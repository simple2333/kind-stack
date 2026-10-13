import { requireApiStaff, apiErrorResponse } from "@/lib/api-auth";
import { saveItemEditCore } from "@/lib/item-edit";
import { getByCode } from "@/lib/items";
import { toPdaItem } from "@/lib/pda-item";
import type { ItemStatus } from "@/lib/items";

export const dynamic = "force-dynamic";

/** PDA 货架编辑：修改物品信息（名称/成色/分类/数量/单价/状态/来源），均记账本。 */
export async function POST(req: Request) {
  try {
    await requireApiStaff();
    let body: {
      code?: string;
      name?: string;
      condition?: string;
      category?: string;
      quantity?: number;
      price?: number;
      status?: ItemStatus;
      origin?: string;
      donorAlias?: string;
    };
    try {
      body = await req.json();
    } catch {
      return Response.json({ ok: false, message: "请求体格式错误" }, { status: 400 });
    }
    if (!body.code) {
      return Response.json({ ok: false, message: "缺少物品编号" }, { status: 400 });
    }
    const result = await saveItemEditCore(body.code, {
      name: body.name,
      condition: body.condition,
      category: body.category,
      quantity: body.quantity,
      price: body.price,
      status: body.status,
      origin: body.origin ?? body.donorAlias,
    });
    if (!result.ok) return Response.json(result, { status: 400 });
    const updated = await getByCode(body.code);
    return Response.json({ ...result, item: updated ? toPdaItem(updated) : undefined });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
