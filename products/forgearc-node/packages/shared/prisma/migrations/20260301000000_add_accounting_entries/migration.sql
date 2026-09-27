-- Migration: add_accounting_entries
-- Creates the accounting_entries table for PO and service-level financial tracking.

CREATE TABLE "accounting_entries" (
    "id" SERIAL NOT NULL,
    "po_id" VARCHAR(30) NOT NULL,
    "module_type" VARCHAR(20) NOT NULL DEFAULT 'order',
    "dispatch_id" INTEGER,
    "service_id" INTEGER,
    "tax_invoice_no" VARCHAR(100),
    "tax_invoice_date" DATE,
    "invoice_amount" DECIMAL(14,2),
    "payment_mode" VARCHAR(50),
    "advance_amount" DECIMAL(14,2),
    "advance_date" DATE,
    "multiple_payment_ref_no" VARCHAR(255),
    "payment_date" DATE,
    "payment_due_date" DATE,
    "payment_amount" DECIMAL(14,2),
    "tds" DECIMAL(14,2),
    "balance_amount" DECIMAL(14,2),
    "no_dues_clearance_status" VARCHAR(50),
    "dispatch_expenses" DECIMAL(14,2),
    "dispatch_expenses_remark" TEXT,
    "commissioning_expenses" DECIMAL(14,2),
    "commissioning_expenses_remark" TEXT,
    "credit_note_ref" VARCHAR(100),
    "credit_note_date" DATE,
    "credit_note_amount" DECIMAL(14,2),
    "credit_note_remark" TEXT,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "accounting_entries_po_id_idx" ON "accounting_entries"("po_id");
CREATE INDEX "accounting_entries_module_type_idx" ON "accounting_entries"("module_type");
CREATE INDEX "accounting_entries_dispatch_id_idx" ON "accounting_entries"("dispatch_id");
CREATE INDEX "accounting_entries_service_id_idx" ON "accounting_entries"("service_id");
CREATE INDEX "accounting_entries_created_at_idx" ON "accounting_entries"("created_at");

ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_po_id_fkey"
    FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("po_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_dispatch_id_fkey"
    FOREIGN KEY ("dispatch_id") REFERENCES "dispatches"("dispatch_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "services"("service_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_updated_by_fkey"
    FOREIGN KEY ("updated_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;