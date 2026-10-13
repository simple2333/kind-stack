import { createItems } from "@/lib/items";
import { manualEntrySchema } from "@/lib/validation";

/**
 * 收件台手动录入核心逻辑（无鉴权、无 revalidatePath），供管理端 action 与 PDA API 复用。
 * 手动录入不再生成捐赠批次/回执；「来源」（如闲鱼/小红书）写入 item.origin。
 * 兼容 PDA 旧入参 alias（映射到 origin）。
 */
export async function createItemsManualCore(input: {
  origin?: string;
  alias?: string;
  items: { name: string; condition?: string; quantity?: number; category?: string; price?: number }[];
}): Promise<{ ok: boolean; message: string; codes: string[] }> {
  const parsed = manualEntrySchema.safeParse({ origin: input.origin ?? input.alias, items: input.items });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "输入无效", codes: [] };

  const { origin, items } = parsed.data;
  const created = await createItems(items.map((i) => ({ ...i, origin, source: "manual" })));
  return {
    ok: true,
    message: `已手动入库 ${created.length} 件`,
    codes: created.map((c) => c.code),
  };
}
