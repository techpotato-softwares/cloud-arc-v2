-- AlterTable: increase po_id length to support format OSG-YYYY-YY-NNNNNNNN (Indian FY)
ALTER TABLE "purchase_orders" ALTER COLUMN "po_id" SET DATA TYPE VARCHAR(30);

ALTER TABLE "po_items" ALTER COLUMN "po_id" SET DATA TYPE VARCHAR(30);

ALTER TABLE "file_uploads" ALTER COLUMN "po_id" SET DATA TYPE VARCHAR(30);

ALTER TABLE "dispatches" ALTER COLUMN "po_id" SET DATA TYPE VARCHAR(30);
