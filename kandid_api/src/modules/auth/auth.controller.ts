import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { AuthService } from './auth.service.js';
import { AuthResponseDto } from './dto/auth-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Cria uma conta e devolve um JWT de acesso' })
  @ApiCreatedResponse({
    description: 'Usuário criado com sucesso',
    type: AuthResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Payload inválido' })
  @ApiConflictResponse({ description: 'E-mail já cadastrado' })
  async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autentica com e-mail e senha e devolve um JWT' })
  @ApiOkResponse({
    description: 'Credenciais válidas',
    type: AuthResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Payload inválido' })
  @ApiUnauthorizedResponse({ description: 'E-mail ou senha inválidos' })
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retorna o usuário autenticado pelo JWT' })
  @ApiOkResponse({
    description: 'Dados públicos do usuário autenticado',
    type: UserResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inválido ou expirado',
  })
  async me(
    @CurrentUser() authenticatedUser: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.authService.getCurrentUser(authenticatedUser.userId);
  }
}
