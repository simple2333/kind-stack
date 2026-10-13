#!/usr/bin/env node
/**
 * 锐浪报表(.grf) → PDA 蓝牙打印模板(CPCL) 转换脚本
 *
 * 用法：
 *   node scripts/convert-grf.mjs            # 转换 public/grf/ 下所有 .grf
 *   node scripts/convert-grf.mjs YZ-item-50x30.grf
 *
 * 产出（写入 public/pda/，由 Next 静态托管，PDA 匿名拉取）：
 *   {name}.txt     CPCL 文本模板（含 [{n}] 占位符）
 *   {name}.json    字段顺序映射（[{n}] → 字段名）
 *   manifest.json  模板清单（PDA 据此列模板）
 *
 * 说明：本脚本移植自参考项目 convert-grf.mjs（已验证可用），仅保留 CPCL 一路，
 * 输入源改为本项目的 public/grf/。详细踩坑见 docs/PDA蓝牙打印.md。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GRF_DIR = path.resolve(__dirname, "../public/grf");
const OUT_DIR = path.resolve(__dirname, "../public/pda");
const MANIFEST_PATH = path.join(OUT_DIR, "manifest.json");

/** 每厘米对应点数（203dpi ≈ 80 dot/cm）。HM-A300E 若为 300dpi 需改此值。 */
const DOTS_PER_CM = 80;

/** 整体水平偏移(点)。正值右移、负值左移。 */
const X_OFFSET_DOTS = 0;

/**
 * 标签间隙(mm)。CPCL 打印首行 `! 0 200 200 {height} 1` 的 {height} 应为
 * 「标签高度 + 间隙 − 1.5mm」换算的点数，使打印机按实际间距走纸，避免累积漂移。
 */
const LABEL_GAP_MM = 2;

const CONTROL_TYPE = {
  Barcode: "barcode",
  MemoBox: "text",
  FieldBox: "text",
  Line: "line",
};

/**
 * PDA 专用排版微调（按 .grf 文件名），**只影响 PDA 打印，不动网页端锐浪模板**。
 *
 * - qrModule：二维码 module(U) 大小覆盖（默认由框尺寸推算，物品标签偏小，调大）
 * - qr：二维码坐标覆盖
 * - text：按控件 Name 覆盖文本坐标（右移/上移）
 *
 * 坐标单位为点（203dpi = 8 dot/mm），标签 40×30mm = 320×240 点。
 */
const PDA_OVERRIDES = {
  "YZ-item-40x30": {
    qrModule: 4, // 40mm 标签较窄，U=4 兼顾清晰与不裁切
    qr: { x: 12, y: 44 },
    text: {
      MemoBox2: { x: 172, y: 22 }, // 来源平台
      MemoBox1: { x: 172, y: 62 }, // 物品介绍（CPCL 单行，超长会截断）
      MemoBox3: { x: 172, y: 178 }, // 价格
    },
  },
  "YZ-receipt-40x30": {
    qrModule: 3, // 回执二维码内容是网址，保持较小以免裁切
    qr: { x: 10, y: 92 },
    text: {
      MemoBox1: { x: 8, y: 8 }, // 店名
      MemoBox2: { x: 8, y: 56 }, // 副标题
      MemoBox3: { x: 152, y: 96 }, // “回执码”说明
      MemoBox4: { x: 152, y: 132 }, // 回执码
    },
  },
};

/**
 * 按 .grf 控件 Font.Size（单位：1/10000 pt）选择 CPCL 中文点阵字库，
 * 以近似网页端锐浪模板的字号层次（来源小、品名中、价格大）。
 * 依赖打印机内置 GBUNSG16/24/32.CPF（汉印常见自带）。
 */
function cpclFont(sizeRaw) {
  const pt = Number(sizeRaw) / 10000;
  if (!Number.isFinite(pt) || pt <= 0) return "GBUNSG24.CPF";
  if (pt < 6) return "GBUNSG16.CPF";
  if (pt < 8.5) return "GBUNSG24.CPF";
  return "GBUNSG32.CPF";
}

/**
 * PDA 专用换行配置（弥补 CPCL 无 WordWrap）：按模板名 + 控件 Name 指定额外行数。
 * 额外行占位符命名为 `{字段}~2`、`{字段}~3`…，由 pda/common/label.js 按固定宽度拆分填充。
 */
const PDA_WRAP = {
  "YZ-item-40x30": {
    MemoBox1: { lines: 2, lineGap: 30 }, // 品名，最多 2 行
  },
};

function toDot(cm) {
  return Math.round((Number(cm) || 0) * DOTS_PER_CM);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** 由二维码框尺寸(cm)推算 CPCL 二维码 module 大小(U 值)，范围 1~32。 */
function qrModuleSize(wCm, hCm) {
  const side = Math.min(toDot(wCm), toDot(hCm));
  const est = Math.max(1, Math.floor((side - 8) / 35));
  return Math.min(32, Math.max(1, est));
}

function extractFieldNames(content) {
  const names = [];
  const re = /\[#([^#]+)#\]/g;
  let m;
  while ((m = re.exec(content)) !== null) names.push(m[1]);
  return names;
}

function convertGrfToCpcl(grf, name) {
  const printer = grf.Printer || {};
  const detail = grf.DetailGrid || {};
  const columnContent = detail.ColumnContent || {};
  const cell = (columnContent.ColumnContentCell || [])[0] || {};
  const controls = cell.Control || [];
  const ov = PDA_OVERRIDES[name] || {};

  // 收集动态字段，按出现顺序分配 [{n}]
  const allFields = [];
  const fieldIndexMap = {};
  controls.forEach((c) => {
    const content = c.Type === "FieldBox" ? (c.DataField ? `[#${c.DataField}#]` : "") : String(c.Text || "");
    extractFieldNames(content).forEach((f) => {
      if (!(f in fieldIndexMap)) {
        fieldIndexMap[f] = allFields.length;
        allFields.push(f);
      }
    });
  });
  const toPlaceholder = (s) => String(s || "").replace(/\[#([^#]+)#\]/g, (m, f) => `[${fieldIndexMap[f]}]`);

  const heightCm = num(printer.Height);
  const pitchMm = heightCm * 10 + LABEL_GAP_MM;
  const heightDot = Math.round((pitchMm - 1.5) * (DOTS_PER_CM / 10));

  const lines = [];
  lines.push(`! 0 200 200 ${heightDot} 1`);

  controls.forEach((c) => {
    const type = CONTROL_TYPE[c.Type];
    if (!type) return;
    // 应用整体水平偏移（文本控件可被 PDA_OVERRIDES 覆盖坐标）
    const tOv = (ov.text && c.Name && ov.text[c.Name]) || null;
    const x = tOv && tOv.x != null ? tOv.x : toDot(c.Left) + X_OFFSET_DOTS;
    const y = tOv && tOv.y != null ? tOv.y : toDot(c.Top);
    const w = toDot(c.Width);
    const h = toDot(c.Height);

    if (type === "line") {
      lines.push(`LINE ${x} ${y} ${x + w} ${y} 2`);
      return;
    }
    if (type === "barcode") {
      const isQr = String(c.BarcodeType || "").toUpperCase() === "QRCODE";
      const data = toPlaceholder(c.Text);
      if (isQr) {
        // 二维码坐标/大小可被覆盖
        const qx = ov.qr && ov.qr.x != null ? ov.qr.x : x;
        const qy = ov.qr && ov.qr.y != null ? ov.qr.y : y;
        const moduleSize = ov.qrModule != null ? ov.qrModule : qrModuleSize(c.Width, c.Height);
        lines.push(`B QR ${qx} ${qy} M 2 U ${moduleSize}`);
        // ⚠️ CPCL 二维码数据必须带「纠错级+掩码+输入模式」前缀（如 MA,），
        // 否则打印机会把数据开头当模式头解析，导致内容缺字符（如丢掉 "YZ-"）。
        lines.push(`MA,${data}`);
        lines.push("ENDQR");
      } else {
        // 一维条码：{y} 是底边（基线），用 top + height 才与 .grf 对齐
        lines.push(`B 128 2 2 ${h} ${x} ${y + h} ${data}`);
      }
      return;
    }
    // 文本：CPCL TEXT 的 {y} 是文字顶部，与 .grf 的 Top 一致。
    // 字号按 .grf Font.Size 映射 CPCL 点阵字库；WordWrap 控件补足换行占位符。
    const font = (ov.font && c.Name && ov.font[c.Name]) || cpclFont(c.Font && c.Font.Size);
    const rawContent = c.Type === "FieldBox" ? (c.DataField ? `[#${c.DataField}#]` : "") : String(c.Text || "");
    lines.push(`TEXT ${font} 0 ${x} ${y} ${toPlaceholder(rawContent)}`);
    const wcfg = PDA_WRAP[name] && c.Name ? PDA_WRAP[name][c.Name] : null;
    if (wcfg && wcfg.lines > 1) {
      const baseField = (rawContent.match(/\[#([^#]+)#\]/) || [])[1];
      if (baseField) {
        for (let k = 2; k <= wcfg.lines; k++) {
          const key = `${baseField}~${k}`;
          if (!(key in fieldIndexMap)) {
            fieldIndexMap[key] = allFields.length;
            allFields.push(key);
          }
          const yy = y + (k - 1) * (wcfg.lineGap || 30);
          lines.push(`TEXT ${font} 0 ${x} ${yy} [${fieldIndexMap[key]}]`);
        }
      }
    }
  });

  lines.push("FORM");
  lines.push("PRINT");
  return { cpcl: lines.join("\r\n"), fields: allFields };
}

function isGrf(obj) {
  return obj && obj.DetailGrid && obj.DetailGrid.ColumnContent;
}

async function main() {
  if (!fs.existsSync(GRF_DIR)) {
    console.error(`未找到目录: ${GRF_DIR}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const argTarget = process.argv[2];
  const grfFiles = fs
    .readdirSync(GRF_DIR)
    .filter((f) => f.toLowerCase().endsWith(".grf"))
    .filter((f) => (argTarget ? f.toLowerCase() === argTarget.toLowerCase() : true))
    .sort();

  if (grfFiles.length === 0) {
    console.log("没有可转换的 .grf 文件。");
    return;
  }

  const entries = [];
  for (const file of grfFiles) {
    const name = path.basename(file, ".grf");
    const raw = fs.readFileSync(path.join(GRF_DIR, file), "utf-8");
    const jsonStr = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    let grf;
    try {
      grf = JSON.parse(jsonStr);
    } catch (e) {
      console.error(`  ${file}: JSON 解析失败 - ${e.message}`);
      continue;
    }
    if (!isGrf(grf)) {
      console.error(`  ${file}: 不是有效的 .grf（缺 DetailGrid.ColumnContent）`);
      continue;
    }
    const { cpcl, fields } = convertGrfToCpcl(grf, name);
    fs.writeFileSync(path.join(OUT_DIR, `${name}.txt`), cpcl, "utf-8");
    fs.writeFileSync(
      path.join(OUT_DIR, `${name}.json`),
      JSON.stringify({ fileName: name, fields }, null, 2),
      "utf-8"
    );
    const printer = grf.Printer || {};
    entries.push({
      file: `${name}.txt`,
      fields: `${name}.json`,
      name: grf.Title || name,
      paper: `${num(printer.Width)}x${num(printer.Height)}cm`,
      updated: new Date().toISOString().slice(0, 10),
    });
    console.log(`  ✓ ${file} → public/pda/${name}.txt（字段：${fields.join(", ") || "无"}）`);
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(entries, null, 2), "utf-8");
  console.log(`\n[pda:cpcl] 已生成 ${entries.length} 个 CPCL 模板 + manifest.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
