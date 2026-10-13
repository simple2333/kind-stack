import { and, desc, eq, sql, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { item, donor } from "@/db/schema";
import { appendLedger } from "./ledger";
import { parseCategoryPath } from "./category";
import type { Item, ItemStatus } from "./item-types";

export type { Item, ItemStatus };
export { statusLabel, STATUS_OPTIONS } from "./item-types";

/** Drizzle 行（camelCase）→ Item（snake_case），供前端使用 */
function toItem(row: typeof item.$inferSelect): Item {
  return {
    id: row.id,
    code: row.code,
    batch_code: row.batchCode,
    donor_id: row.donorId,
    donor_alias: undefined,
    name: row.name,
    category: row.category,
    category_major: row.categoryMajor ?? null,
    category_minor: row.categoryMinor ?? null,
    condition: row.condition,
    quantity: row.quantity,
    sold_qty: row.soldQty,
    given_qty: row.givenQty,
    kept_qty: row.keptQty,
    damaged_qty: row.damagedQty,
    unit: row.unit ?? "件",
    description: row.description,
    price: row.price,
    photo: null,
    photo_thumb: null,
    status: row.status as ItemStatus,
    note: row.note,
    source: row.source ?? "manual",
    origin: row.origin ?? null,
    external_no: row.externalNo ?? null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

/** Generate a unique one-item-one-code: YZ-YYYYMMDD-NNNN（从 DB 读当天最大序号） */
async function generateCode(): Promise<string> {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}`;

  const rows = await db
    .select({ code: item.code })
    .from(item)
    .where(sql`${item.code} LIKE ${`YZ-${date}-%`}`)
    .orderBy(desc(item.code))
    .limit(1);

  let seq = 0;
  if (rows[0]) {
    const m = rows[0].code.match(/(\d+)$/);
    if (m) seq = Number(m[1]);
  }
  seq += 1;
  return `YZ-${date}-${String(seq).padStart(4, "0")}`;
}

export async function createItems(
  entries: {
    name: string;
    condition?: string;
    quantity?: number;
    category?: string;
    description?: string;
    price?: number;
    batchCode?: string;
    donorId?: number;
    source?: string;
    origin?: string;
    externalNo?: string;
  }[]
): Promise<Item[]> {
  const created: Item[] = [];

  for (const e of entries) {
    const code = await generateCode();
    const { major, minor } = parseCategoryPath(e.category ?? "");
    const inserted = await db
      .insert(item)
      .values({
        code,
        batchCode: e.batchCode ?? null,
        donorId: e.donorId ?? null,
        name: e.name,
        category: e.category ?? null,
        categoryMajor: major || null,
        categoryMinor: minor,
        condition: e.condition ?? null,
        quantity: e.quantity ?? 1,
        unit: "件",
        description: e.description ?? null,
        price: e.price ?? null,
        status: "received",
        source: e.source ?? "manual",
        origin: e.origin ?? null,
        externalNo: e.externalNo ?? null,
      })
      .returning();
    const row = inserted[0];
    await appendLedger("item", row.id, "item.received", {
      code,
      name: e.name,
      quantity: e.quantity ?? 1,
      condition: e.condition ?? null,
      batch: e.batchCode ?? null,
      origin: e.origin ?? null,
    });
    created.push(toItem(row));
  }

  return created;
}

export async function updateStatus(code: string, status: ItemStatus, qty?: number): Promise<Item> {
  const itemRow = await getByCode(code);
  if (!itemRow) throw new Error(`物品不存在: ${code}`);

  const remaining = remainingQty(itemRow);
  const n = qty == null ? remaining : Math.min(Math.max(1, Math.floor(qty)), remaining);
  if (n <= 0) throw new Error(`「${itemRow.name}」已无剩余可出库`);

  const outQty = {
    sold: itemRow.sold_qty,
    given: itemRow.given_qty,
    kept: itemRow.kept_qty,
    damaged: itemRow.damaged_qty,
  } as Record<ItemStatus, number>;
  outQty[status] += n;
  const totalOut = outQty.sold + outQty.given + outQty.kept + outQty.damaged;
  const done = totalOut >= itemRow.quantity;

  await db
    .update(item)
    .set({
      status: done ? status : itemRow.status,
      soldQty: outQty.sold,
      givenQty: outQty.given,
      keptQty: outQty.kept,
      damagedQty: outQty.damaged,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(item.id, itemRow.id));

  await appendLedger("item", itemRow.id, `item.${status}` as never, {
    code: itemRow.code,
    name: itemRow.name,
    price: itemRow.price,
    qty: n,
    remaining: itemRow.quantity - totalOut,
  });

  return (await getById(itemRow.id))!;
}

/** 剩余可出库数量 = 总量 - 各状态已出之和 */
export function remainingQty(item: Pick<Item, "quantity" | "sold_qty" | "given_qty" | "kept_qty" | "damaged_qty">): number {
  return item.quantity - (item.sold_qty + item.given_qty + item.kept_qty + item.damaged_qty);
}

/** 各状态已出数量明细（仅返回 >0 的项） */
export function outQtyBreakdown(item: Pick<Item, "sold_qty" | "given_qty" | "kept_qty" | "damaged_qty">): { status: ItemStatus; qty: number }[] {
  const map: [ItemStatus, number][] = [
    ["sold", item.sold_qty],
    ["given", item.given_qty],
    ["kept", item.kept_qty],
    ["damaged", item.damaged_qty],
  ];
  return map.filter(([, q]) => q > 0).map(([status, qty]) => ({ status, qty }));
}

export async function setPrice(code: string, price: number): Promise<Item> {
  const itemRow = await getByCode(code);
  if (!itemRow) throw new Error(`物品不存在: ${code}`);

  await db.update(item).set({ price, updatedAt: new Date().toISOString() }).where(eq(item.id, itemRow.id));
  await appendLedger("item", itemRow.id, "item.priced", { code: itemRow.code, price });
  return (await getById(itemRow.id))!;
}

export async function getByCode(code: string): Promise<Item | undefined> {
  const rows = await db.select().from(item).where(eq(item.code, code)).limit(1);
  return rows[0] ? toItem(rows[0]) : undefined;
}

export async function getById(id: number): Promise<Item | undefined> {
  const rows = await db.select().from(item).where(eq(item.id, id)).limit(1);
  return rows[0] ? toItem(rows[0]) : undefined;
}

export interface ItemFilter {
  status?: ItemStatus;
  /** 全字段模糊搜索（兼容旧调用）；新界面请用下面的分字段条件 */
  q?: string;
  name?: string;
  code?: string;
  origin?: string;
  /** 分类自由文本（同时匹配大分类 / 小分类 / 完整「大类-小类」） */
  categoryText?: string;
  category?: string;
  categoryMajor?: string;
  categoryMinor?: string;
  donor?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

/** 由筛选条件构造 SQL 条件（列表与计数共用） */
function buildItemConds(filter: Omit<ItemFilter, "limit" | "offset">): SQL[] {
  const conds: SQL[] = [];
  if (filter?.status) conds.push(eq(item.status, filter.status));
  if (filter?.q) {
    const likeVal = `%${filter.q}%`;
    conds.push(
      sql`(${item.name} LIKE ${likeVal} OR ${item.code} LIKE ${likeVal} OR ${item.category} LIKE ${likeVal} OR ${item.origin} LIKE ${likeVal})`
    );
  }
  if (filter?.name) conds.push(sql`${item.name} LIKE ${`%${filter.name}%`}`);
  if (filter?.code) conds.push(sql`${item.code} LIKE ${`%${filter.code}%`}`);
  if (filter?.origin) conds.push(sql`${item.origin} LIKE ${`%${filter.origin}%`}`);
  if (filter?.categoryText) {
    const v = `%${filter.categoryText}%`;
    conds.push(sql`(${item.categoryMajor} LIKE ${v} OR ${item.categoryMinor} LIKE ${v} OR ${item.category} LIKE ${v})`);
  }
  if (filter?.category) conds.push(eq(item.category, filter.category));
  if (filter?.categoryMajor) conds.push(eq(item.categoryMajor, filter.categoryMajor));
  if (filter?.categoryMinor) conds.push(eq(item.categoryMinor, filter.categoryMinor));
  if (filter?.donor) {
    const likeVal = `%${filter.donor}%`;
    conds.push(
      sql`${item.batchCode} IN (SELECT ${donor.batchCode} FROM ${donor} WHERE ${donor.alias} LIKE ${likeVal} OR ${donor.name} LIKE ${likeVal})`
    );
  }
  if (filter?.dateFrom) conds.push(sql`${item.createdAt} >= ${`${filter.dateFrom}T00:00:00`}`);
  if (filter?.dateTo) conds.push(sql`${item.createdAt} <= ${`${filter.dateTo}T23:59:59`}`);
  return conds;
}

export async function listItems(filter?: ItemFilter) {
  const conds = buildItemConds(filter ?? {});
  const where = conds.length ? and(...conds) : undefined;
  const rows = await db
    .select()
    .from(item)
    .where(where)
    .orderBy(desc(item.id))
    .limit(filter?.limit ?? 50)
    .offset(filter?.offset ?? 0);
  const result = rows.map(toItem);
  // 带出捐赠人化名（按批次）
  const batchCodes = [...new Set(result.map((i) => i.batch_code).filter((c): c is string => !!c))];
  if (batchCodes.length) {
    const donors = await db.select().from(donor).where(inArray(donor.batchCode, batchCodes));
    const aliasByCode = new Map(donors.map((d) => [d.batchCode, d.alias ?? d.name]));
    for (const i of result) {
      if (i.batch_code) i.donor_alias = aliasByCode.get(i.batch_code) ?? null;
    }
  }
  return result;
}

export async function countItems(filter?: Omit<ItemFilter, "limit" | "offset">): Promise<number> {
  const conds = buildItemConds(filter ?? {});
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(item)
    .where(conds.length ? and(...conds) : undefined);
  return rows[0].c;
}

/** 同类历史均价（按名称模糊匹配 + 已售出） */
export async function averagePriceFor(name: string): Promise<number | null> {
  const rows = await db
    .select({ avg: sql<number>`avg(${item.price})` })
    .from(item)
    .where(
      and(
        eq(item.status, "sold"),
        sql`${item.price} IS NOT NULL`,
        sql`${item.name} LIKE ${`%${name}%`}`
      )
    );
  return rows[0]?.avg ?? null;
}

export async function stats() {
  const total = await countItems();
  const onShelf = await countItems({ status: "on_shelf" });
  const sold = await countItems({ status: "sold" });
  const given = await countItems({ status: "given" });
  const kept = await countItems({ status: "kept" });
  const damaged = await countItems({ status: "damaged" });
  const received = await countItems({ status: "received" });
  const revenueRow = await db
    .select({ s: sql<number>`coalesce(sum(${item.price}), 0)` })
    .from(item)
    .where(eq(item.status, "sold"));
  return { total, onShelf, sold, given, kept, damaged, received, revenue: revenueRow[0]?.s ?? 0 };
}

export async function getDonorAlias(donorId: number): Promise<string | undefined> {
  const rows = await db
    .select({ alias: donor.alias, name: donor.name })
    .from(donor)
    .where(eq(donor.id, donorId))
    .limit(1);
  return rows[0]?.alias ?? rows[0]?.name ?? undefined;
}

/** 最近捐赠批次列表（捐赠回执标签打印用） */
export async function listBatches(limit = 50): Promise<{ batchCode: string; count: number; createdAt: string; alias?: string }[]> {
  const groups = await db
    .select({
      batchCode: item.batchCode,
      count: sql<number>`count(*)`,
      createdAt: sql<string>`max(${item.createdAt})`,
    })
    .from(item)
    .where(sql`${item.batchCode} IS NOT NULL`)
    .groupBy(item.batchCode)
    .orderBy(desc(sql`max(${item.createdAt})`))
    .limit(limit);
  const codes = groups.map((g) => g.batchCode as string);
  const donors = codes.length
    ? await db.select().from(donor).where(inArray(donor.batchCode, codes))
    : [];
  const aliasByCode = new Map(donors.map((d) => [d.batchCode, d.alias]));
  return groups.map((g) => ({
    batchCode: g.batchCode as string,
    count: g.count,
    createdAt: g.createdAt as string,
    alias: aliasByCode.get(g.batchCode as string) ?? undefined,
  }));
}