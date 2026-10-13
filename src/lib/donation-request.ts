import { db } from "@/db";
import { donationRequest } from "@/db/schema";
import { desc, and, eq, sql, type SQL } from "drizzle-orm";

export interface DonationRequestRow {
  id: number;
  code: string | null;
  batchCode: string | null;
  userId: string | null;
  alias: string | null;
  location: string | null;
  note: string | null;
  items: { name: string; condition?: string | null; quantity?: number; category?: string | null; unit?: string | null }[];
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export interface DonationRequestFilter {
  status?: string;
  limit?: number;
  offset?: number;
}

/** 复核台按「物品」维度展示：每个物品是独立记录，带自己的状态 */
export interface DonationRequestItem {
  requestId: number;
  requestCode: string | null;
  alias: string | null;
  note: string | null;
  createdAt: string;
  index: number;
  name: string;
  condition?: string | null;
  quantity?: number;
  category?: string | null;
  unit?: string | null;
  status: string; // pending / approved / rejected
}

function buildConds(f: DonationRequestFilter): SQL[] {
  const conds: SQL[] = [];
  if (f.status && f.status !== "all") conds.push(sql`${donationRequest.status} = ${f.status}`);
  return conds;
}

export async function listDonationRequests(filter?: DonationRequestFilter): Promise<DonationRequestRow[]> {
  const conds = buildConds(filter ?? {});
  const rows = await db
    .select()
    .from(donationRequest)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(donationRequest.id))
    .limit(filter?.limit ?? 100)
    .offset(filter?.offset ?? 0);
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    batchCode: r.batchCode,
    userId: r.userId,
    alias: r.alias,
    location: r.location,
    note: r.note,
    items: JSON.parse(r.itemsJson) as DonationRequestRow["items"],
    status: r.status,
    createdAt: r.createdAt,
    reviewedAt: r.reviewedAt,
    reviewedBy: r.reviewedBy,
  }));
}

export async function countDonationRequests(status?: string): Promise<number> {
  const conds = status && status !== "all" ? [sql`${donationRequest.status} = ${status}`] : [];
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(donationRequest)
    .where(conds.length ? and(...conds) : undefined);
  return rows[0].c;
}

/** 捐赠人个人中心：按登录用户查自己的捐赠登记（含状态与回执码） */
export async function listDonationRequestsByUser(userId: string, limit = 50): Promise<DonationRequestRow[]> {
  const rows = await db
    .select()
    .from(donationRequest)
    .where(eq(donationRequest.userId, userId))
    .orderBy(desc(donationRequest.id))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    batchCode: r.batchCode,
    userId: r.userId,
    alias: r.alias,
    location: r.location,
    note: r.note,
    items: JSON.parse(r.itemsJson) as DonationRequestRow["items"],
    status: r.status,
    createdAt: r.createdAt,
    reviewedAt: r.reviewedAt,
    reviewedBy: r.reviewedBy,
  }));
}

/** 复核台：按物品状态过滤，返回物品级记录（含所属登记信息） */
export async function listDonationRequestItems(filter?: DonationRequestFilter): Promise<DonationRequestItem[]> {
  const rows = await db
    .select()
    .from(donationRequest)
    .orderBy(desc(donationRequest.id))
    .limit(filter?.limit ?? 100)
    .offset(filter?.offset ?? 0);
  const out: DonationRequestItem[] = [];
  for (const r of rows) {
    const items = JSON.parse(r.itemsJson) as {
      name: string;
      condition?: string | null;
      quantity?: number;
      category?: string | null;
      unit?: string | null;
      status?: string;
    }[];
    items.forEach((it, index) => {
      const st = it.status ?? "pending";
      if (filter?.status && filter.status !== "all" && st !== filter.status) return;
      out.push({
        requestId: r.id,
        requestCode: r.code,
        alias: r.alias,
        note: r.note,
        createdAt: r.createdAt,
        index,
        name: it.name,
        condition: it.condition ?? null,
        quantity: it.quantity,
        category: it.category ?? null,
        unit: it.unit ?? null,
        status: st,
      });
    });
  }
  return out;
}

/** 复核台：按物品状态统计数量（用于分页） */
export async function countDonationRequestItems(status?: string): Promise<number> {
  const rows = await db.select().from(donationRequest).orderBy(desc(donationRequest.id));
  let count = 0;
  for (const r of rows) {
    const items = JSON.parse(r.itemsJson) as { status?: string }[];
    for (const it of items) {
      const st = it.status ?? "pending";
      if (!status || status === "all" || st === status) count++;
    }
  }
  return count;
}

/** 打码台-回执登记：一次捐赠登记对应一张回执（含通过 + 被驳回物品）。 */
export interface ReceiptRegistration {
  id: number;
  batchCode: string;
  alias: string | null;
  note: string | null;
  createdAt: string;
  itemCount: number;
  approvedCount: number;
  rejectedCount: number;
  items: { name: string; quantity?: number; status: string; reason?: string | null }[];
}

export interface ReceiptRegistrationFilter {
  batch?: string;
  alias?: string;
  itemName?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

function matchReg(f: ReceiptRegistrationFilter, r: ReceiptRegistration): boolean {
  if (f.batch && !r.batchCode.toLowerCase().includes(f.batch.trim().toLowerCase())) return false;
  if (f.alias && !(r.alias ?? "").toLowerCase().includes(f.alias.trim().toLowerCase())) return false;
  if (f.itemName) {
    const kw = f.itemName.trim().toLowerCase();
    if (!r.items.some((it) => it.name.toLowerCase().includes(kw))) return false;
  }
  if (f.dateFrom && r.createdAt < `${f.dateFrom}T00:00:00`) return false;
  if (f.dateTo && r.createdAt > `${f.dateTo}T23:59:59`) return false;
  return true;
}

function toReceiptRegistration(r: DonationRequestRow): ReceiptRegistration {
  const items = r.items.map((it) => ({
    name: it.name,
    quantity: it.quantity,
    status: (it as { status?: string }).status ?? "pending",
    reason: (it as { reason?: string | null }).reason ?? null,
  }));
  return {
    id: r.id,
    batchCode: r.batchCode ?? "",
    alias: r.alias ?? "匿名捐赠",
    note: r.note,
    createdAt: r.createdAt,
    itemCount: items.length,
    approvedCount: items.filter((i) => i.status === "approved").length,
    rejectedCount: items.filter((i) => i.status === "rejected").length,
    items,
  };
}

export async function listReceiptRegistrations(filter?: ReceiptRegistrationFilter): Promise<ReceiptRegistration[]> {
  const rows = await db.select().from(donationRequest).orderBy(desc(donationRequest.id));
  const all = rows
    .map((r) => ({
      id: r.id,
      code: r.code,
      batchCode: r.batchCode,
      userId: r.userId,
      alias: r.alias,
      location: r.location,
      note: r.note,
      items: JSON.parse(r.itemsJson) as DonationRequestRow["items"],
      status: r.status,
      createdAt: r.createdAt,
      reviewedAt: r.reviewedAt,
      reviewedBy: r.reviewedBy,
    }))
    .filter((r) => r.batchCode)
    .map(toReceiptRegistration);
  const f = filter ?? {};
  const filtered = all.filter((r) => matchReg(f, r));
  const offset = f.offset ?? 0;
  const limit = f.limit ?? filtered.length;
  return filtered.slice(offset, offset + limit);
}

export async function countReceiptRegistrations(filter?: Omit<ReceiptRegistrationFilter, "limit" | "offset">): Promise<number> {
  const rows = await db.select().from(donationRequest);
  const all = rows
    .map((r) => ({
      id: r.id,
      code: r.code,
      batchCode: r.batchCode,
      userId: r.userId,
      alias: r.alias,
      location: r.location,
      note: r.note,
      items: JSON.parse(r.itemsJson) as DonationRequestRow["items"],
      status: r.status,
      createdAt: r.createdAt,
      reviewedAt: r.reviewedAt,
      reviewedBy: r.reviewedBy,
    }))
    .filter((r) => r.batchCode)
    .map(toReceiptRegistration);
  return all.filter((r) => matchReg(filter ?? {}, r)).length;
}

/** 公开端：待复核登记（只暴露 化名/物品/数量/时间/登记号，不含 location/note） */
export async function listPendingPublic(limit = 8): Promise<
  { code: string | null; alias: string | null; items: { name: string; quantity?: number }[]; createdAt: string }[]
> {
  const rows = await db
    .select()
    .from(donationRequest)
    .where(sql`${donationRequest.status} = 'pending'`)
    .orderBy(desc(donationRequest.id))
    .limit(limit);
  return rows.map((r) => ({
    code: r.code,
    alias: r.alias,
    items: (JSON.parse(r.itemsJson) as { name: string; quantity?: number }[]).map((i) => ({
      name: i.name,
      quantity: i.quantity,
    })),
    createdAt: r.createdAt,
  }));
}