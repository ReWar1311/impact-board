import pino from 'pino';

/**
 * Structured logger using Pino
 * Provides consistent logging across the application
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    service: 'org-contribution-motivation',
    version: process.env.npm_package_version ?? '1.0.0',
  },
  formatters: {
    level: (label: string) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Create a child logger with additional context
 */
export function createLogger(context: Record<string, unknown>): pino.Logger {
  return logger.child(context);
}

/**
 * Log an error with stack trace
 */
export function logError(error: Error, context?: Record<string, unknown>): void {
  logger.error({
    err: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
    ...context,
  });
}

/**
 * Log a webhook event
 */
export function logWebhook(
  event: string,
  deliveryId: string,
  action?: string,
  context?: Record<string, unknown>
): void {
  logger.info({
    webhook: {
      event,
      deliveryId,
      action,
    },
    ...context,
  });
}

/**
 * Log a GitHub API call
 */
export function logGitHubApi(
  method: string,
  endpoint: string,
  installationId: number,
  duration: number,
  context?: Record<string, unknown>
): void {
  logger.debug({
    github: {
      method,
      endpoint,
      installationId,
      duration,
    },
    ...context,
  });
}

/**
 * Log a database operation
 */
export function logDatabase(
  operation: string,
  table: string,
  duration: number,
  context?: Record<string, unknown>
): void {
  logger.debug({
    database: {
      operation,
      table,
      duration,
    },
    ...context,
  });
}
