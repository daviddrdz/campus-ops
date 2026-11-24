// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";

vi.mock("next/server", () => ({
  connection: vi.fn().mockResolvedValue(undefined),
}));

describe("GET /api/health", () => {
  it("responde 200 con estado ok y sin caché", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});
