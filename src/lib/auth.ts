import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins/bearer";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";

// 微信开放平台「网站应用」扫码登录（snsapi_login）。
// 仅在配置了 WECHAT_CLIENT_ID / WECHAT_CLIENT_SECRET 时启用，否则前端不显示微信按钮，
// 邮箱注册/登录照常可用（未取得资质/域名时不影响上线）。
// ⚠️ 启用前提：微信开放平台网站应用需企业主体 + 认证，且回调域必须是已备案域名 + HTTPS。
const wechatEnabled = !!(process.env.WECHAT_CLIENT_ID && process.env.WECHAT_CLIENT_SECRET);

export const auth = betterAuth({
  appName: "益栈",
  // bearer 插件：PDA 端（uni-app）无法使用浏览器 cookie，登录后拿 Bearer token
  // 放 Authorization 头访问 /api/pda/*。浏览器端 cookie 会话不受影响。
  plugins: [bearer()],
  // 社交登录：目前仅微信（网站应用扫码）。未配置凭据时整体省略，避免启动即报错。
  ...(wechatEnabled
    ? {
        socialProviders: {
          wechat: {
            clientId: process.env.WECHAT_CLIENT_ID as string,
            clientSecret: process.env.WECHAT_CLIENT_SECRET as string,
            lang: "cn" as const,
          },
        },
      }
    : {}),
  // baseURL 只读 BETTER_AUTH_URL；为空时 Better Auth 按请求 Host 自动识别，
  // 避免被 NEXT_PUBLIC_APP_URL 的 localhost 值污染导致局域网登录被拒。
  baseURL: process.env.BETTER_AUTH_URL || undefined,
  trustedOrigins: [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    "http://localhost:3000",
    // 开发态通配：允许局域网任意 IP 访问本服务（Better Auth 校验 Origin 用）
    process.env.NODE_ENV !== "production" && "http://*:3000",
  ].filter((v): v is string => !!v),
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
    usePlural: true,
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      displayName: {
        type: "string",
        input: true,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // 公开注册（邮箱 / 微信）一律是「捐赠人 donor」，不具备管理端权限。
          // 店长/店员账号不在公开入口创建：seed 建店长、店长后台(createClerk)建店员，
          // 两处都会在创建后显式改写角色（先删 donor 再加目标角色），杜绝越权。
          await db
            .insert(schema.userRoles)
            .values({ userId: user.id, roleId: "donor" })
            .onConflictDoNothing();
        },
      },
    },
    session: {
      create: {
        before: async (data) => {
          // 被店长禁用的账号不允许创建会话（登录）：返回 false 中止创建
          const userId = (data as { userId?: string }).userId;
          if (!userId) return;
          const u = (
            await db
              .select({ disabled: schema.users.disabled })
              .from(schema.users)
              .where(eq(schema.users.id, userId))
              .limit(1)
          )[0];
          if (u?.disabled) return false;
        },
      },
    },
  },
  advanced: {
    // Secure cookie 默认：生产用 HTTPS（域名）开，裸 IP/HTTP 部署需关。
    // 设 BETTER_AUTH_USE_SECURE_COOKIES=true 强制开（仅 HTTPS 场景）；
    // 设 false 强制关（裸公网 IP + HTTP，否则 Secure cookie 不被发送导致登录失效）。
    useSecureCookies:
      process.env.BETTER_AUTH_USE_SECURE_COOKIES === "true"
        ? true
        : process.env.BETTER_AUTH_USE_SECURE_COOKIES === "false"
          ? false
          : process.env.NODE_ENV === "production",
    defaultCookieAttributes: {
      secure:
        process.env.BETTER_AUTH_USE_SECURE_COOKIES === "true"
          ? true
          : process.env.BETTER_AUTH_USE_SECURE_COOKIES === "false"
            ? false
            : process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
    storage: "memory",
  },
});

export type Session = typeof auth.$Infer.Session;

/** 是否已配置微信开放平台凭据（供服务端页面决定是否展示微信登录按钮）。 */
export function isWechatEnabled(): boolean {
  return wechatEnabled;
}