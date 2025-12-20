import { createAppAuth } from '@octokit/auth-app';
import { config, getPrivateKey } from '../config/env';
import { logger } from '../utils/logger';

/**
 * GitHub App JWT Authentication Module
 * 
 * This module handles:
 * 1. JWT generation for app-level authentication
 * 2. Installation access token generation for org-level operations
 * 
 * SECURITY: Never uses Personal Access Tokens (PATs)
 */

// Cache for installation tokens
const tokenCache = new Map<number, { token: string; expiresAt: Date }>();

/**
 * Create an App auth instance
 */
function createAuth() {
  return createAppAuth({
    appId: config.GITHUB_APP_ID,
    privateKey: getPrivateKey(),
  });
}

/**
 * Get a JWT for app-level authentication
 * JWTs are valid for 10 minutes
 */
export async function getAppJwt(): Promise<string> {
  const auth = createAuth();
  const { token } = await auth({ type: 'app' });
  return token;
}

/**
 * Get an installation access token for a specific installation
 * Tokens are valid for 60 minutes, cached for 55 minutes
 */
export async function getInstallationToken(installationId: number): Promise<string> {
  // Check cache first
  const cached = tokenCache.get(installationId);
  if (cached && cached.expiresAt > new Date()) {
    logger.debug({ installationId }, 'Using cached installation token');
    return cached.token;
  }

  logger.debug({ installationId }, 'Generating new installation token');

  const auth = createAuth();
  const { token, expiresAt } = await auth({
    type: 'installation',
    installationId,
  });

  // Cache the token with 5-minute buffer before expiry
  const expiry = new Date(expiresAt);
  expiry.setMinutes(expiry.getMinutes() - 5);

  tokenCache.set(installationId, {
    token,
    expiresAt: expiry,
  });

  return token;
}

/**
 * Invalidate a cached installation token
 */
export function invalidateInstallationToken(installationId: number): void {
  tokenCache.delete(installationId);
  logger.debug({ installationId }, 'Invalidated installation token cache');
}

/**
 * Clear all cached tokens
 */
export function clearTokenCache(): void {
  tokenCache.clear();
  logger.debug('Cleared all cached tokens');
}

/**
 * Get the number of cached tokens (for monitoring)
 */
export function getCachedTokenCount(): number {
  return tokenCache.size;
}

/**
 * Cleanup expired tokens from cache
 */
export function cleanupExpiredTokens(): void {
  const now = new Date();
  let cleanedCount = 0;

  for (const [installationId, { expiresAt }] of tokenCache.entries()) {
    if (expiresAt <= now) {
      tokenCache.delete(installationId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    logger.debug({ cleanedCount }, 'Cleaned up expired tokens');
  }
}

// Periodically cleanup expired tokens
setInterval(cleanupExpiredTokens, 5 * 60 * 1000); // Every 5 minutes
