import type { NextConfig } from "next";

/** 安全响应头（参考 OWASP 与主流框架默认配置） */
const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=()",
  },
];

// 开发态放行局域网 IP：Next.js dev 服务器默认只允许 localhost 跨域访问 dev 资源
//（JS chunk / 字体 / HMR 等），否则局域网设备会拿到 403，导致按钮事件不生效、登录失败。
// 这里取 NEXT_PUBLIC_APP_URL 的主机名（如 192.168.1.2）加入允许列表，可在 .env.local 里改。
const allowedDevHost = (() => {
  const u = process.env.NEXT_PUBLIC_APP_URL || "";
  try {
    return new URL(u).hostname;
  } catch {
    return "";
  }
})();

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "bwip-js"],
  allowedDevOrigins: allowedDevHost ? [allowedDevHost] : [],
  experimental: {
    serverActions: {
      // 拍照入库会把图片以 base64 放进 Server Action 请求体，默认 1MB 不够，
      // 手机一张照片常超 1MB。放宽到 10MB（前端也会先压缩，见 intake.tsx）。
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;