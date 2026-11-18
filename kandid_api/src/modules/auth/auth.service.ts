import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import { normalizeEmail } from '../../common/utils/normalize-email.js';
import { User } from '../users/entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { AuthResponseDto } from './dto/auth-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';

const PASSWORD_HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

const DUPLICATE_ENTRY_CODE = 'ER_DUP_ENTRY';

// Verified against on unknown e-mails so the login path always pays the same
// Argon2id cost, preventing account enumeration through response timing.
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$4HnfLbcTb+Sqj1iyHTCqmg$tn37pjemDHuFx3rqxjJprLEa/n/hchS1iUYV/IlbZ20';

interface MaybeDriverError {
  code?: string;
  driverError?: {
    code?: string;
  };
}

/**
 * Detects a unique constraint violation without relying on the driver class,
 * so a concurrent registration still maps to 409 instead of 500.
 */
const isDuplicateEntry = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as MaybeDriverError;
  const code = candidate.driverError?.code ?? candidate.code;

  return code === DUPLICATE_ENTRY_CODE;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const email = normalizeEmail(dto.email);
    const existingUser = await this.usersService.findByEmail(email);

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await argon2.hash(dto.password, PASSWORD_HASH_OPTIONS);
    let user: User;

    try {
      user = await this.usersService.create({
        name: dto.name,
        email,
        passwordHash,
      });
    } catch (error) {
      if (isDuplicateEntry(error)) {
        throw new ConflictException('Email already registered');
      }

      throw error;
    }

    return {
      user: this.toUserResponse(user),
      accessToken: await this.issueToken(user),
    };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);
    const passwordMatches = await this.verifyPassword(
      dto.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      user: this.toUserResponse(user),
      accessToken: await this.issueToken(user),
    };
  }

  async getCurrentUser(userId: string): Promise<UserResponseDto> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('Authenticated user no longer exists');
    }

    return this.toUserResponse(user);
  }

  toUserResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async verifyPassword(
    password: string,
    passwordHash: string,
  ): Promise<boolean> {
    try {
      return await argon2.verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  private async issueToken(user: User): Promise<string> {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });
  }
}
