import { requireApiStaff, apiErrorResponse } from "@/lib/api-auth";
import { parseEntryText } from "@/lib/ai";

export const dynamic = "force-dynamic";

/** PDA AI 文本入库识别：自然语言描述 → 物品列表。 */
export async function POST(req: Request) {
  try {
    await requireApiStaff();
    let body: { text?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ ok: false, message: "请求体格式错误" }, { status: 400 });
    }
    const text = (body.text ?? "").trim();
    if (!text) return Response.json({ ok: false, message: "请先输入物品描述" }, { status: 400 });
    if (text.length > 500) return Response.json({ ok: false, message: "描述过长" }, { status: 400 });
    try {
      const items = await parseEntryText(text);
      if (items.length === 0) return Response.json({ ok: false, message: "未能识别出物品，请补充描述" }, { status: 400 });
      return Response.json({ ok: true, items, message: `识别到 ${items.length} 件物品` });
    } catch (e) {
      return Response.json({ ok: false, message: e instanceof Error ? e.message : "AI 解析失败" }, { status: 502 });
    }
  } catch (e) {
    return apiErrorResponse(e);
  }
}
