import { listDonorAccounts } from "@/lib/members";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import DonorTable from "./donor-table";

export const dynamic = "force-dynamic";

export default async function DonorsPage() {
  const donors = await listDonorAccounts();
  const registered = donors.length;
  const donated = donors.filter((d) => d.donationCount > 0).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">捐赠人管理</CardTitle>
        <CardDescription>
          已注册捐赠人 {registered} 人，其中 {donated} 人有过捐赠登记。可查看联系方式与捐赠记录，便于后续回访维护。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DonorTable donors={donors} />
      </CardContent>
    </Card>
  );
}
