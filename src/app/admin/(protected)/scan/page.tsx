import { Card } from "@/components/ui/card";
import ScanConsole from "./scan-console";

export const dynamic = "force-dynamic";

export default function ScanPage() {
  return (
    <Card className="p-4">
      <ScanConsole />
    </Card>
  );
}