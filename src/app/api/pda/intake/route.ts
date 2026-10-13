import { requireApiStaff, apiErrorResponse } from "@/lib/api-auth";
import { createItemsManualCore } from "@/lib/intake";

export const dynamic = "force-dynamic";

/** PDA 手动入库（不依赖 AI）：来源 + 多物品，自动生成一件一码。 */
export async function POST(req: Request) {
  try {
    await requireApiStaff();
    let body: {
      origin?: string;
      alias?: string;
      items?: { name: string; condition?: string; quantity?: number; category?: string; price?: number }[];
    };
    try {
      body = await req.json();
    } catch {
      return Response.json({ ok: false, message: "请求体格式错误" }, { status: 400 });
    }
    const result = await createItemsManualCore({
      origin: body.origin ?? body.alias,
      items: body.items ?? [],
    });
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
