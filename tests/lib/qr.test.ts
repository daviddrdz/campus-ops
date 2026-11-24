import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { buildAssetUrl, generateQrSvg, QR_OPTIONS } from "@/lib/qr";

const code = "abc234def567";

function darkCellsFromSvg(svg: string) {
  const path = svg.match(/stroke="[^"]+" d="([^"]+)"/)?.[1];

  if (!path) {
    throw new Error("El SVG no contiene los módulos del QR.");
  }

  const cells = new Set<string>();
  let x = 0;
  let y = 0;

  for (const [, command, rawArgs] of path.matchAll(/([Mmh])([^Mmh]*)/g)) {
    const args = rawArgs
      .trim()
      .split(/[\s,]+/)
      .map(Number);

    if (command === "M") {
      [x, y] = args;
    } else if (command === "m") {
      x += args[0];
      y += args[1];
    } else {
      for (let offset = 0; offset < args[0]; offset++) {
        cells.add(
          `${x + offset - QR_OPTIONS.margin},${Math.floor(y) - QR_OPTIONS.margin}`,
        );
      }

      x += args[0];
    }
  }

  return cells;
}

function darkCellsFor(url: string) {
  const { modules } = QRCode.create(url, {
    errorCorrectionLevel: QR_OPTIONS.errorCorrectionLevel,
  });
  const cells = new Set<string>();

  for (let row = 0; row < modules.size; row++) {
    for (let column = 0; column < modules.size; column++) {
      if (modules.data[row * modules.size + column]) {
        cells.add(`${column},${row}`);
      }
    }
  }

  return cells;
}

describe("buildAssetUrl", () => {
  it("arma la URL con APP_URL sin barra final", () => {
    expect(buildAssetUrl(code, "https://campus.example")).toBe(
      "https://campus.example/a/abc234def567",
    );
  });

  it("no duplica la barra cuando APP_URL termina en barra", () => {
    expect(buildAssetUrl(code, "https://campus.example/")).toBe(
      "https://campus.example/a/abc234def567",
    );
    expect(buildAssetUrl(code, "http://192.168.1.20:3000//")).toBe(
      "http://192.168.1.20:3000/a/abc234def567",
    );
  });

  it("falla con un mensaje claro si falta APP_URL", () => {
    expect(() => buildAssetUrl(code, "")).toThrow("APP_URL");
  });
});

describe("generateQrSvg", () => {
  it("codifica exactamente la URL del activo", async () => {
    const url = buildAssetUrl(code, "https://campus.example");

    const svg = await generateQrSvg(url);

    expect(darkCellsFromSvg(svg)).toEqual(darkCellsFor(url));
  });

  it("produce un QR distinto para otro activo", async () => {
    const url = buildAssetUrl(code, "https://campus.example");
    const otherUrl = buildAssetUrl("zzz234def567", "https://campus.example");

    const svg = await generateQrSvg(url);

    expect(darkCellsFromSvg(svg)).not.toEqual(darkCellsFor(otherUrl));
  });

  it("no incluye la URL como texto dentro del SVG", async () => {
    const svg = await generateQrSvg(
      buildAssetUrl(code, "https://campus.example"),
    );

    expect(svg).not.toContain(code);
  });
});
