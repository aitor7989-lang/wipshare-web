import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { env } from './env';
import * as schema from './schema';

const sql = neon(env.DATABASE_URL);

/**
 * Drizzle client backed by Neon's serverless HTTP driver. The HTTP driver is
 * fine for Phase 2A's low-volume mutations (one INSERT per upload, one UPDATE
 * per complete) and avoids the connection-pooling headaches of long-lived
 * TCP connections in serverless functions.
 */
export const db = drizzle(sql, { schema });
