import { ApiProperty } from '@nestjs/swagger';

/** Representação pública de um currículo. `userId` é somente leitura. */
export class ResumeResponseDto {
  @ApiProperty({ example: '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b' })
  id: string;

  @ApiProperty({ example: '6f1c2a9e-3b7d-4c85-9f10-2a4d8e7b1c33' })
  userId: string;

  @ApiProperty({ example: 'Currículo Backend', maxLength: 120 })
  name: string;

  @ApiProperty({
    description: 'Cargo alvo; string vazia quando não definido',
    example: 'Desenvolvedor Backend Sênior',
    maxLength: 160,
  })
  targetRole: string;

  @ApiProperty({ example: true })
  isDefault: boolean;

  @ApiProperty({ example: '2026-11-19T12:00:00.000Z', format: 'date-time', type: String })
  createdAt: string;

  @ApiProperty({ example: '2026-11-19T12:00:00.000Z', format: 'date-time', type: String })
  updatedAt: string;
}
