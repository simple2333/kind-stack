import { requireApiStaff, apiErrorResponse } from "@/lib/api-auth";
import { getLedger, ledgerCount, verifyChain, ledgerActionLabel } from "@/lib/ledger";

export const dynamic = "force-dynamic";

/** PDA 账本查看：分页列表 + 当前指纹（可校验完整性）。 */
export async function GET(req: Request) {
  try {
    await requireApiStaff();
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const size = Math.min(100, Math.max(1, Number(url.searchParams.get("size")) || 20));
    const verify = url.searchParams.get("verify") === "1";

    if (verify) {
      const result = await verifyChain();
      return Response.json({ ok: true, ...result });
    }

    const [rows, total] = await Promise.all([
      getLedger(size, (page - 1) * size),
      ledgerCount(),
    ]);
    return Response.json({
      ok: true,
      total,
      page,
      size,
      entries: rows.map((r) => ({
        id: r.id,
        action: r.action,
        actionLabel: ledgerActionLabel(r.action),
        refType: r.ref_type,
        refId: r.ref_id,
        payload: r.payload,
        hash: r.hash,
        prevHash: r.prev_hash,
        createdAt: r.created_at,
      })),
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
