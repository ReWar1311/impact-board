import dotenv from 'dotenv';
import { envSchema, EnvConfig } from '../types/schemas';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

/**
 * Validated environment configuration
 * Throws an error if required environment variables are missing or invalid
 */
function loadConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    
    logger.fatal(`Environment configuration validation failed:\n${errors}`);
    throw new Error(`Invalid environment configuration:\n${errors}`);
  }

  return result.data;
}

export const config = loadConfig();

/**
 * Decode the base64-encoded private key
 */
export function getPrivateKey(): string {
  try {
    return Buffer.from(config.GITHUB_APP_PRIVATE_KEY, 'base64').toString('utf-8');
  } catch (error) {
    // If not base64 encoded, return as-is (for development)
    return config.GITHUB_APP_PRIVATE_KEY;
  }
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return config.NODE_ENV === 'production';
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return config.NODE_ENV === 'development';
}

/**
 * Check if running in test mode
 */
export function isTest(): boolean {
  return config.NODE_ENV === 'test';
}
