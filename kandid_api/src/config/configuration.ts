export interface AppConfiguration {
  app: {
    nodeEnv: string;
    port: number;
  };
  database: {
    url?: string;
    host: string;
    port: number;
    username: string;
    password: string;
    name: string;
    ssl: boolean;
    logging: boolean;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  http: {
    corsOrigin: string;
  };
}

const toBoolean = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined || value === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
};

export default (): AppConfiguration => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: toNumber(process.env.PORT, 3000),
  },
  database: {
    url: process.env.DATABASE_URL || undefined,
    host: process.env.DB_HOST ?? 'localhost',
    port: toNumber(process.env.DB_PORT, 3306),
    username: process.env.DB_USERNAME ?? 'kandid',
    password: process.env.DB_PASSWORD ?? 'kandid',
    name: process.env.DB_DATABASE ?? 'kandid',
    ssl: toBoolean(process.env.DB_SSL),
    logging: toBoolean(process.env.DB_LOGGING),
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  },
  http: {
    corsOrigin: process.env.CORS_ORIGIN ?? '*',
  },
});
