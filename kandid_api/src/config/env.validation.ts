const ALLOWED_NODE_ENVS = ['development', 'test', 'production'];

const isValidPort = (value: unknown): boolean => {
  const port = Number(value);

  return Number.isInteger(port) && port > 0 && port <= 65535;
};

/**
 * Validates the raw environment before it is available through ConfigService.
 * Throws a single aggregated error so misconfiguration is obvious at boot.
 */
export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const errors: string[] = [];
  const nodeEnv =
    typeof config.NODE_ENV === 'string' ? config.NODE_ENV : 'development';
  const jwtSecret =
    typeof config.JWT_SECRET === 'string' ? config.JWT_SECRET : '';

  if (!ALLOWED_NODE_ENVS.includes(nodeEnv)) {
    errors.push(`NODE_ENV must be one of: ${ALLOWED_NODE_ENVS.join(', ')}`);
  }

  if (jwtSecret.length < 16) {
    errors.push('JWT_SECRET is required and must have at least 16 characters');
  }

  if (
    nodeEnv === 'production' &&
    jwtSecret === 'change-me-to-a-long-random-secret'
  ) {
    errors.push('JWT_SECRET must be changed from the example value in production');
  }

  if (!isValidPort(config.PORT ?? 3000)) {
    errors.push('PORT must be a valid port number');
  }

  const hasDatabaseUrl =
    typeof config.DATABASE_URL === 'string' && config.DATABASE_URL.length > 0;

  if (!hasDatabaseUrl) {
    if (!config.DB_DATABASE) {
      errors.push('DB_DATABASE is required when DATABASE_URL is not set');
    }

    if (!config.DB_USERNAME) {
      errors.push('DB_USERNAME is required when DATABASE_URL is not set');
    }

    if (!isValidPort(config.DB_PORT ?? 3306)) {
      errors.push('DB_PORT must be a valid port number');
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n- ${errors.join('\n- ')}`,
    );
  }

  return config;
}
