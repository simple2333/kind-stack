import { z } from "zod";

// ============================================================
// Server Action 输入校验（zod）
// 所有对外暴露的 action 入参必须先过 schema，拒绝非法输入。
// ============================================================

const NAME = z.string().trim().min(1, "名称不能为空").max(100, "名称过长");
const CONDITION = z.enum(["全新", "九成新", "八成新", "七成新", "微瑕", "破损"]).optional();
/** 分类为动态两级路径（「大类」或「大类-小类」），不再限定枚举，最长 80 字 */
const CATEGORY = z.string().trim().max(80, "分类过长").optional();
const QUANTITY = z.number().int().min(1, "数量至少为 1").max(9999, "数量过大");
const PRICE = z.number().min(0, "价格不能为负").max(100000, "价格过大");
const UNIT = z.string().trim().max(10, "单位过长").optional();

export const entryItemSchema = z.object({
  name: NAME,
  condition: CONDITION,
  quantity: QUANTITY.optional(),
  category: CATEGORY,
  unit: UNIT,
});

export const confirmItemsSchema = z.object({
  origin: z.string().trim().max(50, "来源过长").optional(),
  entries: z
    .array(
      z.object({
        name: NAME,
        condition: CONDITION,
        quantity: QUANTITY.optional(),
        category: CATEGORY,
      })
    )
    .min(1, "没有要入库的物品")
    .max(100, "单次最多入库 100 件"),
});

export const priceSchema = z.object({
  code: z.string().regex(/^YZ-\d{8}-\d{4}$/, "物品编号格式错误"),
  price: PRICE,
});

export const itemStatusSchema = z.object({
  code: z.string().regex(/^YZ-\d{8}-\d{4}$/, "物品编号格式错误"),
  status: z.enum(["received", "on_shelf", "sold", "given", "kept", "damaged"]),
  qty: z.number().int().min(1, "出库数量至少为 1").optional(),
});

export const donorBatchSchema = z.object({
  alias: z.string().trim().max(50, "化名过长").optional(),
  items: z
    .array(z.object({ name: NAME, condition: CONDITION, quantity: QUANTITY.optional(), category: CATEGORY }))
    .min(1)
    .max(100),
});

/** 收件台手动录入（不依赖 AI），price 可选；批量码由系统生成 */
export const manualEntrySchema = z.object({
  origin: z.string().trim().max(50, "来源过长").optional(),
  items: z
    .array(
      z.object({
        name: NAME,
        condition: CONDITION,
        quantity: QUANTITY.optional(),
        category: CATEGORY,
        price: PRICE.optional(),
      })
    )
    .min(1, "至少录入一件物品")
    .max(100, "单次最多录入 100 件"),
});

/** 捐赠人自助登记（公开匿名） */
export const donationRequestSchema = z.object({
  alias: z.string().trim().max(50, "化名过长").optional(),
  note: z.string().trim().max(200, "备注过长").optional(),
  items: z
    .array(z.object({ name: NAME, condition: CONDITION, quantity: QUANTITY.optional(), category: CATEGORY, unit: UNIT }))
    .min(1, "至少填写一件物品")
    .max(50, "单次最多 50 件"),
});

/** 复核通过时允许微调（含单价） */
export const reviewApproveSchema = z.object({
  id: z.number().int().positive(),
  itemIndexes: z.array(z.number().int().min(0)).optional(),
  items: z
    .array(
      z.object({
        name: NAME,
        condition: CONDITION,
        quantity: QUANTITY.optional(),
        category: CATEGORY,
        price: PRICE.optional(),
      })
    )
    .min(1, "至少一件物品")
    .max(50),
});

export const reviewRejectSchema = z.object({
  id: z.number().int().positive(),
  itemIndexes: z.array(z.number().int().min(0)).min(1, "请选择要驳回的物品"),
  reason: z.string().trim().max(100, "原因过长").optional(),
});

/** 受赠人反馈（公开匿名） */
export const feedbackSchema = z.object({
  content: z.string().trim().min(1, "请填写反馈内容").max(500, "反馈过长"),
  rating: z.number().int().min(1).max(5).optional(),
  contact: z.string().trim().max(50, "联系方式过长").optional(),
});

/** 货架编辑（查看/编辑分离），至少改一项 */
export const updateItemSchema = z.object({
  code: z.string().regex(/^YZ-\d{8}-\d{4}$/, "物品编号格式错误"),
  name: NAME.optional(),
  condition: CONDITION,
  category: CATEGORY,
  quantity: QUANTITY.optional(),
  price: PRICE.optional(),
  status: z.enum(["received", "on_shelf", "sold", "given", "kept", "damaged"]).optional(),
  origin: z.string().trim().max(50, "来源过长").optional(),
  /** PDA 旧入参兼容：仍可传 donorAlias（写入 item.origin） */
  donorAlias: z.string().trim().max(50, "来源过长").optional(),
});

// ============================================================
// 扫码结算 / 售出撤销 / Excel 批量导入
// ============================================================

const CODE = z.string().trim().regex(/^YZ-\d{8}-\d{4}$/, "物品编号格式错误");

/** 扫码结算：一次提交多件物品的流转（售出/转赠/自留/报废） */
export const checkoutSchema = z.object({
  status: z.enum(["sold", "given", "kept", "damaged"]),
  entries: z
    .array(z.object({ code: CODE, qty: z.number().int().min(1, "出库数量至少为 1") }))
    .min(1, "没有要出库的物品")
    .max(200, "单次最多处理 200 件"),
});

/** 货架批量修改：勾选多件统一改分类/状态/来源，至少改一项 */
export const bulkUpdateSchema = z
  .object({
    codes: z.array(z.string().regex(/^YZ-\d{8}-\d{4}$/, "物品编号格式错误")).min(1, "请选择物品").max(200, "单次最多 200 件"),
    category: z.string().trim().max(80).optional(),
    status: z.enum(["received", "on_shelf", "sold", "given", "kept", "damaged"]).optional(),
    origin: z.string().trim().max(50, "来源过长").optional(),
  })
  .refine((v) => v.category != null || v.status != null || v.origin != null, {
    message: "请至少选择一项要修改的内容",
  });

/** 售出撤销：单件（orderItemIds）或整单（orderId） */export const revertSaleSchema = z
  .object({
    orderId: z.number().int().positive().optional(),
    orderItemIds: z.array(z.number().int().positive()).max(200).optional(),
    reason: z.string().trim().max(100, "原因过长").optional(),
  })
  .refine((v) => v.orderId != null || (v.orderItemIds && v.orderItemIds.length > 0), {
    message: "请选择要撤销的销售记录",
  });

/** Excel 批量导入：前端解析后只提交过滤出的行 */
export const excelImportSchema = z.object({
  defaultOrigin: z.string().trim().max(50, "来源过长").optional(),
  rows: z
    .array(
      z.object({
        externalNo: z.string().trim().max(64).optional(),
        name: z.string().trim().min(1, "标题不能为空").max(200, "标题过长"),
        category: z.string().trim().max(80).optional(),
        price: z.number().min(0).max(1000000).optional(),
        photo: z.string().trim().max(500).optional(),
        handledType: z.string().trim().max(20).optional(),
        orderedAt: z.string().trim().max(30).optional(),
      })
    )
    .min(1, "没有可导入的数据")
    .max(5000, "单次最多导入 5000 条"),
});

// ============================================================
// 筛选 + 导出（只读，不写库）
// ============================================================

const DATE = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式应为 YYYY-MM-DD")
  .optional();

export const exportItemsSchema = z.object({
  q: z.string().trim().max(100).optional(),
  name: z.string().trim().max(100).optional(),
  code: z.string().trim().max(40).optional(),
  origin: z.string().trim().max(50).optional(),
  categoryText: z.string().trim().max(80).optional(),
  status: z.enum(["received", "on_shelf", "sold", "given", "kept", "damaged"]).optional(),
  category: z.string().trim().max(80).optional(),
  categoryMajor: z.string().trim().max(80).optional(),
  categoryMinor: z.string().trim().max(80).optional(),
  dateFrom: DATE,
  dateTo: DATE,
  codes: z.array(z.string().regex(/^YZ-\d{8}-\d{4}$/, "物品编号格式错误")).max(500).optional(),
});

export const exportOperLogsSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.number().int().min(0).max(1).optional(),
  dateFrom: DATE,
  dateTo: DATE,
});

export const exportLoginLogsSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.number().int().min(0).max(1).optional(),
  dateFrom: DATE,
  dateTo: DATE,
});

export const receiptLookupSchema = z.object({
  batchCode: z.string().regex(/^JZ-[A-Z0-9]{8}$/, "批量码格式错误"),
});

// ============================================================
// PDA 端（REST API）入参校验
// ============================================================

/** PDA 货架查询（只读） */
export const pdaStockQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["received", "on_shelf", "sold", "given", "kept", "damaged"]).optional(),
  category: z.string().trim().max(80).optional(),
  origin: z.string().trim().max(50).optional(),
  dateFrom: DATE,
  dateTo: DATE,
  page: z.coerce.number().int().min(1).optional(),
  size: z.coerce.number().int().min(1).max(100).optional(),
});

/** PDA 物品查询（按编号） */
export const pdaItemQuerySchema = z.object({
  code: z.string().trim().regex(/^YZ-\d{8}-\d{4}$/, "物品编号格式错误"),
});

/** PDA 流转（与 itemStatusSchema 一致，独立命名便于 PDA 路由引用） */
export const pdaStatusSchema = z.object({
  code: z.string().trim().regex(/^YZ-\d{8}-\d{4}$/, "物品编号格式错误"),
  status: z.enum(["received", "on_shelf", "sold", "given", "kept", "damaged"]),
  qty: z.number().int().min(1, "出库数量至少为 1").optional(),
});

/** PDA 复核列表查询 */
export const pdaReviewQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "all"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  size: z.coerce.number().int().min(1).max(100).optional(),
});

/** PDA 回执查询 */
export const pdaReceiptQuerySchema = z.object({
  batch: z.string().trim().regex(/^JZ-[A-Z0-9]{8}$/, "回执码格式错误"),
});

/** PDA / 网页端 ISBN 查询 */
export const pdaIsbnQuerySchema = z.object({
  isbn: z.string().trim().min(1, "请输入 ISBN").max(20, "ISBN 过长"),
});

/** 解析并校验，返回 safeParse 结果 */
export function safeParse<T extends z.ZodType>(schema: T, data: unknown) {
  return schema.safeParse(data);
}