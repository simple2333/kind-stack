import { notFound } from "next/navigation";
import Link from "next/link";
import { getByCode, averagePriceFor, getDonorAlias, statusLabel } from "@/lib/items";
import { statusBadgeClass } from "@/lib/item-types";
import { getHistory, ledgerActionLabel } from "@/lib/ledger";
import { listFeedback } from "@/lib/feedback";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import HashCell from "@/components/hash-cell";
import FeedbackForm from "../feedback-form";

export const dynamic = "force-dynamic";

export default async function ItemPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const item = await getByCode(code);
  if (!item) notFound();

  const history = await getHistory("item", item.id);
  const avg = await averagePriceFor(item.name);
  const donor = item.donor_id ? await getDonorAlias(item.donor_id) : undefined;
  const feedback = await listFeedback(item.id);
  const canFeedback = item.status === "sold" || item.status === "given";
  const feedbackOpen = canFeedback || feedback.length > 0;

  return (
    <div className="min-h-dvh flex flex-col">
      <main className="mx-auto w-full max-w-2xl px-4 py-6 flex-1 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link href="/ledger" className="text-sm underline underline-offset-4">
            ← 返回账本
          </Link>
          <Link href="/" className="text-sm underline underline-offset-4">
            返回首页
          </Link>
        </div>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm text-muted-foreground">{item.code}</span>
              <Badge className={statusBadgeClass(item.status)}>{statusLabel(item.status)}</Badge>
              <Badge variant="outline">{item.condition ?? "成色未知"}</Badge>
            </div>
            <CardTitle className="text-2xl mt-2">{item.name}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {item.description && <p className="text-muted-foreground">{item.description}</p>}

            <div className="flex items-end gap-3">
              <div className="text-3xl font-bold">
                {item.price != null ? `¥${item.price}` : "未定价"}
              </div>
              {avg != null && (
                <div className="text-sm text-muted-foreground">
                  同类历史成交均价 ¥{avg.toFixed(0)}
                </div>
              )}
            </div>

            {donor && (
              <p className="text-sm text-muted-foreground italic">
                来自{donor}的捐赠
              </p>
            )}

            {item.quantity > 1 && (
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">
                  共 {item.quantity} 件 · 剩余{" "}
                  {item.quantity - (item.sold_qty + item.given_qty + item.kept_qty + item.damaged_qty)} 件
                </span>
                <div className="flex gap-2 flex-wrap">
                  {[
                    ["售出", item.sold_qty],
                    ["转赠", item.given_qty],
                    ["自留", item.kept_qty],
                    ["报废", item.damaged_qty],
                  ]
                    .filter(([, q]) => (q as number) > 0)
                    .map(([l, q]) => (
                      <Badge key={l as string} variant="outline">
                        {l} {q} 件
                      </Badge>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">这件物品的旅程</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {history.map((h, i) => {
              const p = JSON.parse(h.payload) as Record<string, unknown>;
              return (
                <div key={h.id} className="py-3 flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="size-3 rounded-full bg-primary mt-1" />
                    {i < history.length - 1 && <div className="w-px flex-1 bg-border" />}
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{ledgerActionLabel(h.action)}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(h.created_at).toLocaleString("zh-CN")}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {p.name ? `${p.name}${p.price != null ? ` · ¥${p.price}` : ""}${p.quantity ? ` · ×${p.quantity}` : ""}` : ""}
                    </span>
                    <HashCell hash={h.hash} prevHash={h.prev_hash} label={`哈希#${h.id}`} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {feedbackOpen && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">受赠人反馈</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {feedback.length > 0 && (
                <div className="flex flex-col divide-y">
                  {feedback.map((f) => (
                    <div key={f.id} className="py-2 flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        {f.rating != null && <span className="text-amber-500 text-sm">{f.rating}★</span>}
                        <span className="text-xs text-muted-foreground">
                          {new Date(f.created_at).toLocaleString("zh-CN")}
                        </span>
                      </div>
                      <p className="text-sm">{f.content}</p>
                    </div>
                  ))}
                </div>
              )}
              {canFeedback && (
                <div className="border-t pt-3">
                  <p className="text-sm text-muted-foreground mb-2">
                    你是这件物品的新主人吗？留下一句反馈吧。
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    反馈将公开在账本上，捐赠人也能看到；联系方式仅供店主联系，<span className="font-medium">不会公开展示</span>。
                  </p>
                  <FeedbackForm itemId={item.id} />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}