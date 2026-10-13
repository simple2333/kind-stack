"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { exportOperLogsXlsx, exportLoginLogsXlsx } from "@/lib/actions";
import { downloadFromExportAction } from "@/lib/client-download";

export default function LogFilter({ tab }: { tab: "oper" | "login" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");
  const [isPending, startTransition] = useTransition();

  function apply() {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (status) sp.set("status", status);
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    sp.set("tab", tab);
    router.push(`/admin/logs?${sp.toString()}`);
  }

  function reset() {
    setQ("");
    setStatus("");
    setFrom("");
    setTo("");
    router.push("/admin/logs?tab=" + tab);
  }

  function handleExport() {
    startTransition(async () => {
      const res =
        tab === "oper"
          ? await exportOperLogsXlsx({ q: q || undefined, status: status ? Number(status) : undefined, dateFrom: from || undefined, dateTo: to || undefined })
          : await exportLoginLogsXlsx({ q: q || undefined, status: status ? Number(status) : undefined, dateFrom: from || undefined, dateTo: to || undefined });
      await downloadFromExportAction(res);
    });
  }

  return (
    <div className="flex gap-2 flex-wrap items-center">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === "oper" ? "搜索标题 / 方法 / 操作人" : "搜索账号 / IP / 信息"} className="max-w-60" />
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="rounded-md border bg-background px-2 py-1.5 text-sm"
        aria-label="状态筛选"
      >
        <option value="">全部状态</option>
        <option value="0">成功</option>
        <option value="1">异常/失败</option>
      </select>
      <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" aria-label="开始日期" />
      <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" aria-label="结束日期" />
      <Button onClick={apply} disabled={isPending}>筛选</Button>
      <Button variant="outline" onClick={reset} disabled={isPending}>重置</Button>
      <Button variant="secondary" onClick={handleExport} disabled={isPending}>
        {isPending ? "导出中…" : "导出 Excel"}
      </Button>
    </div>
  );
}