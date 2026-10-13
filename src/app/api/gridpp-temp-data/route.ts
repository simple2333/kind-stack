import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 锐浪报表打印临时数据（内存 Map + TTL）。
 *
 * 打印流程：前端生成 dataKey → POST 将待打印数据存入内存（60s 过期），
 * 锐浪打印/预览页面通过 GET 匿名取数渲染打印。dataKey 为一次性随机票据，风险可控。
 *
 * - 插件版（print.html / directPrint.html）期望数据信封：{"row":[{...}]}
 * - HTML5 版（printHtml5.html）期望数据信封：{"Table":[{...}]}
 * 通过 GET 参数 h5 区分返回格式。
 */
const PRINT_TEMP_EXPIRE_MS = 60_000;

interface TempEntry {
  data: unknown;
  expiresAt: number;
}

/** 模块级内存存储（单实例运行，重启即清空，可接受） */
const tempStore = new Map<string, TempEntry>();

/** dataKey 格式：13位时间戳 + 16位大写字母数字随机串，防止任意 key 探测 */
const DATA_KEY_PATTERN = /^\d{13}[A-Z0-9]{16}$/;

function purgeExpired(): void {
  const now = Date.now();
  for (const [key, entry] of tempStore) {
    if (entry.expiresAt < now) tempStore.delete(key);
  }
}

/**
 * POST 二义性处理：
 * - 前端「存储」：body 为 {dataKey, rows}
 * - 锐浪插件「取数」：插件 grplugin_http 按 URL 扩展名判断方法，/api/gridpp-temp-data?dataKey=...
 *   不以 .json 结尾 → 用 POST 且无 body 来拉取数据（与 ruoyi getTempData 的 @PostMapping 一致）。
 * 因此需区分：body 含 rows 视为存储，否则视为取数。
 */
export async function POST(req: NextRequest) {
  const queryDataKey = req.nextUrl.searchParams.get("dataKey") ?? "";

  // 无 body（或无法解析 JSON）：视为插件取数
  let body: Record<string, unknown> | null = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const rows = body ? body.rows : undefined;

  // 插件取数：dataKey 在 query 中，body 无 rows
  if (rows === undefined && queryDataKey) {
    return retrieve(queryDataKey, false);
  }

  // 存储
  const dataKey = typeof body?.dataKey === "string" ? body.dataKey : "";
  if (!DATA_KEY_PATTERN.test(dataKey)) {
    return NextResponse.json({ ok: false, error: "dataKey 格式不合法" }, { status: 400 });
  }
  if (!Array.isArray(rows)) {
    return NextResponse.json({ ok: false, error: "rows 必须为数组" }, { status: 400 });
  }
  purgeExpired();
  tempStore.set(dataKey, { data: rows, expiresAt: Date.now() + PRINT_TEMP_EXPIRE_MS });
  return NextResponse.json({ ok: true });
}

/** 匿名取数接口（锐浪插件 / HTML5 引擎直接 XHR 拉取，无登录态）。h5=1 返回 HTML5 信封格式。 */
export async function GET(req: NextRequest) {
  const dataKey = req.nextUrl.searchParams.get("dataKey") ?? "";
  const isH5 = req.nextUrl.searchParams.get("h5") === "1";
  return retrieve(dataKey, isH5);
}

function retrieve(dataKey: string, isH5: boolean): NextResponse {
  if (!DATA_KEY_PATTERN.test(dataKey)) {
    return NextResponse.json(buildResult([], isH5));
  }
  purgeExpired();
  const entry = tempStore.get(dataKey);
  if (!entry) {
    return NextResponse.json(buildResult([], isH5));
  }
  // 取出后即删除，避免重复打印同一批次数据
  tempStore.delete(dataKey);
  return NextResponse.json(buildResult(entry.data as unknown[], isH5));
}

function buildResult(rows: unknown[], isH5: boolean): Record<string, unknown> {
  if (isH5) {
    // HTML5 引擎期望 {"Table":[...]}
    return { Table: rows };
  }
  // 插件版期望 {"row":[...]}
  return { row: rows };
}
