"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { importItemsExcel, parseExcelImport } from "@/lib/actions";
import type { ImportResult, ExcelPreview } from "@/lib/excel-import";

export default function ImportConsole() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [summary, setSummary] = useState<ExcelPreview | null>(null);
  const [defaultOrigin, setDefaultOrigin] = useState("闲鱼");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [parsing, setParsing] = useState(false);

  function handleFile(file: File) {
    setResult(null);
    setParsing(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(",")[1] ?? "";
      startTransition(async () => {
        try {
          const res = await parseExcelImport(base64, file.name);
          if (!res.ok) {
            toast.error(res.message ?? "文件解析失败");
            setSummary(null);
            return;
          }
          setSummary(res);
          if (res.rows.length === 0) toast.warning("该文件没有「物资入库」的数据");
        } finally {
          setParsing(false);
        }
      });
    };
    reader.onerror = () => {
      setParsing(false);
      toast.error("读取文件失败");
    };
    reader.readAsDataURL(file);
  }

  function handleImport() {
    if (!summary || summary.rows.length === 0) return;
    startTransition(async () => {
      const res = await importItemsExcel({ defaultOrigin: defaultOrigin.trim() || "闲鱼", rows: summary.rows });
      setResult(res);
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    });
  }

  function reset() {
    setSummary(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const busy = isPending || parsing;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Excel 批量导入（闲鱼订单）</CardTitle>
          <CardDescription>
            上传闲鱼「门店订单列表」导出的 Excel，只导入「处理类型 = 物资入库」的行。
            物资标题 → 品名，类目 → 分类（完整「大类-小类」，自动登记），物资售价按「分」÷100 转成元，
            闲鱼订单号用于去重，重复导入会被自动跳过。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="lg" onClick={() => fileRef.current?.click()} disabled={busy}>
              📄 选择 Excel 文件
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            {summary?.fileName && <span className="text-sm text-muted-foreground">{summary.fileName}</span>}
            {parsing && <span className="text-sm text-muted-foreground">解析中…</span>}
            {(summary || result) && (
              <Button variant="outline" onClick={reset} disabled={busy}>
                清空
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground shrink-0">默认来源</span>
            <Input
              value={defaultOrigin}
              onChange={(e) => setDefaultOrigin(e.target.value)}
              placeholder="闲鱼"
              className="max-w-40"
            />
            <span className="text-xs text-muted-foreground">导入物品的「来源」字段，可在货架继续修改</span>
          </div>

          {summary && (
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">共 {summary.total} 行</Badge>
              <Badge variant="default">物资入库 {summary.matched} 行</Badge>
              {summary.skippedType > 0 && <Badge variant="outline">忽略其它类型 {summary.skippedType} 行</Badge>}
              {summary.skippedEmpty > 0 && <Badge variant="destructive">标题为空 {summary.skippedEmpty} 行</Badge>}
            </div>
          )}

          {summary && summary.rows.length > 0 && (
            <>
              <div className="max-h-80 overflow-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2">闲鱼订单号</th>
                      <th className="text-left p-2">物资标题</th>
                      <th className="text-left p-2">类目</th>
                      <th className="text-right p-2">售价(元)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.rows.slice(0, 100).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 font-mono text-xs text-muted-foreground">{r.externalNo ?? "—"}</td>
                        <td className="p-2">{r.name}</td>
                        <td className="p-2">{r.category ?? "—"}</td>
                        <td className="p-2 text-right">{r.price != null ? `¥${r.price}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {summary.rows.length > 100 && (
                  <p className="p-2 text-xs text-muted-foreground">仅预览前 100 行，共 {summary.rows.length} 行</p>
                )}
              </div>
              <div>
                <Button size="lg" onClick={handleImport} disabled={busy}>
                  {isPending ? "导入中…" : `✅ 导入 ${summary.rows.length} 件`}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card className={result.ok ? "border-primary/40" : "border-destructive/40"}>
          <CardHeader>
            <CardTitle className="text-lg">{result.ok ? "导入结果" : "导入失败"}</CardTitle>
            <CardDescription>{result.message}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="default">成功导入 {result.imported} 件</Badge>
              {result.skipped > 0 && <Badge variant="outline">跳过 {result.skipped} 条</Badge>}
              {result.categories > 0 && <Badge variant="secondary">新增分类 {result.categories} 个</Badge>}
            </div>
            {result.samples.length > 0 && (
              <div className="flex flex-col divide-y border rounded-lg">
                {result.samples.map((s) => (
                  <div key={s.code} className="flex items-center gap-2 p-2 text-sm">
                    <span className="font-mono text-xs text-muted-foreground">{s.code}</span>
                    <span className="truncate flex-1">{s.name}</span>
                    <span>{s.price != null ? `¥${s.price}` : "未定价"}</span>
                  </div>
                ))}
              </div>
            )}
            {result.skippedSamples.length > 0 && (
              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                <span className="font-medium">跳过示例：</span>
                {result.skippedSamples.map((s, i) => (
                  <span key={i}>
                    {s.name} —— {s.reason}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
