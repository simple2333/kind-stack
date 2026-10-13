import { Card, CardContent } from "@/components/ui/card";
import ImportConsole from "./import-console";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <Card className="p-4">
      <CardContent className="pt-2">
        <ImportConsole />
      </CardContent>
    </Card>
  );
}
