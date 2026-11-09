import {
  ArgumentsHost,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

const createHost = (url = '/v1/test') => {
  const json = vi.fn();
  const response = {
    status: vi.fn(() => ({ json })),
  };
  const request = { method: 'GET', url };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  return { host, response, json };
};

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the validation payload for client errors', () => {
    const { host, response, json } = createHost();

    filter.catch(
      new BadRequestException(['email must be an email']),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        error: 'Bad Request',
        message: ['email must be an email'],
        path: '/v1/test',
      }),
    );
  });

  it('does not expose internal messages on server errors', () => {
    const { host, response, json } = createHost();

    filter.catch(new Error('connect ECONNREFUSED 10.0.0.1:3306'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Unexpected error',
      }),
    );
    expect(JSON.stringify(json.mock.calls[0]?.[0])).not.toContain(
      'ECONNREFUSED',
    );
  });

  it('also hides the payload of an HttpException with status 500', () => {
    const { host, response, json } = createHost();

    filter.catch(
      new InternalServerErrorException('database password is secret'),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(json.mock.calls[0]?.[0])).not.toContain(
      'database password',
    );
  });
});
