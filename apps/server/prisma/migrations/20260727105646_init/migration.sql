-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('user', 'assistant');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('update_account', 'update_billing_address', 'update_shipping_address', 'download_invoice');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('success', 'failure');

-- CreateEnum
CREATE TYPE "SitePageSource" AS ENUM ('wp_page', 'wp_post', 'woo_category', 'woo_shop');

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "widgetSessionId" TEXT NOT NULL,
    "wpUserId" INTEGER,
    "wpUserEmail" TEXT,
    "wpUserName" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "tokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT,
    "toolCalls" JSONB,
    "toolCallId" TEXT,
    "toolName" TEXT,
    "actionCards" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitePage" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "source" "SitePageSource" NOT NULL DEFAULT 'wp_page',
    "searchVector" tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("excerpt", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("content", '')), 'C')
    ) STORED,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SitePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCache" (
    "id" TEXT NOT NULL,
    "wooProductId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sku" TEXT,
    "description" TEXT,
    "shortDescription" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "regularPrice" DECIMAL(10,2),
    "salePrice" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "category" TEXT NOT NULL,
    "categories" JSONB NOT NULL,
    "attributes" JSONB NOT NULL,
    "stockStatus" TEXT NOT NULL,
    "permalink" TEXT NOT NULL,
    "imageUrl" TEXT,
    "searchVector" tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("shortDescription", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("description", '')), 'C')
    ) STORED,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionAuditLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "wpUserId" INTEGER,
    "actionType" "ActionType" NOT NULL,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "status" "ActionStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatSession_widgetSessionId_key" ON "ChatSession"("widgetSessionId");

-- CreateIndex
CREATE INDEX "ChatSession_wpUserId_idx" ON "ChatSession"("wpUserId");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_createdAt_idx" ON "ChatMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SitePage_url_key" ON "SitePage"("url");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCache_wooProductId_key" ON "ProductCache"("wooProductId");

-- CreateIndex
CREATE INDEX "ProductCache_category_idx" ON "ProductCache"("category");

-- CreateIndex
CREATE INDEX "ProductCache_price_idx" ON "ProductCache"("price");

-- CreateIndex
CREATE INDEX "ActionAuditLog_sessionId_createdAt_idx" ON "ActionAuditLog"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ActionAuditLog_wpUserId_idx" ON "ActionAuditLog"("wpUserId");

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionAuditLog" ADD CONSTRAINT "ActionAuditLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-added: full-text search indexes. The searchVector columns above are
-- GENERATED STORED tsvector columns (hand-edited into this migration -
-- Prisma's schema DSL can only declare them as Unsupported plain columns).
-- ---------------------------------------------------------------------------

-- CreateIndex
CREATE INDEX "SitePage_searchVector_idx" ON "SitePage" USING GIN ("searchVector");

-- CreateIndex
CREATE INDEX "ProductCache_searchVector_idx" ON "ProductCache" USING GIN ("searchVector");

-- ProductCache attribute facet filtering (e.g. attributes @> '{"brand":"Makita"}')
-- CreateIndex
CREATE INDEX "ProductCache_attributes_gin_idx" ON "ProductCache" USING GIN ("attributes" jsonb_path_ops);
