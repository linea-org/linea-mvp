import { config } from 'dotenv';
import { resolve } from 'node:path';
import { defineConfig } from 'drizzle-kit';

// pnpm sets CWD to packages/db when running scripts; ../../.env = repo root .env
// Falls back to .env in CWD for other contexts
config({ path: resolve('../../.env') });
config({ path: resolve('.env') }); // no-op if ../../.env already loaded DATABASE_URL

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL']!,
  },
  // Exclude LangGraph checkpoint tables — managed by @langchain/langgraph, not Drizzle
  tablesFilter: ['!checkpoint_migrations', '!checkpoint_blobs', '!checkpoints', '!checkpoint_writes'],
  verbose: true,
  strict: true,
});
