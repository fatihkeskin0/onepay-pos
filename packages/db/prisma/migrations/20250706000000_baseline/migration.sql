-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CashierRole" AS ENUM ('kasiyer', 'admin', 'wd_manager');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "AnnouncementType" AS ENUM ('info', 'warning', 'success');

-- CreateEnum
CREATE TYPE "ChatSender" AS ENUM ('cashier', 'admin');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('completed', 'rolled_back');

-- CreateEnum
CREATE TYPE "PspTransactionStatus" AS ENUM ('initiated', 'processing', 'paid', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "PspSettlementStatus" AS ENUM ('pending', 'matched', 'partial');

-- CreateTable
CREATE TABLE "sites" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "api_key" VARCHAR(64) NOT NULL,
    "min_deposit" DECIMAL(10,2) NOT NULL DEFAULT 100,
    "min_withdrawal" DECIMAL(10,2) NOT NULL DEFAULT 100,
    "dep_commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "wd_commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "delivery_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "callback_url" VARCHAR(512),
    "callback_url_deposit" VARCHAR(512),
    "callback_url_withdrawal" VARCHAR(512),
    "brand_color" VARCHAR(7) NOT NULL DEFAULT '#2563EB',
    "brand_bg_color" VARCHAR(7) NOT NULL DEFAULT '#F4F7FC',
    "brand_logo_url" VARCHAR(255),
    "telegram_chat_id" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cashiers" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "CashierRole" NOT NULL DEFAULT 'kasiyer',
    "commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "site_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "totp_secret" VARCHAR(64),
    "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3),
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "theme" VARCHAR(10) NOT NULL DEFAULT 'light',
    "telegram_chat_id" VARCHAR(50),
    "telegram_chat_id_pending" VARCHAR(64),
    "tg_notify_deposit" BOOLEAN NOT NULL DEFAULT true,
    "tg_notify_withdrawal" BOOLEAN NOT NULL DEFAULT true,
    "tg_notify_settlement" BOOLEAN NOT NULL DEFAULT true,
    "tg_notify_payout" BOOLEAN NOT NULL DEFAULT true,
    "ip_lock_enabled" BOOLEAN NOT NULL DEFAULT true,
    "admin_note" TEXT,
    "commission_credited" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "cashiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cashier_sub_users" (
    "id" SERIAL NOT NULL,
    "cashier_id" INTEGER NOT NULL,
    "username" VARCHAR(60) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "permissions" JSONB,

    CONSTRAINT "cashier_sub_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cashier_sites" (
    "cashier_id" INTEGER NOT NULL,
    "site_id" INTEGER NOT NULL,

    CONSTRAINT "cashier_sites_pkey" PRIMARY KEY ("cashier_id","site_id")
);

-- CreateTable
CREATE TABLE "deposits" (
    "id" SERIAL NOT NULL,
    "user_id" VARCHAR(100) NOT NULL,
    "site_id" INTEGER,
    "amount" DECIMAL(15,2) NOT NULL,
    "method" VARCHAR(30) NOT NULL DEFAULT 'card',
    "reference" VARCHAR(20) NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "status" "DepositStatus" NOT NULL DEFAULT 'pending',
    "cashier_id" INTEGER,
    "reject_reason" VARCHAR(255),
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_suspicious" BOOLEAN NOT NULL DEFAULT false,
    "suspicious_reason" VARCHAR(255),
    "processed_by_sub_id" INTEGER,
    "processed_by_sub_username" VARCHAR(100),
    "processed_by_admin_username" VARCHAR(100),
    "external_id" VARCHAR(128),
    "psp_provider" VARCHAR(30),
    "psp_ref" VARCHAR(128),
    "commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "commission_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,

    CONSTRAINT "deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_sessions" (
    "id" SERIAL NOT NULL,
    "token" VARCHAR(40) NOT NULL,
    "site_id" INTEGER NOT NULL,
    "user_id" VARCHAR(100) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "user_name" VARCHAR(100) NOT NULL DEFAULT '',
    "return_url" VARCHAR(500) NOT NULL DEFAULT '',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deposit_ref" VARCHAR(64),
    "deposit_token" VARCHAR(64),
    "external_id" VARCHAR(128),

    CONSTRAINT "payment_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" SERIAL NOT NULL,
    "user_id" VARCHAR(100) NOT NULL,
    "balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'TRY',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" BIGSERIAL NOT NULL,
    "user_id" VARCHAR(100) NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "bc_tx_id" VARCHAR(100),
    "status" "TransactionStatus" NOT NULL DEFAULT 'completed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psp_transactions" (
    "id" SERIAL NOT NULL,
    "deposit_id" INTEGER NOT NULL,
    "provider" VARCHAR(30) NOT NULL,
    "provider_ref" VARCHAR(128),
    "status" "PspTransactionStatus" NOT NULL DEFAULT 'initiated',
    "amount" DECIMAL(15,2) NOT NULL,
    "three_ds_status" VARCHAR(30),
    "redirect_url" VARCHAR(512),
    "raw_request" JSONB,
    "raw_response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "psp_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psp_settlements" (
    "id" SERIAL NOT NULL,
    "provider" VARCHAR(30) NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "gross_amount" DECIMAL(15,2) NOT NULL,
    "fee_amount" DECIMAL(15,2) NOT NULL,
    "net_amount" DECIMAL(15,2) NOT NULL,
    "matched_count" INTEGER NOT NULL DEFAULT 0,
    "status" "PspSettlementStatus" NOT NULL DEFAULT 'pending',
    "raw_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "psp_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "type" "AnnouncementType" NOT NULL DEFAULT 'info',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" SERIAL NOT NULL,
    "cashier_id" INTEGER NOT NULL,
    "sender" "ChatSender" NOT NULL,
    "sender_name" VARCHAR(100) NOT NULL DEFAULT '',
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_logs" (
    "id" SERIAL NOT NULL,
    "cashier_id" INTEGER NOT NULL,
    "username" VARCHAR(60) NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "ip" VARCHAR(45) NOT NULL DEFAULT '',
    "logged_in_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logged_out_at" TIMESTAMP(3),

    CONSTRAINT "login_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "cashier_id" INTEGER NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "target" VARCHAR(100),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposit_edit_logs" (
    "id" SERIAL NOT NULL,
    "deposit_id" INTEGER NOT NULL,
    "old_amount" DECIMAL(12,2) NOT NULL,
    "new_amount" DECIMAL(12,2) NOT NULL,
    "edited_by" VARCHAR(64) NOT NULL,
    "edited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposit_edit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_methods" (
    "id" SERIAL NOT NULL,
    "provider" VARCHAR(30) NOT NULL,
    "label" VARCHAR(60) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "min_amount" DECIMAL(12,2) NOT NULL DEFAULT 50,
    "max_amount" DECIMAL(12,2) NOT NULL DEFAULT 100000,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_methods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sites_api_key_key" ON "sites"("api_key");

-- CreateIndex
CREATE UNIQUE INDEX "cashiers_username_key" ON "cashiers"("username");

-- CreateIndex
CREATE UNIQUE INDEX "cashier_sub_users_username_key" ON "cashier_sub_users"("username");

-- CreateIndex
CREATE INDEX "cashier_sub_users_cashier_id_idx" ON "cashier_sub_users"("cashier_id");

-- CreateIndex
CREATE UNIQUE INDEX "deposits_reference_key" ON "deposits"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "deposits_token_key" ON "deposits"("token");

-- CreateIndex
CREATE INDEX "deposits_status_idx" ON "deposits"("status");

-- CreateIndex
CREATE INDEX "deposits_user_id_idx" ON "deposits"("user_id");

-- CreateIndex
CREATE INDEX "deposits_site_id_idx" ON "deposits"("site_id");

-- CreateIndex
CREATE INDEX "deposits_created_at_idx" ON "deposits"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_sessions_token_key" ON "payment_sessions"("token");

-- CreateIndex
CREATE INDEX "payment_sessions_deposit_ref_deposit_token_idx" ON "payment_sessions"("deposit_ref", "deposit_token");

-- CreateIndex
CREATE INDEX "payment_sessions_expires_at_idx" ON "payment_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_bc_tx_id_key" ON "transactions"("bc_tx_id");

-- CreateIndex
CREATE INDEX "transactions_user_id_idx" ON "transactions"("user_id");

-- CreateIndex
CREATE INDEX "psp_transactions_deposit_id_idx" ON "psp_transactions"("deposit_id");

-- CreateIndex
CREATE INDEX "psp_transactions_provider_ref_idx" ON "psp_transactions"("provider_ref");

-- CreateIndex
CREATE INDEX "psp_transactions_provider_provider_ref_idx" ON "psp_transactions"("provider", "provider_ref");

-- CreateIndex
CREATE INDEX "chat_messages_cashier_id_created_at_idx" ON "chat_messages"("cashier_id", "created_at");

-- CreateIndex
CREATE INDEX "login_logs_logged_in_at_idx" ON "login_logs"("logged_in_at");

-- CreateIndex
CREATE INDEX "login_logs_cashier_id_idx" ON "login_logs"("cashier_id");

-- CreateIndex
CREATE INDEX "audit_log_cashier_id_idx" ON "audit_log"("cashier_id");

-- CreateIndex
CREATE INDEX "deposit_edit_logs_deposit_id_idx" ON "deposit_edit_logs"("deposit_id");

-- CreateIndex
CREATE UNIQUE INDEX "pos_methods_provider_key" ON "pos_methods"("provider");

-- AddForeignKey
ALTER TABLE "cashier_sub_users" ADD CONSTRAINT "cashier_sub_users_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "cashiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashier_sites" ADD CONSTRAINT "cashier_sites_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "cashiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashier_sites" ADD CONSTRAINT "cashier_sites_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "cashiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psp_transactions" ADD CONSTRAINT "psp_transactions_deposit_id_fkey" FOREIGN KEY ("deposit_id") REFERENCES "deposits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "cashiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_logs" ADD CONSTRAINT "login_logs_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "cashiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "cashiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_edit_logs" ADD CONSTRAINT "deposit_edit_logs_deposit_id_fkey" FOREIGN KEY ("deposit_id") REFERENCES "deposits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
