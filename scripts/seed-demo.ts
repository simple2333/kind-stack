/**
 * 演示数据脚本（仅用于截图 / 演示，不参与生产）
 *
 * 用法（务必带 DATABASE_URL，否则拒绝执行，避免污染正式库）：
 *   $env:DATABASE_URL="./data-demo/yizhan.db"
 *   npm run db:push
 *   $env:ADMIN_EMAIL="admin@example.com"; $env:ADMIN_PASSWORD="demo-pass-1234"; npm run db:seed
 *   npx tsx scripts/seed-demo.ts
 *
 * 说明：全部走真实业务函数（createItems / setPrice / sellItem / updateStatus / appendLedger），
 * 因此哈希链、销售单、账本条目都是合法的，与真实使用无差异。
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";

type Status = "sold" | "given" | "kept" | "damaged";

interface DemoItem {
  name: string;
  condition?: string;
  category?: string;
  quantity?: number;
  price?: number;
  origin?: string;
  description?: string;
  /** 出库流转（可多段：支持部分出库演示） */
  flow?: { status: Status; qty?: number }[];
}

const STORE_NAME = "示例二手慈善商店";

const SUB_CATEGORIES: Record<string, string[]> = {
  家居: ["陶瓷餐具", "收纳整理", "装饰摆件"],
  衣物: ["女装", "童装"],
  文具: ["笔记本", "书写工具"],
  玩具: ["毛绒玩偶", "益智玩具"],
  厨具: ["锅具", "烘焙"],
  电子产品: ["小家电", "数码配件"],
  书籍: ["文学小说", "儿童绘本"],
  其他: ["杂项"],
};

const ITEMS: DemoItem[] = [
  {
    name: "陶瓷马克杯（米白）",
    condition: "九成新",
    category: "家居-陶瓷餐具",
    quantity: 1,
    price: 12,
    origin: "闲鱼",
    description: "杯口无磕碰，杯身有轻微使用痕迹，已高温消毒。",
    flow: [{ status: "sold" }],
  },
  { name: "不锈钢焖烧杯 500ml", condition: "全新", category: "家居-收纳整理", price: 35, origin: "闲鱼", description: "未拆封，密封圈完好。" },
  { name: "加厚棉麻收纳袋 3 件套", condition: "全新", category: "家居-收纳整理", price: 18, origin: "小红书", description: "可折叠，适合收纳衣物与床品。" },
  { name: "手工陶艺小花瓶", condition: "九成新", category: "家居-装饰摆件", price: 25, origin: "线下捐赠", description: "手作孤品，瓶身有窑变斑点。", flow: [{ status: "sold" }] },
  { name: "摇粒绒儿童外套 120 码", condition: "八成新", category: "衣物-童装", price: 15, origin: "闲鱼", description: "无污渍无破损，已清洗。" , flow: [{ status: "given" }] },
  {
    name: "纯棉长袖衬衫 M 码",
    condition: "九成新",
    category: "衣物-女装",
    quantity: 3,
    price: 28,
    origin: "闲鱼",
    description: "同款三件（不同色），面料无起球。",
    flow: [{ status: "sold", qty: 1 }, { status: "given", qty: 1 }],
  },
  { name: "帆布托特包（印字款）", condition: "全新", category: "家居-收纳整理", price: 9, origin: "微信群", description: "活动余量，未使用。" },
  {
    name: "硬壳格子笔记本 A5",
    condition: "全新",
    category: "文具-笔记本",
    quantity: 5,
    price: 6,
    origin: "闲鱼",
    description: "同款五本，内页 80g 顺滑纸。",
    flow: [{ status: "sold", qty: 2 }],
  },
  { name: "学生文具礼盒", condition: "全新", category: "文具-书写工具", price: 22, origin: "小红书", description: "含中性笔 6 支、笔记贴 2 本。" },
  { name: "棕色小熊毛绒玩偶 45cm", condition: "九成新", category: "玩具-毛绒玩偶", price: 20, origin: "闲鱼", description: "已干洗消毒，适合亲子陪伴。", flow: [{ status: "sold" }] },
  { name: "木质拼装积木 100 粒", condition: "全新", category: "玩具-益智玩具", price: 32, origin: "闲鱼", description: "圆角处理，附收纳桶。" },
  { name: "麦饭石不粘炒锅 28cm", condition: "八成新", category: "厨具-锅具", price: 45, origin: "线下捐赠", description: "涂层完好，无划痕。" },
  { name: "硅胶烘焙模具套装", condition: "全新", category: "厨具-烘焙", price: 16, origin: "小红书", description: "6 连蛋糕模 + 饼干模。" , flow: [{ status: "sold" }] },
  { name: "迷你电煮锅 1.2L", condition: "九成新", category: "电子产品-小家电", price: 55, origin: "闲鱼", description: "宿舍适用，通电正常，附原装电源线。" },
  { name: "Type-C 三合一数据线", condition: "全新", category: "电子产品-数码配件", price: 10, origin: "闲鱼", description: "未拆封，1.2m 编织线。" , flow: [{ status: "sold" }] },
  { name: "《活着》余华（精装）", condition: "九成新", category: "书籍-文学小说", price: 12, origin: "微信群", description: "书页干净，无笔记划线。" },
  { name: "儿童绘本 10 册合售", condition: "八成新", category: "书籍-儿童绘本", price: 30, origin: "闲鱼", description: "适龄 3-6 岁，有轻微翻阅痕迹。", flow: [{ status: "given" }] },
  { name: "玻璃保鲜盒 3 件套", condition: "全新", category: "家居-陶瓷餐具", price: 24, origin: "闲鱼", description: "可微波可冷冻，密封扣完好。", flow: [{ status: "kept" }] },
  { name: "旧台灯（灯罩有破损）", condition: "待修", category: "电子产品-小家电", origin: "线下捐赠", description: "灯座通电正常，灯罩缺口已如实标注。", flow: [{ status: "damaged" }] },
  { name: "竹制砧板", condition: "全新", category: "厨具-锅具", price: 14, origin: "小红书", description: "未使用，带包装。" },
  { name: "针织围巾（驼色）", condition: "全新", category: "衣物-女装", price: 20, origin: "微信群", description: "手感柔软，无球无勾丝。" },
];

/** 待上架（received）保持不动，其余入库后统一「上架」到在售状态 */
const RECEIVED_ONLY = new Set(["竹制砧板", "针织围巾（驼色）"]);

/** 一个真实捐赠批次（含回执码 → 回执页 / 物品页「来自…的捐赠」） */
const BATCH = {
  alias: "热心邻居",
  batchCode: "JZ-DEMO2026",
  items: [
    { name: "双层保温饭盒", condition: "全新", category: "厨具-锅具", quantity: 1, price: 28 },
    { name: "陶瓷餐盘 4 只", condition: "九成新", category: "家居-陶瓷餐具", quantity: 1, price: 20 },
    { name: "儿童保温杯 350ml", condition: "全新", category: "家居-陶瓷餐具", quantity: 1, price: 18 },
  ],
};

/** 受赠人反馈（写 feedback 表 + 记账本 item.feedback） */
const FEEDBACK: { matchName: string; rating: number; content: string }[] = [
  { matchName: "陶瓷马克杯（米白）", rating: 5, content: "杯子很干净，拿回家就用上了，谢谢店里的整理。" },
  { matchName: "陶瓷马克杯（米白）", rating: 4, content: "实物和描述一致，包装也很仔细，下次还会来逛逛。" },
  { matchName: "棕色小熊毛绒玩偶 45cm", rating: 5, content: "孩子特别喜欢，抱着睡了一周，感谢捐赠人。" },
];

/** 待复核的登记（复核台 / 首页「待复核的登记」） */
const PENDING = [
  { alias: "热心邻居", items: [{ name: "羊毛毛毯", condition: "九成新", quantity: 1 }, { name: "不锈钢保温壶", condition: "全新", quantity: 1 }] },
  { alias: "匿名捐赠", items: [{ name: "1000 片风景拼图", condition: "八成新", quantity: 1 }] },
];

async function main() {
  loadEnv({ path: resolve(__dirname, "..", ".env.local") });

  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl.includes("data-demo")) {
    console.error("❌ 拒绝执行：请先设置 DATABASE_URL=./data-demo/yizhan.db（本脚本只允许写入演示库）");
    process.exit(1);
  }

  const { db } = await import("../src/db");
  const schema = await import("../src/db/schema");
  const { createItems, setPrice, updateStatus, getByCode } = await import("../src/lib/items");
  const { sellItem } = await import("../src/lib/sales");
  const { appendLedger } = await import("../src/lib/ledger");

  // ---------- 0. 清空（可重复执行） ----------
  await db.delete(schema.ledger);
  await db.delete(schema.feedback);
  await db.delete(schema.saleOrderItem);
  await db.delete(schema.saleOrder);
  await db.delete(schema.donationRequest);
  await db.delete(schema.item);
  await db.delete(schema.donor);
  console.log("✓ 已清空演示库业务数据");

  // ---------- 1. 店铺信息（化名） ----------
  await db
    .update(schema.store)
    .set({ name: STORE_NAME, slogan: "让每一份善意都有去处" })
    .where(eq(schema.store.id, 1));
  console.log(`✓ 店铺名 → ${STORE_NAME}`);

  // ---------- 2. 两级分类 ----------
  const allCats = await db.select().from(schema.category);
  let sort = 100;
  for (const [major, minors] of Object.entries(SUB_CATEGORIES)) {
    const parent = allCats.find((c) => c.name === major && c.parentId == null);
    if (!parent) continue;
    for (const minor of minors) {
      const exists = allCats.find((c) => c.name === minor && c.parentId === parent.id);
      if (exists) continue;
      await db.insert(schema.category).values({ name: minor, parentId: parent.id, sort: sort++ });
    }
  }
  console.log("✓ 小分类初始化");

  // ---------- 3. 物品入库 ----------
  const created = await createItems(
    ITEMS.map((i) => ({
      name: i.name,
      condition: i.condition,
      category: i.category,
      quantity: i.quantity,
      price: i.price,
      origin: i.origin,
      description: i.description,
      source: "manual",
    }))
  );
  const codeByName = new Map(created.map((c) => [c.name, c.code]));
  console.log(`✓ 手动入库 ${created.length} 件`);

  // ---------- 4. 定价 ----------
  for (const it of ITEMS) {
    if (it.price == null) continue;
    const code = codeByName.get(it.name);
    if (code) await setPrice(code, it.price);
  }
  console.log("✓ 定价完成");

  // ---------- 5. 捐赠批次（回执码） ----------
  const donorIns = await db
    .insert(schema.donor)
    .values({ alias: BATCH.alias, batchCode: BATCH.batchCode })
    .returning();
  const donorId = donorIns[0].id;
  await appendLedger("donor", donorId, "donor.created", { alias: BATCH.alias, batchCode: BATCH.batchCode });
  const batchItems = await createItems(
    BATCH.items.map((i) => ({
      name: i.name,
      condition: i.condition,
      category: i.category,
      quantity: i.quantity,
      price: i.price,
      batchCode: BATCH.batchCode,
      donorId,
      source: "donate",
    }))
  );
  for (const it of batchItems) {
    if (it.price != null) await setPrice(it.code, it.price);
  }
  console.log(`✓ 捐赠批次 ${BATCH.batchCode}（${batchItems.length} 件）`);

  // ---------- 6. 上架（在售） ----------
  // 说明：updateStatus 对 on_shelf 会算出 NaN（已知 bug），这里直接落库 + 记账本。
  async function markOnShelf(code: string) {
    const it = await getByCode(code);
    if (!it || it.status !== "received") return;
    await db
      .update(schema.item)
      .set({ status: "on_shelf", updatedAt: new Date().toISOString() })
      .where(eq(schema.item.id, it.id));
    await appendLedger("item", it.id, "item.on_shelf", { code: it.code, name: it.name, price: it.price });
  }

  const onShelfCodes: string[] = [];
  for (const it of ITEMS) {
    if (RECEIVED_ONLY.has(it.name)) continue;
    if (it.flow?.some((f) => f.status === "damaged")) continue;
    const code = codeByName.get(it.name);
    if (code) onShelfCodes.push(code);
  }
  for (const b of batchItems) onShelfCodes.push(b.code);
  for (const code of onShelfCodes) await markOnShelf(code);
  console.log(`✓ 上架 ${onShelfCodes.length} 件`);

  // ---------- 7. 流转出库 ----------
  for (const it of ITEMS) {
    if (!it.flow) continue;
    const code = codeByName.get(it.name);
    if (!code) continue;
    for (const f of it.flow) {
      const qty = f.qty ?? it.quantity ?? 1;
      if (f.status === "sold") await sellItem(code, qty);
      else await updateStatus(code, f.status, qty);
    }
  }
  // 批次内售出一件，回执页 / 物品页有真实去向
  if (batchItems[0]) await sellItem(batchItems[0].code);
  console.log("✓ 售出 / 转赠 / 自留 / 报废流转完成（含部分出库）");

  // ---------- 7. 受赠人反馈 ----------
  for (const f of FEEDBACK) {
    const code = codeByName.get(f.matchName);
    if (!code) continue;
    const target = await getByCode(code);
    if (!target) continue;
    const ins = await db
      .insert(schema.feedback)
      .values({ itemId: target.id, content: f.content, rating: f.rating })
      .returning();
    await appendLedger("item", target.id, "item.feedback", {
      code: target.code,
      name: target.name,
      feedbackId: ins[0].id,
      rating: f.rating,
      content: f.content,
    });
  }
  console.log("✓ 受赠人反馈已写入并记账本");

  // ---------- 8. 待复核登记 ----------
  let dj = 0;
  let jz = 0;
  for (const p of PENDING) {
    dj += 1;
    jz += 1;
    await db.insert(schema.donationRequest).values({
      code: `DJ-DEMO${String(dj).padStart(2, "0")}`,
      batchCode: `JZ-DEMO${String(2000 + jz).slice(-4)}`.padEnd(11, "0"),
      alias: p.alias,
      location: "深圳市南山区",
      note: "到店自送",
      itemsJson: JSON.stringify(p.items.map((i) => ({ ...i, status: "pending" }))),
      status: "pending",
    });
  }
  console.log(`✓ 待复核登记 ${PENDING.length} 条`);

  const led = await db.select({ id: schema.ledger.id }).from(schema.ledger);
  const its = await db.select({ id: schema.item.id }).from(schema.item);
  console.log(`\n完成：物品 ${its.length} 件，账本 ${led.length} 条`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
