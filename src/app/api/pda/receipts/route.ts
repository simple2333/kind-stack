import { requireApiStaff, apiErrorResponse } from "@/lib/api-auth";
import { listReceiptRegistrations } from "@/lib/donation-request";
import { getStoreName } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** PDA 回执登记列表（标签打印用，按批次）。附带店名供回执标签「店名」取设置值。 */
export async function GET(req: Request) {
  try {
    await requireApiStaff();
    const url = new URL(req.url);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("size")) || 50));
    const [receipts, storeName] = await Promise.all([
      listReceiptRegistrations({
        batch: url.searchParams.get("batch") ?? undefined,
        alias: url.searchParams.get("alias") ?? undefined,
        limit,
      }),
      getStoreName(),
    ]);
    return Response.json({
      ok: true,
      storeName,
      receipts: receipts.map((r) => ({
        id: r.id,
        batchCode: r.batchCode,
        alias: r.alias,
        createdAt: r.createdAt,
        approvedCount: r.approvedCount,
        rejectedCount: r.rejectedCount,
        items: r.items,
      })),
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
