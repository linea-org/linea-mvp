ALTER TABLE "linea_api_keys" ADD COLUMN "expires_at" timestamp with time zone;
ALTER TABLE "linea_api_keys" ADD COLUMN "revoked_at" timestamp with time zone;
