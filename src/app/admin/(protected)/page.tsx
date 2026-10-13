import { stats } from "@/lib/items";
import { Card, CardContent } from "@/components/ui/card";
import IntakeConsole from "./intake";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const s = await stats();
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">累计入库</div>
            <div className="text-3xl font-bold">{s.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">在售</div>
            <div className="text-3xl font-bold">{s.onShelf}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">已售出</div>
            <div className="text-3xl font-bold">{s.sold}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">公益收入</div>
            <div className="text-3xl font-bold">¥{s.revenue.toFixed(0)}</div>
          </CardContent>
        </Card>
      </div>
      <IntakeConsole />
    </div>
  );
}