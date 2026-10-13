import * as XLSX from "xlsx";

/** 将行数据导出为 .xlsx Buffer（服务端使用） */
export function rowsToXlsx(sheetName: string, rows: Record<string, unknown>[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}

/** 服务端 action 返回 base64 + 文件名，客户端用 Blob 下载 */
export function toDownloadPayload(sheetName: string, rows: Record<string, unknown>[], filename: string) {
  const buf = rowsToXlsx(sheetName, rows);
  return { data: buf.toString("base64"), filename };
}