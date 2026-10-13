import Link from "next/link";
import { getFingerprint, verifyChain } from "@/lib/ledger";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import CopyFingerprint from "../copy-fingerprint";
import VerifyForm from "./verify-form";

export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  const fp = await getFingerprint();
  const check = await verifyChain();
  return (
    <div className="min-h-dvh flex flex-col">
      <main className="mx-auto w-full max-w-2xl px-4 py-6 flex-1 flex flex-col gap-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">账本校验</h1>
          <Link href="/" className="text-sm whitespace-nowrap underline underline-offset-4 hover:text-primary hover:underline-offset-8 transition-all">
            返回首页
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          这里可以独立验证账本有没有被偷偷改过。原理：账本每条记录用上一条的哈希 + 时间戳 + 内容计算指纹，
          任何改动都会让指纹对不上。你可以在「完整账本」里找到每条记录的编号（如 #48），输入后即可校验。
        </p>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">当前账本指纹</CardTitle>
            <CardDescription>
              指纹 = 哈希链最新一个区块的哈希。所有账本记录一环扣一环，改动任何一条都会让指纹对不上。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Badge variant={check.valid ? "default" : "destructive"}>
              {check.valid ? `账本完整 · ${check.blocks} 条记录 · 未被篡改` : "账本疑似被篡改"}
            </Badge>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">账本指纹：</p>
              <CopyFingerprint value={fp} />
            </div>
            <code className="font-mono text-xs bg-muted p-3 rounded break-all">{fp}</code>
          </CardContent>
        </Card>
        <VerifyForm />
      </main>
    </div>
  );
}