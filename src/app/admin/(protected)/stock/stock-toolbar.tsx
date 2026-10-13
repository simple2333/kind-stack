"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { exportItemsXlsx } from "@/lib/actions";
import { downloadFromExportAction } from "@/lib/client-download";
import { statusLabel, STATUS_OPTIONS } from "@/lib/item-types";
import type { CategoryNode } from "@/lib/category";

/** 分字段筛选：编号 / 品名 / 分类 / 来源 / 状态 / 入库日期 */
export default function StockToolbar({ count, tree }: { count: number; tree: CategoryNode[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState(params.get("code") ?? "");
  const [name, setName] = useState(params.get("name") ?? "");
  const [categoryText, setCategoryText] = useState(params.get("cat") ?? "");
  const [origin, setOrigin] = useState(params.get("origin") ?? "");
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");
  const [isPending, startTransition] = useTransition();

  const status = params.get("status") ?? "";

  function navigate(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    sp.delete("page");
    router.push(`/admin/stock?${sp.toString()}`);
  }

  function apply() {
    navigate({
      code: code.trim(),
      name: name.trim(),
      cat: categoryText.trim(),
      origin: origin.trim(),
      from,
      to,
    });
  }

  function reset() {
    setCode("");
    setName("");
    setCategoryText("");
    setOrigin("");
    setFrom("");
    setTo("");
    router.push("/admin/stock");
  }

  /** 点分类树里的小分类名，填入分类筛选框（可手输，也可点选） */
  function pickCategory(v: string) {
    setCategoryText(v);
  }

  function handleExport() {
    startTransition(async () => {
      const res = await exportItemsXlsx({
        code: code.trim() || undefined,
        name: name.trim() || undefined,
        categoryText: categoryText.trim() || undefined,
        origin: origin.trim() || undefined,
        status: status || undefined,
        dateFrom: from || undefined,
        dateTo: to || undefined,
      });
      await downloadFromExportAction(res);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 flex-wrap items-end">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">物品编号</span>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="YZ-2026…" className="w-44 font-mono" aria-label="按编号筛选" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">品名</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：马克杯" className="w-48" aria-label="按品名筛选" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">分类（可手输）</span>
          <Input
            value={categoryText}
            onChange={(e) => setCategoryText(e.target.value)}
            placeholder="大分类 / 小分类 / 大类-小类"
            className="w-56"
            aria-label="按分类筛选"
            list="stock-category-options"
          />
          <datalist id="stock-category-options">
            {tree.map((t) => (
              <option key={`m${t.id}`} value={t.name} />
            ))}
            {tree.flatMap((t) =>
              t.children.map((c) => <option key={`c${c.id}`} value={`${t.name}-${c.name}`} />)
            )}
          </datalist>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">来源</span>
          <Input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="如：闲鱼" className="w-36" aria-label="按来源筛选" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">入库起</span>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" aria-label="开始日期" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">入库止</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" aria-label="结束日期" />
        </div>
        <Button onClick={apply} disabled={isPending}>筛选</Button>
        <Button variant="outline" onClick={reset} disabled={isPending}>重置</Button>
        <Button variant="secondary" onClick={handleExport} disabled={isPending}>
          {isPending ? "导出中…" : "导出 Excel"}
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">共 {count} 件</span>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex gap-1 flex-wrap items-center">
          <span className="text-xs text-muted-foreground">状态：</span>
          <Button size="sm" variant={!status ? "default" : "outline"} onClick={() => navigate({ status: "" })}>
            全部
          </Button>
          {STATUS_OPTIONS.map((s) => (
            <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => navigate({ status: status === s ? "" : s })}>
              {statusLabel(s)}
            </Button>
          ))}
        </div>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground select-none">点选分类（可选）</summary>
        <div className="flex gap-1 flex-wrap items-center mt-2">
          {tree.map((t) => (
            <span key={t.id} className="flex items-center gap-0.5 border rounded-md px-1 py-0.5">
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => pickCategory(t.name)} title="筛选该大分类">
                {t.name}
              </Button>
              {t.children.map((c) => (
                <Button
                  key={c.id}
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => pickCategory(`${t.name}-${c.name}`)}
                  title={`筛选 ${t.name}-${c.name}`}
                >
                  {c.name}
                </Button>
              ))}
            </span>
          ))}
          {tree.length === 0 && <span className="text-xs text-muted-foreground">暂无分类</span>}
        </div>
      </details>
    </div>
  );
}
