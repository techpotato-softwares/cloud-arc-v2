-- CreateTable
CREATE TABLE "clients" (
    "client_id" TEXT NOT NULL,
    "client_name" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" VARCHAR(100) NOT NULL,
    "updated_by" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("client_id")
);

-- CreateIndex
CREATE INDEX "clients_client_name_idx" ON "clients"("client_name");

-- CreateIndex
CREATE INDEX "clients_is_active_idx" ON "clients"("is_active");
