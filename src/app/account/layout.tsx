import type { Metadata } from "next";
import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "捐赠人中心 · 益栈",
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            益栈 <span className="text-muted-foreground text-sm font-normal">捐赠人中心</span>
          </Link>
          <Link href="/" className="text-sm underline underline-offset-4">
            返回首页
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 py-6 flex-1 flex flex-col gap-6">{children}</main>
      <Toaster />
    </div>
  );
}
