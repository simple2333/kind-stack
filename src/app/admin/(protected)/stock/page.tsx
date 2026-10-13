import { Suspense } from "react";
import { listItems, countItems } from "@/lib/items";
import { getStoreName } from "@/lib/settings";
import { listCategoryTree } from "@/lib/category";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Pagination from "@/components/pagination";
import StockToolbar from "./stock-toolbar";
import StockTable from "./stock-table";

export const dynamic = "force-dynamic";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{
    code?: string;
    name?: string;
    cat?: string;
    origin?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: string;
    size?: string;
  }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const sizeNum = Number(sp.size);
  const pageSize = PAGE_SIZE_OPTIONS.includes(sizeNum) ? sizeNum : 20;
  const filter = {
    code: sp.code,
    name: sp.name,
    categoryText: sp.cat,
    origin: sp.origin,
    status: (sp.status as "received" | "on_shelf" | "sold" | "given" | "kept" | "damaged") || undefined,
    dateFrom: sp.from,
    dateTo: sp.to,
  };
  const total = await countItems(filter);
  const [items, storeName, tree] = await Promise.all([
    listItems({ ...filter, limit: pageSize, offset: (page - 1) * pageSize }),
    getStoreName(),
    listCategoryTree(),
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">货架（{total} 件）</CardTitle>
        <StockToolbar count={total} tree={tree} />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {items.length === 0 && <p className="text-muted-foreground py-8 text-center">没有符合条件的物品</p>}
        <StockTable items={items} storeName={storeName} tree={tree} />
        <Suspense fallback={null}>
          <Pagination total={total} pageSize={pageSize} page={page} sizeOptions={PAGE_SIZE_OPTIONS} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
