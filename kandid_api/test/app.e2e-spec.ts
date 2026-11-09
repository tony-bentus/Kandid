import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('Kandid API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1 returns the API metadata', () => {
    return request(app.getHttpServer())
      .get('/v1')
      .expect(200)
      .expect(({ body }) => {
        expect(body.name).toBe('Kandid API');
        expect(body.health).toBe('/v1/health');
      });
  });

  it('GET /v1/health reports application and database status', () => {
    return request(app.getHttpServer())
      .get('/v1/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('ok');
        expect(body.services.database).toBe('up');
      });
  });

  it('GET /v1/unknown returns the standard error shape', () => {
    return request(app.getHttpServer())
      .get('/v1/unknown')
      .expect(404)
      .expect(({ body }) => {
        expect(body.statusCode).toBe(404);
        expect(body.path).toBe('/v1/unknown');
        expect(body.timestamp).toBeDefined();
      });
  });
});
