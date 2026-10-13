"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ConfirmDialog from "@/components/confirm-dialog";
import { revertSaleAction } from "@/lib/actions";
import type { SaleOrderRow } from "@/lib/sales";

export default function SalesTable({ orders }: { orders: SaleOrderRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [revertOrder, setRevertOrder] = useState<SaleOrderRow | null>(null);
  const [revertLine, setRevertLine] = useState<{ orderNo: string; line: SaleOrderRow["lines"][number] } | null>(null);

  function doRevertOrder() {
    if (!revertOrder) return;
    startTransition(async () => {
      const res = await revertSaleAction({ orderId: revertOrder.id, reason: `整单撤销 ${revertOrder.orderNo}` });
      toast[res.ok ? "success" : "error"](res.message);
      setRevertOrder(null);
      if (res.ok) router.refresh();
    });
  }

  function doRevertLine() {
    if (!revertLine) return;
    startTransition(async () => {
      const res = await revertSaleAction({
        orderItemIds: [revertLine.line.id],
        reason: `单件撤销 ${revertLine.line.code}`,
      });
      toast[res.ok ? "success" : "error"](res.message);
      setRevertLine(null);
      if (res.ok) router.refresh();
    });
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>销售单号</TableHead>
            <TableHead>时间</TableHead>
            <TableHead>金额</TableHead>
            <TableHead>件数</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>明细</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o) => (
            <TableRow key={o.id}>
              <TableCell className="font-mono text-xs">{o.orderNo}</TableCell>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(o.createdAt).toLocaleString("zh-CN")}
              </TableCell>
              <TableCell className="font-medium">¥{o.totalAmount.toFixed(2)}</TableCell>
              <TableCell>{o.itemCount}</TableCell>
              <TableCell>
                {o.status === "canceled" ? (
                  <Badge variant="destructive">已撤销</Badge>
                ) : (
                  <Badge variant="secondary">已完成</Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {o.lines.map((l) => (
                    <div key={l.id} className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-xs text-muted-foreground">{l.code}</span>
                      <span className="truncate max-w-40">{l.name}</span>
                      <span className="text-xs">×{l.qty}</span>
                      {l.price != null && <span className="text-xs text-muted-foreground">¥{l.price}</span>}
                      {l.status === "canceled" ? (
                        <Badge variant="destructive" className="text-[10px]">
                          已撤销
                        </Badge>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-destructive"
                          onClick={() => setRevertLine({ orderNo: o.orderNo, line: l })}
                          disabled={isPending}
                        >
                          撤销此件
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-right align-top">
                <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                  <Link href={`/admin/stock?q=${encodeURIComponent(o.lines[0]?.code ?? "")}`} className="text-xs underline underline-offset-2 text-muted-foreground">
                    货架
                  </Link>
                  {o.status !== "canceled" && (
                    <Button variant="outline" size="sm" onClick={() => setRevertOrder(o)} disabled={isPending}>
                      整单撤销
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={revertOrder != null}
        onOpenChange={(v) => !v && setRevertOrder(null)}
        title="整单撤销售出"
        description={`确定撤销销售单 ${revertOrder?.orderNo} 的全部 ${revertOrder?.itemCount} 件售出？物品库存与状态会一并还原。`}
        confirmText="确认撤销"
        variant="destructive"
        pending={isPending}
        onConfirm={doRevertOrder}
      />

      <ConfirmDialog
        open={revertLine != null}
        onOpenChange={(v) => !v && setRevertLine(null)}
        title="单件撤销售出"
        description={`确定撤销 ${revertLine?.line.name}（${revertLine?.line.code}）×${revertLine?.line.qty} 的售出？`}
        confirmText="确认撤销"
        variant="destructive"
        pending={isPending}
        onConfirm={doRevertLine}
      />
    </>
  );
}
