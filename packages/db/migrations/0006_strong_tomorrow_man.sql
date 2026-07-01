CREATE TABLE "provider_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"auth_type" text NOT NULL,
	"config_encrypted" text NOT NULL,
	"encryption_key_Version" integer DEFAULT 1 NOT NULL,
	"encryption_vi" text NOT NULL,
	"encryption_auth_tag" text NOT NULL,
	"provider_user_id" text,
	"provider_email" text,
	"expires_at" timestamp with time zone,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_connections_workspace_id_provider_unique" UNIQUE("workspace_id","provider")
);
--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;