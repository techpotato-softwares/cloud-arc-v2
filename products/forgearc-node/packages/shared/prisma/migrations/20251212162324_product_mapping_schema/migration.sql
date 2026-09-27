-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "client_name" VARCHAR(255) NOT NULL,
    "osg_pi_no" INTEGER NOT NULL,
    "osg_pi_date" DATE NOT NULL,
    "client_po_no" INTEGER NOT NULL,
    "client_po_date" DATE NOT NULL,
    "po_status" VARCHAR(50) NOT NULL,
    "no_of_dispatch" VARCHAR(20) NOT NULL,
    "client_address" TEXT NOT NULL,
    "client_contact" VARCHAR(100) NOT NULL,
    "dispatch_plan_date" DATE NOT NULL,
    "site_location" VARCHAR(255) NOT NULL,
    "osc_support" VARCHAR(20) NOT NULL,
    "confirm_date_of_dispatch" DATE NOT NULL,
    "payment_status" VARCHAR(50) NOT NULL,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "po_items" (
    "id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "oem_name" VARCHAR(100) NOT NULL,
    "product" VARCHAR(255) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "spare_quantity" INTEGER NOT NULL DEFAULT 0,
    "total_quantity" INTEGER NOT NULL,
    "price_per_unit" DECIMAL(12,2) NOT NULL,
    "total_price" DECIMAL(14,2) NOT NULL,
    "warranty" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "po_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "user_id" TEXT NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" VARCHAR(100) NOT NULL,
    "updated_by" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "roles" (
    "role_id" TEXT NOT NULL,
    "role_name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "created_by" VARCHAR(100) NOT NULL,
    "updated_by" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "user_role_mappings" (
    "user_role_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "created_by" VARCHAR(100) NOT NULL,
    "updated_by" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_role_mappings_pkey" PRIMARY KEY ("user_role_id")
);

-- CreateTable
CREATE TABLE "user_role_permission_mappings" (
    "user_role_permission_id" TEXT NOT NULL,
    "user_role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_by" VARCHAR(100) NOT NULL,
    "updated_by" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_role_permission_mappings_pkey" PRIMARY KEY ("user_role_permission_id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "permission_id" TEXT NOT NULL,
    "permission_name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "created_by" VARCHAR(100) NOT NULL,
    "updated_by" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("permission_id")
);

-- CreateTable
CREATE TABLE "categories" (
    "category_id" TEXT NOT NULL,
    "category_name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" VARCHAR(100) NOT NULL,
    "updated_by" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "oems" (
    "oem_id" TEXT NOT NULL,
    "oem_name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" VARCHAR(100) NOT NULL,
    "updated_by" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oems_pkey" PRIMARY KEY ("oem_id")
);

-- CreateTable
CREATE TABLE "products" (
    "product_id" TEXT NOT NULL,
    "product_name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "category_id" TEXT NOT NULL,
    "oem_id" TEXT NOT NULL,
    "created_by" VARCHAR(100) NOT NULL,
    "updated_by" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("product_id")
);

-- CreateIndex
CREATE INDEX "purchase_orders_client_name_idx" ON "purchase_orders"("client_name");

-- CreateIndex
CREATE INDEX "purchase_orders_po_status_idx" ON "purchase_orders"("po_status");

-- CreateIndex
CREATE INDEX "purchase_orders_created_at_idx" ON "purchase_orders"("created_at");

-- CreateIndex
CREATE INDEX "po_items_purchase_order_id_idx" ON "po_items"("purchase_order_id");

-- CreateIndex
CREATE INDEX "po_items_category_idx" ON "po_items"("category");

-- CreateIndex
CREATE INDEX "po_items_product_idx" ON "po_items"("product");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "roles_role_name_idx" ON "roles"("role_name");

-- CreateIndex
CREATE INDEX "roles_is_active_idx" ON "roles"("is_active");

-- CreateIndex
CREATE INDEX "user_role_mappings_user_id_idx" ON "user_role_mappings"("user_id");

-- CreateIndex
CREATE INDEX "user_role_mappings_role_id_idx" ON "user_role_mappings"("role_id");

-- CreateIndex
CREATE INDEX "user_role_mappings_is_active_idx" ON "user_role_mappings"("is_active");

-- CreateIndex
CREATE INDEX "user_role_permission_mappings_user_role_id_idx" ON "user_role_permission_mappings"("user_role_id");

-- CreateIndex
CREATE INDEX "user_role_permission_mappings_permission_id_idx" ON "user_role_permission_mappings"("permission_id");

-- CreateIndex
CREATE INDEX "user_role_permission_mappings_is_active_idx" ON "user_role_permission_mappings"("is_active");

-- CreateIndex
CREATE INDEX "permissions_permission_name_idx" ON "permissions"("permission_name");

-- CreateIndex
CREATE INDEX "permissions_is_active_idx" ON "permissions"("is_active");

-- CreateIndex
CREATE INDEX "categories_category_name_idx" ON "categories"("category_name");

-- CreateIndex
CREATE INDEX "categories_is_active_idx" ON "categories"("is_active");

-- CreateIndex
CREATE INDEX "oems_oem_name_idx" ON "oems"("oem_name");

-- CreateIndex
CREATE INDEX "oems_is_active_idx" ON "oems"("is_active");

-- CreateIndex
CREATE INDEX "products_product_name_idx" ON "products"("product_name");

-- CreateIndex
CREATE INDEX "products_is_active_idx" ON "products"("is_active");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_oem_id_idx" ON "products"("oem_id");

-- AddForeignKey
ALTER TABLE "po_items" ADD CONSTRAINT "po_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_mappings" ADD CONSTRAINT "user_role_mappings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_mappings" ADD CONSTRAINT "user_role_mappings_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_permission_mappings" ADD CONSTRAINT "user_role_permission_mappings_user_role_id_fkey" FOREIGN KEY ("user_role_id") REFERENCES "user_role_mappings"("user_role_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_permission_mappings" ADD CONSTRAINT "user_role_permission_mappings_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("permission_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_oem_id_fkey" FOREIGN KEY ("oem_id") REFERENCES "oems"("oem_id") ON DELETE RESTRICT ON UPDATE CASCADE;
