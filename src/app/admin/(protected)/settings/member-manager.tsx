"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClerk, resetMemberPassword, toggleMemberDisabled, deleteMemberAccount } from "@/lib/member-actions";
import ConfirmDialog from "@/components/confirm-dialog";
import type { Member } from "@/lib/members";

export default function MemberManager({ members, currentUserId }: { members: Member[]; currentUserId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [resetTarget, setResetTarget] = useState<Member | null>(null);
  const [resetPwd, setResetPwd] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [disableTarget, setDisableTarget] = useState<Member | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    startTransition(async () => {
      const res = await createClerk({ email, password, name });
      if (res.ok) {
        toast.success(res.message);
        setEmail("");
        setName("");
        setPassword("");
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  function handleReset() {
    if (!resetTarget) return;
    if (resetPwd.length < 8) {
      toast.error("新密码至少 8 位");
      return;
    }
    startTransition(async () => {
      const res = await resetMemberPassword({ userId: resetTarget.id, password: resetPwd });
      if (res.ok) {
        toast.success(res.message);
        setResetTarget(null);
        setResetPwd("");
      } else {
        toast.error(res.message);
      }
    });
  }

  function handleToggleDisable() {
    if (!disableTarget) return;
    const nextDisabled = !disableTarget.disabled;
    startTransition(async () => {
      const res = await toggleMemberDisabled({ userId: disableTarget.id, disabled: nextDisabled });
      if (res.ok) {
        toast.success(res.message);
        setDisableTarget(null);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const res = await deleteMemberAccount({ userId: deleteTarget.id });
      if (res.ok) {
        toast.success(res.message);
        setDeleteTarget(null);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 新增店员 */}
      <div className="flex flex-col gap-2 border rounded-lg p-3">
        <p className="text-sm font-medium">新增店员账号</p>
        <div className="flex gap-2 flex-wrap">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="昵称" className="max-w-40" />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="邮箱" className="max-w-56" />
          <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="初始密码（至少 8 位）" className="max-w-48" />
          <Button onClick={handleCreate} disabled={isPending || !email || !password || password.length < 8}>
            新增店员
          </Button>
        </div>
      </div>

      {/* 成员列表 */}
      <div className="flex flex-col divide-y border rounded-lg">
        {members.map((m) => {
          const isSelf = m.id === currentUserId;
          return (
            <div key={m.id} className="p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex flex-col min-w-0">
                  <span className="font-medium truncate">
                    {m.name}
                    {isSelf && <span className="text-xs text-muted-foreground">（当前账号）</span>}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">{m.email}</span>
                </div>
                <Badge variant={m.roleId === "owner" ? "default" : "secondary"}>
                  {m.roleId === "owner" ? "店长" : "店员"}
                </Badge>
                <Badge variant={m.disabled ? "destructive" : "outline"}>{m.disabled ? "已禁用" : "正常"}</Badge>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">
                  注册 {new Date(m.createdAt).toLocaleDateString("zh-CN")}
                  {m.lastLogin ? ` · 最近登录 ${new Date(m.lastLogin).toLocaleString("zh-CN")}` : ""}
                </span>
                {!isSelf && (
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => { setResetTarget(m); setResetPwd(""); }}>
                      重置密码
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDisableTarget(m)}>
                      {m.disabled ? "启用" : "禁用"}
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(m)}>
                      删除
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 重置密码弹窗 */}
      <Dialog open={resetTarget != null} onOpenChange={(v) => !v && setResetTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>重置密码</DialogTitle>
            <DialogDescription>为「{resetTarget?.name}」设置新密码，该账号将需重新登录。</DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            value={resetPwd}
            onChange={(e) => setResetPwd(e.target.value)}
            placeholder="新密码（至少 8 位）"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)}>取消</Button>
            <Button onClick={handleReset} disabled={isPending || resetPwd.length < 8}>
              确认重置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 禁用确认 */}
      <ConfirmDialog
        open={disableTarget != null}
        onOpenChange={(v) => !v && setDisableTarget(null)}
        title={disableTarget?.disabled ? "启用该账号？" : "禁用该账号？"}
        description={
          disableTarget?.disabled
            ? "启用后该账号可以重新登录。"
            : "禁用后该账号将无法登录（当前会话立即失效），可随时再启用。"
        }
        confirmText={disableTarget?.disabled ? "启用" : "禁用"}
        variant={disableTarget?.disabled ? "default" : "destructive"}
        pending={isPending}
        onConfirm={handleToggleDisable}
      />

      {/* 删除确认 */}
      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="删除该账号？"
        description={`将删除「${deleteTarget?.name}」的账号、登录记录与操作历史权限，且不可恢复。`}
        confirmText="删除账号"
        variant="destructive"
        pending={isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}