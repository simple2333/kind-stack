import { createAuthClient } from "better-auth/react";

const fallback = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const authClient = createAuthClient({
  // 局域网访问时，浏览器发请求的地址就是当前页面地址（如 http://192.168.1.5:3000），
  // 不能写死 localhost，否则局域网设备会把登录请求发到自己本机。
  baseURL: typeof window !== "undefined" ? window.location.origin : fallback,
});

export const { signIn, signUp, signOut, useSession } = authClient;