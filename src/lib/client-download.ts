import { toast } from "sonner";

/**
 * 客户端下载工具：接收导出 action 返回的 base64 + filename，生成 .xlsx 并触发下载。
 * 只能在客户端组件中使用。
 */
export async function downloadFromExportAction(res: {
  ok: boolean;
  data?: string;
  filename?: string;
  message?: string;
}) {
  if (!res.ok || !res.data) {
    toast.error(res.message ?? "导出失败");
    return;
  }
  try {
    const binary = atob(res.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = res.filename ?? "export.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    toast.error("导出文件生成失败");
  }
}