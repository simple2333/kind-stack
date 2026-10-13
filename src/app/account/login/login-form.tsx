"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import WechatButton from "../wechat-button";

export default function LoginForm({ wechatEnabled }: { wechatEnabled: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await signIn.email({ email, password });
      if (res.error) {
        toast.error(res.error.message ?? "登录失败");
        return;
      }
      toast.success("登录成功");
      router.push("/account");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">登录</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {wechatEnabled && (
          <>
            <WechatButton />
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              或使用邮箱登录
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "登录中…" : "登录"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
