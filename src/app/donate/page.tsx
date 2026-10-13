import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DonateForm from "./donate-form";

export const dynamic = "force-dynamic";

export default async function DonatePage() {
  const user = await getCurrentUser();

  return (
    <div className="min-h-dvh flex flex-col">
      <main className="mx-auto w-full max-w-2xl px-4 py-6 flex-1 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">我要捐赠</h1>
          <Link href="/" className="text-sm underline underline-offset-4">返回首页</Link>
        </div>

        {user ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">登记捐赠</CardTitle>
              <CardDescription>
                像寄快递一样方便：填好你要捐的物品，店员复核后正式入库。
                你可以先回家拿东西，也可以当场填写后把物品放到收银台/前台。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DonateForm defaultAlias={user.displayName || user.name || ""} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">请先登录后登记捐赠</CardTitle>
              <CardDescription>
                为方便你随时查询「我捐的东西去哪了」，捐赠前需要先注册/登录一个账号。
                支持微信一键登录，也可以用邮箱注册。
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button render={<Link href="/account/login" />}>登录</Button>
              <Button variant="outline" render={<Link href="/account/register" />}>
                注册新账号
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
