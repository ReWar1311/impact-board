import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger, logWebhook } from '../utils/logger';
import { HTTP_STATUS, SUPPORTED_WEBHOOK_EVENTS } from '../config/constants';
import { handlePushEvent } from './events/push';
import { handlePullRequestEvent } from './events/pullRequest';
import { handleIssuesEvent } from './events/issues';
import { handleInstallationEvent } from './events/installation';
import { repository } from '../storage/repository';

/**
 * Main Webhook Handler
 * 
 * Routes incoming webhook events to their appropriate handlers
 * Ensures idempotency by tracking processed events
 */

// Track processed events to ensure idempotency
const processedEvents = new Map<string, Date>();
const IDEMPOTENCY_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Clean up old entries from the idempotency cache
 */
function cleanupIdempotencyCache(): void {
  const now = new Date();
  const cutoff = new Date(now.getTime() - IDEMPOTENCY_WINDOW_MS);

  for (const [key, timestamp] of processedEvents.entries()) {
    if (timestamp < cutoff) {
      processedEvents.delete(key);
    }
  }
}

// Cleanup every 5 minutes
setInterval(cleanupIdempotencyCache, 5 * 60 * 1000);

/**
 * Generate idempotency key from webhook headers
 */
function getIdempotencyKey(deliveryId: string, event: string): string {
  return `${event}:${deliveryId}`;
}

/**
 * Check if an event has already been processed
 */
function isEventProcessed(deliveryId: string, event: string): boolean {
  const key = getIdempotencyKey(deliveryId, event);
  return processedEvents.has(key);
}

/**
 * Mark an event as processed
 */
function markEventProcessed(deliveryId: string, event: string): void {
  const key = getIdempotencyKey(deliveryId, event);
  processedEvents.set(key, new Date());
}

/**
 * Main webhook handler function
 */
export async function handleWebhook(req: Request, res: Response): Promise<void> {
  const eventType = req.headers['x-github-event'] as string;
  const deliveryId = req.headers['x-github-delivery'] as string;
  const action = req.body?.action as string | undefined;

  // Log incoming webhook
  logWebhook(eventType, deliveryId, action, {
    installationId: req.body?.installation?.id,
    orgLogin: req.body?.organization?.login ?? req.body?.repository?.owner?.login,
  });

  // Check if this is a supported event type
  if (!SUPPORTED_WEBHOOK_EVENTS.includes(eventType as typeof SUPPORTED_WEBHOOK_EVENTS[number])) {
    logger.debug({ eventType, deliveryId }, 'Ignoring unsupported event type');
    res.status(HTTP_STATUS.OK).json({ message: 'Event type not supported' });
    return;
  }

  // Check idempotency
  if (isEventProcessed(deliveryId, eventType)) {
    logger.debug({ eventType, deliveryId }, 'Event already processed (idempotency check)');
    res.status(HTTP_STATUS.OK).json({ message: 'Event already processed' });
    return;
  }

  // Generate processing ID for tracking
  const processingId = uuidv4();

  try {
    // Route to appropriate handler
    switch (eventType) {
      case 'push':
        await handlePushEvent(req.body, processingId);
        break;

      case 'pull_request':
        await handlePullRequestEvent(req.body, processingId);
        break;

      case 'issues':
        await handleIssuesEvent(req.body, processingId);
        break;

      case 'installation':
      case 'installation_repositories':
        await handleInstallationEvent(req.body, processingId);
        break;

      default:
        logger.debug({ eventType, deliveryId }, 'Unhandled event type');
    }

    // Mark event as processed
    markEventProcessed(deliveryId, eventType);

    // Record successful processing
    await repository.processedEvents.record({
      id: processingId,
      eventType,
      deliveryId,
      installationId: req.body?.installation?.id ?? 0,
      orgId: req.body?.organization?.id ?? req.body?.repository?.owner?.id ?? 0,
      processedAt: new Date(),
      success: true,
    });

    res.status(HTTP_STATUS.OK).json({
      message: 'Event processed successfully',
      processingId,
    });
  } catch (error) {
    logger.error({ error, eventType, deliveryId, processingId }, 'Error processing webhook');

    // Record failed processing
    await repository.processedEvents.record({
      id: processingId,
      eventType,
      deliveryId,
      installationId: req.body?.installation?.id ?? 0,
      orgId: req.body?.organization?.id ?? req.body?.repository?.owner?.id ?? 0,
      processedAt: new Date(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Internal Server Error',
      message: 'Failed to process webhook',
      processingId,
    });
  }
}

/**
 * Health check for webhook endpoint
 */
export function webhookHealthCheck(_req: Request, res: Response): void {
  res.status(HTTP_STATUS.OK).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
}
