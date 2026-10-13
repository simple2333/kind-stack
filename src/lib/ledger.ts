import { createHash } from "node:crypto";
import { db } from "@/db";
import { ledger } from "@/db/schema";
import { desc, asc, and, eq, isNull, sql } from "drizzle-orm";
import { ledgerActionLabel } from "./ledger-actions";

export { ledgerActionLabel };

export interface LedgerEntry {
  id: number;
  prev_hash: string;
  hash: string;
  ref_type: string;
  ref_id: number | null;
  action: string;
  payload: string;
  created_at: string;
}

export type LedgerAction =
  | "item.received"
  | "item.priced"
  | "item.shelved"
  | "item.sold"
  | "item.given"
  | "item.kept"
  | "item.damaged"
  | "item.voided"
  | "item.updated"
  | "item.feedback"
  | "item.sale_reverted"
  | "donor.created"
  | "batch.created"
  | "sale.created"
  | "sale.reverted"
  | "fund.published";

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function canonicalize(refType: string, refId: number | null, action: string, payload: string, createdAt: string): string {
  return JSON.stringify({ ref_type: refType, ref_id: refId, action, payload, created_at: createdAt });
}

/** 最新块哈希（事务外读取） */
async function getLastHash(): Promise<string> {
  const row = await db
    .select({ hash: ledger.hash })
    .from(ledger)
    .orderBy(desc(ledger.id))
    .limit(1);
  return row[0]?.hash ?? "genesis";
}

/**
 * Append a record to the append-only hash chain.
 * 单条 INSERT 即原子操作，无需显式事务；所有写账本的操作必须走这里。
 * 注意：Drizzle + better-sqlite3 同步驱动不支持异步事务回调，故用单条写入。
 */
export async function appendLedger(
  refType: string,
  refId: number | null,
  action: LedgerAction,
  payload: unknown
): Promise<LedgerEntry> {
  const prev = await getLastHash();
  const createdAt = new Date().toISOString();
  const body = canonicalize(refType, refId, action, JSON.stringify(payload), createdAt);
  const hash = sha256(`${prev}|${body}`);

  const inserted = await db
    .insert(ledger)
    .values({
      prevHash: prev,
      hash,
      refType,
      refId,
      action,
      payload: JSON.stringify(payload),
      createdAt,
    })
    .returning();
  const r = inserted[0];
  return {
    id: r.id,
    prev_hash: r.prevHash,
    hash: r.hash,
    ref_type: r.refType,
    ref_id: r.refId,
    action: r.action,
    payload: r.payload,
    created_at: r.createdAt,
  };
}

/** Latest block hash = public ledger fingerprint. */
export async function getFingerprint(): Promise<string> {
  return getLastHash();
}

/** Full hash chain for an item / batch / donor. */
export async function getHistory(refType: string, refId: number | null): Promise<LedgerEntry[]> {
  const rows = await db
    .select()
    .from(ledger)
    .where(and(eq(ledger.refType, refType), refId === null ? isNull(ledger.refId) : eq(ledger.refId, refId)))
    .orderBy(asc(ledger.id));
  return rows.map((r) => ({
    id: r.id,
    prev_hash: r.prevHash,
    hash: r.hash,
    ref_type: r.refType,
    ref_id: r.refId,
    action: r.action,
    payload: r.payload,
    created_at: r.createdAt,
  }));
}

export async function getLedger(limit = 100, offset = 0): Promise<LedgerEntry[]> {
  const rows = await db.select().from(ledger).orderBy(desc(ledger.id)).limit(limit).offset(offset);
  return rows.map((r) => ({
    id: r.id,
    prev_hash: r.prevHash,
    hash: r.hash,
    ref_type: r.refType,
    ref_id: r.refId,
    action: r.action,
    payload: r.payload,
    created_at: r.createdAt,
  }));
}

/** Verify integrity: replay the whole chain and check hashes + prev links. */
export async function verifyChain(): Promise<{ valid: boolean; blocks: number; lastHash: string }> {
  const rows = await db.select().from(ledger).orderBy(asc(ledger.id));
  let prev = "genesis";
  for (const row of rows) {
    const body = canonicalize(row.refType, row.refId, row.action, row.payload, row.createdAt);
    const expected = sha256(`${prev}|${body}`);
    if (row.hash !== expected || row.prevHash !== prev) {
      return { valid: false, blocks: rows.length, lastHash: row.hash };
    }
    prev = row.hash;
  }
  return { valid: true, blocks: rows.length, lastHash: prev };
}

/** Verify a single record hash from its id. */
export async function verifyEntry(entryId: number): Promise<{ valid: boolean; entry?: LedgerEntry }> {
  const rows = await db.select().from(ledger).where(eq(ledger.id, entryId)).limit(1);
  const row = rows[0];
  if (!row) return { valid: false };
  const body = canonicalize(row.refType, row.refId, row.action, row.payload, row.createdAt);
  const expected = sha256(`${row.prevHash}|${body}`);
  return {
    valid: row.hash === expected,
    entry: {
      id: row.id,
      prev_hash: row.prevHash,
      hash: row.hash,
      ref_type: row.refType,
      ref_id: row.refId,
      action: row.action,
      payload: row.payload,
      created_at: row.createdAt,
    },
  };
}

export const ledgerCount = async () =>
  (await db.select({ c: sql<number>`count(*)` }).from(ledger))[0].c;