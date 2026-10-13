import Link from "next/link";
import { requireDonor, isStaff } from "@/lib/session";
import { listDonationRequestsByUser } from "@/lib/donation-request";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SignOutButton from "./sign-out-button";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pending: "待复核",
  approved: "已入库",
  rejected: "已驳回",
};

function statusClass(status: string): string {
  if (status === "approved") return "bg-emerald-600 text-white";
  if (status === "rejected") return "bg-destructive text-white";
  return "bg-muted text-foreground";
}

export default async function AccountPage() {
  const user = await requireDonor();
  const requests = await listDonationRequestsByUser(user.id);
  const name = user.displayName || user.name || "捐赠人";

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">你好，{name}</h1>
          <p className="text-sm text-muted-foreground">这里可以登记捐赠、查看回执与物品去向</p>
        </div>
        <SignOutButton />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button render={<Link href="/donate" />}>登记捐赠</Button>
        <Button variant="outline" render={<Link href="/receipt" />}>
          查捐赠回执
        </Button>
        {isStaff(user.roles) && (
          <Button variant="secondary" render={<Link href="/admin" />}>
            进入店长工作台
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">我的捐赠登记</CardTitle>
          <CardDescription>店员复核通过后会正式入库，并生成回执码供你随时查询去向。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {requests.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              还没有捐赠记录，点上方「登记捐赠」开始吧。
            </p>
          )}
          {requests.map((r) => {
            const items = r.items as { name: string; quantity?: number; status?: string }[];
            const approved = items.filter((i) => i.status === "approved").length;
            return (
              <div key={r.id} className="border rounded-lg p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {r.code && <span className="font-mono text-xs text-muted-foreground shrink-0">{r.code}</span>}
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(r.createdAt).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  <Badge className={statusClass(r.status)}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  {items.map((it, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {it.name}
                      {it.quantity != null && it.quantity > 1 ? ` ×${it.quantity}` : ""}
                    </Badge>
                  ))}
                </div>
                {r.status === "approved" && r.batchCode && (
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      回执码 <span className="font-mono">{r.batchCode}</span>
                      {approved > 0 ? ` · 已入库 ${approved} 件` : ""}
                    </span>
                    <Link
                      href={`/receipt?batch=${r.batchCode}`}
                      className="underline underline-offset-4 hover:text-primary"
                    >
                      查看去向
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}
