-- DropForeignKey
ALTER TABLE "cashier_sub_users" DROP CONSTRAINT "cashier_sub_users_cashier_id_fkey";

-- DropTable
DROP TABLE "cashier_sub_users";

-- AlterTable
ALTER TABLE "deposits" DROP COLUMN "processed_by_sub_id",
DROP COLUMN "processed_by_sub_username";
