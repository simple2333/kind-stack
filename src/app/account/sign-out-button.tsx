"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    toast.success("已退出登录");
    router.push("/account/login");
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSignOut}>
      退出登录
    </Button>
  );
}
