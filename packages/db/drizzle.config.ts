import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

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
