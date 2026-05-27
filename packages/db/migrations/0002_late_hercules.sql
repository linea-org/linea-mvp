ALTER TABLE "webhooks" ALTER COLUMN "secret_token" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "webhooks" ADD COLUMN "secret_encrypted" text;