"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { exportItemsXlsx } from "@/lib/actions";
import { downloadFromExportAction } from "@/lib/client-download";
import { statusLabel, STATUS_OPTIONS } from "@/lib/item-types";
import type { ReceiptRegistration } from "@/lib/donation-request";
import type { CategoryNode } from "@/lib/category";
import { gridppPrint, loadGrfTemplates, GRIDPP_HINT, type GridppMode } from "@/lib/gridpp-print";
import { toast } from "sonner";

const RECEIPT_PAGE_SIZES = [10, 20, 50];

interface LabelItem {
  id: number;
  code: string;
  name: string;
  price: number | null;
  status: string;
  categoryMajor: string | null;
  categoryMinor: string | null;
  origin: string | null;
}

export default function LabelPrinter({
  items,
  receipts,
  storeName,
  tree,
}: {
  items: LabelItem[];
  receipts: ReceiptRegistration[];
  storeName: string;
  tree: CategoryNode[];
}) {
  const [mode, setMode] = useState<"item" | "receipt">("item");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isPending, startTransition] = useTransition();

  // —— 物品筛选（分字段） ——
  const [fCode, setFCode] = useState("");
  const [fName, setFName] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fCategory, setFCategory] = useState("");
  const [fOrigin, setFOrigin] = useState("");

  // —— 锐浪报表(Grid++)模板 ——
  const [grfTemplates, setGrfTemplates] = useState<string[]>([]);
  const [grfItemTpl, setGrfItemTpl] = useState("");
  const [grfReceiptTpl, setGrfReceiptTpl] = useState("");

  useEffect(() => {
    loadGrfTemplates().then((list) => {
      setGrfTemplates(list);
      setGrfItemTpl(list.find((f) => /item/i.test(f)) ?? list[0] ?? "");
      setGrfReceiptTpl(list.find((f) => /receipt/i.test(f)) ?? list[0] ?? "");
    });
  }, []);

  // —— 回执筛选 ——
  const [fbatch, setFbatch] = useState("");
  const [falias, setFalias] = useState("");
  const [fitem, setFitem] = useState("");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [receiptPage, setReceiptPage] = useState(1);
  const [receiptSize, setReceiptSize] = useState(10);

  const filteredReceipts = useMemo(() => {
    const b = fbatch.trim().toLowerCase();
    const a = falias.trim().toLowerCase();
    const n = fitem.trim().toLowerCase();
    return receipts.filter((r) => {
      if (b && !r.batchCode.toLowerCase().includes(b)) return false;
      if (a && !(r.alias ?? "").toLowerCase().includes(a)) return false;
      if (n && !r.items.some((it) => it.name.toLowerCase().includes(n))) return false;
      if (fFrom && r.createdAt < `${fFrom}T00:00:00`) return false;
      if (fTo && r.createdAt > `${fTo}T23:59:59`) return false;
      return true;
    });
  }, [receipts, fbatch, falias, fitem, fFrom, fTo]);

  const receiptTotalPages = Math.max(1, Math.ceil(filteredReceipts.length / receiptSize));
  const curReceiptPage = Math.min(receiptPage, receiptTotalPages);
  const receiptPageItems = filteredReceipts.slice((curReceiptPage - 1) * receiptSize, curReceiptPage * receiptSize);

  const filtered = useMemo(() => {
    const codeKw = fCode.trim().toLowerCase();
    const nameKw = fName.trim().toLowerCase();
    const catKw = fCategory.trim().toLowerCase();
    const originKw = fOrigin.trim().toLowerCase();
    return items.filter((i) => {
      if (codeKw && !i.code.toLowerCase().includes(codeKw)) return false;
      if (nameKw && !i.name.toLowerCase().includes(nameKw)) return false;
      if (fStatus && i.status !== fStatus) return false;
      if (catKw) {
        const full = [i.categoryMajor, i.categoryMinor].filter(Boolean).join("-").toLowerCase();
        const major = (i.categoryMajor ?? "").toLowerCase();
        const minor = (i.categoryMinor ?? "").toLowerCase();
        if (!(major.includes(catKw) || minor.includes(catKw) || full.includes(catKw))) return false;
      }
      if (originKw && !(i.origin ?? "").toLowerCase().includes(originKw)) return false;
      return true;
    });
  }, [items, fCode, fName, fStatus, fCategory, fOrigin]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const curPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((curPage - 1) * pageSize, curPage * pageSize);

  function toggle(code: string) {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelected(next);
  }

  function selectAll() {
    setSelected(new Set(pageItems.map((i) => i.code)));
  }

  function clearFilters() {
    setFCode("");
    setFName("");
    setFStatus("");
    setFCategory("");
    setFOrigin("");
    setPage(1);
  }

  function pickCategory(v: string) {
    setFCategory(v);
    setPage(1);
  }

  function handleExport() {
    if (selected.size === 0) return;
    startTransition(async () => {
      const res = await exportItemsXlsx({ codes: [...selected] });
      await downloadFromExportAction(res);
    });
  }

  // —— 锐浪打印数据 ——
  const itemRows =
    selected.size > 0
      ? items
          .filter((i) => selected.has(i.code))
          .map((i) => ({
            code: i.code,
            name: i.name,
            origin: i.origin ?? "",
            price: i.price != null ? `¥${i.price}` : "",
          }))
      : [];

  const receiptRows = filteredReceipts.map((r) => {
    const base = process.env.NEXT_PUBLIC_APP_URL?.trim() || window.location.origin;
    return {
      store_name: storeName,
      batch_code: r.batchCode,
      qr_url: `${base}/receipt?batch=${encodeURIComponent(r.batchCode)}`,
    };
  });

  async function handleGridpp(mode: GridppMode, kind: "item" | "receipt") {
    const rows = kind === "item" ? itemRows : receiptRows;
    const tpl = kind === "item" ? grfItemTpl : grfReceiptTpl;
    if (rows.length === 0) {
      toast.warning(kind === "item" ? "请先勾选要打印的物品" : "没有符合条件的回执");
      return;
    }
    if (!tpl) {
      toast.error("未找到锐浪模板，请先放入 public/grf 并运行 npm run grf:manifest");
      return;
    }
    const res = await gridppPrint(rows, tpl, mode);
    if (!res.ok) toast.error(res.error);
  }

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={mode} onValueChange={(v) => setMode(v === "receipt" ? "receipt" : "item")}>
        <TabsList>
          <TabsTrigger value="item">物品标签</TabsTrigger>
          <TabsTrigger value="receipt">捐赠回执标签</TabsTrigger>
        </TabsList>

        <TabsContent value="item" className="flex flex-col gap-4 mt-3">
          {/* 锐浪模板选择 + 打印 */}
          {grfTemplates.length > 0 ? (
            <div className="flex items-center gap-2 flex-wrap border rounded-lg p-2 bg-muted/20">
              <span className="text-sm font-medium">锐浪报表</span>
              <select
                value={grfItemTpl}
                onChange={(e) => setGrfItemTpl(e.target.value)}
                className="rounded-md border bg-background px-2 py-1 text-sm"
                aria-label="锐浪物品模板"
              >
                {grfTemplates.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" size="sm" disabled={itemRows.length === 0} onClick={() => handleGridpp("html5", "item")}>
                  🌐 HTML5 预览
                </Button>
                <Button variant="outline" size="sm" disabled={itemRows.length === 0} onClick={() => handleGridpp("preview", "item")}>
                  👁 锐浪打印(预览)
                </Button>
                <Button variant="default" size="sm" disabled={itemRows.length === 0} onClick={() => handleGridpp("direct", "item")}>
                  🖨️ 锐浪直接打印
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-destructive border rounded-lg p-3">
              未找到锐浪模板：请把 .grf 放入 <code className="bg-muted px-1">public/grf</code> 后运行{" "}
              <code className="bg-muted px-1">npm run grf:manifest</code>
            </p>
          )}
          <p className="text-xs text-muted-foreground">{GRIDPP_HINT}</p>

          {/* 分字段筛选 */}
          <div className="flex gap-2 flex-wrap items-end border rounded-lg p-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">编号</span>
              <Input value={fCode} onChange={(e) => { setFCode(e.target.value); setPage(1); }} placeholder="YZ-2026…" className="w-40 font-mono" aria-label="按编号筛选" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">品名</span>
              <Input value={fName} onChange={(e) => { setFName(e.target.value); setPage(1); }} placeholder="如：马克杯" className="w-44" aria-label="按品名筛选" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">状态</span>
              <select
                value={fStatus}
                onChange={(e) => { setFStatus(e.target.value); setPage(1); }}
                className="rounded-md border bg-background px-2 py-2 text-sm"
                aria-label="按状态筛选"
              >
                <option value="">全部</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{statusLabel(s)}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">分类（可手输）</span>
              <Input
                value={fCategory}
                onChange={(e) => { setFCategory(e.target.value); setPage(1); }}
                placeholder="大分类 / 小分类 / 大类-小类"
                className="w-56"
                aria-label="按分类筛选"
                list="label-category-options"
              />
              <datalist id="label-category-options">
                {tree.map((t) => (
                  <option key={`m${t.id}`} value={t.name} />
                ))}
                {tree.flatMap((t) => t.children.map((c) => <option key={`c${c.id}`} value={`${t.name}-${c.name}`} />))}
              </datalist>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">来源</span>
              <Input value={fOrigin} onChange={(e) => { setFOrigin(e.target.value); setPage(1); }} placeholder="如：闲鱼" className="w-32" aria-label="按来源筛选" />
            </div>
            {(fCode || fName || fStatus || fCategory || fOrigin) && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>清除筛选</Button>
            )}
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-xs text-muted-foreground select-none">点选分类（可选）</summary>
            <div className="flex gap-1 flex-wrap items-center mt-2">
              {tree.map((t) => (
                <span key={t.id} className="flex items-center gap-0.5 border rounded-md px-1 py-0.5">
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => pickCategory(t.name)}>{t.name}</Button>
                  {t.children.map((c) => (
                    <Button key={c.id} size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => pickCategory(`${t.name}-${c.name}`)}>
                      {c.name}
                    </Button>
                  ))}
                </span>
              ))}
            </div>
          </details>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">已选 {selected.size} 件 · 共 {filtered.length} 件命中</span>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={selectAll} disabled={pageItems.length === 0}>全选当前页</Button>
              <Button variant="ghost" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>取消选择</Button>
              <Button variant="secondary" onClick={handleExport} disabled={selected.size === 0 || isPending}>
                {isPending ? "导出中…" : "导出选中 Excel"}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-1 border rounded-lg p-2">
            {pageItems.length === 0 && <p className="text-muted-foreground p-4 text-center">没有匹配的物品</p>}
            {pageItems.map((i) => (
              <button
                key={i.code}
                onClick={() => toggle(i.code)}
                className={`flex items-center justify-between gap-2 p-2 rounded-md text-left hover:bg-accent ${
                  selected.has(i.code) ? "bg-accent" : ""
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs text-muted-foreground">{i.code}</span>
                  <span className="truncate">{i.name}</span>
                  {(i.categoryMajor || i.categoryMinor) && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {i.categoryMinor ? `${i.categoryMajor}-${i.categoryMinor}` : i.categoryMajor}
                    </span>
                  )}
                  <Badge variant="outline">{statusLabel(i.status)}</Badge>
                  {i.origin && <span className="text-xs text-muted-foreground shrink-0">{i.origin}</span>}
                </div>
                <Badge variant="outline">{i.price != null ? `¥${i.price}` : "未定价"}</Badge>
              </button>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-1 text-sm text-muted-foreground">
                每页
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="rounded-md border bg-background px-2 py-1 text-sm"
                  aria-label="每页条数"
                >
                  {[10, 20, 50, 100].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                条
              </label>
              <span className="text-sm text-muted-foreground">共 {filtered.length} 件 · 第 {curPage} / {totalPages} 页</span>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" disabled={curPage <= 1} onClick={() => setPage(curPage - 1)}>上一页</Button>
                <Button size="sm" variant="outline" disabled={curPage >= totalPages} onClick={() => setPage(curPage + 1)}>下一页</Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="receipt" className="flex flex-col gap-3 mt-3">
          <p className="text-sm text-muted-foreground">
            一次捐赠对应一张回执（含通过与被驳回物品）。按条件筛选后锐浪打印，扫码直达该登记回执页。
          </p>

          {grfTemplates.length > 0 ? (
            <div className="flex items-center gap-2 flex-wrap border rounded-lg p-2 bg-muted/20">
              <span className="text-sm font-medium">锐浪报表</span>
              <select
                value={grfReceiptTpl}
                onChange={(e) => setGrfReceiptTpl(e.target.value)}
                className="rounded-md border bg-background px-2 py-1 text-sm"
                aria-label="锐浪回执模板"
              >
                {grfTemplates.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">将打印当前筛选出的全部回执（每批一张）</span>
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" size="sm" disabled={receiptRows.length === 0} onClick={() => handleGridpp("html5", "receipt")}>
                  🌐 HTML5 预览
                </Button>
                <Button variant="outline" size="sm" disabled={receiptRows.length === 0} onClick={() => handleGridpp("preview", "receipt")}>
                  👁 锐浪打印(预览)
                </Button>
                <Button variant="default" size="sm" disabled={receiptRows.length === 0} onClick={() => handleGridpp("direct", "receipt")}>
                  🖨️ 锐浪直接打印
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-destructive border rounded-lg p-3">
              未找到锐浪模板：请把 .grf 放入 <code className="bg-muted px-1">public/grf</code> 后运行{" "}
              <code className="bg-muted px-1">npm run grf:manifest</code>
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Input value={fbatch} onChange={(e) => { setFbatch(e.target.value); setReceiptPage(1); }} placeholder="批次码" className="max-w-40 font-mono" aria-label="按批次码筛选" />
            <Input value={falias} onChange={(e) => { setFalias(e.target.value); setReceiptPage(1); }} placeholder="捐赠人" className="max-w-40" aria-label="按捐赠人筛选" />
            <Input value={fitem} onChange={(e) => { setFitem(e.target.value); setReceiptPage(1); }} placeholder="物品名称" className="max-w-40" aria-label="按物品名称筛选" />
            <Input type="date" value={fFrom} onChange={(e) => { setFFrom(e.target.value); setReceiptPage(1); }} aria-label="开始时间" className="w-40" />
            <span className="text-sm text-muted-foreground">至</span>
            <Input type="date" value={fTo} onChange={(e) => { setFTo(e.target.value); setReceiptPage(1); }} aria-label="结束时间" className="w-40" />
          </div>

          {filteredReceipts.length === 0 && (
            <p className="text-muted-foreground p-4 text-center border rounded-lg">
              没有符合条件的回执。入库（收件台/手动录入/复核通过）会自动生成回执码，这里即可打印回执。
            </p>
          )}
          <div className="flex flex-col gap-1 border rounded-lg p-2">
            {receiptPageItems.map((b) => (
              <div key={b.batchCode} className="flex items-center justify-between gap-2 p-2 rounded-md">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs text-muted-foreground">{b.batchCode}</span>
                  <span className="truncate text-sm">{b.alias ?? "匿名捐赠"}</span>
                  <span className="text-xs text-muted-foreground">{new Date(b.createdAt).toLocaleString("zh-CN")}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline">通过 {b.approvedCount}</Badge>
                  {b.rejectedCount > 0 && <Badge variant="destructive">驳回 {b.rejectedCount}</Badge>}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-1 text-sm text-muted-foreground">
              每页
              <select
                value={receiptSize}
                onChange={(e) => { setReceiptSize(Number(e.target.value)); setReceiptPage(1); }}
                className="rounded-md border bg-background px-2 py-1 text-sm"
                aria-label="每页条数"
              >
                {RECEIPT_PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              条
            </label>
            <span className="text-sm text-muted-foreground">共 {filteredReceipts.length} 条 · 第 {curReceiptPage} / {receiptTotalPages} 页</span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" disabled={curReceiptPage <= 1} onClick={() => setReceiptPage(curReceiptPage - 1)}>上一页</Button>
              <Button size="sm" variant="outline" disabled={curReceiptPage >= receiptTotalPages} onClick={() => setReceiptPage(curReceiptPage + 1)}>下一页</Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
