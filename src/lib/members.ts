import { db } from "@/db";
import { users, userRoles, roles, loginLog, donationRequest, accounts } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export interface Member {
  id: string;
  name: string;
  email: string | null;
  displayName: string | null;
  disabled: boolean;
  roleId: string | null;
  roleName: string | null;
  createdAt: string;
  lastLogin: string | null;
}

export async function listMembers(): Promise<Member[]> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      displayName: users.displayName,
      disabled: users.disabled,
      roleId: userRoles.roleId,
      roleName: roles.name,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(roles, eq(roles.id, userRoles.roleId))
    .orderBy(users.createdAt);

  const lg = await db
    .select({ loginName: loginLog.loginName, t: sql<string>`max(${loginLog.loginTime})` })
    .from(loginLog)
    .groupBy(loginLog.loginName);
  const lastByEmail = new Map(lg.map((r) => [r.loginName, r.t]));

  // 按 userId 去重（一个用户一个角色展示；若多角色，优先店长）
  const byId = new Map<string, Member>();
  for (const r of rows) {
    const member: Member = {
      id: r.id,
      name: r.name,
      email: r.email,
      displayName: r.displayName,
      disabled: r.disabled,
      roleId: r.roleId,
      roleName: r.roleName,
      createdAt: new Date(r.createdAt).toISOString(),
      lastLogin: r.email ? lastByEmail.get(r.email) ?? null : null,
    };
    const existing = byId.get(r.id);
    if (!existing || (member.roleId === "owner" && existing.roleId !== "owner")) {
      byId.set(r.id, member);
    }
  }
  return [...byId.values()];
}

export async function countOwner(): Promise<number> {
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(userRoles)
    .where(eq(userRoles.roleId, "owner"));
  return rows[0].c;
}

// ============================================================
// 捐赠人管理（店长查看/维护捐赠客户）
// ============================================================

export interface DonorAccount {
  id: string;
  name: string;
  email: string | null;
  displayName: string | null;
  image: string | null;
  disabled: boolean;
  createdAt: string;
  lastLogin: string | null;
  donationCount: number;
  lastDonationAt: string | null;
  viaWechat: boolean;
}

/** 列出所有「捐赠人」角色账号（含捐赠次数统计）。店长维护客户用。 */
export async function listDonorAccounts(): Promise<DonorAccount[]> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      displayName: users.displayName,
      image: users.image,
      disabled: users.disabled,
      createdAt: users.createdAt,
    })
    .from(userRoles)
    .innerJoin(users, eq(users.id, userRoles.userId))
    .where(eq(userRoles.roleId, "donor"))
    .orderBy(users.createdAt);

  // 每个用户的捐赠统计（次数 / 件数 / 最近一次）
  const stats = await db
    .select({
      userId: donationRequest.userId,
      cnt: sql<number>`count(*)`,
      last: sql<string>`max(${donationRequest.createdAt})`,
    })
    .from(donationRequest)
    .groupBy(donationRequest.userId);
  const statByUser = new Map(stats.map((s) => [s.userId, s]));

  // 是否用微信注册（accounts.providerId）
  const waRows = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(eq(accounts.providerId, "wechat"));
  const viaWechat = new Set(waRows.map((r) => r.userId));

  // 最近登录
  const lg = await db
    .select({ loginName: loginLog.loginName, t: sql<string>`max(${loginLog.loginTime})` })
    .from(loginLog)
    .groupBy(loginLog.loginName);
  const lastByEmail = new Map(lg.map((r) => [r.loginName, r.t]));

  return rows.map((r) => {
    const st = statByUser.get(r.id);
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      displayName: r.displayName,
      image: r.image,
      disabled: r.disabled,
      createdAt: new Date(r.createdAt).toISOString(),
      lastLogin: r.email ? lastByEmail.get(r.email) ?? null : null,
      donationCount: st?.cnt ?? 0,
      lastDonationAt: st?.last ?? null,
      viaWechat: viaWechat.has(r.id),
    };
  });
}