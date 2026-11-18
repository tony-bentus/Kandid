import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { normalizeEmailValue } from '../../../common/utils/normalize-email.js';

export class LoginDto {
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
    description: 'Senha do usuário',
    example: 'S3curePass!',
    format: 'password',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}
