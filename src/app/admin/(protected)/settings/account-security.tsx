"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

export default function AccountSecurity() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit() {
    if (next.length < 8) {
      toast.error("新密码至少 8 位");
      return;
    }
    if (next !== confirm) {
      toast.error("两次输入的新密码不一致");
      return;
    }
    setPending(true);
    try {
      const res = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (res.error) {
        toast.error(res.error.message ?? "修改失败");
        return;
      }
      toast.success("密码已修改");
      setCurrent("");
      setNext("");
      setConfirm("");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">账号安全</CardTitle>
        <CardDescription>修改自己的登录密码（需输入当前密码）。</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="当前密码" className="max-w-sm" />
        <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="新密码（至少 8 位）" className="max-w-sm" />
        <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="再次输入新密码" className="max-w-sm" />
        <div className="flex items-center gap-2">
          <Button onClick={handleSubmit} disabled={pending || !current || !next || !confirm}>
            {pending ? "提交中…" : "修改密码"}
          </Button>
          <span className="text-xs text-muted-foreground">修改后其他设备登录会被退出</span>
        </div>
      </CardContent>
    </Card>
  );
}