import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  const dataSource = {
    query: vi.fn(),
  };

  let controller: HealthController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: DataSource, useValue: dataSource }],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  it('reports ok when the database responds', async () => {
    dataSource.query.mockResolvedValueOnce([{ result: 1 }]);

    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.services.database).toBe('up');
    expect(result.version).toBe('0.1.0');
  });

  it('reports degraded when the database fails', async () => {
    dataSource.query.mockRejectedValueOnce(new Error('database down'));

    const result = await controller.check();

    expect(result.status).toBe('degraded');
    expect(result.services.database).toBe('down');
  });
});
