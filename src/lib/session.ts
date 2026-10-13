import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { userRoles, roles } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface UserRoleInfo {
  id: string;
  name: string;
}

export async function getUserRoles(userId: string): Promise<UserRoleInfo[]> {
  const rows = await db
    .select({ id: roles.id, name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));
  return rows;
}

export async function getSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session;
}

export async function getCurrentUser() {
  const session = await getSession();
  const base = session?.user ?? null;
  if (!base) return null;
  const userRolesInfo = await getUserRoles(base.id);
  return { ...base, roles: userRolesInfo } as typeof base & { roles: UserRoleInfo[] };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  return user;
}

/** 仅店长/店员可进管理端；捐赠人账号一律挡回其个人中心。 */
export async function requireStaff() {
  const user = await requireUser();
  if (isDonorOnly(user.roles)) redirect("/account");
  return user;
}

/** 要求已登录的捐赠人（未登录跳登录页；店长/店员也允许用于测试）。 */
export async function requireDonor() {
  const user = await getCurrentUser();
  if (!user) redirect("/account/login");
  return user;
}

export function isOwner(roles: UserRoleInfo[] | undefined): boolean {
  return !!roles?.some((r) => r.id === "owner");
}

export function isStaff(roles: UserRoleInfo[] | undefined): boolean {
  return !!roles?.some((r) => r.id === "owner" || r.id === "clerk");
}

/** 仅有捐赠人角色（无店长/店员角色）。 */
export function isDonorOnly(roles: UserRoleInfo[] | undefined): boolean {
  const hasDonor = !!roles?.some((r) => r.id === "donor");
  return hasDonor && !isStaff(roles);
}