import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataSource, type DataSourceOptions } from 'typeorm';

loadEnv({ path: ['.env.local', '.env'] });

const currentFile = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFile);
const isTypeScript = currentFile.endsWith('.ts');
const toPosix = (value: string): string => value.replaceAll('\\', '/');

const databaseUrl = process.env.DATABASE_URL;
const ssl =
  ['1', 'true', 'yes', 'on'].includes(
    (process.env.DB_SSL ?? '').toLowerCase(),
  )
    ? { rejectUnauthorized: true }
    : undefined;

const options: DataSourceOptions = {
  type: 'mysql',
  ...(databaseUrl
    ? { url: databaseUrl }
    : {
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 3306),
        username: process.env.DB_USERNAME ?? 'kandid',
        password: process.env.DB_PASSWORD ?? 'kandid',
        database: process.env.DB_DATABASE ?? 'kandid',
      }),
  ssl,
  entities: [toPosix(join(currentDir, '..', '**', '*.entity.{ts,js}'))],
  migrations: [
    toPosix(
      join(currentDir, 'migrations', `*.${isTypeScript ? 'ts' : 'js'}`),
    ),
  ],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
  timezone: 'Z',
};

const AppDataSource = new DataSource(options);

export default AppDataSource;
