"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export default function UserBar({ email, roleLabel }: { email: string; roleLabel: string }) {
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    toast.success("已退出登录");
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground truncate max-w-[180px]">{email}</span>
      <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{roleLabel}</span>
      <Button variant="ghost" size="sm" onClick={handleSignOut}>
        退出
      </Button>
    </div>
  );
}