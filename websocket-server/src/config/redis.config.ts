
export const getRedisConfig = (): { host: string; port: number; db: number; password: string | undefined } => ({
  host: process.env['REDIS_HOST'] || 'localhost',
  port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
  db: parseInt(process.env['REDIS_DB'] || '0', 10),
  password: process.env['REDIS_PASSWORD'] || undefined,
});

export const REDIS_NAMESPACE = process.env['REDIS_NAMESPACE'] ? `${process.env['REDIS_NAMESPACE']}:` : '';
