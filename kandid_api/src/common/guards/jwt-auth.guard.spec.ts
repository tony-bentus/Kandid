import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

interface JwtPayload {
  sub: string;
  email: string;
}

interface MockRequest {
  headers: { authorization?: string };
  user?: AuthenticatedUser;
}

const createContext = (request: MockRequest): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  }) as unknown as ExecutionContext;

describe('JwtAuthGuard', () => {
  const verifyAsync = vi.fn<(token: string) => Promise<JwtPayload>>();
  const jwtService = { verifyAsync } as unknown as JwtService;

  let guard: JwtAuthGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new JwtAuthGuard(jwtService);
  });

  it('rejects an Authorization header without the Bearer scheme', async () => {
    const request: MockRequest = {
      headers: { authorization: 'some-token' },
    };

    await expect(
      guard.canActivate(createContext(request)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(request.user).toBeUndefined();
  });

  it('rejects a request without an Authorization header', async () => {
    const request: MockRequest = { headers: {} };

    await expect(
      guard.canActivate(createContext(request)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard.canActivate(createContext(request))).rejects.toThrow(
      'Invalid or missing access token',
    );
  });

  it.each([['Token some-token'], ['Bearer'], ['Bearer some-token extra']])(
    'rejects a malformed Authorization header: %s',
    async (authorization) => {
      const request: MockRequest = { headers: { authorization } };

      await expect(
        guard.canActivate(createContext(request)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    },
  );

  it('rejects an invalid token', async () => {
    verifyAsync.mockRejectedValueOnce(new Error('invalid signature'));
    const request: MockRequest = {
      headers: { authorization: 'Bearer invalid-token' },
    };

    await expect(
      guard.canActivate(createContext(request)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(request.user).toBeUndefined();
  });

  it('accepts a valid token and populates request.user', async () => {
    verifyAsync.mockResolvedValueOnce({
      sub: '5b0f2a8e-4f3c-4f9a-9c1e-2d7a6b8e0f12',
      email: 'jane.doe@example.com',
    });
    const request: MockRequest = {
      headers: { authorization: 'Bearer valid-token' },
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);

    expect(verifyAsync).toHaveBeenCalledWith('valid-token', {
      algorithms: ['HS256'],
    });
    expect(request.user).toEqual({
      userId: '5b0f2a8e-4f3c-4f9a-9c1e-2d7a6b8e0f12',
      email: 'jane.doe@example.com',
    });
  });

  describe('with a real JwtService', () => {
    const user = {
      sub: '5b0f2a8e-4f3c-4f9a-9c1e-2d7a6b8e0f12',
      email: 'jane.doe@example.com',
    };
    const realJwtService = new JwtService({
      secret: 'unit-test-secret-with-16-chars',
    });

    let realGuard: JwtAuthGuard;

    beforeEach(() => {
      realGuard = new JwtAuthGuard(realJwtService);
    });

    it('rejects an expired token with 401', async () => {
      const token = realJwtService.sign(user, { expiresIn: '-1s' });
      const request: MockRequest = {
        headers: { authorization: `Bearer ${token}` },
      };

      await expect(
        realGuard.canActivate(createContext(request)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(
        realGuard.canActivate(createContext(request)),
      ).rejects.toThrow('Invalid or missing access token');
      expect(request.user).toBeUndefined();
    });

    it('rejects a signed token without the required claims', async () => {
      const token = realJwtService.sign({ email: user.email });
      const request: MockRequest = {
        headers: { authorization: `Bearer ${token}` },
      };

      await expect(
        realGuard.canActivate(createContext(request)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(request.user).toBeUndefined();
    });

    it('rejects a signed token with a non-string subject', async () => {
      const token = realJwtService.sign({
        sub: 42,
        email: user.email,
      });
      const request: MockRequest = {
        headers: { authorization: `Bearer ${token}` },
      };

      await expect(
        realGuard.canActivate(createContext(request)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(request.user).toBeUndefined();
    });

    it('accepts a valid signed token and populates request.user', async () => {
      const token = realJwtService.sign(user);
      const request: MockRequest = {
        headers: { authorization: `Bearer ${token}` },
      };

      await expect(
        realGuard.canActivate(createContext(request)),
      ).resolves.toBe(true);
      expect(request.user).toEqual({
        userId: user.sub,
        email: user.email,
      });
    });
  });
});
