"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { verifyEntryAction } from "./actions";
import { ledgerActionLabel } from "@/lib/ledger-actions";

export default function VerifyForm() {
  const [id, setId] = useState("");
  const [result, setResult] = useState<{ valid: boolean; entry?: { id: number; action: string; hash: string; created_at: string; name?: string; code?: string } } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleVerify() {
    const n = Number(id);
    if (!n) return toast.error("请输入记录 ID");
    startTransition(async () => {
      const r = await verifyEntryAction(n);
      setResult({ valid: r.valid, entry: r.entry });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">校验单条记录</CardTitle>
        <CardDescription>输入账本记录编号，重放计算其哈希，验证记录是否被篡改。</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="记录编号，如 48" inputMode="numeric" />
          <Button onClick={handleVerify} disabled={isPending || !id.trim()}>校验</Button>
        </div>
        {result && (
          <div className={result.valid ? "text-green-600 text-sm" : "text-destructive text-sm"}>
            {result.valid
              ? `✅ 记录 #${result.entry?.id}（${ledgerActionLabel(result.entry?.action ?? "")}）哈希有效，未被篡改`
              : "❌ 哈希不匹配，该记录疑似被篡改"}
            {result.entry?.name && (
              <div className="text-muted-foreground mt-1">
                物品：{result.entry.name}
                {result.entry.code ? `（${result.entry.code}）` : ""}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}