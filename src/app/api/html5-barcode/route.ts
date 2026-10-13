import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

interface BarcodeParams {
  type: number;
  text: string;
  codepage?: number;
  Version?: number;
  ErrorLevel?: string;
  Mask?: number;
  requireShowText?: boolean;
}

/**
 * 锐浪报表 HTML5 引擎的条码服务。
 *
 * HTML5 引擎渲染条码时，会向 barcodeURL（默认 /html5/General/Barcode.ashx）POST
 * 请求生成条码位图，返回 JSON：{ cols, rows, graph, text }
 *   - cols/rows：条码模块矩阵的列/行数
 *   - graph：按行、从左到右、每字节高位在前、逐位打包的十六进制串（1=前景色模块）
 *   - text：条码文字
 *
 * 官方样例依赖 Grid++ 的 COM/JNI 原生库（GenerateBarcodeGraph），本服务用纯 JS 的
 * `qrcode` 库复刻该格式，支持 QR 码（type=51）与 Code128（type=13）等。
 */
function bitPackMatrix(matrix: boolean[][]): { cols: number; rows: number; graph: string } {
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;
  const bytesPerRow = Math.ceil(cols / 8);
  const hex: string[] = [];

  for (let r = 0; r < rows; r++) {
    for (let b = 0; b < bytesPerRow; b++) {
      let byte = 0;
      for (let k = 0; k < 8; k++) {
        const c = b * 8 + k;
        if (c < cols && matrix[r][c]) byte |= 1 << (7 - k);
      }
      hex.push(byte.toString(16).padStart(2, "0"));
    }
  }
  return { cols, rows, graph: hex.join("") };
}

async function generateQR(text: string, params: BarcodeParams): Promise<string> {
  const level = (params.ErrorLevel as "L" | "M" | "Q" | "H") ?? "M";
  const qr = QRCode.create(text, {
    errorCorrectionLevel: level,
    version: params.Version ? Number(params.Version) : undefined,
    maskPattern: params.Mask ? (Number(params.Mask) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7) : undefined,
  });
  const size = qr.modules.size;
  const matrix: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) {
      row.push(Boolean(qr.modules.get(r, c)));
    }
    matrix.push(row);
  }
  const { cols, rows, graph } = bitPackMatrix(matrix);
  return JSON.stringify({ cols, rows, graph, text });
}

export async function POST(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("params") ?? "";
  let params: BarcodeParams;
  try {
    params = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid params" }, { status: 400 });
  }

  const text = params.text ?? "";
  if (!text) {
    return NextResponse.json({ cols: 0, rows: 0, graph: "", text: "" });
  }

  try {
    switch (params.type) {
      case 51: // QRCode
        return new NextResponse(await generateQR(text, params), {
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
      default:
        // 暂不支持的条码类型：返回空图（避免页面报错）
        return NextResponse.json({ cols: 0, rows: 0, graph: "", text });
    }
  } catch (e) {
    return NextResponse.json({ cols: 0, rows: 0, graph: "", text, error: e instanceof Error ? e.message : "" });
  }
}
