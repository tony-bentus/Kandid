import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import configuration from './config/configuration.js';
import { validateEnv } from './config/env.validation.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CertificationsModule } from './modules/certifications/certifications.module.js';
import { EducationsModule } from './modules/educations/educations.module.js';
import { ExperiencesModule } from './modules/experiences/experiences.module.js';
import { LanguagesModule } from './modules/languages/languages.module.js';
import { ProfilesModule } from './modules/profiles/profiles.module.js';
import { SkillsModule } from './modules/skills/skills.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => {
        const ssl = config.get<boolean>('database.ssl')
          ? { rejectUnauthorized: true }
          : undefined;
        const common = {
          autoLoadEntities: true,
          synchronize: false,
          logging: config.get<boolean>('database.logging') ?? false,
          retryAttempts: 3,
          retryDelay: 3000,
          timezone: 'Z',
          // `mysql2` devolve DATE como Date em UTC; o TypeORM reformata em TZ local
          // e desloca o dia em fusos negativos. Manter DATE como string preserva
          // o contrato YYYY-MM-DD sem alterar DATETIME (createdAt/updatedAt).
          extra: { dateStrings: ['DATE'] },
          ssl,
        };
        const url = config.get<string>('database.url');

        if (url) {
          return { type: 'mysql', url, ...common } as TypeOrmModuleOptions;
        }

        return {
          type: 'mysql',
          host: config.get<string>('database.host') ?? 'localhost',
          port: config.get<number>('database.port') ?? 3306,
          username: config.get<string>('database.username') ?? 'kandid',
          password: config.get<string>('database.password') ?? 'kandid',
          database: config.get<string>('database.name') ?? 'kandid',
          ...common,
        };
      },
    }),
    HealthModule,
    AuthModule,
    ProfilesModule,
    ExperiencesModule,
    SkillsModule,
    EducationsModule,
    CertificationsModule,
    LanguagesModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
