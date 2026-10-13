import { db } from "@/db";
import { loginLog } from "@/db/schema";
import { desc, and, sql, type SQL } from "drizzle-orm";

export interface LoginLogFilter {
  limit?: number;
  offset?: number;
  status?: number;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
}

function buildLoginConds(f: LoginLogFilter): SQL[] {
  const conds: SQL[] = [];
  if (f.status != null) conds.push(sql`${loginLog.status} = ${f.status}`);
  if (f.q) {
    const likeVal = `%${f.q}%`;
    conds.push(
      sql`(${loginLog.loginName} LIKE ${likeVal} OR ${loginLog.ipaddr} LIKE ${likeVal} OR ${loginLog.msg} LIKE ${likeVal})`
    );
  }
  if (f.dateFrom) conds.push(sql`${loginLog.loginTime} >= ${`${f.dateFrom}T00:00:00`}`);
  if (f.dateTo) conds.push(sql`${loginLog.loginTime} <= ${`${f.dateTo}T23:59:59`}`);
  return conds;
}

export interface LoginLogInput {
  loginName?: string;
  ipaddr?: string;
  browser?: string;
  os?: string;
  status: 0 | 1; // 0成功 1失败
  msg?: string;
}

/** 写入一条登录日志（参照若依 sys_logininfor） */
export async function writeLoginLog(input: LoginLogInput) {
  await db.insert(loginLog).values({
    loginName: input.loginName ?? null,
    ipaddr: input.ipaddr ?? null,
    loginLocation: null,
    browser: input.browser ?? null,
    os: input.os ?? null,
    status: input.status,
    msg: input.msg ?? null,
    loginTime: new Date().toISOString(),
  });
}

/** 从 UA 解析浏览器/系统 */
export function parseUA(ua: string): { browser: string; os: string } {
  let browser = "未知";
  let os = "未知";
  if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = "Chrome";
  else if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Safari\//.test(ua)) browser = "Safari";
  else if (/MicroMessenger/.test(ua)) browser = "微信内置浏览器";
  if (/Windows/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad/.test(ua)) os = "iOS";
  else if (/Linux/.test(ua)) os = "Linux";
  return { browser, os };
}

/** 查询登录日志 */
export async function listLoginLogs(filter?: LoginLogFilter) {
  const conds = buildLoginConds(filter ?? {});
  const rows = await db
    .select()
    .from(loginLog)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(loginLog.id))
    .limit(filter?.limit ?? 50)
    .offset(filter?.offset ?? 0);
  return rows;
}

export async function countLoginLogs(filter?: Omit<LoginLogFilter, "limit" | "offset">): Promise<number> {
  const conds = buildLoginConds(filter ?? {});
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(loginLog)
    .where(conds.length ? and(...conds) : undefined);
  return rows[0].c;
}