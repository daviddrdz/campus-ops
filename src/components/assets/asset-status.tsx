import type { AssetStatus as AssetStatusValue } from "@/generated/prisma/enums";
import { assetStatusLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

const statusColors: Record<AssetStatusValue, string> = {
  OPERATIONAL: "text-status-operational",
  FAULT_REPORTED: "text-status-fault",
  IN_MAINTENANCE: "text-status-maintenance",
};

export function AssetStatus({ status }: { status: AssetStatusValue }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium",
        statusColors[status],
      )}
    >
      <span aria-hidden className="size-2 rounded-full bg-current" />
      {assetStatusLabels[status]}
    </span>
  );
}
