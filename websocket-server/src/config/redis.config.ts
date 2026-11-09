import { parseNonNegativeInt } from "../utils/utils.js";
//in case someone writes in the env something they shouldn't, import the same nonnegativeint funct
export const getRedisConfig = (): { host: string; port: number; db: number; password: string | undefined } => ({
  host: process.env['REDIS_HOST'] || 'localhost',
  port: parseNonNegativeInt(process.env['REDIS_PORT'] , 6379),
  db: parseNonNegativeInt(process.env['REDIS_DB'], 0),
  password: process.env['REDIS_PASSWORD'] || undefined,
});

export const REDIS_NAMESPACE = process.env['REDIS_NAMESPACE'] ? `${process.env['REDIS_NAMESPACE']}:` : '';
