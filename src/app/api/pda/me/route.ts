import { requireApiStaff, apiErrorResponse } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** PDA 获取当前登录用户与角色（校验 token 是否有效）。 */
export async function GET() {
  try {
    const user = await requireApiStaff();
    return Response.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isOwner: user.isOwner,
        isStaff: user.isStaff,
        roles: user.roles.map((r) => r.id),
      },
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
