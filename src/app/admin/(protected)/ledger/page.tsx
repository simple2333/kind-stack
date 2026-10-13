import { Suspense } from "react";
import { getLedger, getFingerprint, verifyChain, ledgerCount, ledgerActionLabel } from "@/lib/ledger";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Pagination from "@/components/pagination";
import HashCell from "@/components/hash-cell";
import VerifyTool from "./verify-tool";

export const dynamic = "force-dynamic";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/** 账本 payload 字段名 → 中文（供店长/店员阅读） */
const FIELD_LABEL: Record<string, string> = {
  code: "编号",
  name: "品名",
  quantity: "数量",
  qty: "数量",
  price: "价格",
  condition: "成色",
  category: "分类",
  batch: "回执码",
  batchCode: "回执码",
  alias: "捐赠人",
  origin: "来源",
  remaining: "剩余",
  content: "反馈内容",
  rating: "评分",
  donorAlias: "来源",
  orderNo: "销售单号",
  total: "金额",
  count: "件数",
};

/** 把账本 payload JSON 转成可读的键值对，过滤掉 null/空值，字段名中文化 */
function payloadSummary(payload: string): { key: string; value: string }[] {
  try {
    const obj = JSON.parse(payload) as Record<string, unknown>;
    return Object.entries(obj)
      .filter(([, v]) => v != null && v !== "" && v !== false)
      .map(([k, v]) => ({ key: FIELD_LABEL[k] ?? k, value: typeof v === "object" ? JSON.stringify(v) : String(v) }));
  } catch {
    return [{ key: "内容", value: payload }];
  }
}

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; size?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const sizeNum = Number(sp.size);
  const pageSize = PAGE_SIZE_OPTIONS.includes(sizeNum) ? sizeNum : 20;
  const entries = await getLedger(pageSize, (page - 1) * pageSize);
  const total = await ledgerCount();
  const check = await verifyChain();
  const fp = await getFingerprint();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">透明账本（哈希链）</CardTitle>
          <CardDescription>
            账本只追加、不可篡改。当前指纹：<span className="font-mono">{fp}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge variant={check.valid ? "default" : "destructive"}>
              {check.valid ? `账本完整 · ${check.blocks} 条记录` : "账本疑似被篡改！"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <VerifyTool />

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">最近记录</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {entries.map((e) => {
            const fields = payloadSummary(e.payload);
            return (
              <div key={e.id} className="py-2 flex flex-col gap-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{ledgerActionLabel(e.action)}</Badge>
                    <span className="text-sm text-muted-foreground">#{e.id}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(e.created_at).toLocaleString("zh-CN")}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
                  {fields.map((f) => (
                    <span key={f.key} className="text-muted-foreground">
                      <span className="text-foreground/70">{f.key}：</span>
                      {f.value}
                    </span>
                  ))}
                </div>
                <HashCell hash={e.hash} prevHash={e.prev_hash} label={`哈希#${e.id}`} />
              </div>
            );
          })}
        </CardContent>
      </Card>
      <Suspense fallback={null}>
        <Pagination total={total} pageSize={pageSize} page={page} sizeOptions={PAGE_SIZE_OPTIONS} />
      </Suspense>
    </div>
  );
}