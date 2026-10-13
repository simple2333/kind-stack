import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { isWechatEnabled } from "@/lib/auth";
import RegisterForm from "./register-form";

export const dynamic = "force-dynamic";

export default async function AccountRegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/account");

  return (
    <>
      <div className="text-center flex flex-col gap-1">
        <h1 className="text-2xl font-bold">注册益栈账号</h1>
        <p className="text-sm text-muted-foreground">注册后即可登记捐赠、查看回执与去向</p>
      </div>
      <RegisterForm wechatEnabled={isWechatEnabled()} />
      <p className="text-center text-sm text-muted-foreground">
        已有账号？{" "}
        <Link href="/account/login" className="underline underline-offset-4">
          去登录
        </Link>
      </p>
    </>
  );
}
