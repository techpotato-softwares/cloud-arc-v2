-- Add warranty and po_item_id to dispatched_items
ALTER TABLE "dispatched_items" ADD COLUMN "warranty" VARCHAR(100);

ALTER TABLE "dispatched_items" ADD COLUMN "po_item_id" INTEGER;

ALTER TABLE "dispatched_items" ADD CONSTRAINT "dispatched_items_po_item_id_fkey" FOREIGN KEY ("po_item_id") REFERENCES "po_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "dispatched_items_po_item_id_idx" ON "dispatched_items"("po_item_id");
