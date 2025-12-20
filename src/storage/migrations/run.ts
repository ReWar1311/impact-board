import { Pool } from 'pg';
import { config } from '../../config/env';
import { logger } from '../../utils/logger';
import { SCHEMA } from '../schema';

/**
 * Database Migration Runner
 * 
 * Runs database migrations to create or update schema
 */

async function runMigrations(): Promise<void> {
  logger.info('Starting database migrations...');

  const pool = new Pool({
    connectionString: config.DATABASE_URL,
  });

  try {
    const client = await pool.connect();

    try {
      // Run the schema creation
      await client.query(SCHEMA);
      logger.info('Database schema created/updated successfully');
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error({ error }, 'Failed to run database migrations');
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('Migrations completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error({ error }, 'Migration failed');
      process.exit(1);
    });
}

export { runMigrations };
