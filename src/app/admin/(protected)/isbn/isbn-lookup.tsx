"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { searchIsbnAction } from "./actions";
import type { IsbnBook } from "@/lib/isbn";

export default function IsbnLookup() {
  const [isbn, setIsbn] = useState("");
  const [book, setBook] = useState<IsbnBook | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSearch() {
    const value = isbn.trim();
    if (!value) {
      toast.error("请输入 ISBN");
      return;
    }
    startTransition(async () => {
      const res = await searchIsbnAction(value);
      if (res.ok && res.book) {
        setBook(res.book);
      } else {
        setBook(null);
        toast.error(res.message ?? "未找到该 ISBN 对应的图书");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">ISBN 图书查询</CardTitle>
          <CardDescription>
            输入或扫描图书背面的 ISBN（10 位 / 13 位，可带连字符），查询书名、作者、出版社、定价等信息。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="例如：9787115279460"
              className="font-mono text-lg"
              autoFocus
            />
            <Button onClick={handleSearch} disabled={isPending || !isbn.trim()} className="shrink-0">
              {isPending ? "查询中…" : "查询"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {book && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-5">
              {book.coverUrl && (
                // 走服务端代理，避免第三方 http 封面被浏览器拦截
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/isbn-cover?url=${encodeURIComponent(book.coverUrl)}`}
                  alt={book.title}
                  className="w-40 h-auto rounded-md border object-contain shrink-0 self-start bg-muted"
                />
              )}
              <div className="flex flex-col gap-2 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <h2 className="text-xl font-bold">{book.title}</h2>
                  {book.binding && <Badge variant="secondary">{book.binding}</Badge>}
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                  <Field label="作者" value={book.author} />
                  <Field label="译者" value={book.translator} />
                  <Field label="出版社" value={book.publisher} />
                  <Field label="出品方" value={book.producer} />
                  <Field label="出版年" value={book.publishYear} />
                  <Field label="页数" value={book.pages} />
                  <Field label="定价" value={book.price} />
                  <Field label="ISBN" value={book.isbn} mono />
                </dl>
                {book.summary && (
                  <div className="mt-2">
                    <div className="text-xs text-muted-foreground mb-1">内容简介</div>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-6">{book.summary}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground shrink-0 w-16">{label}</dt>
      <dd className={mono ? "font-mono" : ""}>{value}</dd>
    </div>
  );
}
