import { auth } from "@/lib/auth";
import { getUserRoles, isStaff } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * PDA 登录代理：服务端调用 Better Auth 邮箱密码登录，取出 bearer 插件写入的
 * `set-auth-token` 响应头，返回给 uni-app 保存。这样 PDA 无需自行处理 Origin/Cookie。
 *
 * 请求体：{ email, password }
 * 返回：  { ok, token, user: { id, email, name } }
 */
export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, message: "请求体格式错误" }, { status: 400 });
  }
  const email = (body.email ?? "").trim();
  const password = body.password ?? "";
  if (!email || !password) {
    return Response.json({ ok: false, message: "请输入邮箱和密码" }, { status: 400 });
  }

  try {
    const result = await auth.api.signInEmail({
      body: { email, password },
      returnHeaders: true,
    });
    const token = result.headers.get("set-auth-token");
    const user = result.response?.user;
    if (!token || !user) {
      return Response.json({ ok: false, message: "登录失败，请检查账号密码" }, { status: 401 });
    }
    // 仅店长/店员可登录 PDA 工作台；捐赠人账号（donor）无工作台权限。
    const roles = await getUserRoles(user.id);
    if (!isStaff(roles)) {
      return Response.json({ ok: false, message: "捐赠人账号不能登录工作台，请使用店员账号" }, { status: 403 });
    }
    return Response.json({
      ok: true,
      token,
      user: {
        id: user.id,
        email: user.email ?? null,
        name: user.name ?? null,
        isOwner: roles.some((r) => r.id === "owner"),
        roles: roles.map((r) => r.id),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "登录失败";
    return Response.json({ ok: false, message }, { status: 401 });
  }
}
