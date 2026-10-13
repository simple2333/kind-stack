import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 图书封面代理：第三方封面是 http 且域名固定，代理后：
 *  - 避免 HTTPS 页面加载 http 图片被浏览器按混合内容拦截
 *  - 不把第三方地址直接暴露给浏览器
 *
 * 仅允许代理 isbn.xiaoxi.ac.cn 的 /images/ 路径，防 SSRF。
 */
const ALLOWED_HOST = "isbn.xiaoxi.ac.cn";
const ALLOWED_PATH_PREFIX = "/images/";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url") ?? "";
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("invalid url", { status: 400 });
  }
  if (target.hostname !== ALLOWED_HOST || !target.pathname.startsWith(ALLOWED_PATH_PREFIX)) {
    return new Response("forbidden", { status: 403 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (!upstream.ok) return new Response("upstream error", { status: 502 });
    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    const buf = await upstream.arrayBuffer();
    return new Response(buf, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800",
      },
    });
  } catch {
    return new Response("fetch failed", { status: 502 });
  }
}
