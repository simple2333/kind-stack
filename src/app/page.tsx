import Link from "next/link";
import { stats, listItems, statusLabel } from "@/lib/items";
import { statusBadgeClass } from "@/lib/item-types";
import { getStoreName } from "@/lib/settings";
import { listPendingPublic } from "@/lib/donation-request";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const s = await stats();
  const storeName = await getStoreName();
  const latest = await listItems({ limit: 8 });
  const pending = await listPendingPublic(8);

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold leading-tight">益栈</h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{storeName}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/donate" className="text-xs sm:text-sm whitespace-nowrap underline underline-offset-4 hover:text-primary hover:underline-offset-8 transition-all">
              我要捐赠
            </Link>
            <Link href="/ledger" className="text-xs sm:text-sm whitespace-nowrap underline underline-offset-4 hover:text-primary hover:underline-offset-8 transition-all">
              完整账本
            </Link>
            <Link href="/verify" className="text-xs sm:text-sm whitespace-nowrap underline underline-offset-4 hover:text-primary hover:underline-offset-8 transition-all">
              账本校验
            </Link>
            <Link href="/receipt" className="text-xs sm:text-sm whitespace-nowrap underline underline-offset-4 hover:text-primary hover:underline-offset-8 transition-all">
              捐赠回执
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6 flex-1 flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">每一件捐赠，都看得见去向</h2>
          <p className="text-muted-foreground">
            这里记录着每一件捐赠物品从入库、上架到售出/转赠的完整过程。
            账本经哈希链保护，任何人可核验、不可篡改。
          </p>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-5">
              <div className="text-sm text-muted-foreground">累计收到捐赠</div>
              <div className="text-3xl font-bold">{s.total} 件</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="text-sm text-muted-foreground">正在爱心义卖</div>
              <div className="text-3xl font-bold">{s.onShelf} 件</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="text-sm text-muted-foreground">已找到新主人</div>
              <div className="text-3xl font-bold">{s.sold} 件</div>
            </CardContent>
          </Card>
        </section>

        <section className="flex flex-wrap gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span>去向明细：</span>
          <span>已售出 {s.sold} 件</span>
          <span>· 已转赠 {s.given} 件</span>
          <span>· 自留 {s.kept} 件</span>
          <span>· 报废 {s.damaged} 件</span>
          <span>· 待上架 {s.received} 件</span>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">最近收到的善意</h2>
            <Link href="/ledger" className="text-sm underline underline-offset-4">
              查看全部
            </Link>
          </div>
          <div className="flex flex-col divide-y border rounded-lg">
            {latest.length === 0 && (
              <div className="p-8 text-center flex flex-col items-center gap-1">
                <p className="text-muted-foreground">还没有捐赠记录</p>
                <p className="text-xs text-muted-foreground/70">新的善意正在路上，稍后再来看看</p>
              </div>
            )}
            {latest.map((item) => (
              <Link key={item.id} href={`/item/${item.code}`} className="p-3 flex items-center justify-between gap-2 hover:bg-accent/50">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium truncate">{item.name}</span>
                  <Badge variant="outline" className="shrink-0">{item.condition ?? ""}</Badge>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={statusBadgeClass(item.status)}>{statusLabel(item.status)}</Badge>
                  <span className="text-sm">{item.price != null ? `¥${item.price}` : "—"}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">待复核的登记</h2>
            <Link href="/donate" className="text-sm underline underline-offset-4">
              我要捐赠
            </Link>
          </div>
          <div className="flex flex-col divide-y border rounded-lg">
            {pending.length === 0 && (
              <p className="p-6 text-center text-muted-foreground text-sm">当前没有待复核的登记</p>
            )}
            {pending.map((p) => (
              <div key={p.code ?? p.createdAt} className="p-3 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {p.code && <span className="font-mono text-xs text-muted-foreground shrink-0">{p.code}</span>}
                    <span className="text-sm font-medium truncate">{p.alias ?? "匿名捐赠"}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(p.createdAt).toLocaleString("zh-CN")}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {p.items.map((it, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {it.name}
                      {it.quantity != null && it.quantity > 1 ? ` ×${it.quantity}` : ""}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <p>{storeName} · 益栈透明账本 · 让每一份善意都有去处</p>
        <p className="mt-2">
          Copyright © 2026{" "}
          <a href="http://simple2333.me" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-primary">
            simple
          </a>{" "}
          and Viola All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}