export type ItemStatus = "received" | "on_shelf" | "sold" | "given" | "kept" | "damaged";

export interface Item {
  id: number;
  code: string;
  batch_code: string | null;
  donor_id: number | null;
  donor_alias?: string | null;
  name: string;
  category: string | null;
  category_major: string | null;
  category_minor: string | null;
  condition: string | null;
  quantity: number;
  sold_qty: number;
  given_qty: number;
  kept_qty: number;
  damaged_qty: number;
  unit: string;
  description: string | null;
  price: number | null;
  photo: Buffer | null;
  photo_thumb: Buffer | null;
  status: ItemStatus;
  note: string | null;
  source: string;
  origin: string | null;
  external_no: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_LABEL: Record<ItemStatus, string> = {
  received: "已入库",
  on_shelf: "在售",
  sold: "已售出",
  given: "已转赠",
  kept: "自留",
  damaged: "报废",
};

export function statusLabel(s: string): string {
  return STATUS_LABEL[s as ItemStatus] ?? s;
}

/** 状态 → 徽标样式类（用于区分状态 vs 属性，增强可读性） */
export function statusBadgeClass(s: string): string {
  switch (s) {
    case "sold":
      return "bg-green-100 text-green-800 border-green-200";
    case "given":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "kept":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "damaged":
      return "bg-red-100 text-red-800 border-red-200";
    case "on_shelf":
      return "bg-blue-100 text-blue-800 border-blue-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export const STATUS_OPTIONS: ItemStatus[] = ["received", "on_shelf", "sold", "given", "kept", "damaged"];