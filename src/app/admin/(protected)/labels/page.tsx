import { listItems } from "@/lib/items";
import { listReceiptRegistrations } from "@/lib/donation-request";
import { getStoreName } from "@/lib/settings";
import { listCategoryTree } from "@/lib/category";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import LabelPrinter from "./label-printer";

export const dynamic = "force-dynamic";

export default async function LabelsPage() {
  const [items, receipts, storeName, tree] = await Promise.all([
    listItems({ limit: 2000 }),
    listReceiptRegistrations(),
    getStoreName(),
    listCategoryTree(),
  ]);
  const itemRows = items.map((i) => ({
    id: i.id,
    code: i.code,
    name: i.name,
    price: i.price,
    status: i.status,
    categoryMajor: i.category_major,
    categoryMinor: i.category_minor,
    origin: i.origin,
  }));

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">打码台</CardTitle>
          <CardDescription>
            使用锐浪报表(Grid++Report)模板打印：物品标签（可批量勾选，物品名称自动分行）与捐赠回执标签。
            模板放在 <code className="bg-muted px-1">public/grf</code>，新增后运行 <code className="bg-muted px-1">npm run grf:manifest</code>。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LabelPrinter items={itemRows} receipts={receipts} storeName={storeName} tree={tree} />
        </CardContent>
      </Card>
    </div>
  );
}
