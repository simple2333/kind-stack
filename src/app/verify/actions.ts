"use server";

import { verifyEntry, verifyChain, getFingerprint } from "@/lib/ledger";

export async function verifyEntryAction(entryId: number): Promise<{
  valid: boolean;
  entry?: { id: number; action: string; hash: string; created_at: string; name?: string; code?: string };
}> {
  const r = await verifyEntry(entryId);
  let name: string | undefined;
  let code: string | undefined;
  if (r.entry) {
    try {
      const p = JSON.parse(r.entry.payload) as Record<string, unknown>;
      if (typeof p.name === "string") name = p.name;
      if (typeof p.code === "string") code = p.code;
    } catch {
      /* 忽略解析失败 */
    }
  }
  return {
    valid: r.valid,
    entry: r.entry
      ? { id: r.entry.id, action: r.entry.action, hash: r.entry.hash, created_at: r.entry.created_at, name, code }
      : undefined,
  };
}

export async function chainStatusAction(): Promise<{ valid: boolean; blocks: number }> {
  const c = await verifyChain();
  return { valid: c.valid, blocks: c.blocks };
}

export async function fingerprintAction(): Promise<{ fingerprint: string }> {
  return { fingerprint: await getFingerprint() };
}