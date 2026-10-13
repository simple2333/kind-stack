import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import ReceiptLookup from "./receipt-lookup";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string }>;
}) {
  const sp = await searchParams;
  const initialCode = sp.batch ?? "";
  return (
    <div className="min-h-dvh flex flex-col">
      <main className="mx-auto w-full max-w-2xl px-4 py-6 flex-1 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">捐赠回执</h1>
          <Link href="/" className="text-sm underline underline-offset-4">
            返回首页
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">查一查，我捐的东西去哪了？</CardTitle>
            <CardDescription>
              寄出捐赠时，商店会给你一张带二维码的回执标签。扫码即自动查询，也可以手动输入回执码。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReceiptLookup initialCode={initialCode} />
          </CardContent>
        </Card>
        <p className="text-sm text-muted-foreground">
          没有回执码？可以到「完整账本」里按物品名或捐赠人搜索，找到你捐的那件物品查看去向。
        </p>
      </main>
    </div>
  );
}