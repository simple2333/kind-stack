import { requireApiOwner, apiErrorResponse } from "@/lib/api-auth";
import { approveDonationRequestCore } from "@/lib/review";

export const dynamic = "force-dynamic";

/** PDA 复核通过并入库（仅店长）。body 同管理端 approveDonationRequest。 */
export async function POST(req: Request) {
  try {
    await requireApiOwner();
    let body: {
      id?: number;
      itemIndexes?: number[];
      items?: { name: string; condition?: string; quantity?: number; category?: string; price?: number }[];
    };
    try {
      body = await req.json();
    } catch {
      return Response.json({ ok: false, message: "请求体格式错误" }, { status: 400 });
    }
    if (typeof body.id !== "number" || !Array.isArray(body.items)) {
      return Response.json({ ok: false, message: "参数错误：需要 id 与 items" }, { status: 400 });
    }
    const result = await approveDonationRequestCore({
      id: body.id,
      itemIndexes: body.itemIndexes,
      items: body.items,
    });
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
