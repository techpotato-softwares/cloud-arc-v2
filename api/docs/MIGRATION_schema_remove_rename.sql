-- Migration: Remove columns and rename dispatch_from_location to delivery_pincode
-- Run this SQL against your database, then run: npx prisma generate (from api/layers/shared/nodejs)

-- 1. Remove po_received_date from purchase_orders
ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "po_received_date";

-- 2. Rename dispatch_from_location to delivery_pincode (preserves existing data)
ALTER TABLE "dispatches" RENAME COLUMN "dispatch_from_location" TO "delivery_pincode";

-- 3. Remove two columns from services (keep product_name)
ALTER TABLE "services" DROP COLUMN IF EXISTS "commissioning_ccd_from_client";
ALTER TABLE "services" DROP COLUMN IF EXISTS "commissioning_info_generated";
