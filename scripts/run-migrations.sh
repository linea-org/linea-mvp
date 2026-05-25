#!/bin/sh
# run-migrations.sh — Applies SQL migrations inside Docker using psql.
# Tracks applied migrations in schema_migrations table (separate from drizzle-kit's
# __drizzle_migrations so both tools can coexist).
set -e

PSQL="psql -h $PGHOST -U $PGUSER -d $PGDATABASE -v ON_ERROR_STOP=1"

echo "==> Waiting for postgres to accept connections..."
until $PSQL -c "SELECT 1" > /dev/null 2>&1; do
  sleep 1
done

echo "==> Creating migration tracking table..."
$PSQL -c "
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  );
"

echo "==> Applying migrations..."
for file in $(ls /migrations/*.sql 2>/dev/null | sort); do
  filename=$(basename "$file")

  applied=$(psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -t -c \
    "SELECT COUNT(*) FROM schema_migrations WHERE filename = '$filename';" \
    | tr -d ' \n')

  if [ "$applied" = "1" ]; then
    echo "  skip: $filename"
    continue
  fi

  echo "  apply: $filename"
  # Strip drizzle-kit statement-breakpoint markers (they are SQL comments; psql ignores them)
  psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 -f "$file"

  psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -c \
    "INSERT INTO schema_migrations (filename) VALUES ('$filename');"
done

echo "==> Migrations complete."
