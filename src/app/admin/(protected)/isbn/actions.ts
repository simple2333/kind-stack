"use server";

import { requireUser } from "@/lib/session";
import { searchIsbn, type IsbnResult } from "@/lib/isbn";

/** 网页端 ISBN 图书查询（需登录）。 */
export async function searchIsbnAction(isbn: string): Promise<IsbnResult> {
  await requireUser();
  const value = String(isbn ?? "").trim();
  if (!value) return { ok: false, message: "请输入 ISBN" };
  return searchIsbn(value);
}
