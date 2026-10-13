/**
 * AI 通道：mimo-v2.6-flash 多模态三合一（拍照识别 / 语音转写 / 文本解析）+ 定价建议。
 * 所有调用走 OpenAI 兼容端点。key 从环境变量读取，只存在于服务端。
 */

export interface ParsedEntry {
  name: string;
  condition?: "全新" | "九成新" | "八成新" | "七成新" | "微瑕" | "破损";
  quantity?: number;
  category?: string;
}

export interface PriceSuggestion {
  price: number;
  reason: string;
}

const BASE_URL = process.env.AI_BASE_URL ?? "https://api.xiaomimimo.com/v1/chat/completions";
const MODEL = process.env.AI_MODEL ?? "mimo-v2.6-flash";
const API_KEY = process.env.AI_API_KEY ?? "";

const ENTRY_PROMPT = `你是二手慈善商店的入库识别助手。用户会发来一段对捐赠物品的描述（可能是语音转写的文字，也可能是照片里看到的物品）。
请识别出所有物品，输出严格 JSON 数组，不要任何解释或 markdown 代码块。
每条格式: {"name":"物品名","condition":"成色(全新/九成新/八成新/七成新/微瑕/破损)","quantity":整数(默认1),"category":"分类(家居/衣物/文具/玩具/厨具/电子产品/书籍/其他)"}
规则: 照片里有多少件就识别多少件; 描述含糊的 category 取最接近的; 若完全无法识别输出空数组 []。`;

const PRICE_PROMPT = `你是二手慈善商店的定价助手。根据物品信息和历史成交价给出建议售价。
输出严格 JSON: {"price":数字(元),"reason":"一句话说明定价依据"}，不要任何解释或 markdown。
规则:
1. price 必须是大于 0 的正数，禁止返回 0 或负数。再低价的物品也至少给 0.5 元。
2. 若用户给的是一整批/多件（quantity > 1），price 指每件的单价。
3. 定价要实惠亲民（二手慈善店通常比市场价低），结合成色和同类历史均价。`;

async function chatCompletion(body: unknown): Promise<string> {
  if (!API_KEY) throw new Error("未配置 AI_API_KEY");
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ model: MODEL, ...(body as object) }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI 请求失败 ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string; reasoning?: string; reasoning_content?: string } }[];
  };
  const msg = data.choices?.[0]?.message;
  return msg?.content ?? msg?.reasoning_content ?? msg?.reasoning ?? "";
}

function extractJsonArray(text: string): unknown[] {
  // 去掉可能的 ```json 围栏，截取首个 [...]
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** 文本 / 语音转写后的解析 */
export async function parseEntryText(text: string): Promise<ParsedEntry[]> {
  const content = await chatCompletion({
    messages: [
      { role: "system", content: ENTRY_PROMPT },
      { role: "user", content: text },
    ],
    temperature: 0.1,
    max_tokens: 2048,
  });
  return extractJsonArray(content).map((r) => r as ParsedEntry);
}

/** 拍照识别（base64 图片） */
export async function parseEntryImage(base64Image: string): Promise<ParsedEntry[]> {
  const content = await chatCompletion({
    messages: [
      { role: "system", content: ENTRY_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "请识别图中所有物品" },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${base64Image}` },
          },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 2048,
  });
  return extractJsonArray(content).map((r) => r as ParsedEntry);
}

/** 定价建议（quantity 为批量件数，price 指单价） */
export async function suggestPrice(
  name: string,
  condition: string | null,
  historyAvg: number | null,
  quantity?: number
): Promise<PriceSuggestion> {
  const userContent = `物品: ${name}\n成色: ${condition ?? "未知"}\n数量(件): ${quantity ?? 1}\n同类历史均价: ${historyAvg ?? "暂无"}`;
  const attempt = async (): Promise<PriceSuggestion> => {
    const content = await chatCompletion({
      messages: [
        { role: "system", content: PRICE_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0.2,
      max_tokens: 512,
    });
    const obj = extractJsonObject(content);
    const price = Number(obj?.price);
    // 解析失败或返回 0/负数/非有限数都视为无效，抛错让上层提示重试，绝不静默返回 0
    if (!obj || !Number.isFinite(price) || price <= 0) {
      throw new Error("AI 未给出有效价格，请重试或手动填写");
    }
    return { price: Math.round(price * 100) / 100, reason: String(obj?.reason ?? "") };
  };

  try {
    return await attempt();
  } catch {
    // 偶发失败重试一次
    return await attempt();
  }
}