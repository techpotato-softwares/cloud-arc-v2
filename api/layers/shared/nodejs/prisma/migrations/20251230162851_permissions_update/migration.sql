/*
  Warnings:

  - You are about to drop the `user_role_permission_mappings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_role_permission_mappings" DROP CONSTRAINT "user_role_permission_mappings_permission_id_fkey";

-- DropForeignKey
ALTER TABLE "user_role_permission_mappings" DROP CONSTRAINT "user_role_permission_mappings_user_role_id_fkey";

-- DropTable
DROP TABLE "user_role_permission_mappings";
