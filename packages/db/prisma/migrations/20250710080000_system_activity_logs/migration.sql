-- CreateTable
CREATE TABLE "system_activity_logs" (
    "id" BIGSERIAL NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "action" VARCHAR(60) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "actor_id" INTEGER,
    "actor_username" VARCHAR(60),
    "user_id" VARCHAR(64),
    "ip" VARCHAR(45),
    "target" VARCHAR(120),
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "system_activity_logs_created_at_idx" ON "system_activity_logs"("created_at");

-- CreateIndex
CREATE INDEX "system_activity_logs_category_idx" ON "system_activity_logs"("category");

-- CreateIndex
CREATE INDEX "system_activity_logs_actor_id_idx" ON "system_activity_logs"("actor_id");
