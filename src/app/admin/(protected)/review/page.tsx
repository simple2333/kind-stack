import { Suspense } from "react";
import Link from "next/link";
import { listDonationRequestItems, countDonationRequestItems } from "@/lib/donation-request";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Pagination from "@/components/pagination";
import ReviewList from "./review-list";

export const dynamic = "force-dynamic";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; size?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status === "approved" || sp.status === "rejected" ? sp.status : "pending";
  const page = Math.max(1, Number(sp.page) || 1);
  const sizeNum = Number(sp.size);
  const pageSize = PAGE_SIZE_OPTIONS.includes(sizeNum) ? sizeNum : 10;
  const [total, requests] = await Promise.all([
    countDonationRequestItems(status),
    listDonationRequestItems({ status, limit: pageSize, offset: (page - 1) * pageSize }),
  ]);

  const tabs = [
    { key: "pending", label: "待复核" },
    { key: "approved", label: "已通过" },
    { key: "rejected", label: "已驳回" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">复核台</CardTitle>
        <CardDescription>
           捐赠人在「我要捐赠」页面自助登记后，在此复核：核对物品、可微调，通过则正式入库（生成一件一码 + 回执码）。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-1 flex-wrap">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={`/admin/review?status=${t.key}`}
              className={`px-3 py-1.5 rounded-md text-sm ${
                status === t.key ? "bg-primary text-primary-foreground font-medium" : "bg-muted hover:bg-accent"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <ReviewList requests={requests} />

        <Suspense fallback={null}>
          <Pagination total={total} pageSize={pageSize} page={page} sizeOptions={PAGE_SIZE_OPTIONS} />
        </Suspense>
      </CardContent>
    </Card>
  );
}