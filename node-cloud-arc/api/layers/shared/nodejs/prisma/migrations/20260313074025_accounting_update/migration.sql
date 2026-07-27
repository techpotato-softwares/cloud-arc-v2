/*
  Warnings:

  - You are about to drop the column `advance_amount` on the `accounting_entries` table. All the data in the column will be lost.
  - You are about to drop the column `advance_date` on the `accounting_entries` table. All the data in the column will be lost.
  - You are about to drop the column `credit_note_amount` on the `accounting_entries` table. All the data in the column will be lost.
  - You are about to drop the column `credit_note_date` on the `accounting_entries` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "accounting_entries" DROP COLUMN "advance_amount",
DROP COLUMN "advance_date",
DROP COLUMN "credit_note_amount",
DROP COLUMN "credit_note_date",
ADD COLUMN     "payment_type" VARCHAR(20);
