"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { verifyEntryAction } from "@/app/verify/actions";
import { ledgerActionLabel } from "@/lib/ledger-actions";

export default function VerifyTool() {
  const [id, setId] = useState("");
  const [result, setResult] = useState<{ valid: boolean; entry?: { id: number; action: string; hash: string; created_at: string } } | null>(null);
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
        <CardTitle className="text-xl">单条校验</CardTitle>
        <CardDescription>输入账本记录 ID，重放哈希验证是否被篡改</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="记录 ID，如 1" inputMode="numeric" />
          <Button onClick={handleVerify} disabled={isPending}>校验</Button>
        </div>
        {result && (
          <div className={result.valid ? "text-green-600" : "text-destructive"}>
            {result.valid ? `✅ 记录 #${result.entry?.id}（${ledgerActionLabel(result.entry?.action ?? "")}）哈希有效` : "❌ 哈希不匹配，记录疑似被篡改"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}