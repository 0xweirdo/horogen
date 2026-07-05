import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { env } from './config/env.js';
import { HealthController } from './modules/health/health.controller.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.NODE_ENV === 'test' ? 'silent' : 'info',
        redact: ['req.headers.authorization'],
      },
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    ProjectsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
