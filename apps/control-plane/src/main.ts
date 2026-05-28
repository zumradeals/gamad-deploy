import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppModule } from './app.module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigrations(): Promise<void> {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL manquant');
  const pool = new pg.Pool({ connectionString: url });
  try {
    const db = drizzle(pool);
    await migrate(db, {
      migrationsFolder: path.resolve(__dirname, '../../../packages/schema/migrations'),
    });
    console.log('Migrations appliquées.');
  } finally {
    await pool.end();
  }
}

async function bootstrap(): Promise<void> {
  await runMigrations();
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.useWebSocketAdapter(new WsAdapter(app));
  const port = parseInt(process.env['PORT'] ?? '3000', 10);
  await app.listen(port);
  console.log(`Control plane démarré sur le port ${port}`);
}

bootstrap().catch((err) => {
  console.error('Erreur au démarrage :', err);
  process.exit(1);
});
