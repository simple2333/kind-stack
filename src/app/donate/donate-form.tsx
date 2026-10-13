"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { submitDonationRequest } from "@/lib/actions";
import { useCategories } from "@/lib/use-categories";

interface Row {
  name: string;
  condition: string;
  category: string;
  quantity: string;
  unit: string;
}

const CONDITION_OPTIONS = ["全新", "九成新", "八成新", "七成新", "微瑕", "破损"];
const UNIT_OPTIONS = ["件", "份", "个", "套", "本"];

export default function DonateForm({ defaultAlias = "" }: { defaultAlias?: string }) {
  const [alias, setAlias] = useState(defaultAlias);
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<Row[]>([{ name: "", condition: "", category: "", quantity: "1", unit: "件" }]);
  const [done, setDone] = useState(false);
  const [doneCode, setDoneCode] = useState("");
  const [isPending, startTransition] = useTransition();
  const { categories } = useCategories(true);

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  function addRow() {
    setRows((r) => [...r, { name: "", condition: "", category: "", quantity: "1", unit: "件" }]);
  }

  function removeRow(i: number) {
    setRows((r) => (r.length <= 1 ? r : r.filter((_, idx) => idx !== i)));
  }

  function handleSubmit() {
    const items = rows
      .filter((r) => r.name.trim())
      .map((r) => ({
        name: r.name.trim(),
        condition: r.condition || undefined,
        category: r.category || undefined,
        quantity: Math.max(1, Number(r.quantity) || 1),
        unit: r.unit || "件",
      }));
    if (items.length === 0) {
      toast.error("请至少填写一件物品");
      return;
    }
    startTransition(async () => {
      const res = await submitDonationRequest({
        alias: alias.trim() || undefined,
        note: note.trim() || undefined,
        items,
      });
      if (res.ok) {
        setDone(true);
        setDoneCode(res.code ?? "");
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="text-4xl">🎉</div>
        <h2 className="text-xl font-bold">提交成功！</h2>
        {doneCode && (
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">你的登记号：</p>
            <div className="font-mono text-2xl font-bold">{doneCode}</div>
            <p className="text-xs text-muted-foreground">请记下登记号，复核通过后可在「最近收到的善意」里凭登记号确认。</p>
          </div>
        )}
        <p className="text-muted-foreground">
          请把捐赠物品放到<b>收银台 / 前台</b>，店员复核后会正式入库。
          <br />
          之后你可以拿一张「捐赠回执标签」，随时扫码查看这些物品的去向。
        </p>
        <Button variant="outline" onClick={() => setDone(false)}>
          继续登记下一批
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder='你的化名（可选，如「老王」）' className="flex-1" />
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          提示：一类物品写一条记录（如「陶瓷马克杯 × 2 件」），不同物品请分别填写。
        </p>
        {rows.map((row, i) => (
          <div key={i} className="border rounded-lg p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm shrink-0">{i + 1}.</span>
              <Input
                value={row.name}
                onChange={(e) => updateRow(i, { name: e.target.value })}
                placeholder="物品名称，如：陶瓷马克杯"
                className="flex-1"
              />
              <Input
                value={row.quantity}
                onChange={(e) => updateRow(i, { quantity: e.target.value })}
                placeholder="数量"
                className="w-16 text-center"
                inputMode="numeric"
              />
              <select
                value={row.unit}
                onChange={(e) => updateRow(i, { unit: e.target.value })}
                className="rounded-md border bg-background px-2 py-2 text-sm"
                aria-label="单位"
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeRow(i)}>
                删除本条登记
              </Button>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">成色（可选）</span>
              <div className="flex gap-1 flex-wrap">
                {CONDITION_OPTIONS.map((c) => (
                  <Button
                    key={c}
                    size="sm"
                    variant={row.condition === c ? "default" : "outline"}
                    onClick={() => updateRow(i, { condition: row.condition === c ? "" : c })}
                  >
                    {c}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">分类（可选）</span>
              <select
                value={row.category}
                onChange={(e) => updateRow(i, { category: e.target.value })}
                className="rounded-md border bg-background px-2 py-2 text-sm"
              >
                <option value="">请选择分类</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addRow} className="self-start">
          + 再填一件
        </Button>
      </div>

      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="备注（可选）：物品使用情况、特别说明等"
        className="min-h-16"
      />

      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">提交即预约登记，正式入库前店员会复核</Badge>
      </div>
      <Button size="lg" onClick={handleSubmit} disabled={isPending}>
        {isPending ? "提交中…" : "提交捐赠登记"}
      </Button>
    </div>
  );
}