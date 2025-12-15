// backend/src/migrate.ts
import { readFileSync } from 'fs';
import path from 'path';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

async function migrate() {
  // путь к schema.sql из корня проекта бэкенда
  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  const sql = readFileSync(schemaPath, 'utf-8');

  const client = new Client({ connectionString });

  console.log('🚀 Running DB migration...');
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log('✅ Migration completed');
}

migrate().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
