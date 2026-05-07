-- AlterTable
ALTER TABLE "Icon" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: every platform-default icon (non-AI) is publicly visible. AI
-- generations stay private until an admin explicitly publishes them.
UPDATE "Icon" SET "isPublic" = true WHERE "isAiGenerated" = false;

-- CreateIndex
CREATE INDEX "Icon_isPublic_idx" ON "Icon"("isPublic");
