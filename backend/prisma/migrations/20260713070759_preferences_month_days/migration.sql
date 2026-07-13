/*
  Warnings:

  - You are about to drop the column `preferredWeekdays` on the `Preference` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Preference" DROP COLUMN "preferredWeekdays",
ADD COLUMN     "outgoingFirstDay" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "preferredDates" TEXT NOT NULL DEFAULT '[]';
