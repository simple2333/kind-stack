"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin", label: "收件台" },
  { href: "/admin/review", label: "复核台" },
  { href: "/admin/import", label: "Excel 导入" },
  { href: "/admin/stock", label: "货架" },
  { href: "/admin/donors", label: "捐赠人" },
  { href: "/admin/scan", label: "扫码处理" },
  { href: "/admin/sales", label: "销售记录" },
  { href: "/admin/ledger", label: "账本" },
  { href: "/admin/labels", label: "打码台" },
  { href: "/admin/isbn", label: "ISBN 查询" },
  { href: "/admin/logs", label: "日志" },
  { href: "/admin/settings", label: "设置" },
];

export default function AdminNav() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <nav className="w-full px-4 pb-2 flex gap-1 overflow-x-auto">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className={`px-3 py-1.5 rounded-md text-base transition-colors ${
            isActive(n.href)
              ? "bg-primary text-primary-foreground font-medium"
              : "hover:bg-accent hover:text-accent-foreground"
          }`}
          aria-current={isActive(n.href) ? "page" : undefined}
        >
          {n.label}
        </Link>
      ))}
    </nav>
  );
}