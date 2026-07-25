-- Migration: increase po_id length to support format OSG-YYYY-YY-NNNNNNNN (Indian FY)
-- Copy this file to: api/layers/shared/nodejs/prisma/migrations/20260208120000_increase_po_id_length/migration.sql
-- Then run from api/layers/shared/nodejs: npx prisma migrate deploy
-- Or run: npx prisma migrate dev --name increase_po_id_length (creates migration from schema and applies)

ALTER TABLE "purchase_orders" ALTER COLUMN "po_id" SET DATA TYPE VARCHAR(30);

ALTER TABLE "po_items" ALTER COLUMN "po_id" SET DATA TYPE VARCHAR(30);

ALTER TABLE "file_uploads" ALTER COLUMN "po_id" SET DATA TYPE VARCHAR(30);

ALTER TABLE "dispatches" ALTER COLUMN "po_id" SET DATA TYPE VARCHAR(30);
