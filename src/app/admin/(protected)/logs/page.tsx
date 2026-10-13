import { Suspense } from "react";
import { listOperLogs, countOperLogs } from "@/lib/oper-log";
import { listLoginLogs, countLoginLogs } from "@/lib/login-log";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Pagination from "@/components/pagination";
import LogFilter from "./log-filter";
import LogTabs from "./log-tabs";

export const dynamic = "force-dynamic";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string; q?: string; from?: string; to?: string; page?: string; size?: string }>;
}) {
  const sp = await searchParams;
  const tab = sp.tab === "login" ? "login" : "oper";
  const page = Math.max(1, Number(sp.page) || 1);
  const sizeNum = Number(sp.size);
  const pageSize = PAGE_SIZE_OPTIONS.includes(sizeNum) ? sizeNum : 20;
  const statusNum = Number(sp.status);
  const filter = {
    q: sp.q,
    status: sp.status != null && sp.status !== "" && !Number.isNaN(statusNum) ? statusNum : undefined,
    dateFrom: sp.from,
    dateTo: sp.to,
  };
  const [opsTotal, loginTotal] = await Promise.all([
    countOperLogs(filter),
    countLoginLogs(filter),
  ]);
  const [ops, logins] = await Promise.all([
    listOperLogs({ ...filter, limit: pageSize, offset: (page - 1) * pageSize }),
    listLoginLogs({ ...filter, limit: pageSize, offset: (page - 1) * pageSize }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">系统日志</CardTitle>
          <CardDescription>
            操作日志记录每次库存/账本变更，登录日志记录登录成功与失败，便于后续审计追溯。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3">
            <LogFilter tab={tab} />
          </div>
          <LogTabs tab={tab} ops={ops} logins={logins} />
          <Suspense fallback={null}>
            <Pagination total={tab === "oper" ? opsTotal : loginTotal} pageSize={pageSize} page={page} sizeOptions={PAGE_SIZE_OPTIONS} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}