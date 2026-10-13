/** 账本 action → 中文显示（纯函数模块，服务端/客户端均可引用） */

const ACTION_LABEL: Record<string, string> = {
  "item.received": "物品入库",
  "item.priced": "定价",
  "item.shelved": "上架",
  "item.on_shelf": "上架",
  "item.sold": "售出",
  "item.given": "转赠",
  "item.kept": "自留",
  "item.damaged": "报废",
  "item.voided": "作废",
  "item.updated": "信息更新",
  "item.feedback": "受赠反馈",
  "item.sale_reverted": "售出撤销",
  "donor.created": "捐赠人登记",
  "batch.created": "批次创建",
  "sale.created": "销售单",
  "sale.reverted": "销售单撤销",
  "fund.published": "资金公示",
};

export function ledgerActionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action;
}