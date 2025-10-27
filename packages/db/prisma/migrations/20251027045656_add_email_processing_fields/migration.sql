/*
  Warnings:

  - Added the required column `from` to the `Email` table without a default value. This is not possible if the table is not empty.
  - Added the required column `receivedAt` to the `Email` table without a default value. This is not possible if the table is not empty.
  - Added the required column `snippet` to the `Email` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Email" ADD COLUMN     "from" TEXT NOT NULL,
ADD COLUMN     "processed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "receivedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "snippet" TEXT NOT NULL,
ALTER COLUMN "summary" DROP NOT NULL,
ALTER COLUMN "priority" DROP NOT NULL,
ALTER COLUMN "action" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Email_userId_processed_idx" ON "Email"("userId", "processed");
