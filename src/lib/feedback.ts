import { db } from "@/db";
import { feedback } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export interface FeedbackRow {
  id: number;
  item_id: number;
  content: string;
  rating: number | null;
  contact: string | null;
  created_at: string;
}

export async function listFeedback(itemId: number): Promise<FeedbackRow[]> {
  const rows = await db
    .select()
    .from(feedback)
    .where(eq(feedback.itemId, itemId))
    .orderBy(desc(feedback.id));
  return rows.map((r) => ({
    id: r.id,
    item_id: r.itemId,
    content: r.content,
    rating: r.rating,
    contact: r.contact,
    created_at: r.createdAt,
  }));
}