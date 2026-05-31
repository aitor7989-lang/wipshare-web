import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import type { Config } from 'drizzle-kit';

export default {
  schema: './src/lib/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // `generate` doesn't need a real URL (it only reads the schema). `push` /
    // `migrate` / `studio` do — they'll fail with a clear connection error if
    // DATABASE_URL is missing or wrong.
    url: process.env.DATABASE_URL ?? '',
  },
} satisfies Config;
