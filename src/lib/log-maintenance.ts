import { db } from "@/db";
import { operLog, loginLog } from "@/db/schema";
import { sql } from "drizzle-orm";

/**
 * 日志保留策略：默认保留最近 30 天，超期自动清理。
 * 可被定时任务/启动脚本调用。
 */
export async function cleanExpiredLogs(retentionDays = 30): Promise<{ operRemoved: number; loginRemoved: number }> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  const operResult = await db
    .delete(operLog)
    .where(sql`${operLog.createdAt} < ${cutoff}`)
    .run();
  const loginResult = await db
    .delete(loginLog)
    .where(sql`${loginLog.loginTime} < ${cutoff}`)
    .run();

  return {
    operRemoved: operResult.changes,
    loginRemoved: loginResult.changes,
  };
}