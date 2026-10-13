import { db } from "@/db";
import { operLog, type OperBusinessType } from "@/db/schema";
import { desc, and, sql, type SQL } from "drizzle-orm";
import { getSession } from "./session";
import { headers } from "next/headers";
import { requestIp } from "./rate-limit";

export interface OperLogInput {
  title: string;
  businessType: OperBusinessType;
  method: string;
}

export interface OperLogFilter {
  limit?: number;
  offset?: number;
  status?: number;
  operName?: string;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
}

function buildOperConds(f: OperLogFilter): SQL[] {
  const conds: SQL[] = [];
  if (f.status != null) conds.push(sql`${operLog.status} = ${f.status}`);
  if (f.operName) conds.push(sql`${operLog.operName} LIKE ${`%${f.operName}%`}`);
  if (f.q) {
    const likeVal = `%${f.q}%`;
    conds.push(
      sql`(${operLog.title} LIKE ${likeVal} OR ${operLog.method} LIKE ${likeVal} OR ${operLog.operName} LIKE ${likeVal})`
    );
  }
  if (f.dateFrom) conds.push(sql`${operLog.createdAt} >= ${`${f.dateFrom}T00:00:00`}`);
  if (f.dateTo) conds.push(sql`${operLog.createdAt} <= ${`${f.dateTo}T23:59:59`}`);
  return conds;
}

/**
 * 操作日志包裹器（参照若依 sys_oper_log）。
 * 自动记录：操作人、IP、参数（脱敏）、结果、状态、耗时。
 * 用法：withOperLog({ title, businessType, method })(async (params) => {...})
 */
export function withOperLog<T extends unknown[], R>(
  meta: OperLogInput,
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T) => {
    const start = Date.now();
    const session = await getSession();
    const hdrs = await headers();

    const ip = await requestIp();
    const url = hdrs.get("x-invoke-path") ?? "";
    const operName = session?.user?.email ?? "anonymous";

    let status = 0;
    let errorMsg = "";
    let jsonResult = "";
    try {
      const result = await fn(...args);
      jsonResult = safeStringify(result);
      return result;
    } catch (e) {
      status = 1;
      errorMsg = e instanceof Error ? e.message.slice(0, 2000) : String(e);
      throw e;
    } finally {
      const costTime = Date.now() - start;
      await db.insert(operLog).values({
        title: meta.title,
        businessType: meta.businessType,
        method: meta.method,
        requestMethod: "POST",
        operatorType: 1,
        operName,
        operUrl: url,
        operIp: ip,
        operParam: safeStringify(sanitizeParams(args)),
        jsonResult,
        status,
        errorMsg: errorMsg || null,
        costTime,
      });
    }
  };
}

/** 敏感字段脱敏：密码/token/密钥不落日志 */
const SENSITIVE_KEYS = ["password", "token", "secret", "apiKey", "api_key", "authorization", "base64"];

function sanitizeParams(args: unknown[]): unknown {
  return args.map((arg) => {
    if (typeof arg === "string") {
      // 照片 base64 太长，截断
      if (arg.length > 500) return `[data:${arg.length} chars]`;
      return arg;
    }
    if (arg && typeof arg === "object") {
      return JSON.parse(
        JSON.stringify(arg, (key, value) => {
          if (SENSITIVE_KEYS.includes(String(key).toLowerCase())) return "[REDACTED]";
          if (typeof value === "string" && value.length > 500) return `[data:${value.length} chars]`;
          return value;
        })
      );
    }
    return arg;
  });
}

function safeStringify(v: unknown): string {
  try {
    const s = JSON.stringify(v);
    return s && s.length > 2000 ? s.slice(0, 2000) : s ?? "";
  } catch {
    return "";
  }
}

/** 查询操作日志（日志查看页用） */
export async function listOperLogs(filter?: OperLogFilter) {
  const conds = buildOperConds(filter ?? {});
  const rows = await db
    .select()
    .from(operLog)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(operLog.id))
    .limit(filter?.limit ?? 50)
    .offset(filter?.offset ?? 0);
  return rows;
}

export async function countOperLogs(filter?: Omit<OperLogFilter, "limit" | "offset">): Promise<number> {
  const conds = buildOperConds(filter ?? {});
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(operLog)
    .where(conds.length ? and(...conds) : undefined);
  return rows[0].c;
}