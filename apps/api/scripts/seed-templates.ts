/**
 * Standalone template seeder script.
 *
 * Deletes all existing internal (built-in) templates from the DB, then
 * re-inserts the full set from templates.data.ts. Safe to run multiple times.
 *
 * Usage (from repo root):
 *   pnpm --filter api seed:templates
 */

import { resolve } from 'node:path';
import { config } from 'dotenv';

config({ path: resolve(__dirname, '../../../.env') });
config({ path: resolve(__dirname, '../../../.env.local') });

import { createDb } from '@linea/db/client';
import { eq } from 'drizzle-orm';
import { templates } from '@linea/db';
import { BUILT_IN_TEMPLATES } from '../src/workflows/templates.data.js';

async function main() {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    console.error('DATABASE_URL is not set. Make sure .env exists at the repo root.');
    process.exit(1);
  }

  const db = createDb(url);

  console.log('Deleting existing internal templates…');
  const deleted = await db
    .delete(templates)
    .where(eq(templates.source, 'internal'))
    .returning({ name: templates.name });

  if (deleted.length > 0) {
    console.log(`  Removed ${deleted.length} template(s): ${deleted.map((t) => t.name).join(', ')}`);
  } else {
    console.log('  No existing internal templates found.');
  }

  console.log(`\nInserting ${BUILT_IN_TEMPLATES.length} templates…`);
  for (const tpl of BUILT_IN_TEMPLATES) {
    await db.insert(templates).values({
      name: tpl.name,
      description: tpl.description,
      category: tpl.category,
      featured: tpl.featured,
      source: 'internal',
      prerequisites: tpl.prerequisites ?? null,
      definition: tpl.definition as any,
      downloads: 0,
    });
    console.log(`  + ${tpl.name}`);
  }

  console.log('\nDone.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
