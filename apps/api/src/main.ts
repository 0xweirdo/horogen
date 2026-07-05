import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import * as Sentry from '@sentry/node';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.js';
import { assertProdSecrets, env } from './config/env.js';

async function bootstrap() {
  assertProdSecrets();

  if (env.SENTRY_DSN) {
    Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV });
  }

  // rawBody จำเป็นสำหรับ verify ลายเซ็น svix ของ Clerk webhook
  const app = await NestFactory.create(AppModule, { rawBody: true, bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('v1');
  app.enableShutdownHooks();

  await app.listen(env.PORT);
}

void bootstrap();
