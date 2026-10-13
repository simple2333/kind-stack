import { Suspense } from "react";
import Link from "next/link";
import { listItems, countItems, statusLabel, type ItemStatus } from "@/lib/items";
import { statusBadgeClass } from "@/lib/item-types";
import { getFingerprint, verifyChain } from "@/lib/ledger";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Pagination from "@/components/pagination";
import CopyFingerprint from "../copy-fingerprint";

export const dynamic = "force-dynamic";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; name?: string; code?: string; category?: string; donor?: string; page?: string; size?: string }>;
}) {
  const sp = await searchParams;
  const status = (sp.status as ItemStatus) || undefined;
  const name = sp.name;
  const code = sp.code;
  const category = sp.category;
  const donor = sp.donor;
  const page = Math.max(1, Number(sp.page) || 1);
  const sizeNum = Number(sp.size);
  const pageSize = PAGE_SIZE_OPTIONS.includes(sizeNum) ? sizeNum : 20;
  const filter = { status, name, code, category, donor };
  const total = await countItems(filter);
  const items = await listItems({ ...filter, limit: pageSize, offset: (page - 1) * pageSize });
  const fp = await getFingerprint();
  const check = await verifyChain();

  return (
    <div className="min-h-dvh flex flex-col">
      <main className="mx-auto w-full max-w-3xl px-4 py-6 flex-1 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">透明账本</h1>
          <Link href="/" className="text-sm underline underline-offset-4">
            返回首页
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">账本公信力</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant={check.valid ? "default" : "destructive"}>
                {check.valid ? `账本完整（${check.blocks} 条账本记录）` : "账本被篡改！"}
              </Badge>
              <span className="text-xs text-muted-foreground">当前共 {total} 件物品</span>
            </div>
            <p className="text-muted-foreground">
              账本里的每一条记录都通过「哈希链」一环扣一环地连接起来：每条记录都包含上一条记录的指纹，
              任何一条被改动，后面所有记录的指纹都会对不上。账本指纹就是最新一条记录的指纹，公开可查。
            </p>
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground">账本指纹（哈希链最新块）：</p>
              <CopyFingerprint value={fp} />
            </div>
            <code className="font-mono text-xs bg-muted p-2 rounded break-all">{fp}</code>
            <p className="text-xs text-muted-foreground">
              想验证某条记录是否被篡改？前往{" "}
              <Link href="/verify" className="underline underline-offset-4">
                账本校验
              </Link>{" "}
              输入记录编号即可。
            </p>
          </CardContent>
        </Card>

        <form className="flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap">
            <input
              name="name"
              defaultValue={name}
              placeholder="物品名称"
              className="flex-1 min-w-32 rounded-md border bg-background px-3 py-2 text-sm"
            />
            <input
              name="code"
              defaultValue={code}
              placeholder="编号"
              className="flex-1 min-w-32 rounded-md border bg-background px-3 py-2 text-sm font-mono"
            />
            <input
              name="category"
              defaultValue={category}
              placeholder="分类"
              className="flex-1 min-w-24 rounded-md border bg-background px-3 py-2 text-sm"
            />
            <input
              name="donor"
              defaultValue={donor}
              placeholder="捐赠人昵称"
              className="flex-1 min-w-24 rounded-md border bg-background px-3 py-2 text-sm"
            />
            <button type="submit" className="rounded-md bg-primary px-4 text-sm text-primary-foreground">
              搜索
            </button>
          </div>
        </form>

        <div className="flex gap-1 flex-wrap">
          {[undefined, "received", "on_shelf", "sold", "given", "kept", "damaged"].map((s) => (
            <Link
              key={s ?? "all"}
              href={s ? `/ledger?status=${s}` : "/ledger"}
              className={`rounded-full px-3 py-1 text-sm ${
                status === s ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}
            >
              {s ? statusLabel(s) : "全部"}
            </Link>
          ))}
        </div>

        <div className="flex flex-col divide-y border rounded-lg">
          {items.length === 0 && <p className="text-muted-foreground p-8 text-center">暂无记录</p>}
          {items.map((item) => (
            <Link key={item.id} href={`/item/${item.code}`} className="p-3 flex items-center justify-between gap-2 hover:bg-accent/50">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-xs text-muted-foreground shrink-0">{item.code}</span>
                <span className="truncate">{item.name}</span>
                <Badge variant="outline" className="shrink-0">{item.condition ?? ""}</Badge>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {item.quantity > 1 && (
                  <span className="text-xs text-muted-foreground">
                    共{item.quantity}件 · 已流转：
                    {[
                      ["售出", item.sold_qty],
                      ["转赠", item.given_qty],
                      ["自留", item.kept_qty],
                      ["报废", item.damaged_qty],
                    ]
                      .filter(([, q]) => (q as number) > 0)
                      .map(([l, q]) => `${l}${q}`)
                      .join("、") || "0"}
                  </span>
                )}
                <Badge className={statusBadgeClass(item.status)}>{statusLabel(item.status)}</Badge>
                <span className="text-sm w-14 text-right">{item.price != null ? `¥${item.price}` : "—"}</span>
              </div>
            </Link>
          ))}
        </div>

        <Suspense fallback={null}>
          <Pagination total={total} pageSize={pageSize} page={page} sizeOptions={PAGE_SIZE_OPTIONS} />
        </Suspense>
      </main>
    </div>
  );
}