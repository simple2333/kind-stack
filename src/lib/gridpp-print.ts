/**
 * 锐浪报表(Grid++Report)打印客户端工具（客户端专用，含 DOM/fetch）。
 *
 * 打印流程：生成 dataKey → POST 临时数据到 /api/gridpp-temp-data →
 * 打开对应打印页面（插件直连/插件预览/HTML5预览），页面按 dataKey 匿名取数渲染。
 */

export type GridppMode = "direct" | "preview" | "html5";

/** 生成一次性临时数据凭证（13位时间戳 + 16位大写字母数字随机串） */
export function genDataKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let rand = "";
  for (let i = 0; i < 16; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  return Date.now() + rand;
}

/**
 * 加载 public/grf/manifest.json 中的锐浪模板清单。
 * 失败时返回空数组（调用方自行回退）。
 */
export async function loadGrfTemplates(): Promise<string[]> {
  try {
    const res = await fetch("/grf/manifest.json");
    if (!res.ok) return [];
    const list: unknown = await res.json();
    return Array.isArray(list) ? (list as string[]) : [];
  } catch {
    return [];
  }
}

/** 解析 .grf 模板中的 DetailGrid.Recordset.Field 字段名（用于前端提示/预览数据）。 */
export async function loadGrfFields(file?: string): Promise<string[]> {
  if (!file) return [];
  try {
    const res = await fetch(`/grf/${file}`);
    if (!res.ok) return [];
    const json = (await res.json()) as {
      DetailGrid?: { Recordset?: { Field?: { Name?: string }[] } };
    };
    return (json?.DetailGrid?.Recordset?.Field || []).map((f) => f?.Name).filter(Boolean) as string[];
  } catch {
    return [];
  }
}

/**
 * 打开锐浪打印/预览页。
 * @param rows      打印数据行数组
 * @param grfTemplate .grf 文件名（如 YZ-item-50x30.grf，可省略 .grf）
 * @param mode      direct=插件直连打印 / preview=插件预览 / html5=HTML5预览(Chrome可用)
 */
export async function gridppPrint(
  rows: Record<string, unknown>[],
  grfTemplate: string,
  mode: GridppMode
): Promise<{ ok: boolean; error?: string }> {
  if (!rows.length) return { ok: false, error: "没有可打印的数据" };
  if (!grfTemplate) return { ok: false, error: "请选择锐浪模板" };

  const dataKey = genDataKey();
  const page = mode === "direct" ? "directPrint.html" : mode === "preview" ? "print.html" : "printHtml5.html";

  // 存临时数据
  try {
    const res = await fetch("/api/gridpp-temp-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataKey, rows }),
    });
    if (!res.ok) return { ok: false, error: "保存打印数据失败，请重试" };
  } catch {
    return { ok: false, error: "保存打印数据失败，请重试" };
  }

  const dataUrl = `/api/gridpp-temp-data?dataKey=${dataKey}`;
  const url = `/gridpp/${page}?printTpl=${encodeURIComponent(grfTemplate)}&dataUrl=${encodeURIComponent(dataUrl)}`;
  window.open(url, "_blank");
  return { ok: true };
}

/**
 * 提示文案：锐浪打印的浏览器/插件说明。
 */
export const GRIDPP_HINT =
  "锐浪打印：直接打印与预览需在支持锐浪插件的浏览器（360 极速浏览器兼容模式 / IE11）中使用，首次使用会提示安装插件；HTML5 预览可在 Chrome/Edge 直接查看效果（不弹打印框）。";
