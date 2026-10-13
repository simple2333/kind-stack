import { db } from "@/db";
import { item } from "@/db/schema";
import { eq } from "drizzle-orm";
import { appendLedger } from "@/lib/ledger";
import { getByCode, updateStatus, setPrice, type ItemStatus } from "@/lib/items";
import { sellItem } from "@/lib/sales";
import { parseCategoryPath, ensureCategoryPath } from "@/lib/category";
import { updateItemSchema } from "@/lib/validation";

/**
 * 货架编辑核心逻辑（无鉴权、无 revalidatePath），供管理端 action 与 PDA API 复用。
 * 状态→item.<status>（售出走销售单，可撤销），价格→item.priced，其余→item.updated；
 * 「来源」写入 item.origin（兼容 PDA 旧入参 donorAlias）。
 */
export async function saveItemEditCore(
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
): Promise<{ ok: boolean; message: string }> {
  const parsed = updateItemSchema.safeParse({ code, ...patch });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "输入无效" };
  const data = parsed.data;
  const itemRow = await getByCode(data.code);
  if (!itemRow) return { ok: false, message: "物品不存在" };
  const origin = data.origin ?? data.donorAlias;
  try {
    if (data.status && data.status !== itemRow.status) {
      if (data.status === "sold") {
        await sellItem(data.code);
      } else {
        await updateStatus(data.code, data.status);
      }
    }
    if (data.price != null && data.price !== itemRow.price) {
      await setPrice(data.code, data.price);
    }
    const hasFieldChange =
      (data.name != null && data.name !== itemRow.name) ||
      (data.condition != null && data.condition !== itemRow.condition) ||
      (data.category != null && data.category !== itemRow.category) ||
      (data.quantity != null && data.quantity !== itemRow.quantity) ||
      (origin != null && origin !== itemRow.origin);
    if (hasFieldChange) {
      // 分类变动时同步拆出大/小分类，并确保分类树中存在该路径
      let major = itemRow.category_major;
      let minor = itemRow.category_minor;
      if (data.category != null && data.category !== itemRow.category) {
        const parsed = parseCategoryPath(data.category);
        if (parsed.major) {
          await ensureCategoryPath(parsed.major, parsed.minor);
          major = parsed.major;
          minor = parsed.minor;
        } else {
          major = null;
          minor = null;
        }
      }
      await db
        .update(item)
        .set({
          name: data.name ?? itemRow.name,
          condition: data.condition ?? itemRow.condition,
          category: data.category ?? itemRow.category,
          categoryMajor: major,
          categoryMinor: minor,
          quantity: data.quantity ?? itemRow.quantity,
          origin: origin ?? itemRow.origin,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(item.id, itemRow.id));
      await appendLedger("item", itemRow.id, "item.updated", {
        code: itemRow.code,
        ...(data.name != null && data.name !== itemRow.name && { name: data.name }),
        ...(data.condition != null && data.condition !== itemRow.condition && { condition: data.condition }),
        ...(data.category != null && data.category !== itemRow.category && { category: data.category }),
        ...(data.quantity != null && data.quantity !== itemRow.quantity && { quantity: data.quantity }),
        ...(origin != null && origin !== itemRow.origin && { origin }),
      });
    }

    return { ok: true, message: "已保存" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "保存失败" };
  }
}

/**
 * 批量修改（货架勾选多件）：分类 / 状态 / 来源。
 * 复用 saveItemEditCore，逐件写入并记账本；单件失败不中断，最后汇总。
 */
export async function bulkUpdateItemsCore(
  codes: string[],
  patch: { category?: string; status?: ItemStatus; origin?: string }
): Promise<{ ok: boolean; message: string; updated: number; failed: number }> {
  if (!codes.length) return { ok: false, message: "没有选择物品", updated: 0, failed: 0 };
  if (!patch.category && !patch.status && !patch.origin) {
    return { ok: false, message: "没有要修改的内容", updated: 0, failed: 0 };
  }
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const code of codes) {
    const res = await saveItemEditCore(code, {
      category: patch.category,
      status: patch.status,
      origin: patch.origin,
    });
    if (res.ok) updated++;
    else {
      failed++;
      if (errors.length < 3) errors.push(`${code}: ${res.message}`);
    }
  }
  const parts = [`已修改 ${updated} 件`];
  if (failed > 0) parts.push(`失败 ${failed} 件（${errors.join("；")}）`);
  return { ok: failed === 0, message: parts.join("，"), updated, failed };
}
