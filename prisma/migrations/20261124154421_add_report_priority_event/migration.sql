-- AlterEnum
ALTER TYPE "ReportEventType" ADD VALUE 'PRIORITY_CHANGED';

-- AlterTable
ALTER TABLE "ReportEvent" ADD COLUMN     "priority" "ReportPriority";
