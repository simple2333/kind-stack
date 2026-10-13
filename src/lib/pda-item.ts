import { remainingQty, type Item } from "@/lib/items";

/** PDA 物品 DTO：仅返回移动端需要的字段，避免带出 base64 照片等大字段。 */
export function toPdaItem(r: Item) {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    category: r.category,
    condition: r.condition,
    price: r.price,
    quantity: r.quantity,
    status: r.status,
    source: r.source,
    origin: r.origin,
    batchCode: r.batch_code,
    donorAlias: r.donor_alias ?? null,
    soldQty: r.sold_qty,
    givenQty: r.given_qty,
    keptQty: r.kept_qty,
    damagedQty: r.damaged_qty,
    remaining: remainingQty(r),
    createdAt: r.created_at,
  };
}
