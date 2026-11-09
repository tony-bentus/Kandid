import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

interface ApiInfo {
  name: string;
  version: string;
  docs: string;
  health: string;
}

@ApiTags('meta')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Metadados da API' })
  @ApiOkResponse({ description: 'Nome, versão e links úteis' })
  getInfo(): ApiInfo {
    return {
      name: 'Kandid API',
      version: '0.1.0',
      docs: '/docs',
      health: '/v1/health',
    };
  }
}
