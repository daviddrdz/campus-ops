import { describe, expect, it } from "vitest";
import {
  AssetStatus,
  AssetType,
  FaultType,
  NotificationType,
  ReportEventType,
  ReportPriority,
  ReportStatus,
  UserRole,
} from "@/generated/prisma/enums";
import {
  assetStatusLabels,
  assetTypeLabels,
  faultTypeLabels,
  notificationTypeLabels,
  reportEventTypeLabels,
  reportPriorityLabels,
  reportStatusLabels,
  userRoleLabels,
} from "@/lib/labels";

const cases: [string, Record<string, string>, Record<string, string>][] = [
  ["UserRole", UserRole, userRoleLabels],
  ["AssetType", AssetType, assetTypeLabels],
  ["AssetStatus", AssetStatus, assetStatusLabels],
  ["ReportStatus", ReportStatus, reportStatusLabels],
  ["ReportPriority", ReportPriority, reportPriorityLabels],
  ["FaultType", FaultType, faultTypeLabels],
  ["ReportEventType", ReportEventType, reportEventTypeLabels],
  ["NotificationType", NotificationType, notificationTypeLabels],
];

describe("etiquetas", () => {
  it.each(cases)(
    "%s tiene etiqueta para cada valor",
    (_name, values, labels) => {
      expect(Object.keys(labels).sort()).toEqual(Object.values(values).sort());
      expect(
        Object.values(labels).every((label) => label.trim().length > 0),
      ).toBe(true);
    },
  );

  it("ReportStatus no incluye CLOSED: RESOLVED es el estado final", () => {
    expect(Object.values(ReportStatus)).not.toContain("CLOSED");
  });

  it("ReportPriority es LOW, MEDIUM y HIGH", () => {
    expect(Object.values(ReportPriority).sort()).toEqual([
      "HIGH",
      "LOW",
      "MEDIUM",
    ]);
  });
});
