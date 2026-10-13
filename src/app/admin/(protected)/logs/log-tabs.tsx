"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const BTYPE_LABEL: Record<number, string> = { 0: "其他", 1: "新增", 2: "修改", 3: "删除", 4: "登录" };
const BTYPE_CLASS: Record<number, string> = {
  0: "bg-slate-100 text-slate-700 border-slate-200",
  1: "bg-green-100 text-green-800 border-green-200",
  2: "bg-blue-100 text-blue-800 border-blue-200",
  3: "bg-red-100 text-red-800 border-red-200",
  4: "bg-purple-100 text-purple-800 border-purple-200",
};

interface LogRow {
  id: number;
  businessType?: number | null;
  title?: string | null;
  method?: string | null;
  operName?: string | null;
  operIp?: string | null;
  operUrl?: string | null;
  operParam?: string | null;
  jsonResult?: string | null;
  status: number;
  costTime?: number | null;
  errorMsg?: string | null;
  createdAt?: string | null;
  loginName?: string | null;
  browser?: string | null;
  os?: string | null;
  ipaddr?: string | null;
  msg?: string | null;
  loginTime?: string | null;
}

function pretty(v?: string | null): string {
  if (!v) return "（空）";
  try {
    return JSON.stringify(JSON.parse(v), null, 2);
  } catch {
    return v;
  }
}

function OperDetail({ row, onClose }: { row: LogRow; onClose: () => void }) {
  const fields: [string, string][] = [
    ["标题", row.title ?? ""],
    ["业务类型", BTYPE_LABEL[row.businessType ?? 0] ?? "其他"],
    ["方法", row.method ?? ""],
    ["操作人", row.operName ?? ""],
    ["IP", row.operIp ?? ""],
    ["路径", row.operUrl ?? ""],
    ["状态", row.status === 0 ? "成功" : "异常"],
    ["耗时", row.costTime != null ? `${row.costTime}ms` : ""],
    ["时间", row.createdAt ? new Date(row.createdAt).toLocaleString("zh-CN") : ""],
  ];
  return (
    <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>操作日志详情 #{row.id}</DialogTitle>
        <DialogDescription>脱敏后的入参 / 返回结果，供排查与审计。</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1">
        {fields.map(([k, v]) => (
          <div key={k} className="flex items-start gap-2 text-sm">
            <span className="text-muted-foreground w-16 shrink-0">{k}：</span>
            <span className="break-all">{v}</span>
          </div>
        ))}
        {row.errorMsg && (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <span className="w-16 shrink-0">错误：</span>
            <span className="break-all">{row.errorMsg}</span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1">入参（脱敏 JSON）</p>
          <pre className="text-xs bg-muted p-2 rounded-md overflow-auto max-h-40 whitespace-pre-wrap break-all">{pretty(row.operParam)}</pre>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">返回结果（JSON）</p>
          <pre className="text-xs bg-muted p-2 rounded-md overflow-auto max-h-40 whitespace-pre-wrap break-all">{pretty(row.jsonResult)}</pre>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          关闭
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default function LogTabs({
  tab,
  ops,
  logins,
}: {
  tab: "oper" | "login";
  ops: LogRow[];
  logins: LogRow[];
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<LogRow | null>(null);

  return (
    <>
      <Tabs
        value={tab}
        onValueChange={(v) => router.push(`/admin/logs?tab=${v === "login" ? "login" : "oper"}`)}
      >
        <TabsList>
          <TabsTrigger value="oper">操作日志（{ops.length}）</TabsTrigger>
          <TabsTrigger value="login">登录日志（{logins.length}）</TabsTrigger>
        </TabsList>

        <TabsContent value="oper" className="flex flex-col divide-y mt-2">
          {ops.length === 0 && (
            <div className="py-10 text-center flex flex-col items-center gap-1">
              <p className="text-muted-foreground">暂无符合条件的操作日志</p>
              <p className="text-xs text-muted-foreground/70">执行入库、定价、流转等操作后，这里会自动记录</p>
            </div>
          )}
          {ops.map((l) => (
            <div key={l.id} className="py-2 flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <Badge className={BTYPE_CLASS[l.businessType ?? 0] ?? "bg-slate-100 text-slate-700 border-slate-200"}>
                  {BTYPE_LABEL[l.businessType ?? 0] ?? "其他"}
                </Badge>
                <span className="font-medium">{l.title}</span>
                <span className="text-muted-foreground truncate">{l.operName}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge className={l.status === 0 ? "bg-green-100 text-green-800 border-green-200" : "bg-red-100 text-red-800 border-red-200"}>
                  {l.status === 0 ? "成功" : "异常"}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {l.costTime != null ? `${l.costTime}ms` : ""}
                </span>
                <span className="text-muted-foreground text-xs">
                  {l.createdAt ? new Date(l.createdAt).toLocaleString("zh-CN") : ""}
                </span>
                <Button variant="outline" size="sm" onClick={() => setDetail(l)}>
                  详情
                </Button>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="login" className="flex flex-col divide-y mt-2">
          {logins.length === 0 && (
            <div className="py-10 text-center flex flex-col items-center gap-1">
              <p className="text-muted-foreground">暂无符合条件的登录日志</p>
              <p className="text-xs text-muted-foreground/70">每次登录成功或失败都会在这里留下记录</p>
            </div>
          )}
          {logins.map((l) => (
            <div key={l.id} className="py-2 flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <Badge className={l.status === 0 ? "bg-green-100 text-green-800 border-green-200" : "bg-red-100 text-red-800 border-red-200"}>
                  {l.status === 0 ? "成功" : "失败"}
                </Badge>
                <span className="font-medium">{l.loginName}</span>
                <span className="text-muted-foreground truncate">
                  {l.browser} · {l.os}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-muted-foreground text-xs">{l.ipaddr}</span>
                <span className="text-muted-foreground text-xs">{l.msg}</span>
                <span className="text-muted-foreground text-xs">
                  {l.loginTime ? new Date(l.loginTime).toLocaleString("zh-CN") : ""}
                </span>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      {detail && (
        <Dialog open onOpenChange={(v) => !v && setDetail(null)}>
          <OperDetail row={detail} onClose={() => setDetail(null)} />
        </Dialog>
      )}
    </>
  );
}