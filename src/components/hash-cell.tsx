"use client";

import { useState } from "react";

/**
 * 完整哈希展示：始终显示全部 64 位，支持一键复制，可附带上一块哈希（prev_hash）。
 * 用于账本/物品页，解决哈希被截断成 "…" 看不到的问题。
 */
export default function HashCell({
  hash,
  prevHash,
  label,
}: {
  hash: string;
  prevHash?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 忽略复制失败 */
    }
  }

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="flex items-center gap-2">
        {label && <span className="text-xs text-muted-foreground shrink-0">{label}</span>}
        <code className="font-mono text-xs text-muted-foreground break-all">{hash}</code>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="text-xs text-primary underline underline-offset-2"
          onClick={handleCopy}
        >
          {copied ? "已复制 ✓" : "复制"}
        </button>
        {prevHash && (
          <span className="text-xs text-muted-foreground min-w-0">
            prev: <code className="font-mono break-all">{prevHash}</code>
          </span>
        )}
      </div>
    </div>
  );
}