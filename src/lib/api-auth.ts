import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getUserRoles, isOwner, isStaff, type UserRoleInfo } from "@/lib/session";

/**
 * PDA / 外部 API 鉴权（Bearer Token 或浏览器 cookie）。
 *
 * 与 requireUser() 的区别：requireUser 未登录时 redirect("/admin/login")，
 * 用于页面（返回 HTML 跳转）；API 必须返回 401 JSON，否则 uni.request 拿到 302/HTML。
 *
 * 使用前需在 auth.ts 启用 bearer 插件：客户端登录后从响应头 set-auth-token
 * 取 token，后续请求带 `Authorization: Bearer <token>`。
 */
export interface ApiUser {
  id: string;
  email: string | null;
  name: string | null;
  roles: UserRoleInfo[];
  isOwner: boolean;
  isStaff: boolean;
}

export async function getApiUser(): Promise<ApiUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  const base = session?.user;
  if (!base) return null;
  const roles = await getUserRoles(base.id);
  return {
    id: base.id,
    email: base.email ?? null,
    name: base.name ?? null,
    roles,
    isOwner: isOwner(roles),
    isStaff: isStaff(roles),
  };
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** 要求登录，否则抛出 ApiError(401)。供 API 路由 try/catch 统一转 JSON。 */
export async function requireApiUser(): Promise<ApiUser> {
  const user = await getApiUser();
  if (!user) throw new ApiError(401, "未登录或登录已过期");
  return user;
}

/** 要求店长/店员（staff），捐赠人账号一律 403。PDA / 管理侧 API 用。 */
export async function requireApiStaff(): Promise<ApiUser> {
  const user = await requireApiUser();
  if (!user.isStaff) throw new ApiError(403, "捐赠人账号无工作台权限");
  return user;
}

/** 要求店长角色，否则抛出 ApiError(403)。 */
export async function requireApiOwner(): Promise<ApiUser> {
  const user = await requireApiStaff();
  if (!user.isOwner) throw new ApiError(403, "仅店长可执行该操作");
  return user;
}

/** 把未知异常统一转成 API JSON 响应（含 ApiError 状态码）。 */
export function apiErrorResponse(e: unknown): Response {
  const status = e instanceof ApiError ? e.status : 500;
  const message = e instanceof Error ? e.message : "服务器内部错误";
  return Response.json({ ok: false, message }, { status });
}
