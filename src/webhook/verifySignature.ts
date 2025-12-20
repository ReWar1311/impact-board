import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { HTTP_STATUS } from '../config/constants';

/**
 * Webhook Signature Verification
 * 
 * Verifies that incoming webhooks are genuinely from GitHub
 * using HMAC SHA-256 signature verification
 * 
 * SECURITY: This is a critical security measure - never bypass this
 */

/**
 * Verify the webhook signature using x-hub-signature-256
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string | undefined
): boolean {
  if (!signature) {
    logger.warn('Missing webhook signature header');
    return false;
  }

  // GitHub sends the signature as "sha256=<hash>"
  const signatureParts = signature.split('=');
  if (signatureParts.length !== 2 || signatureParts[0] !== 'sha256') {
    logger.warn('Invalid webhook signature format');
    return false;
  }

  const receivedSignature = signatureParts[1];
  if (!receivedSignature) {
    logger.warn('Empty webhook signature');
    return false;
  }

  // Calculate expected signature
  const expectedSignature = crypto
    .createHmac('sha256', config.GITHUB_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    const receivedBuffer = Buffer.from(receivedSignature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (receivedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
  } catch (error) {
    logger.error({ error }, 'Error during signature verification');
    return false;
  }
}

/**
 * Express middleware for webhook signature verification
 */
export function webhookSignatureMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  const deliveryId = req.headers['x-github-delivery'] as string | undefined;

  // Get raw body for signature verification
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

  if (!rawBody) {
    logger.error({ deliveryId }, 'Missing raw body for signature verification');
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: 'Bad Request',
      message: 'Missing request body',
    });
    return;
  }

  if (!verifyWebhookSignature(rawBody, signature)) {
    logger.warn({ deliveryId }, 'Invalid webhook signature');
    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      error: 'Unauthorized',
      message: 'Invalid webhook signature',
    });
    return;
  }

  logger.debug({ deliveryId }, 'Webhook signature verified');
  next();
}

/**
 * Verify a webhook signature manually (for testing)
 */
export function createTestSignature(payload: string | Buffer): string {
  const signature = crypto
    .createHmac('sha256', config.GITHUB_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return `sha256=${signature}`;
}
