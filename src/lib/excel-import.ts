import { db } from "@/db";
import { category, item } from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import * as XLSX from "xlsx";
import { createItems } from "@/lib/items";
import { parseCategoryPath, ensureCategoryPath } from "@/lib/category";
import { excelImportSchema } from "@/lib/validation";

/**
 * Excel 批量导入核心逻辑（无鉴权、无 revalidatePath），供管理端 action 复用。
 *
 * 数据来源：闲鱼「门店订单列表」导出。只处理「处理类型=物资入库」的行（其余忽略）。
 * 映射规则：
 *   物资标题 → name；类目（完整「大类-小类」）→ category；物资售价（分）÷100 → price；
 *   来源默认「闲鱼」→ origin；闲鱼订单号 → external_no（唯一，用于重复导入去重）。
 *
 * 解析放在服务端（xlsx 不再进客户端 bundle，避免点开页面时加载 1MB JS 卡顿）。
 */

/** 与 Excel 表头严格对应（闲鱼「门店订单列表」导出） */
const HANDLED_TYPE = "物资入库";

async function countCategoryRows(): Promise<number> {
  const rows = await db.select({ c: sql<number>`count(*)` }).from(category);
  return rows[0].c;
}
const COL = {
  externalNo: "闲鱼订单号",
  handledType: "处理类型",
  name: "物资标题",
  category: "类目",
  price: "物资售价",
  photo: "物资图片",
  orderedAt: "订单时间",
} as const;

export interface ExcelRow {
  externalNo?: string;
  name: string;
  category?: string;
  price?: number;
  photo?: string;
  handledType?: string;
  orderedAt?: string;
}

export interface ExcelPreview {
  ok: boolean;
  message?: string;
  fileName?: string;
  total: number;
  matched: number;
  skippedType: number;
  skippedEmpty: number;
  rows: ExcelRow[];
}

/** 服务端解析 Excel（base64），过滤出「物资入库」行并按分→元换算售价 */
export function parseExcelBuffer(base64: string, fileName?: string): ExcelPreview {
  const empty: ExcelPreview = { ok: false, total: 0, matched: 0, skippedType: 0, skippedEmpty: 0, rows: [] };
  let raw: Record<string, unknown>[];
  try {
    const buf = Buffer.from(base64, "base64");
    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return { ...empty, message: "未找到工作表" };
    raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  } catch {
    return { ...empty, message: "文件解析失败，请确认是 .xlsx 文件" };
  }

  const rows: ExcelRow[] = [];
  let skippedEmpty = 0;
  for (const r of raw) {
    const handledType = String(r[COL.handledType] ?? "").trim();
    if (handledType !== HANDLED_TYPE) continue;
    const name = String(r[COL.name] ?? "").trim();
    if (!name) {
      skippedEmpty++;
      continue;
    }
    const priceRaw = Number(String(r[COL.price] ?? "").replace(/[^\d.]/g, ""));
    rows.push({
      externalNo: String(r[COL.externalNo] ?? "").trim() || undefined,
      name,
      category: String(r[COL.category] ?? "").trim() || undefined,
      price: Number.isFinite(priceRaw) && priceRaw > 0 ? Math.round((priceRaw / 100) * 100) / 100 : undefined,
      photo: String(r[COL.photo] ?? "").trim() || undefined,
      handledType,
      orderedAt: String(r[COL.orderedAt] ?? "").trim() || undefined,
    });
  }

  return {
    ok: true,
    fileName,
    total: raw.length,
    matched: rows.length,
    skippedType: raw.length - rows.length - skippedEmpty,
    skippedEmpty,
    rows,
  };
}

export interface ImportResult {
  ok: boolean;
  message: string;
  imported: number;
  skipped: number;
  categories: number;
  samples: { code: string; name: string; price: number | null }[];
  skippedSamples: { name: string; reason: string }[];
}

export async function importItemsFromExcelCore(input: {
  defaultOrigin?: string;
  rows: ExcelRow[];
}): Promise<ImportResult> {
  const parsed = excelImportSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "输入无效",
      imported: 0,
      skipped: 0,
      categories: 0,
      samples: [],
      skippedSamples: [],
    };
  }

  const origin = (parsed.data.defaultOrigin ?? "闲鱼").trim() || "闲鱼";
  // 只保留「物资入库」的行（handledType 未提供则视为已由前端过滤）
  const rows = parsed.data.rows.filter((r) => !r.handledType || r.handledType === HANDLED_TYPE);
  const ignoredByType = parsed.data.rows.length - rows.length;

  // 订单号去重：查已存在的 external_no
  const externalNos = [...new Set(rows.map((r) => r.externalNo?.trim()).filter((v): v is string => !!v))];
  const existing = externalNos.length
    ? await db
        .select({ externalNo: item.externalNo })
        .from(item)
        .where(inArray(item.externalNo, externalNos))
    : [];
  const existingSet = new Set(existing.map((e) => e.externalNo).filter((v): v is string => !!v));

  const toCreate: typeof rows = [];
  const skippedSamples: { name: string; reason: string }[] = [];
  for (const r of rows) {
    const no = r.externalNo?.trim();
    if (no && existingSet.has(no)) {
      skippedSamples.push({ name: r.name, reason: `订单号已导入（${no}）` });
      existingSet.delete(no); // 同一文件内重复也只跳过一次提示
      continue;
    }
    if (no) existingSet.add(no);
    toCreate.push(r);
  }

  // 类目自动登记到两级分类树（大类 + 小类），忽略空值
  const catPaths = [...new Set(toCreate.map((r) => r.category?.trim()).filter((v): v is string => !!v))];
  let registeredCats = 0;
  for (const path of catPaths) {
    const { major, minor } = parseCategoryPath(path);
    if (!major) continue;
    const before = await countCategoryRows();
    await ensureCategoryPath(major, minor);
    if ((await countCategoryRows()) > before) registeredCats++;
  }

  const created = await createItems(
    toCreate.map((r) => ({
      name: r.name.trim(),
      category: r.category?.trim() || undefined,
      price: r.price,
      source: "import",
      origin,
      externalNo: r.externalNo?.trim() || undefined,
    }))
  );

  const skipped = ignoredByType + skippedSamples.length;
  return {
    ok: true,
    message: `已导入 ${created.length} 件，跳过 ${skipped} 条`,
    imported: created.length,
    skipped,
    categories: registeredCats,
    samples: created.slice(0, 8).map((c) => ({ code: c.code, name: c.name, price: c.price })),
    skippedSamples: skippedSamples.slice(0, 8),
  };
}

/** 统计 item 表按来源（origin）的条数，供导入页展示 */
export async function countByOrigin(): Promise<{ origin: string | null; count: number }[]> {
  const rows = await db
    .select({ origin: item.origin, count: sql<number>`count(*)` })
    .from(item)
    .groupBy(item.origin)
    .orderBy(sql`count(*) desc`);
  return rows;
}

/** 该订单号是否已存在于 item 表 */
export async function externalNoExists(no: string): Promise<boolean> {
  const rows = await db.select({ id: item.id }).from(item).where(eq(item.externalNo, no)).limit(1);
  return rows.length > 0;
}
