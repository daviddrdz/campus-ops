import { describe, expect, it } from "vitest";
import { formatDateTime } from "@/lib/dates";

describe("formatDateTime", () => {
  it("muestra la hora del campus aunque el servidor esté en UTC", () => {
    const text = formatDateTime(new Date("2026-11-24T18:05:00Z"));

    expect(text).toContain("24 nov 2026");
    expect(text).toMatch(/12:05/);
  });
});
