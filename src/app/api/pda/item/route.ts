import { requireApiStaff, apiErrorResponse } from "@/lib/api-auth";
import { getByCode } from "@/lib/items";
import { toPdaItem } from "@/lib/pda-item";
import { pdaItemQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** PDA 按「一件一码」查询物品详情（扫码后调用）。 */
export async function GET(req: Request) {
  try {
    await requireApiStaff();
    const url = new URL(req.url);
    const parsed = pdaItemQuerySchema.safeParse({ code: url.searchParams.get("code") ?? "" });
    if (!parsed.success) {
      return Response.json({ ok: false, message: parsed.error.issues[0]?.message ?? "参数错误" }, { status: 400 });
    }
    const item = await getByCode(parsed.data.code);
    if (!item) return Response.json({ ok: false, message: "未找到该物品" }, { status: 404 });
    return Response.json({ ok: true, item: toPdaItem(item) });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
