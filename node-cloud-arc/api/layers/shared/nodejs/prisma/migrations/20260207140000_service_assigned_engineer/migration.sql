-- Add assigned_service_engineer FK to users, then drop old text column
ALTER TABLE "services" ADD COLUMN "assigned_service_engineer" INTEGER;

ALTER TABLE "services" ADD CONSTRAINT "services_assigned_service_engineer_fkey" FOREIGN KEY ("assigned_service_engineer") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "services" DROP COLUMN IF EXISTS "service_engineer_assigned";
