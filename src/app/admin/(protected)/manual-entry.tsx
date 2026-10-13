"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createItemsManual } from "@/lib/actions";
import { useCategories } from "@/lib/use-categories";

const CONDITION_OPTIONS = ["全新", "九成新", "八成新", "七成新", "微瑕", "破损"];

export default function ManualEntry() {
  const [name, setName] = useState("");
  const [condition, setCondition] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [origin, setOrigin] = useState("");
  const [isPending, startTransition] = useTransition();
  const { categories } = useCategories();

  function handleSubmit() {
    if (!name.trim()) {
      toast.error("请填写物品名称");
      return;
    }
    const qty = Number(quantity);
    if (!qty || qty < 1) {
      toast.error("数量至少为 1");
      return;
    }
    const priceNum = price.trim() ? Number(price) : undefined;
    if (price.trim() && (priceNum == null || Number.isNaN(priceNum) || priceNum < 0)) {
      toast.error("请输入有效价格");
      return;
    }
    startTransition(async () => {
      const res = await createItemsManual({
        origin: origin.trim() || undefined,
        items: [
          {
            name: name.trim(),
            condition: condition || undefined,
            category: category || undefined,
            quantity: qty,
            price: priceNum,
          },
        ],
      });
      if (res.ok) {
        toast.success(`${res.message}：${res.codes.join(", ")}`);
        setName("");
        setCondition("");
        setCategory("");
        setQuantity("1");
        setPrice("");
        setOrigin("");
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">手动录入</CardTitle>
         <CardDescription>不依赖 AI，直接填表入库，自动生成一件一码。带 * 为必填。</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="* 物品名称，如：马克杯"
            className="flex-1"
          />
          <div className="flex items-center gap-1">
            <Input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="数量"
              className="w-20 text-center"
              inputMode="numeric"
            />
            <Input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="单价(元，可选)"
              className="w-28 text-right"
              inputMode="decimal"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">成色（可选）</span>
          <div className="flex gap-1 flex-wrap">
            {CONDITION_OPTIONS.map((c) => (
              <Button
                key={c}
                variant={condition === c ? "default" : "outline"}
                size="sm"
                onClick={() => setCondition(condition === c ? "" : c)}
              >
                {c}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">分类（可选）</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
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

        <Input
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          placeholder="物品来源（可选，如：闲鱼 / 小红书 / 线下捐赠）"
          className="flex-1"
        />

        <Button size="lg" onClick={handleSubmit} disabled={isPending || !name.trim()}>
          {isPending ? "入库中…" : "手动入库"}
        </Button>
      </CardContent>
    </Card>
  );
}