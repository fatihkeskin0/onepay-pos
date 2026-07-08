-- Rename phone → telegram_username on merchant applications
ALTER TABLE "merchant_applications" RENAME COLUMN "phone" TO "telegram_username";
ALTER TABLE "merchant_applications" ALTER COLUMN "telegram_username" TYPE VARCHAR(64);
