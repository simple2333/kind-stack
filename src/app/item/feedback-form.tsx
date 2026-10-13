"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitFeedback } from "@/lib/actions";

const RATINGS = [5, 4, 3, 2, 1];

export default function FeedbackForm({ itemId, onSubmitted }: { itemId: number; onSubmitted?: () => void }) {
  const [content, setContent] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [contact, setContact] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!content.trim()) {
      toast.error("请填写反馈内容");
      return;
    }
    startTransition(async () => {
      const res = await submitFeedback(itemId, {
        content: content.trim(),
        rating: rating ?? undefined,
        contact: contact.trim() || undefined,
      });
      if (res.ok) {
        toast.success(res.message);
        setContent("");
        setRating(null);
        setContact("");
        onSubmitted?.();
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <span className="text-sm text-muted-foreground mr-1">满意度：</span>
        {RATINGS.map((r) => (
          <Button
            key={r}
            variant={rating === r ? "default" : "outline"}
            size="sm"
            onClick={() => setRating(rating === r ? null : r)}
            title={`${r} 星`}
          >
            {r}★
          </Button>
        ))}
      </div>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="说说这件物品怎么样？功能是否正常、感受如何……"
        className="min-h-20"
      />
      <div className="flex items-center gap-2">
        <Input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="联系方式（可选）"
          className="flex-1"
        />
        <Button onClick={handleSubmit} disabled={isPending || !content.trim()}>
          {isPending ? "提交中…" : "提交反馈"}
        </Button>
      </div>
    </div>
  );
}