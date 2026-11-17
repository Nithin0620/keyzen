import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validateEnv } from './config/env';

async function bootstrap(): Promise<void> {
  const env = validateEnv();
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  await app.listen(env.API_PORT);
}

void bootstrap();
