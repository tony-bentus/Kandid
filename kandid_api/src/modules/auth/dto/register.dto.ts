import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
import { normalizeEmailValue } from '../../../common/utils/normalize-email.js';

export class RegisterDto {
  @ApiProperty({
    description: 'Nome completo do usuário',
    example: 'Jane Doe',
    minLength: 2,
    maxLength: 120,
  })
  @IsString()
  @Length(2, 120)
  name: string;

  @ApiProperty({
    description: 'E-mail do usuário (normalizado para minúsculas)',
    example: 'jane.doe@example.com',
    maxLength: 160,
  })
  @Transform(({ value }) => normalizeEmailValue(value))
  @IsEmail()
  @MaxLength(160)
  email: string;

  @ApiProperty({
    description: 'Senha em texto puro (armazenada apenas como hash Argon2id)',
    example: 'S3curePass!',
    minLength: 8,
    maxLength: 128,
    format: 'password',
  })
  @IsString()
  @Length(8, 128)
  password: string;
}
