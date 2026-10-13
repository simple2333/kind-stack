/**
 * ISBN 图书检索（第三方 API：isbn.xiaoxi.ac.cn）。
 *
 * key 只在服务端读取（ISBN_API_KEY），不下发浏览器。
 * 返回统一结构，供网页端 Server Action 与 PDA API 复用。
 */

const ISBN_API_BASE = process.env.ISBN_API_BASE ?? "https://isbn.xiaoxi.ac.cn";
const ISBN_API_KEY = process.env.ISBN_API_KEY ?? "";

export interface IsbnBook {
  isbn: string;
  title: string;
  author: string | null;
  publisher: string | null;
  producer: string | null;
  translator: string | null;
  publishYear: string | null;
  pages: string | null;
  price: string | null;
  binding: string | null;
  summary: string | null;
  /** 原封面地址（第三方，http）；前端用 /api/isbn-cover 代理加载 */
  coverUrl: string | null;
}

export interface IsbnResult {
  ok: boolean;
  message?: string;
  book?: IsbnBook;
}

/** 去掉连字符/空格，只保留数字与 X（ISBN-10 校验位可能是 X） */
export function normalizeIsbn(input: string): string {
  return String(input ?? "").replace(/[^0-9Xx]/g, "").toUpperCase();
}

/** 校验 ISBN-10 / ISBN-13 长度（不做校验位计算，交由第三方 API 判定） */
export function isValidIsbnFormat(isbn: string): boolean {
  const s = normalizeIsbn(isbn);
  if (s.length === 10) return /^\d{9}[\dX]$/.test(s);
  if (s.length === 13) return /^\d{13}$/.test(s);
  return false;
}

interface RawBook {
  isbn?: string;
  title?: string;
  author?: string;
  publisher?: string;
  producer?: string;
  translator?: string;
  publish_year?: string;
  pages?: string;
  price?: string;
  binding?: string;
  summary?: string;
  local_cover_url?: string;
}

function toBook(raw: RawBook): IsbnBook {
  return {
    isbn: raw.isbn ?? "",
    title: raw.title ?? "",
    author: raw.author ?? null,
    publisher: raw.publisher ?? null,
    producer: raw.producer ?? null,
    translator: raw.translator ?? null,
    publishYear: raw.publish_year ?? null,
    pages: raw.pages ?? null,
    price: raw.price ?? null,
    binding: raw.binding ?? null,
    summary: raw.summary ?? null,
    coverUrl: raw.local_cover_url ?? null,
  };
}

/**
 * 按 ISBN 查询图书。
 * @param input ISBN-10 / ISBN-13（可含连字符）
 */
export async function searchIsbn(input: string): Promise<IsbnResult> {
  const isbn = normalizeIsbn(input);
  if (!isValidIsbnFormat(isbn)) {
    return { ok: false, message: "ISBN 格式不正确，请输入 10 位或 13 位 ISBN" };
  }
  if (!ISBN_API_KEY) {
    return { ok: false, message: "未配置 ISBN_API_KEY，请联系管理员" };
  }

  let res: Response;
  try {
    res = await fetch(`${ISBN_API_BASE}/search?isbn=${encodeURIComponent(isbn)}`, {
      headers: { "X-API-Key": ISBN_API_KEY },
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? `查询失败：${e.message}` : "查询失败" };
  }

  if (res.status === 404) return { ok: false, message: "未找到该 ISBN 对应的图书" };
  if (res.status === 422) return { ok: false, message: "ISBN 格式不正确" };
  if (res.status === 401) return { ok: false, message: "ISBN 查询服务鉴权失败（API Key 无效）" };
  if (!res.ok) return { ok: false, message: `ISBN 查询服务返回错误 ${res.status}` };

  let raw: RawBook;
  try {
    raw = (await res.json()) as RawBook;
  } catch {
    return { ok: false, message: "ISBN 查询服务返回数据异常" };
  }
  if (!raw || !raw.title) return { ok: false, message: "未找到该 ISBN 对应的图书" };

  return { ok: true, book: toBook(raw) };
}
