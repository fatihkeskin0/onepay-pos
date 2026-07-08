CREATE TABLE "trusted_ips" (
    "id" SERIAL NOT NULL,
    "cidr" VARCHAR(64) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "category" VARCHAR(30) NOT NULL DEFAULT 'betconstruct',
    "skip_rate_limit" BOOLEAN NOT NULL DEFAULT true,
    "sync_cloudflare" BOOLEAN NOT NULL DEFAULT true,
    "cloudflare_rule_ids" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "note" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trusted_ips_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "trusted_ips_cidr_key" ON "trusted_ips"("cidr");
CREATE INDEX "trusted_ips_is_active_idx" ON "trusted_ips"("is_active");
