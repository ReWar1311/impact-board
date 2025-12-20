import { logger } from '../../utils/logger';
import { installationWebhookSchema } from '../../types/schemas';
import type { InstallationWebhookPayload, StoredInstallation } from '../../types';
import { DEFAULT_ORG_SETTINGS } from '../../types';
import { repository } from '../../storage/repository';
import { getOrgConfig, getProfileRepository, createProfileRepository } from '../../github/client';
import { invalidateInstallationToken } from '../../github/auth';
import { readmePublisher } from '../../readme/publisher';

/**
 * Installation Event Handler
 * 
 * Handles GitHub App installation and uninstallation events
 * Sets up the organization profile repository and initial configuration
 */

/**
 * Handle an installation webhook event
 */
export async function handleInstallationEvent(
  payload: unknown,
  processingId: string
): Promise<void> {
  // Validate payload
  const validationResult = installationWebhookSchema.safeParse(payload);
  if (!validationResult.success) {
    logger.warn({ processingId, errors: validationResult.error.errors }, 'Invalid installation payload');
    return;
  }

  const event = validationResult.data;
  const installation = event.installation;

  logger.info({
    processingId,
    installationId: installation.id,
    action: event.action,
    accountLogin: installation.account.login,
    accountType: installation.target_type,
  }, 'Processing installation event');

  switch (event.action) {
    case 'created':
      await handleInstallationCreated(event as InstallationWebhookPayload, processingId);
      break;

    case 'deleted':
      await handleInstallationDeleted(event as InstallationWebhookPayload, processingId);
      break;

    case 'suspend':
      await handleInstallationSuspended(event as InstallationWebhookPayload, processingId);
      break;

    case 'unsuspend':
      await handleInstallationUnsuspended(event as InstallationWebhookPayload, processingId);
      break;

    default:
      logger.debug({ processingId, action: event.action }, 'Unhandled installation action');
  }
}

/**
 * Handle new app installation
 */
async function handleInstallationCreated(
  event: InstallationWebhookPayload,
  processingId: string
): Promise<void> {
  const installation = event.installation;
  const accountLogin = installation.account.login;
  const installationId = installation.id;

  logger.info({
    processingId,
    installationId,
    accountLogin,
  }, 'New app installation');

  // Load organization config (if exists)
  const settings = await getOrgConfig(installationId, accountLogin);

  // Store installation
  const storedInstallation: StoredInstallation = {
    installationId: installation.id,
    accountId: installation.account.id,
    accountLogin: accountLogin,
    accountType: installation.target_type,
    createdAt: new Date(installation.created_at),
    updatedAt: new Date(installation.updated_at),
    settings,
    isActive: true,
  };

  await repository.installations.create(storedInstallation);

  // Check if profile repository exists
  const profileRepo = await getProfileRepository(installationId, accountLogin);

  if (!profileRepo) {
    logger.info({ processingId, accountLogin }, 'Profile repository does not exist');

    // Try to create it (requires admin permission)
    const created = await createProfileRepository(installationId, accountLogin);
    
    if (created) {
      logger.info({ processingId, accountLogin }, 'Created profile repository');
    } else {
      logger.warn({ processingId, accountLogin }, 'Failed to create profile repository - may need manual setup');
    }
  }

  // Initialize README with contribution sections
  if (settings.enableReadmeUpdates) {
    try {
      await readmePublisher.initializeReadme(installationId, accountLogin);
      logger.info({ processingId, accountLogin }, 'Initialized profile README');
    } catch (error) {
      logger.warn({ processingId, accountLogin, error }, 'Failed to initialize profile README');
    }
  }

  logger.info({
    processingId,
    installationId,
    accountLogin,
  }, 'Installation setup complete');
}

/**
 * Handle app uninstallation
 */
async function handleInstallationDeleted(
  event: InstallationWebhookPayload,
  processingId: string
): Promise<void> {
  const installation = event.installation;

  logger.info({
    processingId,
    installationId: installation.id,
    accountLogin: installation.account.login,
  }, 'App uninstalled');

  // Mark installation as inactive
  await repository.installations.deactivate(installation.id);

  // Clear cached token
  invalidateInstallationToken(installation.id);

  logger.info({
    processingId,
    installationId: installation.id,
  }, 'Installation deactivated');
}

/**
 * Handle installation suspension
 */
async function handleInstallationSuspended(
  event: InstallationWebhookPayload,
  processingId: string
): Promise<void> {
  const installation = event.installation;

  logger.info({
    processingId,
    installationId: installation.id,
    accountLogin: installation.account.login,
  }, 'App installation suspended');

  // Mark installation as inactive
  await repository.installations.deactivate(installation.id);

  // Clear cached token
  invalidateInstallationToken(installation.id);
}

/**
 * Handle installation unsuspension
 */
async function handleInstallationUnsuspended(
  event: InstallationWebhookPayload,
  processingId: string
): Promise<void> {
  const installation = event.installation;

  logger.info({
    processingId,
    installationId: installation.id,
    accountLogin: installation.account.login,
  }, 'App installation unsuspended');

  // Reload settings
  const settings = await getOrgConfig(installation.id, installation.account.login);

  // Reactivate installation
  await repository.installations.activate(installation.id, settings);

  logger.info({
    processingId,
    installationId: installation.id,
  }, 'Installation reactivated');
}
