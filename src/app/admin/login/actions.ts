"use server";

import { writeLoginLog, parseUA } from "@/lib/login-log";
import { requestIp } from "@/lib/rate-limit";

export async function recordLogin(
  email: string,
  status: 0 | 1,
  msg: string
): Promise<{ ok: boolean }> {
  const { headers } = await import("next/headers");
  const hdrs = await headers();
  const ua = hdrs.get("user-agent") ?? "";
  const { browser, os } = parseUA(ua);
  const ip = await requestIp();
  await writeLoginLog({ loginName: email, ipaddr: ip, browser, os, status, msg });
  return { ok: true };
}