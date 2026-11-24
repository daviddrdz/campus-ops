-- AlterTable
ALTER TABLE "ReportEvent" ADD COLUMN     "assigneeId" TEXT;

-- CreateIndex
CREATE INDEX "ReportEvent_assigneeId_idx" ON "ReportEvent"("assigneeId");

-- AddForeignKey
ALTER TABLE "ReportEvent" ADD CONSTRAINT "ReportEvent_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
