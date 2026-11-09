import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const corsOrigin = config.get<string>('http.corsOrigin') ?? '*';
  app.enableCors({ origin: corsOrigin === '*' ? true : corsOrigin });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Kandid API')
    .setDescription(
      'API de gestão de busca por emprego: perfil, currículos com análise ATS e candidaturas.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  SwaggerModule.setup(
    'docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  const port = config.get<number>('app.port') ?? 3000;
  await app.listen(port);

  Logger.log(`Kandid API listening on http://localhost:${port}/v1`, 'Bootstrap');
  Logger.log(`Swagger UI at http://localhost:${port}/docs`, 'Bootstrap');
}

await bootstrap();
