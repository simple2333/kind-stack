import { requireApiStaff, apiErrorResponse } from "@/lib/api-auth";
import { searchIsbn } from "@/lib/isbn";
import { pdaIsbnQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** PDA ISBN 图书查询（扫码/手输 ISBN，返回书名/作者/出版社/定价等）。 */
export async function GET(req: Request) {
  try {
    await requireApiStaff();
    const url = new URL(req.url);
    const parsed = pdaIsbnQuerySchema.safeParse({ isbn: url.searchParams.get("isbn") ?? "" });
    if (!parsed.success) {
      return Response.json({ ok: false, message: parsed.error.issues[0]?.message ?? "参数错误" }, { status: 400 });
    }
    const result = await searchIsbn(parsed.data.isbn);
    return Response.json(result, { status: result.ok ? 200 : 404 });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
