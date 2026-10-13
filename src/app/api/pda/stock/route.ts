import { requireApiStaff, apiErrorResponse } from "@/lib/api-auth";
import { listItems, countItems } from "@/lib/items";
import { toPdaItem } from "@/lib/pda-item";
import { pdaStockQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** PDA 货架查询：搜索/状态/分类/来源/日期筛选 + 分页。 */
export async function GET(req: Request) {
  try {
    await requireApiStaff();
    const url = new URL(req.url);
    const parsed = pdaStockQuerySchema.safeParse({
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      origin: url.searchParams.get("origin") ?? undefined,
      dateFrom: url.searchParams.get("dateFrom") ?? undefined,
      dateTo: url.searchParams.get("dateTo") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      size: url.searchParams.get("size") ?? undefined,
    });
    if (!parsed.success) {
      return Response.json({ ok: false, message: parsed.error.issues[0]?.message ?? "参数错误" }, { status: 400 });
    }
    const { q, status, category, origin, dateFrom, dateTo } = parsed.data;
    const page = parsed.data.page ?? 1;
    const size = parsed.data.size ?? 20;
    // 分类按「大类/小类/大类-小类」模糊匹配（选大分类可含其全部小分类），与网页端筛选一致
    const filter = { q, status, categoryText: category, origin, dateFrom, dateTo };
    const [rows, total] = await Promise.all([
      listItems({ ...filter, limit: size, offset: (page - 1) * size }),
      countItems(filter),
    ]);
    const items = rows.map(toPdaItem);
    return Response.json({ ok: true, items, total, page, size });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
