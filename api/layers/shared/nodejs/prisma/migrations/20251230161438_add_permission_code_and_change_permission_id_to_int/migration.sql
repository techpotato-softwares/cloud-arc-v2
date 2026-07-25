/*
  Warnings:

  - The primary key for the `permissions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `permission_id` column on the `permissions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `permission_code` to the `permissions` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `permission_id` on the `user_role_permission_mappings` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "user_role_permission_mappings" DROP CONSTRAINT "user_role_permission_mappings_permission_id_fkey";

-- AlterTable
ALTER TABLE "permissions" DROP CONSTRAINT "permissions_pkey",
ADD COLUMN     "permission_code" VARCHAR(100) NOT NULL,
DROP COLUMN "permission_id",
ADD COLUMN     "permission_id" SERIAL NOT NULL,
ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("permission_id");

-- AlterTable
ALTER TABLE "user_role_permission_mappings" DROP COLUMN "permission_id",
ADD COLUMN     "permission_id" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "permissions_permission_code_idx" ON "permissions"("permission_code");

-- CreateIndex
CREATE INDEX "user_role_permission_mappings_permission_id_idx" ON "user_role_permission_mappings"("permission_id");

-- AddForeignKey
ALTER TABLE "user_role_permission_mappings" ADD CONSTRAINT "user_role_permission_mappings_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("permission_id") ON DELETE CASCADE ON UPDATE CASCADE;
