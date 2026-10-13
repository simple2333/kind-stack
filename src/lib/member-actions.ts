"use server";

import { z } from "zod";
import { db } from "@/db";
import { users, accounts, sessions, userRoles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hashPassword } from "@better-auth/utils/password";
import { requireUser, isOwner } from "@/lib/session";
import { withOperLog } from "@/lib/oper-log";
import { countOwner } from "@/lib/members";
import { revalidatePath } from "next/cache";

const clerkSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(8, "密码至少 8 位").max(72, "密码过长"),
  name: z.string().trim().min(1, "昵称不能为空").max(50, "昵称过长"),
});

const resetSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(8, "密码至少 8 位").max(72, "密码过长"),
});

const toggleSchema = z.object({
  userId: z.string().min(1),
  disabled: z.boolean(),
});

const deleteSchema = z.object({
  userId: z.string().min(1),
});

async function requireOwner() {
  const user = await requireUser();
  if (!isOwner(user.roles)) {
    const err = new Error("仅店长可操作");
    (err as Error & { code?: string }).code = "FORBIDDEN";
    throw err;
  }
  return user;
}

/** 店长新增店员账号 */
export const createClerk = withOperLog(
  { title: "新增店员", businessType: 1, method: "createClerk" },
  async (input: { email: string; password: string; name: string }): Promise<{ ok: boolean; message: string }> => {
    try {
      await requireOwner();
    } catch {
      return { ok: false, message: "仅店长可操作" };
    }
    const parsed = clerkSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "输入无效" };
    try {
      const res = await auth.api.signUpEmail({
        body: { email: parsed.data.email, password: parsed.data.password, name: parsed.data.name, displayName: parsed.data.name },
      });
      // 注册钩子默认给 donor，这里改成店员：先清 donor 再插入 clerk
      await db.delete(userRoles).where(eq(userRoles.userId, res.user.id));
      await db.insert(userRoles).values({ userId: res.user.id, roleId: "clerk" }).onConflictDoNothing();
      revalidatePath("/admin/settings");
      return { ok: true, message: `已新增店员 ${parsed.data.name}` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "创建失败" };
    }
  }
);

/** 店长重置店员密码（强制其重新登录） */
export const resetMemberPassword = withOperLog(
  { title: "重置店员密码", businessType: 2, method: "resetMemberPassword" },
  async (input: { userId: string; password: string }): Promise<{ ok: boolean; message: string }> => {
    try {
      await requireOwner();
    } catch {
      return { ok: false, message: "仅店长可操作" };
    }
    const parsed = resetSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "输入无效" };
    const target = (await db.select().from(users).where(eq(users.id, parsed.data.userId)).limit(1))[0];
    if (!target) return { ok: false, message: "账号不存在" };
    const hash = await hashPassword(parsed.data.password);
    await db
      .update(accounts)
      .set({ password: hash })
      .where(and(eq(accounts.userId, parsed.data.userId), eq(accounts.providerId, "credential")));
    // 吊销该账号现有会话，需重新登录
    await db.delete(sessions).where(eq(sessions.userId, parsed.data.userId));
    revalidatePath("/admin/settings");
    return { ok: true, message: "密码已重置（该账号需重新登录）" };
  }
);

/** 店长禁用/启用店员账号 */
export const toggleMemberDisabled = withOperLog(
  { title: "禁用/启用店员", businessType: 2, method: "toggleMemberDisabled" },
  async (input: { userId: string; disabled: boolean }): Promise<{ ok: boolean; message: string }> => {
    try {
      await requireOwner();
    } catch {
      return { ok: false, message: "仅店长可操作" };
    }
    const parsed = toggleSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "输入无效" };
    const target = (await db.select().from(users).where(eq(users.id, parsed.data.userId)).limit(1))[0];
    if (!target) return { ok: false, message: "账号不存在" };
    await db
      .update(users)
      .set({ disabled: parsed.data.disabled, updatedAt: new Date() })
      .where(eq(users.id, parsed.data.userId));
    if (parsed.data.disabled) {
      await db.delete(sessions).where(eq(sessions.userId, parsed.data.userId));
    }
    revalidatePath("/admin/settings");
    return { ok: true, message: parsed.data.disabled ? "已禁用该账号" : "已启用该账号" };
  }
);

/** 店长删除店员账号 */
export const deleteMemberAccount = withOperLog(
  { title: "删除店员账号", businessType: 3, method: "deleteMemberAccount" },
  async (input: { userId: string }): Promise<{ ok: boolean; message: string }> => {
    try {
      await requireOwner();
    } catch {
      return { ok: false, message: "仅店长可操作" };
    }
    const parsed = deleteSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "输入无效" };
    const target = (await db.select().from(users).where(eq(users.id, parsed.data.userId)).limit(1))[0];
    if (!target) return { ok: false, message: "账号不存在" };

    const roleRow = (await db.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, parsed.data.userId)).limit(1))[0];
    const owners = await countOwner();
    if (roleRow?.roleId === "owner" && owners <= 1) {
      return { ok: false, message: "不能删除最后一个店长" };
    }
    await db.delete(userRoles).where(eq(userRoles.userId, parsed.data.userId));
    await db.delete(users).where(eq(users.id, parsed.data.userId)); // accounts/sessions 外键级联删除
    revalidatePath("/admin/settings");
    return { ok: true, message: "已删除账号" };
  }
);