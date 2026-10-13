"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { lookupBatch, type BatchItem, type RejectedItem } from "./actions";
import { statusLabel } from "@/lib/item-types";
import FeedbackForm from "../item/feedback-form";

interface BatchResult {
  donorAlias: string;
  createdAt?: string;
  items: BatchItem[];
  rejected?: RejectedItem[];
}

export default function ReceiptLookup({ initialCode = "" }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [openFeedback, setOpenFeedback] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (initialCode) handleLookup(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  function handleLookup(value?: string) {
    const target = (value ?? code).trim();
    if (!target) return;
    startTransition(async () => {
      const res = await lookupBatch(target);
      if (res.ok && res.data) {
        setResult(res.data);
        toast.success(`找到 ${res.data.items.length} 件物品`);
      } else {
        setResult(null);
        toast.error(res.message ?? "未找到该回执码");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="例如 JZ-3K9X2F7A" className="font-mono" />
        <Button onClick={() => handleLookup()} disabled={isPending}>查询</Button>
      </div>

      {result && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            捐赠人：<span className="font-medium text-foreground">{result.donorAlias}</span> · 共 {result.items.length} 件
            {result.createdAt && (
              <span className="ml-2">捐赠时间：{new Date(result.createdAt).toLocaleString("zh-CN")}</span>
            )}
          </p>
          <div className="flex flex-col divide-y border rounded-lg">
            {result.items.map((i) => (
              <div key={i.code} className="p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs text-muted-foreground">{i.code}</span>
                    <span className="truncate">{i.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={i.status === "sold" ? "default" : "secondary"}>
                      {statusLabel(i.status)}
                    </Badge>
                    {i.price != null && <span className="text-sm">¥{i.price}</span>}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setOpenFeedback(openFeedback === i.id ? null : i.id)}
                    >
                      {openFeedback === i.id ? "收起反馈" : `反馈${i.feedback.length > 0 ? `(${i.feedback.length})` : ""}`}
                    </Button>
                  </div>
                </div>

                {openFeedback === i.id && (
                  <div className="flex flex-col gap-2 border-t pt-2">
                    {i.feedback.length > 0 && (
                      <div className="flex flex-col divide-y">
                        {i.feedback.map((f) => (
                          <div key={f.id} className="py-1.5 flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              {f.rating != null && <span className="text-amber-500 text-xs">{f.rating}★</span>}
                              <span className="text-xs text-muted-foreground">
                                {new Date(f.created_at).toLocaleString("zh-CN")}
                              </span>
                            </div>
                            <p className="text-sm">{f.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      你是这件物品的新主人吗？扫码填写受赠反馈，捐赠人也能看到你的反馈。
                    </p>
                    <FeedbackForm
                      itemId={i.id}
                      onSubmitted={() => {
                        setOpenFeedback(null);
                        handleLookup(code.trim());
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {result.rejected && result.rejected.length > 0 && (
            <div className="flex flex-col gap-1 border rounded-lg p-3 bg-muted/30">
              <p className="text-sm font-medium text-destructive">未通过的物品</p>
              {result.rejected.map((r, i) => (
                <div key={i} className="flex flex-col gap-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="truncate">{r.name}</span>
                    {r.quantity != null && <span className="text-muted-foreground">×{r.quantity}</span>}
                    <Badge variant="destructive">未通过</Badge>
                  </div>
                  {r.reason && <p className="text-xs text-muted-foreground">原因：{r.reason}</p>}
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                这些物品未通过复核，未正式入库。如有疑问可联系店员。
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}