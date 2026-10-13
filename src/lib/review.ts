import { db } from "@/db";
import { donor, donationRequest } from "@/db/schema";
import { eq } from "drizzle-orm";
import { appendLedger } from "@/lib/ledger";
import { createItems } from "@/lib/items";
import { reviewApproveSchema, reviewRejectSchema } from "@/lib/validation";

/**
 * 复核台核心逻辑（无鉴权、无 revalidatePath）。
 *
 * 被两处复用：
 *  - 管理端 Server Action（lib/actions.ts，包 requireUser + withOperLog + revalidatePath）
 *  - PDA REST API（app/api/pda/review/*，包 requireApiUser + apiErrorResponse）
 *
 * 因此这里只做纯业务：校验入参、读写库、记账本，返回结果对象。
 */

export interface ApproveResult {
  ok: boolean;
  message: string;
  codes?: string[];
  batchCode?: string;
}

export interface RejectResult {
  ok: boolean;
  message: string;
}

/** 店长复核通过并入库（支持单条：只通过选中的 items） */
export async function approveDonationRequestCore(input: {
  id: number;
  itemIndexes?: number[];
  items: { name: string; condition?: string; quantity?: number; category?: string; price?: number }[];
}): Promise<ApproveResult> {
  const parsed = reviewApproveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "输入无效" };
  const req = await db.select().from(donationRequest).where(eq(donationRequest.id, parsed.data.id)).limit(1);
  const row = req[0];
  if (!row) return { ok: false, message: "登记不存在" };
  if (row.status !== "pending") return { ok: false, message: "该登记已处理" };

  // 解析现有 items，标记本次通过的项（未传 itemIndexes 则全部通过）。
  // 记录本次新通过的索引 approvedIdx：createItems 只应创建「本次通过」的物品，
  // 否则多次逐个通过同一登记时，会把之前已通过的物品重复创建（且拿不到本轮填的价格）。
  const items = JSON.parse(row.itemsJson) as { name: string; condition?: string; quantity?: number; category?: string; unit?: string; status?: string }[];
  const approvedNames = new Set(parsed.data.items.map((i) => i.name.trim()));
  const idxSet = parsed.data.itemIndexes ? new Set(parsed.data.itemIndexes) : null;
  const approvedIdx: number[] = [];
  items.forEach((it, i) => {
    if ((it.status ?? "pending") === "pending" && (idxSet ? idxSet.has(i) : approvedNames.has(it.name.trim()))) {
      it.status = "approved";
      approvedIdx.push(i);
    }
  });
  if (approvedIdx.length === 0) return { ok: false, message: "没有可通过的物品" };

  // 回执批次码 = 该捐赠登记的批次码（一次登记对应一张回执）；兼容历史无批次时兜底生成
  const batchCode = row.batchCode ?? `JZ-${Date.now().toString(36).toUpperCase().slice(-8)}`;
  // 该批次已建过 donor 则复用（避免同一登记多次通过时重复建 donor）
  const existingDonor = row.batchCode
    ? await db.select().from(donor).where(eq(donor.batchCode, batchCode)).limit(1)
    : [];
  let donorId: number | undefined;
  if (existingDonor[0]) {
    donorId = existingDonor[0].id;
  } else if (row.alias && row.alias.trim()) {
    const ins = await db.insert(donor).values({ alias: row.alias.trim(), batchCode }).returning();
    donorId = ins[0].id;
    await appendLedger("donor", donorId, "donor.created", { alias: row.alias.trim(), batchCode });
  }
  if (row.batchCode !== batchCode) {
    await db.update(donationRequest).set({ batchCode }).where(eq(donationRequest.id, parsed.data.id));
  }
  // 只创建本次新通过的物品（approvedIdx，与 itemsJson 中的索引一一对应），
  // 并应用前端微调后的值（name/condition/category/quantity/price）。
  // 注意：不能按 it.status === "approved" 过滤——那会把之前轮次已通过的物品重复创建。
  const editedByIndex = new Map<number, (typeof parsed.data.items)[number]>();
  parsed.data.items.forEach((p, i) => {
    const targetIdx = idxSet ? [...idxSet][i] : i;
    if (targetIdx != null) editedByIndex.set(targetIdx, p);
  });
  const created = await createItems(
    approvedIdx.map((i) => {
      const it = items[i];
      const edited = editedByIndex.get(i);
      return {
        name: edited?.name ?? it.name,
        condition: edited?.condition ?? it.condition,
        quantity: edited?.quantity ?? it.quantity,
        category: edited?.category ?? it.category,
        price: edited?.price,
        batchCode,
        donorId,
        source: "donate",
      };
    })
  );

  // 更新请求状态：全部处理完则终态
  const allDone = items.every((it) => (it.status ?? "pending") !== "pending");
  const anyApproved = items.some((it) => it.status === "approved");
  await db
    .update(donationRequest)
    .set({
      itemsJson: JSON.stringify(items),
      status: allDone ? (anyApproved ? "approved" : "rejected") : "pending",
      reviewedAt: new Date().toISOString(),
      reviewedBy: "店长",
    })
    .where(eq(donationRequest.id, parsed.data.id));

  return {
    ok: true,
    message: `已入库 ${created.length} 件（回执码 ${batchCode}）`,
    codes: created.map((c) => c.code),
    batchCode,
  };
}

/** 店长复核驳回（支持单条：只驳回选中的 items） */
export async function rejectDonationRequestCore(input: {
  id: number;
  itemIndexes: number[];
  reason?: string;
}): Promise<RejectResult> {
  const parsed = reviewRejectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "输入无效" };
  const req = await db.select().from(donationRequest).where(eq(donationRequest.id, parsed.data.id)).limit(1);
  const row = req[0];
  if (!row) return { ok: false, message: "登记不存在" };
  if (row.status !== "pending") return { ok: false, message: "该登记已处理" };

  const items = JSON.parse(row.itemsJson) as { name: string; condition?: string; quantity?: number; category?: string; unit?: string; status?: string; reason?: string }[];
  const idxSet = new Set(parsed.data.itemIndexes);
  let rejectedCount = 0;
  items.forEach((it, i) => {
    if ((it.status ?? "pending") === "pending" && idxSet.has(i)) {
      it.status = "rejected";
      if (parsed.data.reason) it.reason = parsed.data.reason;
      rejectedCount++;
    }
  });
  if (rejectedCount === 0) return { ok: false, message: "没有可驳回的物品" };

  const allDone = items.every((it) => (it.status ?? "pending") !== "pending");
  const anyApproved = items.some((it) => it.status === "approved");
  await db
    .update(donationRequest)
    .set({
      itemsJson: JSON.stringify(items),
      status: allDone ? (anyApproved ? "approved" : "rejected") : "pending",
      reviewedAt: new Date().toISOString(),
      reviewedBy: "店长",
    })
    .where(eq(donationRequest.id, parsed.data.id));

  return { ok: true, message: parsed.data.reason ? `已驳回 ${rejectedCount} 件：${parsed.data.reason}` : `已驳回 ${rejectedCount} 件` };
}
