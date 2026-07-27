/*
  Warnings:

  - You are about to drop the `commissionings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `pre_commissionings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `warranty_certificates` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "commissionings" DROP CONSTRAINT "commissionings_created_by_fkey";

-- DropForeignKey
ALTER TABLE "commissionings" DROP CONSTRAINT "commissionings_pre_commissioning_id_fkey";

-- DropForeignKey
ALTER TABLE "commissionings" DROP CONSTRAINT "commissionings_updated_by_fkey";

-- DropForeignKey
ALTER TABLE "pre_commissionings" DROP CONSTRAINT "pre_commissionings_created_by_fkey";

-- DropForeignKey
ALTER TABLE "pre_commissionings" DROP CONSTRAINT "pre_commissionings_dispatch_id_fkey";

-- DropForeignKey
ALTER TABLE "pre_commissionings" DROP CONSTRAINT "pre_commissionings_updated_by_fkey";

-- DropForeignKey
ALTER TABLE "warranty_certificates" DROP CONSTRAINT "warranty_certificates_commissioning_id_fkey";

-- DropForeignKey
ALTER TABLE "warranty_certificates" DROP CONSTRAINT "warranty_certificates_created_by_fkey";

-- DropForeignKey
ALTER TABLE "warranty_certificates" DROP CONSTRAINT "warranty_certificates_updated_by_fkey";

-- DropTable
DROP TABLE "commissionings";

-- DropTable
DROP TABLE "pre_commissionings";

-- DropTable
DROP TABLE "warranty_certificates";

-- CreateTable
CREATE TABLE "services" (
    "service_id" SERIAL NOT NULL,
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
    "pre_commissioning_updated_at" TIMESTAMP(3),
    "commissioning_ecd_from_client" VARCHAR(255),
    "commissioning_service_ticket_no" VARCHAR(100),
    "commissioning_ccd_from_client" VARCHAR(255),
    "commissioning_issues" TEXT,
    "commissioning_solution" TEXT,
    "commissioning_info_generated" VARCHAR(255),
    "commissioning_date" DATE,
    "commissioning_status" VARCHAR(50),
    "commissioning_remarks" TEXT,
    "commissioning_updated_at" TIMESTAMP(3),
    "warranty_certificate_no" VARCHAR(100),
    "warranty_issue_date" DATE,
    "warranty_start_date" DATE,
    "warranty_end_date" DATE,
    "warranty_status" VARCHAR(50),
    "warranty_updated_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("service_id")
);

-- CreateIndex
CREATE INDEX "services_dispatch_id_idx" ON "services"("dispatch_id");

-- CreateIndex
CREATE INDEX "services_pre_commissioning_status_idx" ON "services"("pre_commissioning_status");

-- CreateIndex
CREATE INDEX "services_commissioning_status_idx" ON "services"("commissioning_status");

-- CreateIndex
CREATE INDEX "services_warranty_status_idx" ON "services"("warranty_status");

-- CreateIndex
CREATE INDEX "services_created_at_idx" ON "services"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "services_dispatch_id_serial_number_key" ON "services"("dispatch_id", "serial_number");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "dispatches"("dispatch_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
