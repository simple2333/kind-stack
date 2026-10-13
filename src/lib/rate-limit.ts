/**
 * 简易内存限流（公开匿名接口用，如 /donate 提交、受赠人反馈）。
 * 服务器重启即重置，够用即可；生产可换 Redis。
 */
const hits = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const rec = hits.get(key);
  if (!rec || now > rec.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (rec.count >= max) return false;
  rec.count += 1;
  return true;
}

/** 读取请求 IP（在 async 上下文调用）：x-forwarded-for → x-real-ip → cf-connecting-ip → local */
export async function requestIp(): Promise<string> {
  const { headers } = await import("next/headers");
  const hdrs = await headers();
  const fwd = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = hdrs.get("x-real-ip");
  const cf = hdrs.get("cf-connecting-ip");
  let ip = fwd || real || cf || "local";
  if (ip.startsWith("::ffff:")) ip = ip.slice(7); // 去掉 IPv4 映射前缀
  return ip;
}