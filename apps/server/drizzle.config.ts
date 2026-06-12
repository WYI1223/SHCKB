import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
  // generate works schema-only; studio/push need the db url — keep it
  // aligned with the runtime default (src/index.ts SHCKB_DB_PATH).
  dbCredentials: { url: process.env.SHCKB_DB_PATH ?? './data/shckb.db' },
});
