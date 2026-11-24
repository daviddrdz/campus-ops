import { describe, expect, it } from "vitest";
import type { AssetStatus, ReportStatus } from "@/generated/prisma/enums";
import { deriveAssetStatus } from "@/server/reports/asset-status";

describe("deriveAssetStatus", () => {
  it.each<[string, ReportStatus[], AssetStatus]>([
    ["sin reportes", [], "OPERATIONAL"],
    ["solo cerrados", ["RESOLVED", "REJECTED"], "OPERATIONAL"],
    ["uno reportado", ["REPORTED"], "FAULT_REPORTED"],
    ["uno asignado", ["ASSIGNED"], "FAULT_REPORTED"],
    ["uno en proceso", ["IN_PROGRESS"], "IN_MAINTENANCE"],
    ["reportado y asignado", ["REPORTED", "ASSIGNED"], "FAULT_REPORTED"],
    [
      "en proceso gana a reportado",
      ["REPORTED", "IN_PROGRESS"],
      "IN_MAINTENANCE",
    ],
    [
      "en proceso gana a asignado",
      ["IN_PROGRESS", "ASSIGNED"],
      "IN_MAINTENANCE",
    ],
    [
      "abierto junto a cerrados",
      ["RESOLVED", "REPORTED", "REJECTED"],
      "FAULT_REPORTED",
    ],
  ])("%s", (_name, statuses, expected) => {
    expect(deriveAssetStatus(statuses)).toBe(expected);
  });
});
