import { requireApiStaff, apiErrorResponse } from "@/lib/api-auth";
import { listCategories, listCategoryTree } from "@/lib/category";

export const dynamic = "force-dynamic";

/** PDA 读取分类：flat（录入下拉，兼容旧消费者）+ tree（货架两级点选筛选）。 */
export async function GET() {
  try {
    await requireApiStaff();
    const [rows, tree] = await Promise.all([listCategories(), listCategoryTree()]);
    return Response.json({
      ok: true,
      categories: rows.map((r) => ({ id: r.id, name: r.name })),
      tree: tree.map((t) => ({
        id: t.id,
        name: t.name,
        children: t.children.map((c) => ({ id: c.id, name: c.name })),
      })),
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
