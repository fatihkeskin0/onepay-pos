-- AlterTable
ALTER TABLE "pos_methods" ADD COLUMN "proxy_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "pos_methods" ADD COLUMN "proxy_mode" VARCHAR(20) NOT NULL DEFAULT 'off';
ALTER TABLE "pos_methods" ADD COLUMN "proxy_entry_ids" JSONB;

-- CreateTable
CREATE TABLE "proxy_pool_entries" (
    "id" SERIAL NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "host" VARCHAR(255) NOT NULL,
    "port" INTEGER NOT NULL,
    "protocol" VARCHAR(10) NOT NULL DEFAULT 'http',
    "username" VARCHAR(120),
    "password_enc" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3),
    "fail_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proxy_pool_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "panel_access_ips" (
    "id" SERIAL NOT NULL,
    "cidr" VARCHAR(64) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "note" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "panel_access_ips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proxy_pool_entries_host_port_username_key" ON "proxy_pool_entries"("host", "port", "username");

-- CreateIndex
CREATE INDEX "proxy_pool_entries_is_active_idx" ON "proxy_pool_entries"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "panel_access_ips_cidr_key" ON "panel_access_ips"("cidr");

-- CreateIndex
CREATE INDEX "panel_access_ips_is_active_idx" ON "panel_access_ips"("is_active");
