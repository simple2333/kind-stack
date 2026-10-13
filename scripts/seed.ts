import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { db } from "../src/db";
import { store, roles, userRoles, users, category } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "../src/lib/auth";

// 显式加载 .env.local（tsx 不会自动加载）
loadEnv({ path: resolve(__dirname, "..", ".env.local") });

async function seed() {
  // store 初始化
  const storeRow = await db.select().from(store).where(eq(store.id, 1));
  if (storeRow.length === 0) {
    await db.insert(store).values({ id: 1, name: "示例二手慈善商店" });
    console.log("✓ store 初始化");
  }

  // 角色
  for (const [id, name] of [
    ["owner", "店长"],
    ["clerk", "店员"],
    ["donor", "捐赠人"],
  ] as const) {
    const exists = await db.select({ id: roles.id }).from(roles).where(eq(roles.id, id));
    if (exists.length === 0) {
      await db.insert(roles).values({ id, name });
    }
  }
  console.log("✓ 角色初始化 (owner/clerk/donor)");

  // 预置店长账号（env: ADMIN_EMAIL / ADMIN_PASSWORD）
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? defaultPassword();
  const existingAdmin = await db.select({ id: users.id }).from(users).where(eq(users.email, adminEmail));
  if (existingAdmin.length === 0) {
    const res = await auth.api.signUpEmail({
      body: { email: adminEmail, password: adminPassword, name: "店长", displayName: "店长" },
    });
    if (res.token || res.user) {
      // 注册钩子默认给 donor，管理端账号需改回 owner
      await db.delete(userRoles).where(eq(userRoles.userId, res.user.id));
      await db
        .insert(userRoles)
        .values({ userId: res.user.id, roleId: "owner" })
        .onConflictDoNothing();
      console.log(`✓ 已创建店长账号: ${adminEmail}`);
      console.log(`  ┌──────────────────────────────────────────`);
      console.log(`  │  初始密码: ${adminPassword}`);
      console.log(`  │  首次登录后请立即修改！`);
      console.log(`  └──────────────────────────────────────────`);
    }
  } else {
    // 确保已有管理员账号是 owner（并清掉注册钩子留下的 donor 角色）
    await db.delete(userRoles).where(eq(userRoles.userId, existingAdmin[0].id));
    await db
      .insert(userRoles)
      .values({ userId: existingAdmin[0].id, roleId: "owner" })
      .onConflictDoNothing();
    console.log(`✓ 店长账号已存在: ${adminEmail}`);
  }

  // 默认分类（两级：此处仅建根大分类；小分类由 Excel 导入或设置页新增）
  const DEFAULT_CATEGORIES = ["家居", "衣物", "文具", "玩具", "厨具", "电子产品", "书籍", "其他"];
  const existingCats = await db.select({ name: category.name }).from(category);
  const existingNames = new Set(existingCats.map((c) => c.name));
  let sort = 0;
  for (const name of DEFAULT_CATEGORIES) {
    if (!existingNames.has(name)) {
      await db.insert(category).values({ name, parentId: null, sort: ++sort });
    }
  }
  console.log("✓ 默认分类");

  console.log("种子完成");
}

function defaultPassword(): string {
  // 随机 12 位安全密码（数字+字母，含大小写）
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < 12; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });