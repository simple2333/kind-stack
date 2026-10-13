"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function CopyFingerprint({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("账本指纹已复制");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制失败，请手动选择复制");
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
      {copied ? "已复制 ✓" : "复制"}
    </Button>
  );
}