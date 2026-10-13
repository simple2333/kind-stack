import { requireApiStaff, apiErrorResponse } from "@/lib/api-auth";
import { listDonationRequestItems, countDonationRequestItems } from "@/lib/donation-request";
import { pdaReviewQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** PDA 复核台：待复核/已通过/已驳回的物品列表（按物品维度）。 */
export async function GET(req: Request) {
  try {
    await requireApiStaff();
    const url = new URL(req.url);
    const parsed = pdaReviewQuerySchema.safeParse({
      status: url.searchParams.get("status") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      size: url.searchParams.get("size") ?? undefined,
    });
    if (!parsed.success) {
      return Response.json({ ok: false, message: parsed.error.issues[0]?.message ?? "参数错误" }, { status: 400 });
    }
    const status = parsed.data.status ?? "pending";
    const page = parsed.data.page ?? 1;
    const size = parsed.data.size ?? 20;
    const [items, total] = await Promise.all([
      listDonationRequestItems({ status, limit: size, offset: (page - 1) * size }),
      countDonationRequestItems(status),
    ]);
    return Response.json({ ok: true, items, total, page, size });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
