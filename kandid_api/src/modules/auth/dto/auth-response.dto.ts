import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto.js';

export class AuthResponseDto {
  @ApiProperty({
    description: 'Dados públicos do usuário autenticado',
    type: UserResponseDto,
  })
  user: UserResponseDto;

  @ApiProperty({
    description: 'JWT de acesso para as rotas protegidas',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1YjBmMmE4ZS00ZjNjLTRmOWEtOWMxZS0yZDdhNmI4ZTBmMTIiLCJlbWFpbCI6ImphbmUuZG9lQGV4YW1wbGUuY29tIn0.signature',
  })
  accessToken: string;
}
