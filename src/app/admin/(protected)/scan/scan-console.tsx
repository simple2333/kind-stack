"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { scanLookup, checkoutItems } from "@/lib/actions";
import { statusLabel, type ItemStatus } from "@/lib/item-types";

interface ScannedItem {
  id: number;
  code: string;
  name: string;
  price: number | null;
  status: string;
  condition: string;
  category: string;
  quantity: number;
  remaining: number;
  sold_qty: number;
  given_qty: number;
  kept_qty: number;
  damaged_qty: number;
}

interface CartLine extends ScannedItem {
  qty: number;
  prevStatus: string;
}

const STATUS_ACTIONS: { key: Exclude<ItemStatus, "received" | "on_shelf">; label: string; variant: "default" | "destructive" | "outline" | "secondary" }[] = [
  { key: "sold", label: "售出", variant: "default" },
  { key: "given", label: "转赠", variant: "secondary" },
  { key: "kept", label: "自留", variant: "outline" },
  { key: "damaged", label: "报废", variant: "destructive" },
];

export default function ScanConsole() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<Exclude<ItemStatus, "received" | "on_shelf">>("sold");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [isPending, startTransition] = useTransition();
  const [camOpen, setCamOpen] = useState(false);
  const [camErr, setCamErr] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    inputRef.current?.focus();
    return () => stopCamera();
  }, []);

  function stopCamera() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOpen(false);
    setCamErr("");
  }

  async function openCamera() {
    setCamErr("");
    if (!("BarcodeDetector" in window)) {
      setCamErr("当前浏览器不支持摄像头扫码，请用 Chrome/Edge，或直接用扫码枪/手动输入编号");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      setCamOpen(true);
    } catch {
      setCamErr("无法打开摄像头，请检查浏览器授权（需 HTTPS 或 localhost 才能用摄像头）");
    }
  }

  useEffect(() => {
    if (!camOpen || !videoRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.setAttribute("playsinline", "true");
    void video.play();

    const detector = new (window as unknown as {
      BarcodeDetector: new (o?: { formats?: string[] }) => {
        detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
      };
    }).BarcodeDetector({ formats: ["qr_code"] });

    let closed = false;
    const tick = async () => {
      if (closed) return;
      if (video.readyState >= 2) {
        try {
          const codes = await detector.detect(video);
          const hit = codes.map((c) => c.rawValue).find((v) => /^YZ-/.test(v.trim()));
          if (hit) {
            stopCamera();
            addToCart(hit.trim());
            return;
          }
        } catch {
          /* 忽略单帧失败 */
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      closed = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [camOpen]);

  /** 扫码 → 查物品 → 加入待结算清单（不立即流转） */
  function handleScan(value?: string) {
    const target = (value ?? code).trim();
    if (!target) return;
    addToCart(target);
  }

  function addToCart(target: string) {
    startTransition(async () => {
      const res = await scanLookup(target);
      setCode("");
      if (!res.ok || !res.item) {
        toast.error(res.message ?? "未找到");
        inputRef.current?.focus();
        return;
      }
      const item = res.item;
      if (item.remaining <= 0) {
        toast.error(`「${item.name}」已无剩余可出库`);
        inputRef.current?.focus();
        return;
      }
      setCart((c) => {
        const exists = c.find((l) => l.code === item.code);
        if (exists) {
          if (exists.qty >= item.remaining) {
            toast.info(`「${item.name}」已加入 ${exists.qty} 件，不能再多`);
            return c;
          }
          return c.map((l) => (l.code === item.code ? { ...l, qty: l.qty + 1 } : l));
        }
        return [{ ...item, qty: 1, prevStatus: item.status }, ...c];
      });
      toast.success(`已加入「${item.name}」`);
      inputRef.current?.focus();
    });
  }

  function setLineQty(codeKey: string, qty: number) {
    setCart((c) =>
      c.map((l) =>
        l.code === codeKey ? { ...l, qty: Math.min(Math.max(1, qty || 1), l.remaining) } : l
      )
    );
  }

  function removeLine(codeKey: string) {
    setCart((c) => c.filter((l) => l.code !== codeKey));
  }

  function clearCart() {
    setCart([]);
    inputRef.current?.focus();
  }

  function switchMode(k: Exclude<ItemStatus, "received" | "on_shelf">) {
    if (cart.length > 0) {
      toast.info("已切换操作类型，请确认清单按新类型处理");
    }
    setMode(k);
    inputRef.current?.focus();
  }

  const totalQty = cart.reduce((s, l) => s + l.qty, 0);
  const totalAmount = cart.reduce((s, l) => s + (l.price ?? 0) * l.qty, 0);

  function handleCheckout() {
    if (cart.length === 0) return;
    startTransition(async () => {
      const res = await checkoutItems({ status: mode, entries: cart.map((l) => ({ code: l.code, qty: l.qty })) });
      if (res.ok) {
        toast.success(res.message);
        setCart([]);
        inputRef.current?.focus();
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">扫码处理</CardTitle>
          <CardDescription>
            先选操作（默认售出），扫码先把物品带出来加入下方清单，可改数量、删除，确认无误后一次性提交。
            售出会生成一张销售单，可在「销售记录」整单或单件撤销。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">本次扫码将执行的操作：</span>
            <div className="flex gap-2 flex-wrap">
              {STATUS_ACTIONS.map((s) => (
                <Button
                  key={s.key}
                  variant={mode === s.key ? s.variant : "outline"}
                  size="lg"
                  onClick={() => switchMode(s.key)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              当前模式：<span className="font-semibold">{statusLabel(mode)}</span> · 扫码后加入清单，确认时统一提交
            </p>
          </div>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleScan();
            }}
          >
            <Input
              ref={inputRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="扫码或输入物品编号，回车加入清单"
              className="flex-1 font-mono text-lg"
            />
            <Button type="submit" disabled={isPending || !code.trim()}>
              加入
            </Button>
            <Button
              type="button"
              variant={camOpen ? "secondary" : "outline"}
              onClick={camOpen ? stopCamera : openCamera}
              title="用手机摄像头扫描二维码"
            >
              {camOpen ? "关闭摄像头" : "📷 摄像头扫码"}
            </Button>
          </form>

          {camOpen && (
            <div className="flex flex-col gap-1">
              <video ref={videoRef} className="w-full max-w-sm rounded-lg border bg-black aspect-square object-cover" />
              <p className="text-xs text-muted-foreground">对准「一件一码」二维码，自动加入清单</p>
            </div>
          )}
          {camErr && <p className="text-xs text-destructive">{camErr}</p>}
        </CardContent>
      </Card>

      <Card className={cart.length > 0 ? "border-primary/40" : ""}>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl">
              待{statusLabel(mode)}清单（{cart.length} 种 · {totalQty} 件）
            </CardTitle>
            <CardDescription>
              {mode === "sold"
                ? `合计金额 ¥${totalAmount.toFixed(2)}`
                : `本次将把 ${totalQty} 件物品标记为「${statusLabel(mode)}」`}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={clearCart} disabled={cart.length === 0 || isPending}>
              清空
            </Button>
            <Button size="lg" onClick={handleCheckout} disabled={cart.length === 0 || isPending}>
              {isPending ? "处理中…" : mode === "sold" ? `✅ 确认售出（¥${totalAmount.toFixed(2)}）` : `✅ 确认${statusLabel(mode)}`}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {cart.length === 0 && (
            <p className="text-muted-foreground py-8 text-center">扫码后物品会出现在这里，确认后再统一提交</p>
          )}
          {cart.map((l) => (
            <div key={l.code} className="flex items-center justify-between gap-3 border rounded-md px-3 py-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-xs text-muted-foreground">{l.code}</span>
                <span className="font-medium truncate">{l.name}</span>
                <Badge variant="outline">{statusLabel(l.prevStatus)}</Badge>
                {l.price != null && <span className="text-sm font-bold">¥{l.price}</span>}
                <span className="text-xs text-muted-foreground">共{l.quantity} · 剩{l.remaining}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setLineQty(l.code, l.qty - 1)} disabled={l.qty <= 1}>
                  −
                </Button>
                <Input
                  value={l.qty}
                  onChange={(e) => setLineQty(l.code, Number(e.target.value))}
                  inputMode="numeric"
                  className="w-16 text-center h-9"
                  aria-label={`${l.name} 数量`}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLineQty(l.code, l.qty + 1)}
                  disabled={l.qty >= l.remaining}
                >
                  +
                </Button>
                {mode === "sold" && <span className="text-sm w-20 text-right">¥{((l.price ?? 0) * l.qty).toFixed(2)}</span>}
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeLine(l.code)}>
                  删除
                </Button>
              </div>
            </div>
          ))}
          {cart.length > 0 && mode === "sold" && (
            <div className="flex justify-end text-lg font-bold pt-2 border-t">合计：¥{totalAmount.toFixed(2)}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
