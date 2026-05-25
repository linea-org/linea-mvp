/**
 * baseline.mjs — Mark all current migrations as applied in an EXISTING database.
 *
 * Run this ONCE on a database that was set up via `db:push` (not `db:migrate`).
 * After running, `drizzle-kit migrate` will only apply NEW migrations going forward.
 *
 * Usage:
 *   pnpm --filter=@linea/db db:baseline
 *   # or from repo root:
 *   pnpm db:baseline
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Load env (dotenv/config side-effect import)
const { config } = await import('dotenv');
config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../.env') });

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set. Create a .env file at the repo root.');
  process.exit(1);
}

const postgres = (await import('postgres')).default;
const db = postgres(process.env.DATABASE_URL, { max: 1 });

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, 'migrations');

// Read the drizzle-kit journal to know which migrations exist
const journal = JSON.parse(readFileSync(join(migrationsDir, 'meta', '_journal.json'), 'utf-8'));

// Create the drizzle migrations tracking table (drizzle-kit migrate also creates this)
await db`
  CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  )
`;

console.log('Marking existing migrations as applied...\n');
let marked = 0;
let skipped = 0;

for (const entry of journal.entries) {
  const filePath = join(migrationsDir, `${entry.tag}.sql`);
  const content = readFileSync(filePath, 'utf-8');
  // drizzle-kit stores sha256 of the SQL file content
  const hash = createHash('sha256').update(content).digest('hex');

  const [existing] = await db`
    SELECT id FROM __drizzle_migrations WHERE hash = ${hash}
  `;

  if (existing) {
    console.log(`  already recorded: ${entry.tag}`);
    skipped++;
  } else {
    await db`
      INSERT INTO __drizzle_migrations (hash, created_at)
      VALUES (${hash}, ${entry.when})
    `;
    console.log(`  ✓ marked as applied: ${entry.tag}`);
    marked++;
  }
}

console.log(`\nBaseline complete: ${marked} recorded, ${skipped} already present.`);
console.log('Future schema changes: edit TypeScript schema → pnpm db:generate → pnpm db:migrate');

await db.end();
