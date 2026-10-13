import type { Metadata } from "next";
import Link from "next/link";
import LoginForm from "./login-form";

export const metadata: Metadata = {
  title: "登录 · 益栈管理端",
};

export default function LoginPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center flex flex-col gap-1">
          <h1 className="text-2xl font-bold">益栈 · 店长工作台</h1>
          <p className="text-sm text-muted-foreground">登录后管理库存与账本</p>
        </div>
        <LoginForm />
        <p className="text-center text-sm text-muted-foreground">
          还没有账号？{" "}
          <Link href="/admin/register" className="underline underline-offset-4">
            注册一个
          </Link>
        </p>
      </div>
    </div>
  );
}