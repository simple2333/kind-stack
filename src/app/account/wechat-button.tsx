"use client";

import { useState } from "react";
import { toast } from "sonner";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

/** 微信开放平台「网站应用」扫码登录按钮（仅在配置了凭据时渲染）。 */
export default function WechatButton() {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      await signIn.social({ provider: "wechat", callbackURL: "/account" });
    } catch {
      toast.error("微信登录暂不可用，请稍后再试");
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="w-full bg-[#07c160] hover:bg-[#06ad56] text-white"
    >
      {pending ? "正在跳转微信…" : "微信一键登录"}
    </Button>
  );
}
