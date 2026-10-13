import { requireApiStaff, apiErrorResponse } from "@/lib/api-auth";
import { updateStatus, getByCode, remainingQty } from "@/lib/items";
import { sellItem } from "@/lib/sales";
import { pdaStatusSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** PDA 扫码流转：售出/转赠/自留/报废，支持部分出库（qty）。 */
export async function POST(req: Request) {
  try {
    await requireApiStaff();
    let body: { code?: string; status?: string; qty?: number };
    try {
      body = await req.json();
    } catch {
      return Response.json({ ok: false, message: "请求体格式错误" }, { status: 400 });
    }
    const parsed = pdaStatusSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ ok: false, message: parsed.error.issues[0]?.message ?? "参数错误" }, { status: 400 });
    }
    try {
      // 售出与网页端一致：走销售单（可在销售记录页整单/单件撤销）；
      // 转赠/自留/报废不涉及金额，直接流转。
      const updated =
        parsed.data.status === "sold"
          ? (await sellItemReturning(parsed.data.code, parsed.data.qty))
          : await updateStatus(parsed.data.code, parsed.data.status, parsed.data.qty);
      return Response.json({
        ok: true,
        message: `已更新为「${parsed.data.status}」`,
        item: {
          code: updated.code,
          name: updated.name,
          status: updated.status,
          remaining: remainingQty(updated),
        },
      });
    } catch (e) {
      return Response.json({ ok: false, message: e instanceof Error ? e.message : "更新失败" }, { status: 400 });
    }
  } catch (e) {
    return apiErrorResponse(e);
  }
}

/** 售出：生成销售单后返回最新物品（sellItem 只写库不返回行）。 */
async function sellItemReturning(code: string, qty?: number) {
  await sellItem(code, qty);
  const item = await getByCode(code);
  if (!item) throw new Error(`物品不存在: ${code}`);
  return item;
}
