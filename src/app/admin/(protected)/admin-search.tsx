"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

/** 管理端全局搜索：回车跳转货架按关键词筛选 */
export default function AdminSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <form
      className="hidden md:block"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/admin/stock?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索物品 / 编号" className="w-44 h-8" />
    </form>
  );
}