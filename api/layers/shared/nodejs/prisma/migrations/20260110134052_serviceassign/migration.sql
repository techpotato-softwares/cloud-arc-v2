-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "assign_service_to" INTEGER;

-- CreateIndex
CREATE INDEX "purchase_orders_assign_service_to_idx" ON "purchase_orders"("assign_service_to");

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_assign_service_to_fkey" FOREIGN KEY ("assign_service_to") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
