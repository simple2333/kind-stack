/**
 * 生成 public/grf/manifest.json（锐浪报表模板清单）。
 *
 * 扫描 public/grf 目录下所有 .grf 模板文件名，写入 manifest.json。
 * 前端打码台据此自动带出模板下拉，新增模板无需改代码。
 *
 * 用法：npm run grf:manifest
 */
import { readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const grfDir = resolve(process.cwd(), "public/grf");
const manifestPath = resolve(grfDir, "manifest.json");

const files = readdirSync(grfDir)
  .filter((f) => f.toLowerCase().endsWith(".grf"))
  .sort();

writeFileSync(manifestPath, JSON.stringify(files, null, 2), "utf-8");
console.log(`[grf:manifest] 已生成 ${manifestPath}（${files.length} 个模板）`);
for (const f of files) console.log(`  - ${f}`);
