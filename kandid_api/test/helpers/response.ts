/** Corpo de erro no formato único da API: { statusCode, error, message, path, timestamp }. */
export interface ApiErrorBody {
  statusCode: number;
  error?: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

interface HttpResponseLike {
  status: number;
  body: unknown;
}

/**
 * Valida o envelope de erro e devolve o corpo tipado para asserções de mensagem.
 * `path` deve incluir a query string quando houver (o filtro usa `originalUrl`).
 */
export function expectApiError(
  response: HttpResponseLike,
  status: number,
  path: string,
): ApiErrorBody {
  expect(response.status).toBe(status);

  const body = response.body as ApiErrorBody;

  expect(body.statusCode).toBe(status);
  expect(body.path).toBe(path);
  expect(typeof body.timestamp).toBe('string');
  expect(body.timestamp.length).toBeGreaterThan(0);
  expect(body.message).toBeDefined();

  return body;
}

/** Compara mensagens ignorando caixa e separadores (endDate == "end date"). */
export function errorMentions(body: ApiErrorBody, term: string): boolean {
  const normalize = (value: string): string =>
    value.toLowerCase().replace(/[^a-z0-9]/g, '');

  return normalize(JSON.stringify(body.message)).includes(normalize(term));
}
