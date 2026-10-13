import { db } from "@/db";
import { item, donationRequest } from "@/db/schema";
import { eq } from "drizzle-orm";
import { receiptLookupSchema } from "@/lib/validation";
import { listFeedback } from "@/lib/feedback";

export interface BatchItem {
  id: number;
  code: string;
  name: string;
  status: string;
  price: number | null;
  feedback: { id: number; content: string; rating: number | null; created_at: string }[];
}

export interface RejectedItem {
  name: string;
  quantity?: number;
  reason?: string;
}

export interface BatchLookupData {
  donorAlias: string;
  createdAt: string;
  items: BatchItem[];
  rejected?: RejectedItem[];
}

/**
 * 捐赠回执查询核心逻辑（无鉴权），供公开端 Server Action 与 PDA API 复用。
 * 按「捐赠登记」查询：一次登记对应一张回执（含通过 + 被驳回物品）。
 */
export async function lookupBatchCore(batchCode: string): Promise<{
  ok: boolean;
  message?: string;
  data?: BatchLookupData;
}> {
  const parsed = receiptLookupSchema.safeParse({ batchCode });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "回执码无效" };
  const code = parsed.data.batchCode;

  const reqRows = await db.select().from(donationRequest).where(eq(donationRequest.batchCode, code)).limit(1);
  const req = reqRows[0];
  if (!req) return { ok: false, message: "未找到该回执码" };

  const rows = await db
    .select({ id: item.id, code: item.code, name: item.name, status: item.status, price: item.price })
    .from(item)
    .where(eq(item.batchCode, code))
    .orderBy(item.id);

  const items: BatchItem[] = [];
  for (const r of rows) {
    const fb = await listFeedback(r.id);
    items.push({ ...r, feedback: fb.map((f) => ({ id: f.id, content: f.content, rating: f.rating, created_at: f.created_at })) });
  }

  // 从登记里带出被驳回的物品（未通过），含驳回原因
  let rejected: RejectedItem[] | undefined;
  try {
    const parsedItems = JSON.parse(req.itemsJson) as { name: string; quantity?: number; status?: string; reason?: string }[];
    const rej = parsedItems.filter((i) => i.status === "rejected");
    if (rej.length > 0) {
      rejected = rej.map((i) => ({ name: i.name, quantity: i.quantity, reason: i.reason }));
    }
  } catch {
    /* 忽略解析失败 */
  }

  return {
    ok: true,
    data: {
      donorAlias: req.alias ?? "匿名捐赠者",
      createdAt: req.createdAt,
      items,
      rejected,
    },
  };
}
