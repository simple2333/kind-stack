import { db } from "@/db";
import { settings, store } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getSetting(key: string): Promise<string | null> {
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

export async function getStoreName(): Promise<string> {
  const rows = await db.select().from(store).where(eq(store.id, 1)).limit(1);
  return rows[0]?.name ?? "示例二手慈善商店";
}