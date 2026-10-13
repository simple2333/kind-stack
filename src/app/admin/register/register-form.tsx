"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("密码至少 8 位");
      return;
    }
    if (password !== confirm) {
      toast.error("两次输入的密码不一致");
      return;
    }
    setPending(true);
    try {
      const res = await signUp.email({
        name: name || email.split("@")[0],
        email,
        password,
      });
      if (res.error) {
        toast.error(res.error.message ?? "注册失败");
        return;
      }
      toast.success("注册成功，已自动登录");
      router.push("/admin");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">注册</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">昵称</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如何称呼你"
            />
          </div>
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
              placeholder="至少 8 位"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm">确认密码</Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="再次输入密码"
              required
            />
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "注册中…" : "注册"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}