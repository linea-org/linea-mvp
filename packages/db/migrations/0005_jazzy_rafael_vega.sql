ALTER TABLE "templates" DROP CONSTRAINT "templates_published_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Community templates must always have a publisher; only source='internal' rows may have published_by IS NULL.
-- Wrapped in a DO block so re-running on a DB that already has the constraint is a no-op.
DO $$ BEGIN
  ALTER TABLE "templates" ADD CONSTRAINT "chk_community_has_publisher"
    CHECK (source = 'internal' OR published_by IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;