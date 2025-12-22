import { logger } from '../../utils/logger';
import { pullRequestWebhookSchema } from '../../types/schemas';
import type { PullRequestWebhookPayload } from '../../types';
import { collector } from '../../stats/collector';
import { antiGaming } from '../../stats/antiGaming';
import { getPullRequestDetails } from '../../github/client';
import { repository } from '../../storage/repository';

/**
 * Pull Request Event Handler
 * 
 * Processes pull request events to track merged PRs
 * Only counts merged PRs to prevent gaming through opened/closed cycles
 */

/**
 * Handle a pull request webhook event
 */
export async function handlePullRequestEvent(
  payload: unknown,
  processingId: string
): Promise<void> {
  // Validate payload
  const validationResult = pullRequestWebhookSchema.safeParse(payload);
  if (!validationResult.success) {
    logger.warn({ processingId, errors: validationResult.error.errors }, 'Invalid pull_request payload');
    return;
  }

  const event = validationResult.data as PullRequestWebhookPayload;

  // Skip if no installation
  if (!event.installation) {
    logger.debug({ processingId }, 'PR event without installation, skipping');
    return;
  }

  // Only process closed PRs that were merged
  if (event.action !== 'closed') {
    logger.debug({ processingId, action: event.action }, 'Ignoring non-closed PR action');
    return;
  }

  if (!event.pull_request.merged) {
    logger.debug({ processingId, prNumber: event.number }, 'PR was closed without merging, skipping');
    return;
  }

  // Skip if no repository (shouldn't happen)
  if (!event.repository) {
    logger.warn({ processingId }, 'PR event without repository, skipping');
    return;
  }

  const installationId = event.installation.id;
  const orgId = event.organization?.id ?? event.repository.owner.id;
  const orgLogin = event.organization?.login ?? event.repository.owner.login;
  const repoId = event.repository.id;
  const repoName = event.repository.name;
  const pr = event.pull_request;

  logger.info({
    processingId,
    installationId,
    orgLogin,
    repoName,
    prNumber: event.number,
    prAuthor: pr.user.login,
  }, 'Processing merged pull request');

  // Store PR author user info
  await repository.users.upsert({
    userId: pr.user.id,
    login: pr.user.login,
    avatarUrl: pr.user.avatar_url,
    type: pr.user.type,
  });

  // Check if PR author is a bot
  if (antiGaming.isBotUser(pr.user.login, pr.user.type)) {
    logger.debug({ processingId, username: pr.user.login }, 'Skipping PR from bot user');
    return;
  }

  // Get detailed PR info
  const details = await getPullRequestDetails(
    installationId,
    orgLogin,
    repoName,
    event.number
  );

  if (!details) {
    logger.warn({ processingId, prNumber: event.number }, 'Failed to get PR details');
    return;
  }

  // Check minimum changes
  if (!antiGaming.meetsMinimumPrChanges(details.changedFiles)) {
    logger.debug({
      processingId,
      prNumber: event.number,
      changedFiles: details.changedFiles,
    }, 'PR below minimum changes threshold');
    return;
  }

  // Record the merged PR
  await collector.recordPullRequest({
    installationId,
    orgId,
    orgLogin,
    userId: pr.user.id,
    userLogin: pr.user.login,
    repoId,
    repoName,
    prNumber: event.number,
    linesAdded: details.additions,
    linesRemoved: details.deletions,
    changedFiles: details.changedFiles,
    mergedAt: pr.merged_at ? new Date(pr.merged_at) : new Date(),
  });

  logger.info({
    processingId,
    prNumber: event.number,
    prAuthor: pr.user.login,
    additions: details.additions,
    deletions: details.deletions,
  }, 'Recorded merged pull request');
}
