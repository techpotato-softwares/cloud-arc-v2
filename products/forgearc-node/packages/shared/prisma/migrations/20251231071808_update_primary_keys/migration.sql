/*
  Warnings:

  - The primary key for the `categories` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `category_id` column on the `categories` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `clients` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `client_id` column on the `clients` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `oems` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `oem_id` column on the `oems` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `po_items` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `po_items` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `products` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `product_id` column on the `products` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `assign_dispatch_to` column on the `purchase_orders` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `role_permissions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `role_permission_id` column on the `role_permissions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `user_id` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `category_id` on the `po_items` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `oem_id` on the `po_items` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `product_id` on the `po_items` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `category_id` on the `products` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `oem_id` on the `products` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `client_id` on the `purchase_orders` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "po_items" DROP CONSTRAINT "po_items_category_id_fkey";

-- DropForeignKey
ALTER TABLE "po_items" DROP CONSTRAINT "po_items_oem_id_fkey";

-- DropForeignKey
ALTER TABLE "po_items" DROP CONSTRAINT "po_items_product_id_fkey";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_category_id_fkey";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_oem_id_fkey";

-- DropForeignKey
ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_assign_dispatch_to_fkey";

-- DropForeignKey
ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_client_id_fkey";

-- AlterTable
ALTER TABLE "categories" DROP CONSTRAINT "categories_pkey",
DROP COLUMN "category_id",
ADD COLUMN     "category_id" SERIAL NOT NULL,
ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("category_id");

-- AlterTable
ALTER TABLE "clients" DROP CONSTRAINT "clients_pkey",
DROP COLUMN "client_id",
ADD COLUMN     "client_id" SERIAL NOT NULL,
ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("client_id");

-- AlterTable
ALTER TABLE "oems" DROP CONSTRAINT "oems_pkey",
DROP COLUMN "oem_id",
ADD COLUMN     "oem_id" SERIAL NOT NULL,
ADD CONSTRAINT "oems_pkey" PRIMARY KEY ("oem_id");

-- AlterTable
ALTER TABLE "po_items" DROP CONSTRAINT "po_items_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "category_id",
ADD COLUMN     "category_id" INTEGER NOT NULL,
DROP COLUMN "oem_id",
ADD COLUMN     "oem_id" INTEGER NOT NULL,
DROP COLUMN "product_id",
ADD COLUMN     "product_id" INTEGER NOT NULL,
ADD CONSTRAINT "po_items_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "products" DROP CONSTRAINT "products_pkey",
DROP COLUMN "product_id",
ADD COLUMN     "product_id" SERIAL NOT NULL,
DROP COLUMN "category_id",
ADD COLUMN     "category_id" INTEGER NOT NULL,
DROP COLUMN "oem_id",
ADD COLUMN     "oem_id" INTEGER NOT NULL,
ADD CONSTRAINT "products_pkey" PRIMARY KEY ("product_id");

-- AlterTable
ALTER TABLE "purchase_orders" DROP COLUMN "assign_dispatch_to",
ADD COLUMN     "assign_dispatch_to" INTEGER,
DROP COLUMN "client_id",
ADD COLUMN     "client_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_pkey",
DROP COLUMN "role_permission_id",
ADD COLUMN     "role_permission_id" SERIAL NOT NULL,
ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_permission_id");

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
DROP COLUMN "user_id",
ADD COLUMN     "user_id" SERIAL NOT NULL,
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("user_id");

-- CreateIndex
CREATE INDEX "po_items_category_id_idx" ON "po_items"("category_id");

-- CreateIndex
CREATE INDEX "po_items_oem_id_idx" ON "po_items"("oem_id");

-- CreateIndex
CREATE INDEX "po_items_product_id_idx" ON "po_items"("product_id");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_oem_id_idx" ON "products"("oem_id");

-- CreateIndex
CREATE INDEX "purchase_orders_client_id_idx" ON "purchase_orders"("client_id");

-- CreateIndex
CREATE INDEX "purchase_orders_assign_dispatch_to_idx" ON "purchase_orders"("assign_dispatch_to");

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("client_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_assign_dispatch_to_fkey" FOREIGN KEY ("assign_dispatch_to") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_items" ADD CONSTRAINT "po_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_items" ADD CONSTRAINT "po_items_oem_id_fkey" FOREIGN KEY ("oem_id") REFERENCES "oems"("oem_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_items" ADD CONSTRAINT "po_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_oem_id_fkey" FOREIGN KEY ("oem_id") REFERENCES "oems"("oem_id") ON DELETE RESTRICT ON UPDATE CASCADE;
