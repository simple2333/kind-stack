"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { addMajorCategoryAction, addMinorCategoryAction, deleteCategoryAction } from "@/lib/actions";
import ConfirmDialog from "@/components/confirm-dialog";
import type { CategoryNode } from "@/lib/category";

export default function CategoryManager({ tree }: { tree: CategoryNode[] }) {
  const router = useRouter();
  const [majorName, setMajorName] = useState("");
  const [minorInputs, setMinorInputs] = useState<Record<number, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; label: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAddMajor() {
    if (!majorName.trim()) {
      toast.error("请输入大分类名称");
      return;
    }
    startTransition(async () => {
      const res = await addMajorCategoryAction(majorName.trim());
      if (res.ok) {
        toast.success(res.message);
        setMajorName("");
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  function handleAddMinor(parentId: number) {
    const name = (minorInputs[parentId] ?? "").trim();
    if (!name) {
      toast.error("请输入小分类名称");
      return;
    }
    startTransition(async () => {
      const res = await addMinorCategoryAction(parentId, name);
      if (res.ok) {
        toast.success(res.message);
        setMinorInputs((s) => ({ ...s, [parentId]: "" }));
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const res = await deleteCategoryAction(deleteTarget.id);
      if (res.ok) {
        toast.success(res.message);
        setDeleteTarget(null);
        router.refresh();
      } else {
        toast.error(res.message);
        setDeleteTarget(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 flex-wrap items-center">
        <Input
          value={majorName}
          onChange={(e) => setMajorName(e.target.value)}
          placeholder="新增大分类，如：玩具"
          className="max-w-60"
          onKeyDown={(e) => e.key === "Enter" && handleAddMajor()}
        />
        <Button onClick={handleAddMajor} disabled={isPending || !majorName.trim()}>
          新增大分类
        </Button>
        <span className="text-xs text-muted-foreground">
          分类为两级：大分类（如「玩具」）+ 小分类（如「创意整蛊玩具」）。
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {tree.map((major) => (
          <div key={major.id} className="border rounded-lg p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="text-sm">{major.name}</Badge>
              <span className="text-xs text-muted-foreground">
                {major.children.length} 个小分类
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive h-7 px-2 ml-auto"
                onClick={() => setDeleteTarget({ id: major.id, label: `大分类「${major.name}」` })}
                title="删除大分类"
              >
                删除大类
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {major.children.map((child) => (
                <div key={child.id} className="flex items-center gap-1 border rounded-md px-2 py-1 bg-muted/30">
                  <span className="text-sm">{child.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive h-6 px-1"
                    onClick={() => setDeleteTarget({ id: child.id, label: `${major.name}-${child.name}` })}
                    title="删除小分类"
                  >
                    删
                  </Button>
                </div>
              ))}
              {major.children.length === 0 && (
                <span className="text-xs text-muted-foreground">暂无小分类</span>
              )}
            </div>
            <div className="flex gap-2 items-center">
              <Input
                value={minorInputs[major.id] ?? ""}
                onChange={(e) => setMinorInputs((s) => ({ ...s, [major.id]: e.target.value }))}
                placeholder={`新增「${major.name}」下的小分类，如：创意整蛊玩具`}
                className="max-w-72 h-8"
                onKeyDown={(e) => e.key === "Enter" && handleAddMinor(major.id)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAddMinor(major.id)}
                disabled={isPending || !(minorInputs[major.id] ?? "").trim()}
              >
                + 小分类
              </Button>
            </div>
          </div>
        ))}
        {tree.length === 0 && <p className="text-sm text-muted-foreground">暂无分类，请新增大分类</p>}
      </div>

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`删除${deleteTarget?.label ?? "分类"}？`}
        description="大分类需先删完其小分类；分类下还有物品时无法删除。"
        confirmText="确认删除"
        variant="destructive"
        pending={isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
