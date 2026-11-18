import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({
    description: 'Identificador único do usuário',
    example: '5b0f2a8e-4f3c-4f9a-9c1e-2d7a6b8e0f12',
  })
  id: string;

  @ApiProperty({
    description: 'Nome completo do usuário',
    example: 'Jane Doe',
  })
  name: string;

  @ApiProperty({
    description: 'E-mail do usuário',
    example: 'jane.doe@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Data de criação do usuário',
    example: '2026-11-09T12:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Data da última atualização do usuário',
    example: '2026-11-09T12:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  updatedAt: Date;
}
