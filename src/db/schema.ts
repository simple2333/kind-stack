import {
  integer,
  sqliteTable,
  text,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ============================================================
// Better Auth 核心表（user/session/account/verification）
// 由 npx @better-auth/cli generate 生成，与 auth.ts 严格对齐
// ============================================================
export {
  users,
  sessions,
  accounts,
  verifications,
} from "./auth-schema";

// ============================================================
// 业务表
// ============================================================

export const store = sqliteTable("store", {
  id: integer("id").primaryKey(),
  name: text("name").notNull().default("示例二手慈善商店"),
  slogan: text("slogan").default("让每一份善意都有去处"),
  publicEnabled: integer("public_enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const donor = sqliteTable("donor", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name"),
  alias: text("alias"),
  batchCode: text("batch_code").unique(),
  contact: text("contact"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const item = sqliteTable(
  "item",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull().unique(),
    batchCode: text("batch_code"),
    donorId: integer("donor_id").references(() => donor.id),
    name: text("name").notNull(),
    category: text("category"),
    categoryMajor: text("category_major"), // 大分类（如「玩具」）
    categoryMinor: text("category_minor"), // 小分类（如「创意整蛊玩具」）
    condition: text("condition"),
    quantity: integer("quantity").notNull().default(1),
    soldQty: integer("sold_qty").notNull().default(0),
    givenQty: integer("given_qty").notNull().default(0),
    keptQty: integer("kept_qty").notNull().default(0),
    damagedQty: integer("damaged_qty").notNull().default(0),
    unit: text("unit").default("件"),
    description: text("description"),
    price: real("price"),
    photo: text("photo"), // base64 或路径
    photoThumb: text("photo_thumb"),
    status: text("status").notNull().default("received"),
    note: text("note"),
    source: text("source").notNull().default("manual"), // 录入渠道：manual=店员录入(含AI) / donate=用户自助登记 / import=Excel 导入
    origin: text("origin"), // 物品来源：闲鱼 / 小红书 / 线下捐赠 等（用户手填）
    externalNo: text("external_no").unique(), // 外部单号（闲鱼订单号），用于批量导入去重
    createdAt: text("created_at").notNull().default(new Date().toISOString()),
    updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
  },
  (t) => [
    index("idx_item_code").on(t.code),
    index("idx_item_status").on(t.status),
    index("idx_item_batch").on(t.batchCode),
    index("idx_item_external").on(t.externalNo),
  ]
);

export const ledger = sqliteTable(
  "ledger",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    prevHash: text("prev_hash").notNull().default(""),
    hash: text("hash").notNull(),
    refType: text("ref_type").notNull(),
    refId: integer("ref_id"),
    action: text("action").notNull(),
    payload: text("payload").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_ledger_ref").on(t.refType, t.refId)]
);

export const pendingEntry = sqliteTable("pending_entry", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  payload: text("payload").notNull(),
  source: text("source").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

// ============================================================
// 捐赠人自助登记（快递站式：扫码自填 → 店长复核 → 正式入库）
// ============================================================

export const donationRequest = sqliteTable(
  "donation_request",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").unique(), // 登记号 DJ-xxxx，供捐赠者精确确认
    batchCode: text("batch_code").unique(), // 回执批次码 JZ-xxxx，一次捐赠登记对应一张回执
    userId: text("user_id"), // 捐赠人账号（登录后提交才有；历史匿名数据为 null）
    alias: text("alias"),
    location: text("location"),
    note: text("note"),
    itemsJson: text("items_json").notNull(),
    status: text("status").notNull().default("pending"), // pending / approved / rejected
    reviewedAt: text("reviewed_at"),
    reviewedBy: text("reviewed_by"),
    createdAt: text("created_at").notNull().default(new Date().toISOString()),
  },
  (t) => [index("idx_donation_status").on(t.status), index("idx_donation_user").on(t.userId)]
);

// ============================================================
// 受赠人反馈（扫码填写，存库 + 记入哈希链）
// ============================================================

export const feedback = sqliteTable(
  "feedback",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    itemId: integer("item_id").notNull().references(() => item.id),
    content: text("content").notNull(),
    rating: integer("rating"), // 1-5
    contact: text("contact"),
    createdAt: text("created_at").notNull().default(new Date().toISOString()),
  },
  (t) => [index("idx_feedback_item").on(t.itemId)]
);

// ============================================================
// 销售单（扫码结算生成，支持整单撤销 / 单件撤销）
// ============================================================

export const saleOrder = sqliteTable(
  "sale_order",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderNo: text("order_no").notNull().unique(), // XS-YYYYMMDD-NNNN
    totalAmount: real("total_amount").notNull().default(0),
    itemCount: integer("item_count").notNull().default(0),
    status: text("status").notNull().default("completed"), // completed / canceled
    operator: text("operator"),
    createdAt: text("created_at").notNull().default(new Date().toISOString()),
    canceledAt: text("canceled_at"),
  },
  (t) => [index("idx_sale_status").on(t.status), index("idx_sale_time").on(t.createdAt)]
);

export const saleOrderItem = sqliteTable(
  "sale_order_item",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id").notNull().references(() => saleOrder.id),
    itemId: integer("item_id").notNull().references(() => item.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    qty: integer("qty").notNull().default(1),
    price: real("price"), // 成交单价快照
    prevStatus: text("prev_status").notNull().default("received"), // 撤销时还原的物品状态
    status: text("status").notNull().default("sold"), // sold / canceled
    createdAt: text("created_at").notNull().default(new Date().toISOString()),
    canceledAt: text("canceled_at"),
  },
  (t) => [index("idx_sale_item_order").on(t.orderId), index("idx_sale_item_item").on(t.itemId)]
);

// 历史遗留表：旧「简易 SVG 标签模板」已废弃，标签打印统一走锐浪模板（public/grf/*.grf）。
// 保留声明仅为避免 db:push 在生产库执行 DROP TABLE；代码中已无任何引用。
export const labelTemplate = sqliteTable("label_template", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  widthMm: real("width_mm").notNull(),
  heightMm: real("height_mm").notNull(),
  fields: text("fields").notNull(), // JSON
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// ============================================================
// 物品分类（两级树：大分类 parentId 为空，小分类挂大分类）
// 删除时校验无该分类（含子分类）物品
// ============================================================

export const category = sqliteTable(
  "category",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(), // 小分类存小类名；大分类存大类名
    parentId: integer("parent_id"), // 大分类为 null；小分类指向大分类 id
    sort: integer("sort").notNull().default(0),
    createdAt: text("created_at").notNull().default(new Date().toISOString()),
  },
  (t) => [index("idx_category_parent").on(t.parentId)]
);

// ============================================================
// 角色（轻量 RBAC：店长 / 店员）
// ============================================================

export const roles = sqliteTable("roles", {
  id: text("id").primaryKey(), // 'owner' | 'clerk'
  name: text("name").notNull(),
});

export const userRoles = sqliteTable(
  "user_roles",
  {
    userId: text("user_id").notNull(),
    roleId: text("role_id").notNull().references(() => roles.id),
    createdAt: text("created_at").notNull().default(new Date().toISOString()),
  },
  (t) => [
    index("idx_user_roles_user").on(t.userId),
    uniqueIndex("uq_user_roles").on(t.userId, t.roleId),
  ]
);

// ============================================================
// 操作日志（参照若依 sys_oper_log）
// ============================================================

export type OperBusinessType = 0 | 1 | 2 | 3 | 4; // 其他/新增/修改/删除/登录

export const operLog = sqliteTable(
  "oper_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title"), // 模块标题，如"物品入库"
    businessType: integer("business_type").notNull().default(0), // 0其他 1新增 2修改 3删除
    method: text("method"), // server action 名
    requestMethod: text("request_method"), // POST
    operatorType: integer("operator_type").notNull().default(1), // 0其他 1后台用户
    operName: text("oper_name"), // 操作人（email）
    operUrl: text("oper_url"),
    operIp: text("oper_ip"),
    operParam: text("oper_param"), // 请求参数 JSON（脱敏）
    jsonResult: text("json_result"), // 返回结果 JSON
    status: integer("status").notNull().default(0), // 0正常 1异常
    errorMsg: text("error_msg"),
    costTime: integer("cost_time"), // 耗时 ms
    createdAt: text("created_at").notNull().default(new Date().toISOString()),
  },
  (t) => [
    index("idx_oper_btype").on(t.businessType),
    index("idx_oper_status").on(t.status),
    index("idx_oper_time").on(t.createdAt),
  ]
);

// ============================================================
// 登录日志（参照若依 sys_logininfor）
// ============================================================

export const loginLog = sqliteTable(
  "login_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    loginName: text("login_name"),
    ipaddr: text("ipaddr"),
    loginLocation: text("login_location"),
    browser: text("browser"),
    os: text("os"),
    status: integer("status").notNull().default(0), // 0成功 1失败
    msg: text("msg"),
    loginTime: text("login_time").notNull().default(new Date().toISOString()),
  },
  (t) => [index("idx_login_status").on(t.status), index("idx_login_time").on(t.loginTime)]
);