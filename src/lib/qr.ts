import QRCode from "qrcode";

export const QR_OPTIONS = { errorCorrectionLevel: "M", margin: 4 } as const;

export function buildAssetUrl(code: string, appUrl = process.env.APP_URL) {
  if (!appUrl) {
    throw new Error("Falta configurar APP_URL.");
  }

  return `${appUrl.replace(/\/+$/, "")}/a/${encodeURIComponent(code)}`;
}

export function generateQrSvg(url: string) {
  return QRCode.toString(url, { ...QR_OPTIONS, type: "svg" });
}
