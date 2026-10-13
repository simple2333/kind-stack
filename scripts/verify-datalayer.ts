import { createItems, updateStatus, setPrice, stats, averagePriceFor, listItems } from "../src/lib/items";
import { verifyChain, getFingerprint, getHistory } from "../src/lib/ledger";
import { db } from "../src/db";
import { ledger } from "../src/db/schema";
import { eq } from "drizzle-orm";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function main() {
  console.log("== 数据层验证（Drizzle） ==");

  // 1. 建库正常（直接查询 ledger 表确认连通）
  await db.select().from(ledger).limit(0);
  console.log("  ✓ 建库正常");

  // 2. 创建物品（一件一码）
  const created = await createItems([
    { name: "陶瓷马克杯", condition: "九成新", quantity: 1, category: "厨具" },
    { name: "暖手宝", condition: "全新", quantity: 2, category: "家居" },
  ]);
  assert(created.length === 2, "创建 2 件物品");
  assert(created[0].code.startsWith("YZ-"), `一件一码格式正确: ${created[0].code}`);
  assert(created[0].status === "received", "初始状态 received");

  // 3. 定价
  const priced = await setPrice(created[0].code, 8);
  assert(priced.price === 8, "定价 ¥8");

  // 4. 状态流转
  const sold = await updateStatus(created[0].code, "sold");
  assert(sold.status === "sold", "售出状态");

  // 5. 哈希链完整性
  const chain = await verifyChain();
  assert(chain.valid, `哈希链完整 (${chain.blocks} blocks)`);
  assert((await getFingerprint()) === chain.lastHash, "指纹 = 最新块哈希");

  // 6. 物品历史
  const hist = await getHistory("item", created[0].id);
  assert(hist.length === 3, `物品历史 3 条 (received/priced/sold), 实际 ${hist.length}`);
  assert(hist[0].action === "item.received" && hist[2].action === "item.sold", "历史顺序正确");

  // 7. 篡改检测
  await db.update(ledger).set({ payload: JSON.stringify({ hacked: true }) }).where(eq(ledger.id, hist[0].id));
  const after = await verifyChain();
  assert(!after.valid, "篡改后哈希链被检测到");
  await db.update(ledger).set({ payload: hist[0].payload }).where(eq(ledger.id, hist[0].id));

  // 8. 统计与均价
  const s = await stats();
  assert(s.total >= 2 && s.sold >= 1 && s.revenue >= 8, `统计: total=${s.total} sold=${s.sold} revenue=${s.revenue}`);
  const avg = await averagePriceFor("马克杯");
  console.log(`  平均价: ${avg}`);

  // 9. 搜索
  const list = await listItems({ q: "马克" });
  assert(list.length >= 1, "搜索'马克'命中物品");

  console.log("\n全部通过 ✓");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});