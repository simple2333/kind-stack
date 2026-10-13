"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { approveDonationRequest, rejectDonationRequest } from "@/lib/actions";
import ConfirmDialog from "@/components/confirm-dialog";
import { useCategories } from "@/lib/use-categories";
import type { DonationRequestItem } from "@/lib/donation-request";

const CONDITION_OPTIONS = ["全新", "九成新", "八成新", "七成新", "微瑕", "破损"];

const STATUS_LABEL: Record<string, string> = { pending: "待复核", approved: "已通过", rejected: "已驳回" };

interface ApproveTarget {
  item: DonationRequestItem;
  name: string;
  condition: string;
  category: string;
  quantity: string;
  price: string;
}

export default function ReviewList({ requests }: { requests: DonationRequestItem[] }) {
  const router = useRouter();
  const [approveTarget, setApproveTarget] = useState<ApproveTarget | null>(null);
  const [rejectTarget, setRejectTarget] = useState<DonationRequestItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const { categories } = useCategories();

  function openApprove(item: DonationRequestItem) {
    setApproveTarget({
      item,
      name: item.name,
      condition: item.condition ?? "",
      category: item.category ?? "",
      quantity: String(item.quantity ?? 1),
      price: "",
    });
  }

  function handleApprove() {
    if (!approveTarget) return;
    const { item, name, condition, category, quantity, price } = approveTarget;
    if (!name.trim()) {
      toast.error("物品名称不能为空");
      return;
    }
    const qty = Number(quantity) || 1;
    const priceNum = price.trim() ? Number(price) : undefined;
    const payload = {
      name: name.trim(),
      condition: condition || undefined,
      category: category || undefined,
      quantity: qty,
      ...(priceNum != null && !Number.isNaN(priceNum) ? { price: priceNum } : {}),
    };
    startTransition(async () => {
      const res = await approveDonationRequest({
        id: item.requestId,
        itemIndexes: [item.index],
        items: [payload],
      });
      if (res.ok) {
        toast.success(`${res.message}：${res.codes?.join(", ")}`);
        setApproveTarget(null);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  function handleReject() {
    if (!rejectTarget) return;
    startTransition(async () => {
      const res = await rejectDonationRequest({
        id: rejectTarget.requestId,
        itemIndexes: [rejectTarget.index],
        reason: rejectReason || undefined,
      });
      if (res.ok) {
        toast.success(res.message);
        setRejectTarget(null);
        setRejectReason("");
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  if (requests.length === 0) {
    return <p className="text-muted-foreground py-10 text-center">该分类下暂无登记</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {requests.map((item) => {
        const isPending = item.status === "pending";
        return (
          <div
            key={`${item.requestId}-${item.index}`}
            className={`border rounded-lg p-4 flex flex-col gap-3 ${isPending ? "border-primary/40" : "opacity-70"}`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">#{item.requestId}</span>
                <Badge variant={item.status === "pending" ? "default" : item.status === "approved" ? "secondary" : "destructive"}>
                  {STATUS_LABEL[item.status] ?? item.status}
                </Badge>
                <span className="text-sm">{item.alias ?? "匿名捐赠"}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(item.createdAt).toLocaleString("zh-CN")}
              </div>
            </div>

            {item.note && <p className="text-sm text-muted-foreground">备注：{item.note}</p>}

            <div className="flex items-center gap-2">
              <Input
                value={item.name}
                readOnly
                className="flex-1"
                placeholder="物品名称"
              />
              <Input
                value={String(item.quantity ?? 1)}
                readOnly
                className="w-20 text-center"
                placeholder="数量"
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">成色</span>
              <div className="flex gap-1 flex-wrap">
                {CONDITION_OPTIONS.map((c) => (
                  <Button
                    key={c}
                    size="sm"
                    variant={item.condition === c ? "default" : "outline"}
                    disabled
                  >
                    {c}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">分类</span>
              <Input value={item.category ?? ""} readOnly className="max-w-xs" placeholder="未选择分类" />
            </div>

            {isPending && (
              <div className="flex gap-2 justify-end items-center">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setRejectTarget(item)}
                >
                  驳回
                </Button>
                <Button size="sm" onClick={() => openApprove(item)}>
                  通过并入库
                </Button>
              </div>
            )}
          </div>
        );
      })}

      <ConfirmDialog
        open={approveTarget != null}
        onOpenChange={(v) => !v && setApproveTarget(null)}
        title="通过并正式入库？"
        description="将按当前填写的内容生成一件一码，写入透明账本，并自动生成回执码（可打印捐赠回执标签）。"
        confirmText="通过并入库"
        pending={isPending}
        onConfirm={handleApprove}
      >
        {approveTarget != null && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Input
                value={approveTarget.name}
                onChange={(e) => setApproveTarget({ ...approveTarget, name: e.target.value })}
                placeholder="物品名称"
                className="flex-1"
              />
              <Input
                value={approveTarget.quantity}
                onChange={(e) => setApproveTarget({ ...approveTarget, quantity: e.target.value })}
                placeholder="数量"
                className="w-20 text-center"
                inputMode="numeric"
              />
              <Input
                value={approveTarget.price}
                onChange={(e) => setApproveTarget({ ...approveTarget, price: e.target.value })}
                placeholder="单价(元,可选)"
                className="w-28 text-right"
                inputMode="decimal"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">成色</span>
              <div className="flex gap-1 flex-wrap">
                {CONDITION_OPTIONS.map((c) => (
                  <Button
                    key={c}
                    size="sm"
                    variant={approveTarget.condition === c ? "default" : "outline"}
                    onClick={() =>
                      setApproveTarget({
                        ...approveTarget,
                        condition: approveTarget.condition === c ? "" : c,
                      })
                    }
                  >
                    {c}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">分类</span>
              <select
                value={approveTarget.category}
                onChange={(e) => setApproveTarget({ ...approveTarget, category: e.target.value })}
                className="rounded-md border bg-background px-2 py-2 text-sm"
              >
                <option value="">请选择分类</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={rejectTarget != null}
        onOpenChange={(v) => !v && setRejectTarget(null)}
        title="驳回这件物品？"
        description="仅驳回该物品，其余物品仍可继续通过入库。"
        confirmText="确认驳回"
        variant="destructive"
        pending={isPending}
        onConfirm={handleReject}
      >
        {rejectTarget != null && (
          <div className="-mt-2">
            <Input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="驳回原因（可选）"
            />
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
