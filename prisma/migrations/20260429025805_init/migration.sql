-- CreateTable
CREATE TABLE "Icon" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "svgContent" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "tags" TEXT[],
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "prompt" TEXT,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Icon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Icon_slug_key" ON "Icon"("slug");

-- CreateIndex
CREATE INDEX "Icon_category_idx" ON "Icon"("category");

-- CreateIndex
CREATE INDEX "Icon_style_idx" ON "Icon"("style");

-- CreateIndex
CREATE INDEX "Icon_tags_idx" ON "Icon" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "Icon_name_idx" ON "Icon"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Icon" ADD CONSTRAINT "Icon_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
