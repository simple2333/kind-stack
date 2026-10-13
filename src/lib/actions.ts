"use server";

import { db } from "@/db";
import { donor, item, feedback, donationRequest } from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { appendLedger } from "@/lib/ledger";
import { createItems, setPrice, updateStatus, listItems, getByCode, type ItemStatus, type Item } from "@/lib/items";
import { listOperLogs } from "@/lib/oper-log";
import { listLoginLogs } from "@/lib/login-log";
import { toDownloadPayload } from "@/lib/export";
import { parseEntryText, parseEntryImage, suggestPrice, type ParsedEntry } from "@/lib/ai";
import { requireUser, getCurrentUser } from "@/lib/session";
import { withOperLog } from "@/lib/oper-log";
import { approveDonationRequestCore, rejectDonationRequestCore } from "@/lib/review";
import { createItemsManualCore } from "@/lib/intake";
import { saveItemEditCore, bulkUpdateItemsCore } from "@/lib/item-edit";
import { checkoutStatus, revertSale } from "@/lib/sales";
import { importItemsFromExcelCore } from "@/lib/excel-import";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";
import { addMajorCategory, addMinorCategory, deleteCategory, listCategories, listCategoryTree, type CategoryNode } from "@/lib/category";
import {
  confirmItemsSchema,
  priceSchema,
  itemStatusSchema,
  donorBatchSchema,
  donationRequestSchema,
  feedbackSchema,
  exportItemsSchema,
  exportOperLogsSchema,
  exportLoginLogsSchema,
  checkoutSchema,
  revertSaleSchema,
  bulkUpdateSchema,
} from "@/lib/validation";
import { revalidatePath } from "next/cache";

export async function submitTextEntry(text: string): Promise<{ ok: boolean; items: ParsedEntry[]; message: string }> {
  await requireUser();
  try {
    const items = await parseEntryText(text);
    if (items.length === 0) return { ok: false, items: [], message: "未能识别出物品，请补充描述" };
    return { ok: true, items, message: `识别到 ${items.length} 件物品` };
  } catch (e) {
    return { ok: false, items: [], message: e instanceof Error ? e.message : "AI 解析失败" };
  }
}

export async function submitImageEntry(base64: string): Promise<{ ok: boolean; items: ParsedEntry[]; message: string }> {
  await requireUser();
  try {
    const items = await parseEntryImage(base64);
    if (items.length === 0) return { ok: false, items: [], message: "未能识别出物品，请重新拍摄" };
    return { ok: true, items, message: `识别到 ${items.length} 件物品` };
  } catch (e) {
    return { ok: false, items: [], message: e instanceof Error ? e.message : "AI 解析失败" };
  }
}

export const confirmItems = withOperLog(
  { title: "物品入库", businessType: 1, method: "confirmItems" },
  async (input: {
    origin?: string;
    entries: { name: string; condition?: string; quantity?: number; category?: string }[];
  }): Promise<{ ok: boolean; message: string; codes: string[] }> => {
    await requireUser();
    const parsed = confirmItemsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "输入无效", codes: [] };

    // 手动/AI 入库不再建捐赠批次：来源直接写入 item.origin
    const created = await createItems(
      parsed.data.entries.map((e) => ({ ...e, origin: parsed.data.origin, source: "manual" }))
    );
    revalidatePath("/admin");
    return { ok: true, message: `已入库 ${created.length} 件`, codes: created.map((c) => c.code) };
  }
);

export const savePrice = withOperLog(
  { title: "物品定价", businessType: 2, method: "savePrice" },
  async (code: string, price: number): Promise<{ ok: boolean; message: string }> => {
    await requireUser();
    const parsed = priceSchema.safeParse({ code, price });
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "输入无效" };
    try {
      await setPrice(parsed.data.code, parsed.data.price);
      revalidatePath("/admin");
      revalidatePath(`/item/${parsed.data.code}`);
      return { ok: true, message: "已保存价格" };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "保存失败" };
    }
  }
);

export async function suggestPriceAction(code: string): Promise<{ ok: boolean; price?: number; reason?: string; message?: string }> {
  await requireUser();
  const { getByCode, averagePriceFor } = await import("@/lib/items");
  const item = await getByCode(code);
  if (!item) return { ok: false, message: "物品不存在" };
  try {
    const avg = await averagePriceFor(item.name);
    const s = await suggestPrice(item.name, item.condition, avg, item.quantity);
    if (!Number.isFinite(s.price) || s.price <= 0) {
      return { ok: false, message: "AI 未给出有效价格，请手动填写" };
    }
    return { ok: true, price: s.price, reason: s.reason };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "定价失败" };
  }
}

export const setItemStatus = withOperLog(
  { title: "物品流转", businessType: 2, method: "setItemStatus" },
  async (code: string, status: ItemStatus, qty?: number): Promise<{ ok: boolean; message: string }> => {
    await requireUser();
    const parsed = itemStatusSchema.safeParse({ code, status, qty });
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "输入无效" };
    try {
      await updateStatus(parsed.data.code, parsed.data.status, parsed.data.qty);
      revalidatePath("/admin");
      revalidatePath(`/item/${parsed.data.code}`);
      return { ok: true, message: `已更新为「${parsed.data.status}」` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "更新失败" };
    }
  }
);

export const createDonorBatch = withOperLog(
  { title: "创建捐赠批次", businessType: 1, method: "createDonorBatch" },
  async (
    alias: string,
    items: { name: string; condition?: string; quantity?: number; category?: string }[]
  ): Promise<{ ok: boolean; message: string; batchCode?: string }> => {
    await requireUser();
    const parsed = donorBatchSchema.safeParse({ alias, items });
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "输入无效" };
    const batchCode = `JZ-${Date.now().toString(36).toUpperCase().slice(-8)}`;
    const inserted = await db
      .insert(donor)
      .values({ alias: parsed.data.alias || "匿名捐赠者", batchCode })
      .returning();
    const donorId = inserted[0].id;
    await appendLedger("donor", donorId, "donor.created", { alias, batchCode });

    const created = await createItems(parsed.data.items.map((i) => ({ ...i, batchCode, donorId, origin: alias })));
    revalidatePath("/admin");
    return { ok: true, message: `已创建批量码 ${batchCode}，入库 ${created.length} 件`, batchCode };
  }
);

/** 收件台手动录入（不依赖 AI），可直接带单价；来源写入 item.origin，不再建捐赠批次。 */
export const createItemsManual = withOperLog(
  { title: "手动入库", businessType: 1, method: "createItemsManual" },
  async (input: {
    origin?: string;
    items: { name: string; condition?: string; quantity?: number; category?: string; price?: number }[];
  }): Promise<{ ok: boolean; message: string; codes: string[] }> => {
    await requireUser();
    const result = await createItemsManualCore(input);
    if (result.ok) revalidatePath("/admin");
    return result;
  }
);

/** 货架编辑（查看/编辑分离）：状态→item.<status>，价格→item.priced，其余→item.updated */
export const saveItemEdit = withOperLog(
  { title: "编辑物品", businessType: 2, method: "saveItemEdit" },
  async (
    code: string,
    patch: {
      name?: string;
      condition?: string;
      category?: string;
      quantity?: number;
      price?: number;
      status?: ItemStatus;
      origin?: string;
      donorAlias?: string;
    }
  ): Promise<{ ok: boolean; message: string }> => {
    await requireUser();
    const result = await saveItemEditCore(code, patch);
    if (result.ok) {
      revalidatePath("/admin/stock");
      revalidatePath(`/item/${code}`);
    }
    return result;
  }
);

/** 货架批量修改：勾选多件统一改分类 / 状态 / 来源，逐件记账本 */
export const bulkUpdateItems = withOperLog(
  { title: "批量修改物品", businessType: 2, method: "bulkUpdateItems" },
  async (
    codes: string[],
    patch: { category?: string; status?: ItemStatus; origin?: string }
  ): Promise<{ ok: boolean; message: string; updated: number; failed: number }> => {
    await requireUser();
    const parsed = bulkUpdateSchema.safeParse({ codes, ...patch });
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "输入无效", updated: 0, failed: 0 };
    const result = await bulkUpdateItemsCore(parsed.data.codes, {
      category: parsed.data.category,
      status: parsed.data.status,
      origin: parsed.data.origin,
    });
    if (result.updated > 0) {
      revalidatePath("/admin/stock");
      revalidatePath("/admin");
    }
    return result;
  }
);

// ============================================================
// 捐赠人自助登记 / 复核（快递站式）
// ============================================================

/** 捐赠人提交捐赠意向（需登录），进待复核队列 */
export async function submitDonationRequest(input: {
  alias?: string;
  note?: string;
  items: { name: string; condition?: string; quantity?: number; category?: string; unit?: string }[];
}): Promise<{ ok: boolean; message: string; id?: number; code?: string; batchCode?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "请先登录后再登记捐赠" };
  const parsed = donationRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "输入无效" };
  const ip = await requestIp();
  if (!checkRateLimit(`donate:${ip}`, 3, 60_000)) return { ok: false, message: "提交太频繁，请稍后再试" };
  const code = `DJ-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  const batchCode = `JZ-${Date.now().toString(36).toUpperCase().slice(-8)}`;
  const alias = parsed.data.alias?.trim() || user.displayName || user.name || null;
  const inserted = await db
    .insert(donationRequest)
    .values({
      code,
      batchCode,
      userId: user.id,
      alias,
      note: parsed.data.note ?? null,
      itemsJson: JSON.stringify(parsed.data.items),
      status: "pending",
    })
    .returning();
  return { ok: true, message: "提交成功！请把物品放到收银台/前台，店员复核后正式入库", id: inserted[0].id, code, batchCode };
}

/** 店长复核通过并入库（支持单条：只通过选中的 items）。核心逻辑见 lib/review.ts。 */
export const approveDonationRequest = withOperLog(
  { title: "复核通过并入库", businessType: 1, method: "approveDonationRequest" },
  async (input: {
    id: number;
    itemIndexes?: number[];
    items: { name: string; condition?: string; quantity?: number; category?: string; price?: number }[];
  }): Promise<{ ok: boolean; message: string; codes?: string[]; batchCode?: string }> => {
    await requireUser();
    const result = await approveDonationRequestCore(input);
    if (result.ok) {
      revalidatePath("/admin/review");
      revalidatePath("/admin");
    }
    return result;
  }
);

/** 店长复核驳回（支持单条：只驳回选中的 items）。核心逻辑见 lib/review.ts。 */
export const rejectDonationRequest = withOperLog(
  { title: "复核驳回", businessType: 3, method: "rejectDonationRequest" },
  async (input: { id: number; itemIndexes: number[]; reason?: string }): Promise<{ ok: boolean; message: string }> => {
    await requireUser();
    const result = await rejectDonationRequestCore(input);
    if (result.ok) revalidatePath("/admin/review");
    return result;
  }
);

// ============================================================
// 分类管理（两级树：大分类 / 小分类）
// ============================================================

export const addMajorCategoryAction = withOperLog(
  { title: "新增大分类", businessType: 1, method: "addMajorCategoryAction" },
  async (name: string): Promise<{ ok: boolean; message: string; id?: number }> => {
    await requireUser();
    return addMajorCategory(name);
  }
);

export const addMinorCategoryAction = withOperLog(
  { title: "新增小分类", businessType: 1, method: "addMinorCategoryAction" },
  async (parentId: number, name: string): Promise<{ ok: boolean; message: string; id?: number }> => {
    await requireUser();
    return addMinorCategory(parentId, name);
  }
);

export const deleteCategoryAction = withOperLog(
  { title: "删除分类", businessType: 3, method: "deleteCategoryAction" },
  async (id: number): Promise<{ ok: boolean; message: string }> => {
    await requireUser();
    return deleteCategory(id);
  }
);

/** 读取两级分类树（设置页/筛选下拉） */
export async function listCategoryTreeAction(): Promise<{ ok: boolean; tree: CategoryNode[] }> {
  const tree = await listCategoryTree();
  return { ok: true, tree };
}

/** 读取扁平分类列表（兼容旧消费者，供各表单下拉使用） */
export async function listCategoriesAction(): Promise<{ ok: boolean; categories: { id: number; name: string }[] }> {
  const rows = await listCategories();
  return { ok: true, categories: rows.map((r) => ({ id: r.id, name: r.name })) };
}

/** 公开读取分类列表（捐赠表单用，无需登录） */
export async function listPublicCategoriesAction(): Promise<{ ok: boolean; categories: { id: number; name: string }[] }> {
  const rows = await listCategories();
  return { ok: true, categories: rows.map((r) => ({ id: r.id, name: r.name })) };
}

// ============================================================
// 受赠人反馈（公开匿名，存库 + 记入哈希链）
// ============================================================

export async function submitFeedback(
  itemId: number,
  input: { content: string; rating?: number; contact?: string }
): Promise<{ ok: boolean; message: string }> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "输入无效" };
  const target = (await db.select().from(item).where(eq(item.id, itemId)).limit(1))[0];
  if (!target) return { ok: false, message: "物品不存在" };
  if (target.status !== "sold" && target.status !== "given") {
    return { ok: false, message: "该物品尚未售出/转赠，暂不能填写反馈" };
  }

  const ip = await requestIp();
  if (!checkRateLimit(`fb:${ip}`, 5, 60_000)) return { ok: false, message: "提交太频繁，请稍后再试" };

  // 每件物品反馈上限 10 条，防接口暴力刷入
  const cnt = await db
    .select({ c: sql<number>`count(*)` })
    .from(feedback)
    .where(eq(feedback.itemId, itemId));
  if (cnt[0].c >= 10) return { ok: false, message: "该物品反馈已达上限，感谢关注" };

  await db.insert(feedback).values({
    itemId,
    content: parsed.data.content,
    rating: parsed.data.rating ?? null,
    contact: parsed.data.contact ?? null,
  });
  await appendLedger("item", itemId, "item.feedback", {
    content: parsed.data.content,
    rating: parsed.data.rating ?? null,
  });
  revalidatePath(`/item/${target.code}`);
  return { ok: true, message: "感谢你的反馈！" };
}

export async function scanLookup(code: string): Promise<{
  ok: boolean;
  message?: string;
  item?: {
    id: number;
    code: string;
    name: string;
    price: number | null;
    status: string;
    condition: string;
    category: string;
    quantity: number;
    remaining: number;
    sold_qty: number;
    given_qty: number;
    kept_qty: number;
    damaged_qty: number;
  };
}> {
  await requireUser();
  if (!/^YZ-\d{8}-\d{4}$/.test(code)) return { ok: false, message: "编号格式不正确，请扫描「一件一码」标签" };
  const it = await getByCode(code);
  if (!it) return { ok: false, message: "未找到该物品" };
  return {
    ok: true,
    item: {
      id: it.id,
      code: it.code,
      name: it.name,
      price: it.price,
      status: it.status,
      condition: it.condition ?? "",
      category: it.category ?? "",
      quantity: it.quantity,
      remaining: it.quantity - (it.sold_qty + it.given_qty + it.kept_qty + it.damaged_qty),
      sold_qty: it.sold_qty,
      given_qty: it.given_qty,
      kept_qty: it.kept_qty,
      damaged_qty: it.damaged_qty,
    },
  };
}

// ============================================================
// 扫码结算 / 售出撤销 / Excel 批量导入
// ============================================================
/** 扫码结算：一批物品统一流转（售出生成销售单，可撤销） */
export const checkoutItems = withOperLog(
  { title: "扫码结算", businessType: 2, method: "checkoutItems" },
  async (input: {
    status: "sold" | "given" | "kept" | "damaged";
    entries: { code: string; qty: number }[];
  }): Promise<{ ok: boolean; message: string; orderNo?: string; total?: number; count?: number }> => {
    await requireUser();
    const parsed = checkoutSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "输入无效" };
    const res = await checkoutStatus(parsed.data.status, parsed.data.entries);
    if (res.ok) {
      revalidatePath("/admin");
      revalidatePath("/admin/stock");
      revalidatePath("/admin/sales");
    }
    return res;
  }
);

/** 售出撤销：整单或单件 */
export const revertSaleAction = withOperLog(
  { title: "售出撤销", businessType: 2, method: "revertSaleAction" },
  async (input: {
    orderId?: number;
    orderItemIds?: number[];
    reason?: string;
  }): Promise<{ ok: boolean; message: string; reverted: number }> => {
    await requireUser();
    const parsed = revertSaleSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "输入无效", reverted: 0 };
    const res = await revertSale(parsed.data);
    if (res.ok) {
      revalidatePath("/admin/stock");
      revalidatePath("/admin/sales");
      revalidatePath("/admin");
    }
    return res;
  }
);

/** Excel 批量导入：服务端解析文件（避免 xlsx 打进客户端 bundle），返回预览行 */
export async function parseExcelImport(base64: string, fileName?: string) {
  await requireUser();
  const { parseExcelBuffer } = await import("@/lib/excel-import");
  return parseExcelBuffer(base64, fileName);
}

/** Excel 批量导入（只处理「物资入库」行，按闲鱼订单号去重） */
export const importItemsExcel = withOperLog(
  { title: "Excel 批量导入", businessType: 1, method: "importItemsExcel" },
  async (input: {
    defaultOrigin?: string;
    rows: {
      externalNo?: string;
      name: string;
      category?: string;
      price?: number;
      photo?: string;
      handledType?: string;
      orderedAt?: string;
    }[];
  }) => {
    await requireUser();
    const res = await importItemsFromExcelCore(input);
    if (res.ok) {
      revalidatePath("/admin");
      revalidatePath("/admin/stock");
      revalidatePath("/admin/settings");
    }
    return res;
  }
);

// ============================================================
// 导出（只读操作，不记操作日志）
// ============================================================

const ITEM_STATUS_LABEL: Record<string, string> = {
  received: "入库",
  on_shelf: "上架",
  sold: "售出",
  given: "转赠",
  kept: "自留",
  damaged: "报废",
};
const BTYPE_LABEL: Record<number, string> = { 0: "其他", 1: "新增", 2: "修改", 3: "删除", 4: "登录" };
const SOURCE_LABEL: Record<string, string> = {
  manual: "店员录入",
  donate: "用户自助捐赠",
  import: "Excel 导入",
  ai: "AI 识别",
};

async function exportItemsPayload(filter: {
  q?: string;
  name?: string;
  code?: string;
  origin?: string;
  categoryText?: string;
  status?: ItemStatus;
  category?: string;
  categoryMajor?: string;
  categoryMinor?: string;
  dateFrom?: string;
  dateTo?: string;
  codes?: string[];
}): Promise<{ data: string; filename: string }> {
  let filtered: Item[];
  if (filter.codes && filter.codes.length > 0) {
    const rows = await db.select().from(item).where(inArray(item.code, filter.codes)).orderBy(item.id);
    filtered = rows.map((r) => ({
      id: r.id,
      code: r.code,
      batch_code: r.batchCode,
      donor_id: r.donorId,
      name: r.name,
      category: r.category,
      category_major: r.categoryMajor ?? null,
      category_minor: r.categoryMinor ?? null,
      condition: r.condition,
      quantity: r.quantity,
      sold_qty: r.soldQty,
      given_qty: r.givenQty,
      kept_qty: r.keptQty,
      damaged_qty: r.damagedQty,
      unit: r.unit ?? "件",
      description: r.description,
      price: r.price,
      photo: null,
      photo_thumb: null,
      status: r.status as ItemStatus,
      note: r.note,
      source: r.source ?? "manual",
      origin: r.origin ?? null,
      external_no: r.externalNo ?? null,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    }));
  } else {
    filtered = await listItems({ ...filter, limit: 5000 });
  }
  const out = filtered.map((r) => ({
    编号: r.code,
    品名: r.name,
    大分类: r.category_major ?? "",
    小分类: r.category_minor ?? "",
    分类: r.category ?? "",
    成色: r.condition ?? "",
    数量: r.quantity,
    已售出: r.sold_qty,
    已转赠: r.given_qty,
    自留: r.kept_qty,
    报废: r.damaged_qty,
    剩余: r.quantity - (r.sold_qty + r.given_qty + r.kept_qty + r.damaged_qty),
    "单价(元)": r.price ?? "",
    状态: ITEM_STATUS_LABEL[r.status] ?? r.status,
    物品来源: r.origin ?? "",
    录入方式: SOURCE_LABEL[r.source] ?? r.source,
    外部单号: r.external_no ?? "",
    批量码: r.batch_code ?? "",
    备注: r.note ?? "",
    入库时间: r.created_at ? new Date(r.created_at).toLocaleString("zh-CN") : "",
    更新时间: r.updated_at ? new Date(r.updated_at).toLocaleString("zh-CN") : "",
  }));
  return toDownloadPayload("货架", out, `益栈-货架-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function exportItemsXlsx(input: {
  q?: string;
  name?: string;
  code?: string;
  origin?: string;
  categoryText?: string;
  status?: string;
  category?: string;
  categoryMajor?: string;
  categoryMinor?: string;
  dateFrom?: string;
  dateTo?: string;
  codes?: string[];
}): Promise<{ ok: boolean; data?: string; filename?: string; message?: string }> {
  await requireUser();
  const parsed = exportItemsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "输入无效" };
  try {
    const payload = await exportItemsPayload(parsed.data);
    return { ok: true, ...payload };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "导出失败" };
  }
}

export async function exportOperLogsXlsx(input: {
  q?: string;
  status?: number;
  dateFrom?: string;
  dateTo?: string;
}): Promise<{ ok: boolean; data?: string; filename?: string; message?: string }> {
  await requireUser();
  const parsed = exportOperLogsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "输入无效" };
  try {
    const logs = await listOperLogs({ ...parsed.data, limit: 5000 });
    const out = logs.map((l) => ({
      类型: BTYPE_LABEL[l.businessType] ?? "其他",
      标题: l.title ?? "",
      方法: l.method ?? "",
      操作人: l.operName ?? "",
      IP: l.operIp ?? "",
      参数: l.operParam ?? "",
      结果: l.jsonResult ?? "",
      状态: l.status === 0 ? "成功" : "异常",
      错误: l.errorMsg ?? "",
      "耗时(ms)": l.costTime ?? "",
      时间: l.createdAt ? new Date(l.createdAt).toLocaleString("zh-CN") : "",
    }));
    return { ok: true, ...toDownloadPayload("操作日志", out, `益栈-操作日志-${new Date().toISOString().slice(0, 10)}.xlsx`) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "导出失败" };
  }
}

export async function exportLoginLogsXlsx(input: {
  q?: string;
  status?: number;
  dateFrom?: string;
  dateTo?: string;
}): Promise<{ ok: boolean; data?: string; filename?: string; message?: string }> {
  await requireUser();
  const parsed = exportLoginLogsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "输入无效" };
  try {
    const logs = await listLoginLogs({ ...parsed.data, limit: 5000 });
    const out = logs.map((l) => ({
      账号: l.loginName ?? "",
      IP: l.ipaddr ?? "",
      浏览器: l.browser ?? "",
      系统: l.os ?? "",
      状态: l.status === 0 ? "成功" : "失败",
      信息: l.msg ?? "",
      时间: l.loginTime ? new Date(l.loginTime).toLocaleString("zh-CN") : "",
    }));
    return { ok: true, ...toDownloadPayload("登录日志", out, `益栈-登录日志-${new Date().toISOString().slice(0, 10)}.xlsx`) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "导出失败" };
  }
}