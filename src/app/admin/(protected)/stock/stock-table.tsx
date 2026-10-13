"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { saveItemEdit, suggestPriceAction, bulkUpdateItems } from "@/lib/actions";
import type { Item, ItemStatus } from "@/lib/item-types";
import { statusLabel, STATUS_OPTIONS } from "@/lib/item-types";
import { gridppPrint, loadGrfTemplates, type GridppMode } from "@/lib/gridpp-print";
import { useCategories } from "@/lib/use-categories";
import type { CategoryNode } from "@/lib/category";

const CONDITION_OPTIONS = ["全新", "九成新", "八成新", "七成新", "微瑕", "破损"];

const SOURCE_LABEL: Record<string, string> = {
  manual: "店员录入",
  donate: "用户自助捐赠",
  import: "Excel 导入",
  ai: "AI 识别",
};

interface EditState {
  name: string;
  condition: string;
  category: string;
  quantity: string;
  price: string;
  status: ItemStatus;
  origin: string;
}

export default function StockTable({
  items,
  storeName,
  tree,
}: {
  items: Item[];
  storeName: string;
  tree: CategoryNode[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState<EditState | null>(null);
  const [isPending, startTransition] = useTransition();
  const { categories } = useCategories();

  // —— 批量选择 ——
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMajor, setBulkMajor] = useState("");
  const [bulkMinor, setBulkMinor] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkOrigin, setBulkOrigin] = useState("");

  // 翻页/筛选（items 变化）后清空上一页的选择，避免误操作。
  // 用「渲染期对比上次签名」替代 effect 内 setState（避免级联渲染）。
  const itemsSig = items.map((i) => i.code).join(",");
  const [prevSig, setPrevSig] = useState(itemsSig);
  if (prevSig !== itemsSig) {
    setPrevSig(itemsSig);
    if (selected.size > 0) setSelected(new Set());
  }

  const allChecked = items.length > 0 && items.every((i) => selected.has(i.code));
  const selectedItems = items.filter((i) => selected.has(i.code));

  function toggleOne(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(items.map((i) => i.code)));
  }

  // —— 锐浪报表打印 ——
  const [grfItemTpl, setGrfItemTpl] = useState<string>("");
  const [grfReceiptTpl, setGrfReceiptTpl] = useState<string>("");
  useEffect(() => {
    loadGrfTemplates().then((list) => {
      setGrfItemTpl(list.find((f) => /item/i.test(f)) ?? list[0] ?? "");
      setGrfReceiptTpl(list.find((f) => /receipt/i.test(f)) ?? list[0] ?? "");
    });
  }, []);

  async function printGridpp(item: Item, mode: GridppMode) {
    if (!grfItemTpl) {
      toast.error("未找到锐浪模板，请先放入 public/grf 并运行 npm run grf:manifest");
      return;
    }
    const res = await gridppPrint(
      [{
        code: item.code,
        name: item.name,
        origin: item.origin ?? "",
        price: item.price != null ? `¥${item.price}` : "",
      }],
      grfItemTpl,
      mode
    );
    if (!res.ok) toast.error(res.error);
  }

  /** 锐浪打印单张捐赠回执（二维码内容为公开回执页完整网址） */
  async function printReceipt(batchCode: string) {
    if (!grfReceiptTpl) {
      toast.error("未找到锐浪回执模板，请先放入 public/grf 并运行 npm run grf:manifest");
      return;
    }
    const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
    const base = configured || (typeof window !== "undefined" ? window.location.origin : "");
    const res = await gridppPrint(
      [{ store_name: storeName, batch_code: batchCode, qr_url: `${base}/receipt?batch=${encodeURIComponent(batchCode)}` }],
      grfReceiptTpl,
      "preview"
    );
    if (!res.ok) toast.error(res.error);
  }

  function openEdit(item: Item) {
    setEditing(item);
    setForm({
      name: item.name,
      condition: item.condition ?? "",
      category: item.category ?? "",
      quantity: String(item.quantity),
      price: item.price != null ? String(item.price) : "",
      status: item.status,
      origin: item.origin ?? "",
    });
  }

  function suggestPrice() {
    if (!editing || !form) return;
    startTransition(async () => {
      const res = await suggestPriceAction(editing.code);
      if (res.ok && res.price != null) {
        setForm((f) => (f ? { ...f, price: String(res.price) } : f));
        toast.success(`AI 建议 ¥${res.price}${res.reason ? `（${res.reason}）` : ""}`);
      } else {
        toast.error(res.message ?? "定价失败");
      }
    });
  }

  function handleSave() {
    if (!editing || !form) return;
    const qty = Number(form.quantity);
    if (!qty || qty < 1) {
      toast.error("数量至少为 1");
      return;
    }
    const price = form.price.trim() ? Number(form.price) : undefined;
    if (form.price.trim() && (price == null || Number.isNaN(price) || price < 0)) {
      toast.error("请输入有效价格");
      return;
    }
    startTransition(async () => {
      const res = await saveItemEdit(editing.code, {
        name: form.name.trim() || editing.name,
        condition: form.condition || undefined,
        category: form.category || undefined,
        quantity: qty,
        price,
        status: form.status,
        origin: form.origin.trim() || undefined,
      });
      if (res.ok) {
        toast.success(res.message);
        setEditing(null);
        setForm(null);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  // —— 批量操作 ——
  function runBulk() {
    const patch: { category?: string; status?: ItemStatus; origin?: string } = {};
    if (bulkMajor) patch.category = bulkMinor ? `${bulkMajor}-${bulkMinor}` : bulkMajor;
    if (bulkStatus) patch.status = bulkStatus as ItemStatus;
    if (bulkOrigin.trim()) patch.origin = bulkOrigin.trim();
    if (!patch.category && !patch.status && !patch.origin) {
      toast.error("请至少选择一项要修改的内容");
      return;
    }
    startTransition(async () => {
      const res = await bulkUpdateItems(selectedItems.map((i) => i.code), patch);
      toast[res.ok ? "success" : "error"](res.message);
      if (res.ok) {
        setBulkOpen(false);
        setBulkMajor("");
        setBulkMinor("");
        setBulkStatus("");
        setBulkOrigin("");
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  function bulkPrintLabels() {
    if (!grfItemTpl) {
      toast.error("未找到锐浪模板，请先放入 public/grf 并运行 npm run grf:manifest");
      return;
    }
    void printGridppRows(selectedItems, "preview");
  }

  async function printGridppRows(list: Item[], mode: GridppMode) {
    if (list.length === 0) {
      toast.warning("请先勾选要打印的物品");
      return;
    }
    const rows = list.map((item) => ({
      code: item.code,
      name: item.name,
      origin: item.origin ?? "",
      price: item.price != null ? `¥${item.price}` : "",
    }));
    const res = await gridppPrint(rows, grfItemTpl, mode);
    if (!res.ok) toast.error(res.error);
  }

  const bulkMinorOptions = tree.find((t) => t.name === bulkMajor)?.children ?? [];

  return (
    <>
      {selected.size > 0 && (
        <div className="flex items-center gap-2 flex-wrap border rounded-lg p-2 bg-muted/40 sticky top-2 z-20">
          <span className="text-sm font-medium">已选 {selected.size} 件</span>
          <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>
            取消选择
          </Button>
          <Button size="sm" onClick={() => setBulkOpen(true)}>
            批量修改
          </Button>
          {grfItemTpl && (
            <>
              <Button size="sm" variant="outline" onClick={() => printGridppRows(selectedItems, "html5")}>
                🌐 批量 HTML5 预览
              </Button>
              <Button size="sm" variant="secondary" onClick={bulkPrintLabels}>
                🖨️ 批量锐浪打印
              </Button>
            </>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  aria-label="全选当前页"
                  className="size-4 cursor-pointer"
                />
              </TableHead>
              <TableHead>编号</TableHead>
              <TableHead>品名</TableHead>
              <TableHead>大分类</TableHead>
              <TableHead>小分类</TableHead>
              <TableHead>成色</TableHead>
              <TableHead>数量</TableHead>
              <TableHead>单价</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>来源</TableHead>
              <TableHead>录入方式</TableHead>
              <TableHead>入库时间</TableHead>
              <TableHead className="text-right whitespace-nowrap">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} className={selected.has(item.code) ? "bg-muted/40" : ""}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selected.has(item.code)}
                    onChange={() => toggleOne(item.code)}
                    aria-label={`选择 ${item.name}`}
                    className="size-4 cursor-pointer"
                  />
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{item.code}</TableCell>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.category_major ?? "—"}</TableCell>
                <TableCell>{item.category_minor ?? "—"}</TableCell>
                <TableCell>{item.condition ?? "—"}</TableCell>
                <TableCell>
                  {item.quantity > 1 ? (
                    <div className="flex flex-col">
                      <span>{item.quantity}</span>
                      <span className="text-xs text-muted-foreground">
                        已出：
                        {[
                          ["售出", item.sold_qty],
                          ["转赠", item.given_qty],
                          ["自留", item.kept_qty],
                          ["报废", item.damaged_qty],
                        ]
                          .filter(([, q]) => (q as number) > 0)
                          .map(([l, q]) => `${l}${q}`)
                          .join("、") || "0"}
                        · 剩{item.quantity - (item.sold_qty + item.given_qty + item.kept_qty + item.damaged_qty)}
                      </span>
                    </div>
                  ) : (
                    item.quantity
                  )}
                </TableCell>
                <TableCell>{item.price != null ? `¥${item.price}` : "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{statusLabel(item.status)}</Badge>
                </TableCell>
                <TableCell>{item.origin ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={item.source === "donate" ? "outline" : "secondary"}>
                    {SOURCE_LABEL[item.source] ?? item.source}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(item.created_at).toLocaleString("zh-CN")}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                    <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                      编辑
                    </Button>
                    {grfItemTpl && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => printGridpp(item, "html5")} title="锐浪 HTML5 预览（Chrome 可用）">
                          标签预览
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => printGridpp(item, "direct")} title="锐浪直接打印（需 360/IE 插件）">
                          打印标签
                        </Button>
                      </>
                    )}
                    {item.batch_code && grfReceiptTpl && (
                      <Button variant="ghost" size="sm" onClick={() => printReceipt(item.batch_code!)} title="锐浪打印捐赠回执标签">
                        回执
                      </Button>
                    )}
                    <Link href={`/item/${item.code}`} className="text-xs text-muted-foreground underline underline-offset-2">
                      详情
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 批量修改弹窗 */}
      <Dialog open={bulkOpen} onOpenChange={(v) => !v && setBulkOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>批量修改 {selected.size} 件物品</DialogTitle>
            <DialogDescription>只填需要修改的项，留空的项保持不变。修改会写入透明账本。</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">大分类（选填）</span>
              <select
                value={bulkMajor}
                onChange={(e) => {
                  setBulkMajor(e.target.value);
                  setBulkMinor("");
                }}
                className="rounded-md border bg-background px-2 py-2 text-sm"
              >
                <option value="">不修改</option>
                {tree.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            {bulkMajor && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">小分类（选填，不选则只设大分类）</span>
                <select
                  value={bulkMinor}
                  onChange={(e) => setBulkMinor(e.target.value)}
                  className="rounded-md border bg-background px-2 py-2 text-sm"
                >
                  <option value="">（仅大分类）</option>
                  {bulkMinorOptions.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">状态（选填）</span>
              <div className="flex gap-1 flex-wrap">
                <Button size="sm" variant={bulkStatus === "" ? "default" : "outline"} onClick={() => setBulkStatus("")}>
                  不修改
                </Button>
                {STATUS_OPTIONS.map((s) => (
                  <Button key={s} size="sm" variant={bulkStatus === s ? "default" : "outline"} onClick={() => setBulkStatus(s)}>
                    {statusLabel(s)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">来源（选填，如：闲鱼 / 小红书）</span>
              <Input
                value={bulkOrigin}
                onChange={(e) => setBulkOrigin(e.target.value)}
                placeholder="留空则不修改"
                className="max-w-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>
              取消
            </Button>
            <Button onClick={runBulk} disabled={isPending}>
              {isPending ? "处理中…" : `确认修改 ${selected.size} 件`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 单件编辑弹窗 */}
      <Dialog open={editing != null} onOpenChange={(v) => !v && (setEditing(null), setForm(null))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑物品</DialogTitle>
            <DialogDescription>
              编号 {editing?.code} · 仅在编辑时可修改，保存后写入透明账本。
            </DialogDescription>
          </DialogHeader>
          {form && editing && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="品名"
                  className="flex-1"
                />
                <Input
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  placeholder="数量"
                  className="w-20 text-center"
                  inputMode="numeric"
                />
                <Input
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="单价(元)"
                  className="w-28 text-right"
                  inputMode="decimal"
                />
                <Button variant="outline" size="sm" onClick={suggestPrice} disabled={isPending}>
                  AI 定价
                </Button>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">来源（闲鱼 / 小红书 / 线下捐赠 等，可修改/补填）</span>
                <Input
                  value={form.origin}
                  onChange={(e) => setForm({ ...form, origin: e.target.value })}
                  placeholder="如：闲鱼（留空则不修改）"
                  className="max-w-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">成色</span>
                <div className="flex gap-1 flex-wrap">
                  {CONDITION_OPTIONS.map((c) => (
                    <Button
                      key={c}
                      size="sm"
                      variant={form.condition === c ? "default" : "outline"}
                      onClick={() => setForm({ ...form, condition: form.condition === c ? "" : c })}
                    >
                      {c}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">分类</span>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="rounded-md border bg-background px-2 py-2 text-sm"
                >
                  <option value="">请选择分类</option>
                  {tree.map((t) => (
                    <optgroup key={t.id} label={t.name}>
                      <option value={t.name}>{t.name}（仅大类）</option>
                      {t.children.map((c) => (
                        <option key={c.id} value={`${t.name}-${c.name}`}>
                          {t.name}-{c.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  {categories
                    .filter((c) => !tree.some((t) => t.name === c || t.children.some((ch) => `${t.name}-${ch.name}` === c)))
                    .map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">状态</span>
                <div className="flex gap-1 flex-wrap">
                  {STATUS_OPTIONS.map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={form.status === s ? "default" : "outline"}
                      onClick={() => setForm({ ...form, status: s })}
                    >
                      {statusLabel(s)}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => (setEditing(null), setForm(null))}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={isPending || !form}>
              {isPending ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
