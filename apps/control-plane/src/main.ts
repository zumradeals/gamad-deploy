import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
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
