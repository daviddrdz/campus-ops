import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("omite valores falsos", () => {
    expect(cn("base", false, undefined, "extra")).toBe("base extra");
  });

  it("resuelve conflictos de Tailwind a favor de la última clase", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
