/*
  Warnings:

  - You are about to drop the column `category` on the `po_items` table. All the data in the column will be lost.
  - You are about to drop the column `oem_name` on the `po_items` table. All the data in the column will be lost.
  - You are about to drop the column `product` on the `po_items` table. All the data in the column will be lost.
  - You are about to drop the column `purchase_order_id` on the `po_items` table. All the data in the column will be lost.
  - The primary key for the `purchase_orders` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `client_name` on the `purchase_orders` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `purchase_orders` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `purchase_orders` table. All the data in the column will be lost.
  - Added the required column `category_id` to the `po_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `final_price` to the `po_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gst_percent` to the `po_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `oem_id` to the `po_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `po_id` to the `po_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `product_id` to the `po_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `client_id` to the `purchase_orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `po_id` to the `purchase_orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `po_received_date` to the `purchase_orders` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "po_items" DROP CONSTRAINT "po_items_purchase_order_id_fkey";

-- DropIndex
DROP INDEX "po_items_category_idx";

-- DropIndex
DROP INDEX "po_items_product_idx";

-- DropIndex
DROP INDEX "po_items_purchase_order_id_idx";

-- DropIndex
DROP INDEX "purchase_orders_client_name_idx";

-- AlterTable
ALTER TABLE "po_items" DROP COLUMN "category",
DROP COLUMN "oem_name",
DROP COLUMN "product",
DROP COLUMN "purchase_order_id",
ADD COLUMN     "category_id" TEXT NOT NULL,
ADD COLUMN     "final_price" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "gst_percent" DECIMAL(5,2) NOT NULL,
ADD COLUMN     "oem_id" TEXT NOT NULL,
ADD COLUMN     "po_id" TEXT NOT NULL,
ADD COLUMN     "product_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_pkey",
DROP COLUMN "client_name",
DROP COLUMN "date",
DROP COLUMN "id",
ADD COLUMN     "assign_dispatch_to" TEXT,
ADD COLUMN     "client_id" TEXT NOT NULL,
ADD COLUMN     "po_id" VARCHAR(20) NOT NULL,
ADD COLUMN     "po_received_date" DATE NOT NULL,
ADD CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("po_id");

-- CreateIndex
CREATE INDEX "po_items_po_id_idx" ON "po_items"("po_id");

-- CreateIndex
CREATE INDEX "po_items_category_id_idx" ON "po_items"("category_id");

-- CreateIndex
CREATE INDEX "po_items_oem_id_idx" ON "po_items"("oem_id");

-- CreateIndex
CREATE INDEX "po_items_product_id_idx" ON "po_items"("product_id");

-- CreateIndex
CREATE INDEX "purchase_orders_client_id_idx" ON "purchase_orders"("client_id");

-- CreateIndex
CREATE INDEX "purchase_orders_assign_dispatch_to_idx" ON "purchase_orders"("assign_dispatch_to");

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("client_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_assign_dispatch_to_fkey" FOREIGN KEY ("assign_dispatch_to") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_items" ADD CONSTRAINT "po_items_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("po_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_items" ADD CONSTRAINT "po_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_items" ADD CONSTRAINT "po_items_oem_id_fkey" FOREIGN KEY ("oem_id") REFERENCES "oems"("oem_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_items" ADD CONSTRAINT "po_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;
