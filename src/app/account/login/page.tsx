import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { isWechatEnabled } from "@/lib/auth";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function AccountLoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/account");

  return (
    <>
      <div className="text-center flex flex-col gap-1">
        <h1 className="text-2xl font-bold">登录益栈</h1>
        <p className="text-sm text-muted-foreground">登录后可登记捐赠、查看回执与去向</p>
      </div>
      <LoginForm wechatEnabled={isWechatEnabled()} />
      <p className="text-center text-sm text-muted-foreground">
        还没有账号？{" "}
        <Link href="/account/register" className="underline underline-offset-4">
          注册一个
        </Link>
      </p>
    </>
  );
}
