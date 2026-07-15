-- CreateTable
CREATE TABLE "ScheduleApproval" (
    "id" TEXT NOT NULL,
    "scheduleMonthId" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleApproval_scheduleMonthId_adminUserId_key" ON "ScheduleApproval"("scheduleMonthId", "adminUserId");

-- AddForeignKey
ALTER TABLE "ScheduleApproval" ADD CONSTRAINT "ScheduleApproval_scheduleMonthId_fkey" FOREIGN KEY ("scheduleMonthId") REFERENCES "ScheduleMonth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleApproval" ADD CONSTRAINT "ScheduleApproval_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
