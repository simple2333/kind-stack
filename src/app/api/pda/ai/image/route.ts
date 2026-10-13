import { requireApiStaff, apiErrorResponse } from "@/lib/api-auth";
import { parseEntryImage } from "@/lib/ai";

export const dynamic = "force-dynamic";

/** PDA AI 拍照入库识别：base64 图片 → 物品列表。 */
export async function POST(req: Request) {
  try {
    await requireApiStaff();
    let body: { image?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ ok: false, message: "请求体格式错误" }, { status: 400 });
    }
    // 允许带 data:image/...;base64, 前缀，统一剥离
    let image = (body.image ?? "").trim();
    const comma = image.indexOf(",");
    if (image.startsWith("data:") && comma !== -1) image = image.slice(comma + 1);
    if (!image) return Response.json({ ok: false, message: "未收到图片" }, { status: 400 });
    // base64 长度上限约 8MB（前端已压缩）
    if (image.length > 8 * 1024 * 1024) {
      return Response.json({ ok: false, message: "图片过大，请重新拍摄" }, { status: 413 });
    }
    try {
      const items = await parseEntryImage(image);
      if (items.length === 0) return Response.json({ ok: false, message: "未能识别出物品，请重新拍摄" }, { status: 400 });
      return Response.json({ ok: true, items, message: `识别到 ${items.length} 件物品` });
    } catch (e) {
      return Response.json({ ok: false, message: e instanceof Error ? e.message : "AI 解析失败" }, { status: 502 });
    }
  } catch (e) {
    return apiErrorResponse(e);
  }
}
