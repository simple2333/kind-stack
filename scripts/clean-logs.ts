import { cleanExpiredLogs } from "../src/lib/log-maintenance";

async function main() {
  const days = Number(process.env.LOG_RETENTION_DAYS ?? 30);
  const { operRemoved, loginRemoved } = await cleanExpiredLogs(days);
  console.log(`日志清理完成：操作日志删除 ${operRemoved} 条，登录日志删除 ${loginRemoved} 条（保留 ${days} 天）`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });