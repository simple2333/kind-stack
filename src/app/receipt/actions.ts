"use server";

import { lookupBatchCore } from "@/lib/receipt-lookup";
import type { BatchLookupData } from "@/lib/receipt-lookup";

export type { BatchItem, RejectedItem, BatchLookupData } from "@/lib/receipt-lookup";

export async function lookupBatch(batchCode: string): Promise<{
  ok: boolean;
  message?: string;
  data?: BatchLookupData;
}> {
  return lookupBatchCore(batchCode);
}
