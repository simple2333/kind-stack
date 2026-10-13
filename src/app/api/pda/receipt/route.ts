import { requireApiStaff, apiErrorResponse } from "@/lib/api-auth";
import { lookupBatchCore } from "@/lib/receipt-lookup";
import { pdaReceiptQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** PDA 捐赠回执查询：扫码/输入回执码，查看该批次物品的流转情况。 */
export async function GET(req: Request) {
  try {
    await requireApiStaff();
    const url = new URL(req.url);
    const parsed = pdaReceiptQuerySchema.safeParse({ batch: url.searchParams.get("batch") ?? "" });
    if (!parsed.success) {
      return Response.json({ ok: false, message: parsed.error.issues[0]?.message ?? "参数错误" }, { status: 400 });
    }
    const result = await lookupBatchCore(parsed.data.batch);
    return Response.json(result, { status: result.ok ? 200 : 404 });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
