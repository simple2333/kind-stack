import { db } from "@/db";
import { item, saleOrder, saleOrderItem } from "@/db/schema";
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { appendLedger } from "./ledger";
import { getByCode, remainingQty, updateStatus, type ItemStatus } from "./items";

/**
 * 销售单（扫码结算）核心逻辑。
 *
 * - 售出统一通过 `sellItem` / `checkoutSale`，两者都会生成销售单，故可在销售记录页整单/单件撤销。
 * - 转赠/自留/报废不走销售单，直接 updateStatus（不涉及金额，无需撤销）。
 * - 撤销：回滚 sold_qty，若该物品已不再全部出库则还原状态，并记账本 `item.sale_reverted`。
 */

/** 生成销售单号 XS-YYYYMMDD-NNNN（读当天最大序号） */
async function generateOrderNo(): Promise<string> {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const rows = await db
    .select({ orderNo: saleOrder.orderNo })
    .from(saleOrder)
    .where(sql`${saleOrder.orderNo} LIKE ${`XS-${date}-%`}`)
    .orderBy(desc(saleOrder.orderNo))
    .limit(1);
  let seq = 0;
  if (rows[0]) {
    const m = rows[0].orderNo.match(/(\d+)$/);
    if (m) seq = Number(m[1]);
  }
  return `XS-${date}-${String(seq + 1).padStart(4, "0")}`;
}

export interface SaleLineResult {
  orderId: number;
  orderNo: string;
  total: number;
  count: number;
  codes: string[];
}

/**
 * 扫码结算：一批物品统一流转。
 * - status="sold"：生成一张销售单（含多行），可整单撤销
 * - 其它状态：逐件 updateStatus（不生成销售单）
 */
export async function checkoutStatus(
  status: Exclude<ItemStatus, "received" | "on_shelf">,
  entries: { code: string; qty: number }[]
): Promise<{ ok: boolean; message: string; orderNo?: string; total?: number; count?: number }> {
  // 先校验全部物品，避免中途失败造成半单
  const loaded: { code: string; name: string; price: number | null; itemId: number; prevStatus: string; qty: number }[] = [];
  for (const e of entries) {
    const it = await getByCode(e.code);
    if (!it) return { ok: false, message: `物品不存在：${e.code}` };
    const remaining = remainingQty(it);
    if (remaining <= 0) return { ok: false, message: `「${it.name}」已无剩余可出库` };
    const qty = Math.min(Math.max(1, Math.floor(e.qty)), remaining);
    loaded.push({ code: it.code, name: it.name, price: it.price, itemId: it.id, prevStatus: it.status, qty });
  }

  if (status !== "sold") {
    for (const l of loaded) {
      await updateStatus(l.code, status, l.qty);
    }
    const count = loaded.reduce((s, l) => s + l.qty, 0);
    return { ok: true, message: `已处理 ${count} 件`, count };
  }

  const orderNo = await generateOrderNo();
  const total = loaded.reduce((s, l) => s + (l.price ?? 0) * l.qty, 0);
  const count = loaded.reduce((s, l) => s + l.qty, 0);
  const inserted = await db
    .insert(saleOrder)
    .values({ orderNo, totalAmount: total, itemCount: count, status: "completed" })
    .returning();
  const orderId = inserted[0].id;

  for (const l of loaded) {
    await updateStatus(l.code, "sold", l.qty);
    await db.insert(saleOrderItem).values({
      orderId,
      itemId: l.itemId,
      code: l.code,
      name: l.name,
      qty: l.qty,
      price: l.price ?? null,
      prevStatus: l.prevStatus,
      status: "sold",
    });
  }
  await appendLedger("sale", orderId, "sale.created", { orderNo, total, count, codes: loaded.map((l) => l.code) });

  return { ok: true, message: `已售出 ${count} 件，合计 ¥${total.toFixed(2)}`, orderNo, total, count };
}

/** 单件售出（货架编辑等入口）：整件或指定数量，生成一张只含一行的销售单。 */
export async function sellItem(code: string, qty?: number): Promise<void> {
  const it = await getByCode(code);
  if (!it) throw new Error(`物品不存在: ${code}`);
  const n = qty == null ? remainingQty(it) : Math.min(Math.max(1, Math.floor(qty)), remainingQty(it));
  const res = await checkoutStatus("sold", [{ code, qty: n }]);
  if (!res.ok) throw new Error(res.message);
}

/** 撤销一条销售明细：回滚 sold_qty，必要时还原物品状态 */
async function revertLine(line: {
  id: number;
  itemId: number;
  code: string;
  name: string;
  qty: number;
  prevStatus: string;
}): Promise<boolean> {
  const rows = await db.select().from(item).where(eq(item.id, line.itemId)).limit(1);
  const it = rows[0];
  if (!it) return false;
  const newSold = Math.max(0, it.soldQty - line.qty);
  const totalOut = newSold + it.givenQty + it.keptQty + it.damagedQty;
  const restore = totalOut < it.quantity && it.status === "sold";
  await db
    .update(item)
    .set({
      soldQty: newSold,
      status: restore ? line.prevStatus : it.status,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(item.id, it.id));
  await db
    .update(saleOrderItem)
    .set({ status: "canceled", canceledAt: new Date().toISOString() })
    .where(eq(saleOrderItem.id, line.id));
  await appendLedger("item", it.id, "item.sale_reverted", {
    code: it.code,
    name: it.name,
    qty: line.qty,
    status: restore ? line.prevStatus : it.status,
  });
  return true;
}

/** 售出撤销：整单（orderId）或单件（orderItemIds） */
export async function revertSale(input: {
  orderId?: number;
  orderItemIds?: number[];
  reason?: string;
}): Promise<{ ok: boolean; message: string; reverted: number }> {
  const conds: SQL[] = [eq(saleOrderItem.status, "sold")];
  if (input.orderId != null) conds.push(eq(saleOrderItem.orderId, input.orderId));
  if (input.orderItemIds && input.orderItemIds.length) conds.push(inArray(saleOrderItem.id, input.orderItemIds));
  const lines = await db
    .select()
    .from(saleOrderItem)
    .where(and(...conds));
  if (lines.length === 0) return { ok: false, message: "没有可撤销的销售记录", reverted: 0 };

  let reverted = 0;
  for (const l of lines) {
    if (await revertLine(l)) reverted += l.qty;
  }

  // 整单全部撤销则把销售单标记为已撤销
  const orderIds = [...new Set(lines.map((l) => l.orderId))];
  for (const oid of orderIds) {
    const rest = await db
      .select({ c: sql<number>`count(*)` })
      .from(saleOrderItem)
      .where(and(eq(saleOrderItem.orderId, oid), eq(saleOrderItem.status, "sold")));
    if (rest[0].c === 0) {
      await db
        .update(saleOrder)
        .set({ status: "canceled", canceledAt: new Date().toISOString() })
        .where(eq(saleOrder.id, oid));
      await appendLedger("sale", oid, "sale.reverted", { reason: input.reason ?? null, reverted });
    }
  }

  return { ok: true, message: `已撤销 ${reverted} 件售出`, reverted };
}

export interface SaleOrderRow {
  id: number;
  orderNo: string;
  totalAmount: number;
  itemCount: number;
  status: string;
  createdAt: string;
  canceledAt: string | null;
  lines: {
    id: number;
    code: string;
    name: string;
    qty: number;
    price: number | null;
    status: string;
  }[];
}

/** 销售记录列表（含明细），供管理端销售记录页 */
export async function listSaleOrders(limit = 50, offset = 0): Promise<SaleOrderRow[]> {
  const orders = await db
    .select()
    .from(saleOrder)
    .orderBy(desc(saleOrder.id))
    .limit(limit)
    .offset(offset);
  if (orders.length === 0) return [];
  const ids = orders.map((o) => o.id);
  const lines = await db
    .select()
    .from(saleOrderItem)
    .where(inArray(saleOrderItem.orderId, ids))
    .orderBy(saleOrderItem.id);
  const byOrder = new Map<number, SaleOrderRow["lines"]>();
  for (const l of lines) {
    const arr = byOrder.get(l.orderId) ?? [];
    arr.push({ id: l.id, code: l.code, name: l.name, qty: l.qty, price: l.price, status: l.status });
    byOrder.set(l.orderId, arr);
  }
  return orders.map((o) => ({
    id: o.id,
    orderNo: o.orderNo,
    totalAmount: o.totalAmount,
    itemCount: o.itemCount,
    status: o.status,
    createdAt: o.createdAt,
    canceledAt: o.canceledAt,
    lines: byOrder.get(o.id) ?? [],
  }));
}

export async function countSaleOrders(): Promise<number> {
  const rows = await db.select({ c: sql<number>`count(*)` }).from(saleOrder);
  return rows[0].c;
}
