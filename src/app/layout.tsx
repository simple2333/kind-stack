import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "益栈 · 透明账本",
  description: "让每一份善意都有去处 —— 二手慈善商店透明账本",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}