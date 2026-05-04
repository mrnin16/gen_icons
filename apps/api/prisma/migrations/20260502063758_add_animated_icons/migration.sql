-- AlterTable
ALTER TABLE "Icon" ADD COLUMN     "animationData" TEXT,
ADD COLUMN     "iconType" TEXT NOT NULL DEFAULT 'static';

-- CreateIndex
CREATE INDEX "Icon_iconType_idx" ON "Icon"("iconType");
