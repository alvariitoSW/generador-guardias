-- AlterTable
ALTER TABLE "Preference" ADD COLUMN     "hasOtherServiceGuardias" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "otherServiceGuardiaDates" TEXT NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "RosterName" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "claimedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RosterName_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RosterName_fullName_key" ON "RosterName"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "RosterName_claimedByUserId_key" ON "RosterName"("claimedByUserId");

-- AddForeignKey
ALTER TABLE "RosterName" ADD CONSTRAINT "RosterName_claimedByUserId_fkey" FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
