import { createClient, Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';
import { bootstrapDatabase } from './bootstrap';
import fs from 'node:fs';
import path from 'node:path';

// Ensure data directory exists for local SQLite database
const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbUrl = process.env.DATABASE_URL || `file:${path.join(dataDir, 'farhan_ai.db')}`;

export const client: Client = createClient({
  url: dbUrl,
});

export const db = drizzle(client, { schema });

// Bootstrap flag to run schema initialization once
let isBootstrapped = false;
let bootstrapPromise: Promise<void> | null = null;

export async function ensureDatabaseReady(): Promise<void> {
  if (isBootstrapped) return;
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrapDatabase(client).then(() => {
      isBootstrapped = true;
    });
  }
  return bootstrapPromise;
}
