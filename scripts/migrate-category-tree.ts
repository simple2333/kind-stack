import "dotenv/config";
import Database from "better-sqlite3";

/**
 * 一次性迁移：分类拆分为两级树。
 * 1. category 加 parent_id；item 加 category_major / category_minor
 * 2. 旧分类（单级或「大类-小类」扁平字符串）重建为树：大类为根，小类挂其下
 * 3. 回填 item 的 category_major / category_minor
 * 幂等：重复执行不会重复建分类。
 */
const db = new Database(process.env.DATABASE_URL ?? "./data/yizhan.db");

function cols(t: string): string[] {
  return (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name);
}

// —— 1. 加列 ——
if (!cols("category").includes("parent_id")) {
  db.exec("ALTER TABLE category ADD COLUMN parent_id integer");
  console.log("+ category.parent_id");
}
if (!cols("item").includes("category_major")) {
  db.exec("ALTER TABLE item ADD COLUMN category_major text");
  console.log("+ item.category_major");
}
if (!cols("item").includes("category_minor")) {
  db.exec("ALTER TABLE item ADD COLUMN category_minor text");
  console.log("+ item.category_minor");
}
db.exec("CREATE INDEX IF NOT EXISTS idx_category_parent ON category (parent_id)");

// 旧唯一索引 category_name_unique 会阻碍「不同大类下同名小类」，删除之
const indexes = (db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='category'").all() as {
  name: string;
}[]).map((r) => r.name);
for (const idx of indexes) {
  if (idx.toLowerCase().includes("category") && idx.toLowerCase().includes("unique")) {
    db.exec(`DROP INDEX IF EXISTS "${idx}"`);
    console.log("drop unique index:", idx);
  }
}

// —— 2. 重建分类树 ——
interface CatRow {
  id: number;
  name: string;
  parent_id: number | null;
}
const rows = db.prepare("SELECT id, name, parent_id FROM category").all() as CatRow[];
const majorByName = new Map<string, number>();

function ensureMajor(name: string): number {
  const existing = majorByName.get(name);
  if (existing != null) return existing;
  const found = db.prepare("SELECT id FROM category WHERE name = ? AND parent_id IS NULL").get(name) as
    | { id: number }
    | undefined;
  if (found) {
    majorByName.set(name, found.id);
    return found.id;
  }
  const max = db.prepare("SELECT COALESCE(MAX(sort),0) AS m FROM category WHERE parent_id IS NULL").get() as { m: number };
  const res = db.prepare("INSERT INTO category (name, parent_id, sort) VALUES (?, NULL, ?)").run(name, max.m + 1);
  const id = Number(res.lastInsertRowid);
  majorByName.set(name, id);
  console.log(`+ 大分类「${name}」#${id}`);
  return id;
}

let majors = 0;
let minors = 0;
for (const r of rows) {
  // 已是子分类（有 parent）→ 跳过
  if (r.parent_id != null) {
    minors++;
    continue;
  }
  const name = r.name.trim();
  if (!name) continue;
  if (name.includes("-")) {
    const [majorRaw, ...rest] = name.split("-");
    const major = majorRaw.trim();
    const minor = rest.join("-").trim();
    const majorId = ensureMajor(major);
    // 该旧行改造成小分类：name=小类名，parentId=大分类
    db.prepare("UPDATE category SET name = ?, parent_id = ? WHERE id = ?").run(minor, majorId, r.id);
    console.log(`  小分类「${major} / ${minor}」#${r.id}`);
    minors++;
  } else {
    // 单级默认分类（家居/衣物…）视为大分类，保持 parent_id 为空
    majorByName.set(name, r.id);
    majors++;
  }
}

// —— 3. 回填 item ——
const items = db.prepare("SELECT id, category FROM item WHERE category IS NOT NULL AND category <> ''").all() as {
  id: number;
  category: string;
}[];
let filled = 0;
for (const it of items) {
  const cat = it.category.trim();
  if (!cat) continue;
  let major: string;
  let minor: string | null;
  if (cat.includes("-")) {
    const [m, ...rest] = cat.split("-");
    major = m.trim();
    minor = rest.join("-").trim() || null;
  } else {
    major = cat;
    minor = null;
  }
  db.prepare("UPDATE item SET category_major = ?, category_minor = ? WHERE id = ?").run(major, minor, it.id);
  filled++;
}
console.log(`回填物品分类: ${filled} 件`);
console.log(`分类树完成：大分类 ${majors} 个（原有单级）+ 小分类 ${minors} 个`);

const final = db.prepare("SELECT COUNT(*) AS c FROM category").get() as { c: number };
const roots = db.prepare("SELECT COUNT(*) AS c FROM category WHERE parent_id IS NULL").get() as { c: number };
console.log(`category 表：共 ${final.c} 行，大分类 ${roots.c} 个`);
db.close();
