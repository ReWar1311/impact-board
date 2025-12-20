import { config } from './config/env';
import { logger } from './utils/logger';
import { app } from './server';
import { runMigrations } from './storage/migrations/run';
import { repository } from './storage/repository';
import { scheduleReadmeUpdates } from './readme/publisher';

/**
 * Application Entry Point
 * 
 * Bootstraps the GitHub Contribution Motivation App
 */

// Graceful shutdown handler
let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, 'Received shutdown signal, cleaning up...');

  try {
    // Close database connections
    await repository.close();
    logger.info('Database connections closed');
  } catch (error) {
    logger.error({ error }, 'Error during shutdown');
  }

  logger.info('Shutdown complete');
  process.exit(0);
}

// Register shutdown handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught exception');
  shutdown('uncaughtException');
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled promise rejection');
});

async function main(): Promise<void> {
  logger.info('Starting GitHub Contribution Motivation App...');
  logger.info({
    nodeEnv: config.NODE_ENV,
    appId: config.GITHUB_APP_ID,
    webhookPath: '/webhook',
  }, 'Configuration loaded');

  try {
    // Run database migrations
    logger.info('Running database migrations...');
    await runMigrations();
    logger.info('Database migrations completed');

    // Test database connection
    await repository.query('SELECT 1');
    logger.info('Database connection verified');

    // Schedule periodic README updates
    if (config.NODE_ENV !== 'test') {
      scheduleReadmeUpdates();
      logger.info('README update scheduler started');
    }

    // Start HTTP server
    const server = app.listen(config.PORT, () => {
      logger.info({ port: config.PORT }, 'HTTP server started');
      logger.info(`Webhook endpoint: http://localhost:${config.PORT}/webhook`);
      logger.info(`Health check: http://localhost:${config.PORT}/health`);
      logger.info('GitHub Contribution Motivation App is ready!');
    });

    // Configure server timeouts
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.fatal({ port: config.PORT }, 'Port is already in use');
      } else {
        logger.fatal({ error }, 'Server error');
      }
      process.exit(1);
    });

  } catch (error) {
    logger.fatal({ error }, 'Failed to start application');
    process.exit(1);
  }
}

// Start the application
main();
