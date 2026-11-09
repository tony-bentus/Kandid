import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';

type ServiceStatus = 'up' | 'down';

interface HealthResponse {
  status: 'ok' | 'degraded';
  version: string;
  timestamp: string;
  uptime: number;
  services: {
    database: ServiceStatus;
  };
}

const API_VERSION = '0.1.0';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Verifica a saúde da API e da conexão com o banco' })
  @ApiOkResponse({ description: 'Aplicação respondendo (banco pode estar degradado)' })
  async check(): Promise<HealthResponse> {
    let database: ServiceStatus = 'down';

    try {
      await this.dataSource.query('SELECT 1');
      database = 'up';
    } catch {
      database = 'down';
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      version: API_VERSION,
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      services: {
        database,
      },
    };
  }
}
