import { db } from "@/db";
import { category, item } from "@/db/schema";
import { and, asc, eq, isNull, or, sql, type SQL } from "drizzle-orm";

/** 分类以两级树组织：大分类 parentId=null，小分类挂在大分类下。 */
export interface CategoryNode {
  id: number;
  name: string;
  parentId: number | null;
  sort: number;
  children: { id: number; name: string; parentId: number; sort: number }[];
}

/** 大分类（不含子分类） */
export async function listMajorCategories(): Promise<{ id: number; name: string; sort: number }[]> {
  const rows = await db
    .select()
    .from(category)
    .where(isNull(category.parentId))
    .orderBy(asc(category.sort), asc(category.id));
  return rows.map((r) => ({ id: r.id, name: r.name, sort: r.sort }));
}

/** 两级分类树（供设置页/筛选下拉） */
export async function listCategoryTree(): Promise<CategoryNode[]> {
  const rows = await db.select().from(category).orderBy(asc(category.sort), asc(category.id));
  const majors = rows.filter((r) => r.parentId == null);
  const byParent = new Map<number, typeof rows>();
  for (const r of rows) {
    if (r.parentId == null) continue;
    const arr = byParent.get(r.parentId) ?? [];
    arr.push(r);
    byParent.set(r.parentId, arr);
  }
  return majors.map((m) => ({
    id: m.id,
    name: m.name,
    parentId: null,
    sort: m.sort,
    children: (byParent.get(m.id) ?? []).map((c) => ({ id: c.id, name: c.name, parentId: c.id ? m.id : m.id, sort: c.sort })),
  }));
}

/**
 * 扁平分类路径列表（保持旧消费者兼容）：
 * 大分类返回「家居」；小分类返回完整「大类-小类」。用于 PDA 分类接口、简易下拉。
 */
export async function listCategories(): Promise<{ id: number; name: string; sort: number }[]> {
  const rows = await db.select().from(category).orderBy(asc(category.sort), asc(category.id));
  const nameById = new Map(rows.map((r) => [r.id, r.name]));
  const roots = rows.filter((r) => r.parentId == null);
  const out: { id: number; name: string; sort: number }[] = [];
  for (const m of roots) {
    out.push({ id: m.id, name: m.name, sort: m.sort });
    for (const c of rows.filter((r) => r.parentId === m.id)) {
      out.push({ id: c.id, name: `${m.name}-${c.name}`, sort: c.sort });
    }
  }
  // 兼容历史脏数据：parentId 指向不存在的大分类
  for (const r of rows) {
    if (r.parentId != null && !nameById.has(r.parentId)) {
      out.push({ id: r.id, name: r.name, sort: r.sort });
    }
  }
  return out;
}

/** 按「大类-小类」字符串解析出 {major, minor}；无连字符则 minor=null */
export function parseCategoryPath(path: string): { major: string; minor: string | null } {
  const s = path.trim();
  if (!s) return { major: "", minor: null };
  if (!s.includes("-")) return { major: s, minor: null };
  const [m, ...rest] = s.split("-");
  return { major: m.trim(), minor: rest.join("-").trim() || null };
}

/** 组合完整分类名（大类-小类；无小类时只返回大类） */
export function composeCategory(major: string, minor?: string | null): string {
  const m = major.trim();
  const n = (minor ?? "").trim();
  return n ? `${m}-${n}` : m;
}

/** 确保大分类存在，返回其 id */
export async function ensureMajor(name: string): Promise<number> {
  const trimmed = name.trim();
  const found = await db
    .select({ id: category.id })
    .from(category)
    .where(and(isNull(category.parentId), eq(category.name, trimmed)))
    .limit(1);
  if (found[0]) return found[0].id;
  const max = await db
    .select({ m: sql<number>`coalesce(max(${category.sort}), 0)` })
    .from(category)
    .where(isNull(category.parentId));
  const inserted = await db
    .insert(category)
    .values({ name: trimmed, parentId: null, sort: (max[0]?.m ?? 0) + 1 })
    .returning();
  return inserted[0].id;
}

/** 确保「大类 / 小类」路径存在，返回 {major, minor, majorId, minorId} */
export async function ensureCategoryPath(
  major: string,
  minor?: string | null
): Promise<{ major: string; minor: string | null }> {
  const m = major.trim();
  const n = (minor ?? "").trim() || null;
  const majorId = await ensureMajor(m);
  if (n) {
    const found = await db
      .select({ id: category.id })
      .from(category)
      .where(and(eq(category.parentId, majorId), eq(category.name, n)))
      .limit(1);
    if (!found[0]) {
      const max = await db
        .select({ m: sql<number>`coalesce(max(${category.sort}), 0)` })
        .from(category)
        .where(eq(category.parentId, majorId));
      await db.insert(category).values({ name: n, parentId: majorId, sort: (max[0]?.m ?? 0) + 1 });
    }
  }
  return { major: m, minor: n };
}

/** 新增大分类（同名去重） */
export async function addMajorCategory(name: string): Promise<{ ok: boolean; message: string; id?: number }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "分类名称不能为空" };
  if (trimmed.includes("-")) return { ok: false, message: "大分类名称不能包含「-」，请直接填大类名" };
  const exists = await db
    .select({ id: category.id })
    .from(category)
    .where(and(isNull(category.parentId), eq(category.name, trimmed)))
    .limit(1);
  if (exists[0]) return { ok: false, message: "该大分类已存在" };
  const id = await ensureMajor(trimmed);
  return { ok: true, message: `已新增大分类「${trimmed}」`, id };
}

/** 新增大分类下的小分类 */
export async function addMinorCategory(
  parentId: number,
  name: string
): Promise<{ ok: boolean; message: string; id?: number }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "小分类名称不能为空" };
  const parent = await db.select().from(category).where(eq(category.id, parentId)).limit(1);
  if (!parent[0] || parent[0].parentId != null) return { ok: false, message: "大分类不存在" };
  const exists = await db
    .select({ id: category.id })
    .from(category)
    .where(and(eq(category.parentId, parentId), eq(category.name, trimmed)))
    .limit(1);
  if (exists[0]) return { ok: false, message: "该小分类已存在" };
  const max = await db
    .select({ m: sql<number>`coalesce(max(${category.sort}), 0)` })
    .from(category)
    .where(eq(category.parentId, parentId));
  const inserted = await db
    .insert(category)
    .values({ name: trimmed, parentId, sort: (max[0]?.m ?? 0) + 1 })
    .returning();
  return { ok: true, message: `已新增小分类「${parent[0].name}-${trimmed}」`, id: inserted[0].id };
}

/** 分类下（含其小分类）的物品数 */
async function countItemsInCategory(id: number): Promise<number> {
  const row = (await db.select().from(category).where(eq(category.id, id)).limit(1))[0];
  if (!row) return 0;
  if (row.parentId == null) {
    // 大分类：物品的 categoryMajor 命中，或 category 精确等于大类名（单级物品）
    const res = await db
      .select({ c: sql<number>`count(*)` })
      .from(item)
      .where(or(eq(item.categoryMajor, row.name), eq(item.category, row.name)));
    return res[0].c;
  }
  // 小分类：categoryMajor + categoryMinor 命中
  const major = (await db.select().from(category).where(eq(category.id, row.parentId)).limit(1))[0];
  const res = await db
    .select({ c: sql<number>`count(*)` })
    .from(item)
    .where(and(eq(item.categoryMajor, major?.name ?? ""), eq(item.categoryMinor, row.name)));
  return res[0].c;
}

/** 删除分类：大分类需其下无小分类且无物品；小分类需无物品 */
export async function deleteCategory(id: number): Promise<{ ok: boolean; message: string }> {
  const row = (await db.select().from(category).where(eq(category.id, id)).limit(1))[0];
  if (!row) return { ok: false, message: "分类不存在" };

  if (row.parentId == null) {
    const childCount = await db
      .select({ c: sql<number>`count(*)` })
      .from(category)
      .where(eq(category.parentId, id));
    if (childCount[0].c > 0) {
      return { ok: false, message: `该大分类下还有 ${childCount[0].c} 个小分类，请先删除小分类` };
    }
    // 单级物品直接挂在大类名上
    const direct = await db
      .select({ c: sql<number>`count(*)` })
      .from(item)
      .where(eq(item.category, row.name));
    if (direct[0].c > 0) return { ok: false, message: `该分类下还有 ${direct[0].c} 件物品，无法删除` };
    await db.delete(category).where(eq(category.id, id));
    return { ok: true, message: `已删除大分类「${row.name}」` };
  }

  const used = await countItemsInCategory(id);
  if (used > 0) return { ok: false, message: `该分类下还有 ${used} 件物品，无法删除` };
  await db.delete(category).where(eq(category.id, id));
  return { ok: true, message: `已删除小分类「${row.name}」` };
}

/** 货架筛选：分类条件（大类 / 大类+小类） */
export function categoryConds(major?: string, minor?: string): SQL[] {
  const conds: SQL[] = [];
  if (!major) return conds;
  conds.push(eq(item.categoryMajor, major));
  if (minor) conds.push(eq(item.categoryMinor, minor));
  return conds;
}
