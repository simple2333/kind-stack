import type { Metadata } from "next";
import Link from "next/link";
import { getFingerprint } from "@/lib/ledger";
import { requireStaff, isOwner } from "@/lib/session";
import { Toaster } from "@/components/ui/sonner";
import UserBar from "./user-bar";
import AdminNav from "./admin-nav";
import AdminSearch from "./admin-search";

export const metadata: Metadata = {
  title: "益栈 · 管理端",
};

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const fingerprint = await getFingerprint();
  const roleLabel = isOwner(user.roles) ? "店长" : "店员";

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="w-full px-4 py-3 flex items-center justify-between gap-3">
          <Link href="/admin" className="text-2xl font-bold shrink-0">
            益栈 <span className="text-muted-foreground text-base font-normal">店长工作台</span>
          </Link>
          <div className="flex items-center gap-4 min-w-0">
            <AdminSearch />
            <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
              账本指纹 {fingerprint.slice(0, 12)}…
            </span>
            <UserBar email={user.email ?? ""} roleLabel={roleLabel} />
          </div>
        </div>
        <AdminNav />
      </header>
      <main className="w-full px-4 py-6 flex-1">{children}</main>
      <Toaster />
    </div>
  );
}