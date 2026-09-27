-- CreateTable
CREATE TABLE "dispatches" (
    "dispatch_id" SERIAL NOT NULL,
    "po_id" VARCHAR(20) NOT NULL,
    "project_name" VARCHAR(255) NOT NULL,
    "project_location" VARCHAR(255) NOT NULL,
    "delivery_location" VARCHAR(255) NOT NULL,
    "delivery_address" TEXT NOT NULL,
    "google_map_link" VARCHAR(500),
    "confirm_dispatch_date" DATE NOT NULL,
    "delivery_contact" VARCHAR(100) NOT NULL,
    "remarks" TEXT,
    "no_dues_clearance" VARCHAR(50),
    "doc_osg_pi_no" VARCHAR(50),
    "doc_osg_pi_date" DATE,
    "tax_invoice_number" VARCHAR(100),
    "invoice_date" DATE,
    "eway_bill" VARCHAR(100),
    "delivery_challan" VARCHAR(100),
    "dispatch_date" DATE,
    "packaging_list" TEXT,
    "dispatch_from_location" VARCHAR(255),
    "dispatch_status" VARCHAR(50),
    "dispatch_lr_no" VARCHAR(100),
    "dispatch_remarks" TEXT,
    "document_updated_at" TIMESTAMP(3),
    "date_of_delivery" DATE,
    "delivery_status" VARCHAR(50),
    "proof_of_delivery" TEXT,
    "delivery_updated_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispatches_pkey" PRIMARY KEY ("dispatch_id")
);

-- CreateTable
CREATE TABLE "dispatched_items" (
    "id" SERIAL NOT NULL,
    "dispatch_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "serial_numbers" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispatched_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pre_commissionings" (
    "pre_commissioning_id" SERIAL NOT NULL,
    "dispatch_id" INTEGER NOT NULL,
    "serial_number" VARCHAR(100) NOT NULL,
    "product_name" VARCHAR(255) NOT NULL,
    "pc_contact" VARCHAR(255) NOT NULL,
    "service_engineer_assigned" VARCHAR(255) NOT NULL,
    "ppm_checklist" VARCHAR(255) NOT NULL,
    "ppm_sheet_received_from_client" VARCHAR(255) NOT NULL,
    "ppm_checklist_shared_with_oem" VARCHAR(255) NOT NULL,
    "ppm_ticked_no_from_oem" VARCHAR(255) NOT NULL,
    "ppm_confirmation_status" VARCHAR(50) NOT NULL,
    "oem_comments" TEXT,
    "pre_commissioning_status" VARCHAR(50) NOT NULL,
    "remarks" TEXT,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pre_commissionings_pkey" PRIMARY KEY ("pre_commissioning_id")
);

-- CreateTable
CREATE TABLE "commissionings" (
    "commissioning_id" SERIAL NOT NULL,
    "pre_commissioning_id" INTEGER NOT NULL,
    "ecd_from_client" VARCHAR(255),
    "service_ticket_no" VARCHAR(100),
    "ccd_from_client" VARCHAR(255),
    "issues" TEXT,
    "solution" TEXT,
    "info_generated" VARCHAR(255),
    "commissioning_date" DATE,
    "commissioning_status" VARCHAR(50) NOT NULL,
    "remarks" TEXT,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commissionings_pkey" PRIMARY KEY ("commissioning_id")
);

-- CreateTable
CREATE TABLE "warranty_certificates" (
    "warranty_certificate_id" SERIAL NOT NULL,
    "commissioning_id" INTEGER NOT NULL,
    "certificate_no" VARCHAR(100) NOT NULL,
    "issue_date" DATE NOT NULL,
    "warranty_start_date" DATE NOT NULL,
    "warranty_end_date" DATE NOT NULL,
    "warranty_status" VARCHAR(50) NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warranty_certificates_pkey" PRIMARY KEY ("warranty_certificate_id")
);

-- CreateIndex
CREATE INDEX "dispatches_po_id_idx" ON "dispatches"("po_id");

-- CreateIndex
CREATE INDEX "dispatches_dispatch_status_idx" ON "dispatches"("dispatch_status");

-- CreateIndex
CREATE INDEX "dispatches_delivery_status_idx" ON "dispatches"("delivery_status");

-- CreateIndex
CREATE INDEX "dispatches_created_at_idx" ON "dispatches"("created_at");

-- CreateIndex
CREATE INDEX "dispatched_items_dispatch_id_idx" ON "dispatched_items"("dispatch_id");

-- CreateIndex
CREATE INDEX "dispatched_items_product_id_idx" ON "dispatched_items"("product_id");

-- CreateIndex
CREATE INDEX "pre_commissionings_dispatch_id_idx" ON "pre_commissionings"("dispatch_id");

-- CreateIndex
CREATE INDEX "pre_commissionings_pre_commissioning_status_idx" ON "pre_commissionings"("pre_commissioning_status");

-- CreateIndex
CREATE INDEX "pre_commissionings_created_at_idx" ON "pre_commissionings"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "pre_commissionings_dispatch_id_serial_number_key" ON "pre_commissionings"("dispatch_id", "serial_number");

-- CreateIndex
CREATE UNIQUE INDEX "commissionings_pre_commissioning_id_key" ON "commissionings"("pre_commissioning_id");

-- CreateIndex
CREATE INDEX "commissionings_pre_commissioning_id_idx" ON "commissionings"("pre_commissioning_id");

-- CreateIndex
CREATE INDEX "commissionings_commissioning_status_idx" ON "commissionings"("commissioning_status");

-- CreateIndex
CREATE INDEX "commissionings_created_at_idx" ON "commissionings"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "warranty_certificates_commissioning_id_key" ON "warranty_certificates"("commissioning_id");

-- CreateIndex
CREATE INDEX "warranty_certificates_commissioning_id_idx" ON "warranty_certificates"("commissioning_id");

-- CreateIndex
CREATE INDEX "warranty_certificates_warranty_status_idx" ON "warranty_certificates"("warranty_status");

-- CreateIndex
CREATE INDEX "warranty_certificates_created_at_idx" ON "warranty_certificates"("created_at");

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("po_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatched_items" ADD CONSTRAINT "dispatched_items_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "dispatches"("dispatch_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatched_items" ADD CONSTRAINT "dispatched_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_commissionings" ADD CONSTRAINT "pre_commissionings_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "dispatches"("dispatch_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_commissionings" ADD CONSTRAINT "pre_commissionings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_commissionings" ADD CONSTRAINT "pre_commissionings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissionings" ADD CONSTRAINT "commissionings_pre_commissioning_id_fkey" FOREIGN KEY ("pre_commissioning_id") REFERENCES "pre_commissionings"("pre_commissioning_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissionings" ADD CONSTRAINT "commissionings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissionings" ADD CONSTRAINT "commissionings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_certificates" ADD CONSTRAINT "warranty_certificates_commissioning_id_fkey" FOREIGN KEY ("commissioning_id") REFERENCES "commissionings"("commissioning_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_certificates" ADD CONSTRAINT "warranty_certificates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_certificates" ADD CONSTRAINT "warranty_certificates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
