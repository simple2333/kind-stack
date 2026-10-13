import { Suspense } from "react";
import { listSaleOrders, countSaleOrders } from "@/lib/sales";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Pagination from "@/components/pagination";
import SalesTable from "./sales-table";

export const dynamic = "force-dynamic";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; size?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const sizeNum = Number(sp.size);
  const pageSize = PAGE_SIZE_OPTIONS.includes(sizeNum) ? sizeNum : 20;
  const [total, orders] = await Promise.all([
    countSaleOrders(),
    listSaleOrders(pageSize, (page - 1) * pageSize),
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">销售记录（{total} 单）</CardTitle>
        <CardDescription>
          扫码售出生成的销售单。卖错东西时，可整单撤销或只撤销其中一件，物品库存与状态会自动还原并记账本。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {orders.length === 0 && (
          <p className="text-muted-foreground py-8 text-center">还没有销售记录。到「扫码处理」售出物品即会生成。</p>
        )}
        <SalesTable orders={orders} />
        <Suspense fallback={null}>
          <Pagination total={total} pageSize={pageSize} page={page} sizeOptions={PAGE_SIZE_OPTIONS} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
