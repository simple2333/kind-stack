"use client";

import { useState, useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { submitTextEntry, submitImageEntry, confirmItems } from "@/lib/actions";
import { useCategories } from "@/lib/use-categories";
import ManualEntry from "./manual-entry";

interface PendingItem {
  name: string;
  condition?: string;
  quantity: number;
  category?: string;
}

const CONDITION_OPTIONS = ["全新", "九成新", "八成新", "七成新", "微瑕", "破损"];

/** 将 dataURL 图片等比缩到最长边 MAX，并压缩为 JPEG，返回新的 dataURL；失败则原样返回 */
async function compressImage(dataUrl: string, maxSide = 1280, quality = 0.8): Promise<string> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("load fail"));
    img.src = dataUrl;
  });
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  if (scale >= 1) return dataUrl;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

export default function IntakeConsole() {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [origin, setOrigin] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const { categories } = useCategories();

  function startVoice() {
    const w = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        continuous: boolean;
        onresult: (e: { results: { 0: { 0: { transcript: string } }; length: number } }) => void;
        onend: () => void;
        onerror: () => void;
        start: () => void;
        stop: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        continuous: boolean;
        onresult: (e: { results: { 0: { 0: { transcript: string } }; length: number } }) => void;
        onend: () => void;
        onerror: () => void;
        start: () => void;
        stop: () => void;
      };
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      toast.error("当前浏览器不支持语音识别，请使用 Chrome/Edge");
      return;
    }
    const rec = new Ctor();
    rec.lang = "zh-CN";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setText(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
      toast.error("语音识别出错，请重试");
    };
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
    toast.success("正在聆听，请说：'收到三只马克杯'");
  }

  function stopVoice() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  function handleTextSubmit() {
    if (!text.trim()) return;
    startTransition(async () => {
      const res = await submitTextEntry(text.trim());
      if (res.ok) {
        setPending((p) => [...p, ...res.items.map((i) => ({ ...i, quantity: i.quantity ?? 1 }))]);
        setText("");
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    });
  }

  function handlePhoto(file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      const full = String(reader.result);
      setPhoto(full);
      // 先在客户端压缩/缩放，减小请求体与 AI 载荷，避免大图超限
      const compressed = await compressImage(full).catch(() => full);
      const data = String(compressed).split(",")[1] ?? String(compressed);
      startTransition(async () => {
        const res = await submitImageEntry(data);
        if (res.ok) {
          setPending((p) => [...p, ...res.items.map((i) => ({ ...i, quantity: i.quantity ?? 1 }))]);
          toast.success(res.message);
        } else {
          toast.error(res.message);
        }
      });
    };
    reader.readAsDataURL(file);
  }

  function handleConfirm() {
    if (pending.length === 0) return;
    startTransition(async () => {
      const res = await confirmItems({
        origin: origin || undefined,
        entries: pending.map((i) => ({ ...i })),
      });
      if (res.ok) {
        toast.success(`${res.message}：${res.codes.join(", ")}`);
        setPending([]);
        setOrigin("");
        setPhoto(null);
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">收件台</CardTitle>
          <CardDescription>
             拍照 / 说话 / 打字，AI 自动识别入库。确认前可修改，确认后生成一件一码进入货架。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Button
              size="lg"
              className="h-16 flex-1 text-lg"
              onClick={() => fileRef.current?.click()}
              disabled={isPending}
            >
              {photo ? "重新拍照" : "📷 拍一张多件物品"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0])}
            />
            <Button
              size="lg"
              className="h-16 text-lg"
              variant={listening ? "default" : "outline"}
              onClick={listening ? stopVoice : startVoice}
            >
              {listening ? "🔴 聆听中…点我停止" : "🎙️ 语音说一句"}
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='例如："收到三只马克杯、一套睡衣、两本旧书"'
              className="min-h-24 text-lg"
            />
            <div className="flex items-center gap-2">
              <Button
                size="lg"
                className="text-lg flex-1"
                variant={text.trim() ? "default" : "outline"}
                onClick={handleTextSubmit}
                disabled={isPending || !text.trim()}
              >
                {isPending ? "AI 识别中…" : "识别入库"}
              </Button>
              {!text.trim() && (
                <span className="text-xs text-muted-foreground">输入或语音录入后即可识别</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <ManualEntry />

      {pending.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl">待确认（{pending.length} 件）</CardTitle>
               <CardDescription>确认后自动生成一件一码，进入货架</CardDescription>
            </div>
            <Button onClick={handleConfirm} size="lg" disabled={isPending}>
              ✅ 全部确认入库
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Input
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="物品来源（可选，如：闲鱼 / 小红书 / 线下捐赠）"
              className="flex-1"
            />
            <div className="flex flex-col divide-y">
              {pending.map((item, idx) => (
                <div key={idx} className="py-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-lg font-medium">{item.name}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPending((p) => p.map((x, i) => (i === idx ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x)))
                        }
                      >
                        −
                      </Button>
                      <span className="w-8 text-center text-lg">×{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPending((p) => p.map((x, i) => (i === idx ? { ...x, quantity: x.quantity + 1 } : x)))}
                      >
                        +
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setPending((p) => p.filter((_, i) => i !== idx))}
                      >
                        删
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground shrink-0">成色：</span>
                    <Badge variant="secondary">{item.condition ?? "成色未知"}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground shrink-0">分类：</span>
                    <Badge variant="outline">{item.category ?? "未分类"}</Badge>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">成色：</span>
                    <div className="flex gap-1 flex-wrap">
                      {CONDITION_OPTIONS.map((c) => (
                        <Button
                          key={c}
                          variant={item.condition === c ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPending((p) => p.map((x, i) => (i === idx ? { ...x, condition: c } : x)))}
                        >
                          {c}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">分类：</span>
                    <select
                      value={item.category ?? ""}
                      onChange={(e) => setPending((p) => p.map((x, i) => (i === idx ? { ...x, category: e.target.value || undefined } : x)))}
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
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}