"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

function pageList(current: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set<number>([1, totalPages, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

export default function Pagination({
  total,
  pageSize,
  page,
  sizeOptions,
}: {
  total: number;
  pageSize: number;
  page: number;
  sizeOptions?: number[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function go(p: number) {
    if (p < 1 || p > totalPages || p === page) return;
    const next = new URLSearchParams(sp.toString());
    if (p <= 1) next.delete("page");
    else next.set("page", String(p));
    router.push(`${pathname}?${next.toString()}`);
  }

  function changeSize(size: number) {
    const next = new URLSearchParams(sp.toString());
    next.set("size", String(size));
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex items-center gap-3 mt-3 flex-wrap">
      {sizeOptions && (
        <label className="flex items-center gap-1 text-sm text-muted-foreground">
          每页
          <select
            value={pageSize}
            onChange={(e) => changeSize(Number(e.target.value))}
            className="rounded-md border bg-background px-2 py-1 text-sm"
            aria-label="每页条数"
          >
            {sizeOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          条
        </label>
      )}

      <span className="text-sm text-muted-foreground">共 {total} 条 · 第 {page} / {totalPages} 页</span>

      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => go(page - 1)}>
          上一页
        </Button>
        {pageList(page, totalPages).map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="px-1 text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={p}
              size="sm"
              variant={p === page ? "default" : "outline"}
              onClick={() => go(p)}
            >
              {p}
            </Button>
          )
        )}
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => go(page + 1)}>
          下一页
        </Button>
      </div>
    </div>
  );
}