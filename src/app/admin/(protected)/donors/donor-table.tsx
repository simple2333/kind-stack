"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { DonorAccount } from "@/lib/members";

export default function DonorTable({ donors }: { donors: DonorAccount[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return donors;
    return donors.filter((d) =>
      [d.name, d.displayName, d.email].some((v) => (v ?? "").toLowerCase().includes(kw))
    );
  }, [donors, q]);

  return (
    <div className="flex flex-col gap-3">
      <div className="max-w-xs">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索昵称 / 邮箱"
        />
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">昵称</th>
              <th className="text-left px-3 py-2 font-medium">邮箱</th>
              <th className="text-left px-3 py-2 font-medium">注册方式</th>
              <th className="text-right px-3 py-2 font-medium">捐赠次数</th>
              <th className="text-left px-3 py-2 font-medium">最近捐赠</th>
              <th className="text-left px-3 py-2 font-medium">注册时间</th>
              <th className="text-left px-3 py-2 font-medium">状态</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  没有匹配的捐赠人
                </td>
              </tr>
            )}
            {filtered.map((d) => (
              <tr key={d.id} className="hover:bg-accent/40">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {d.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.image} alt="" className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-muted" />
                    )}
                    <span className="font-medium truncate max-w-[140px]">{d.displayName || d.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-muted-foreground truncate max-w-[200px]">{d.email ?? "—"}</td>
                <td className="px-3 py-2">
                  {d.viaWechat ? (
                    <Badge className="bg-[#07c160] text-white">微信</Badge>
                  ) : (
                    <Badge variant="outline">邮箱</Badge>
                  )}
                </td>
                <td className="px-3 py-2 text-right">{d.donationCount}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {d.lastDonationAt ? new Date(d.lastDonationAt).toLocaleString("zh-CN") : "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {new Date(d.createdAt).toLocaleDateString("zh-CN")}
                </td>
                <td className="px-3 py-2">
                  {d.disabled ? (
                    <Badge variant="outline" className="text-destructive">已禁用</Badge>
                  ) : (
                    <Badge variant="outline">正常</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
