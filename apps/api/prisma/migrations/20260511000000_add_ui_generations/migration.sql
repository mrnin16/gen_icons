-- CreateTable
CREATE TABLE "UiGeneration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "jsx" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "isRefine" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UiGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UiGeneration_userId_createdAt_idx" ON "UiGeneration"("userId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "UiGeneration" ADD CONSTRAINT "UiGeneration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
