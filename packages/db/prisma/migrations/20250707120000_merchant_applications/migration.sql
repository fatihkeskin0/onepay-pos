-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('new', 'reviewed', 'archived');

-- CreateTable
CREATE TABLE "merchant_applications" (
    "id" SERIAL NOT NULL,
    "company_name" VARCHAR(200) NOT NULL,
    "contact_name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(40) NOT NULL,
    "message" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'new',
    "ip" VARCHAR(64) NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "merchant_applications_status_created_at_idx" ON "merchant_applications"("status", "created_at");

-- Default Telegram support username (admin can change in settings)
INSERT INTO "settings" ("key", "value", "updated_at")
VALUES ('telegram_support_username', 'onepos_support', NOW())
ON CONFLICT ("key") DO NOTHING;
