import { requireApiOwner, apiErrorResponse } from "@/lib/api-auth";
import { rejectDonationRequestCore } from "@/lib/review";

export const dynamic = "force-dynamic";

/** PDA 复核驳回（仅店长）。body 同管理端 rejectDonationRequest。 */
export async function POST(req: Request) {
  try {
    await requireApiOwner();
    let body: { id?: number; itemIndexes?: number[]; reason?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ ok: false, message: "请求体格式错误" }, { status: 400 });
    }
    if (typeof body.id !== "number" || !Array.isArray(body.itemIndexes)) {
      return Response.json({ ok: false, message: "参数错误：需要 id 与 itemIndexes" }, { status: 400 });
    }
    const result = await rejectDonationRequestCore({
      id: body.id,
      itemIndexes: body.itemIndexes,
      reason: body.reason,
    });
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
