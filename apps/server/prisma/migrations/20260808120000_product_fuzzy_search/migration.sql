-- Enables fuzzy/typo-tolerant product matching (client feedback: typo handling +
-- "suggest something similar" when there's no exact match). pg_trgm's similarity()
-- catches character-level typos that websearch_to_tsquery's stemmed word matching
-- can't (e.g. "cordlss" vs "cordless"), and doubles as a "similar products" ranker
-- when the strict search returns zero rows. See search/products.ts's fuzzySearchByName.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "ProductCache_name_trgm_idx" ON "ProductCache" USING GIN ("name" gin_trgm_ops);
