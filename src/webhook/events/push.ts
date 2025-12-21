import { logger } from '../../utils/logger';
import { pushWebhookSchema } from '../../types/schemas';
import type { PushWebhookPayload, GitHubCommit } from '../../types';
import { collector } from '../../stats/collector';
import { antiGaming } from '../../stats/antiGaming';
import { getCommitDetails } from '../../github/client';
import { COMMIT_PATTERNS } from '../../config/constants';

/**
 * Push Event Handler
 * 
 * Processes push events to track commits and line changes
 * Applies anti-gaming rules to filter out trivial commits
 */

/**
 * Handle a push webhook event
 */
export async function handlePushEvent(
  payload: unknown,
  processingId: string
): Promise<void> {
  // Validate payload
  const validationResult = pushWebhookSchema.safeParse(payload);
  if (!validationResult.success) {
    logger.warn({ processingId, errors: validationResult.error.errors }, 'Invalid push payload');
    return;
  }

  const event = validationResult.data as PushWebhookPayload;

  // Skip if no installation
  if (!event.installation) {
    logger.debug({ processingId }, 'Push event without installation, skipping');
    return;
  }

  // Skip if no repository (shouldn't happen for push events)
  if (!event.repository) {
    logger.warn({ processingId }, 'Push event without repository, skipping');
    return;
  }

  const installationId = event.installation.id;
  const orgId = event.organization?.id ?? event.repository.owner.id;
  const orgLogin = event.organization?.login ?? event.repository.owner.login;
  const repoId = event.repository.id;
  const repoName = event.repository.name;

  logger.info({
    processingId,
    installationId,
    orgLogin,
    repoName,
    commitsCount: event.commits.length,
  }, 'Processing push event');

  // Skip if pushing to non-default branch (optional, based on config)
  // For now, we'll process all branches

  // Filter and process commits
  const validCommits: Array<{
    commit: GitHubCommit;
    linesAdded: number;
    linesRemoved: number;
  }> = [];

  for (const commit of event.commits) {
    // Skip if commit author doesn't have a GitHub username
    if (!commit.author.username) {
      logger.debug({ processingId, sha: commit.id }, 'Skipping commit without GitHub username');
      continue;
    }

    // Apply anti-gaming filters
    if (!antiGaming.isValidCommit(commit)) {
      logger.debug({ processingId, sha: commit.id }, 'Commit filtered by anti-gaming rules');
      continue;
    }

    // Get detailed commit info for line counts
    const details = await getCommitDetails(
      installationId,
      orgLogin,
      repoName,
      commit.id
    );

    if (!details) {
      logger.warn({ processingId, sha: commit.id }, 'Failed to get commit details');
      continue;
    }

    // Check minimum lines
    const totalLines = details.additions + details.deletions;
    if (!antiGaming.meetsMinimumLines(totalLines)) {
      logger.debug({ processingId, sha: commit.id, totalLines }, 'Commit below minimum lines threshold');
      continue;
    }

    validCommits.push({
      commit,
      linesAdded: details.additions,
      linesRemoved: details.deletions,
    });
  }

  logger.info({
    processingId,
    validCommitsCount: validCommits.length,
    filteredCount: event.commits.length - validCommits.length,
  }, 'Filtered commits');

  // Group commits by author
  const commitsByAuthor = new Map<string, typeof validCommits>();

  for (const item of validCommits) {
    const username = item.commit.author.username!;
    const existing = commitsByAuthor.get(username) ?? [];
    existing.push(item);
    commitsByAuthor.set(username, existing);
  }

  // Record contributions for each author
  for (const [username, commits] of commitsByAuthor.entries()) {
    // Apply daily cap
    const cappedCommits = antiGaming.applyDailyCap(commits);

    const totalLinesAdded = cappedCommits.reduce((sum: number, c) => sum + c.linesAdded, 0);
    const totalLinesRemoved = cappedCommits.reduce((sum: number, c) => sum + c.linesRemoved, 0);

    await collector.recordCommits({
      installationId,
      orgId,
      orgLogin,
      userId: 0, // Will be resolved by collector
      userLogin: username,
      repoId,
      repoName,
      commitCount: cappedCommits.length,
      linesAdded: totalLinesAdded,
      linesRemoved: totalLinesRemoved,
      date: new Date(),
    });

    logger.debug({
      processingId,
      username,
      commitCount: cappedCommits.length,
      linesAdded: totalLinesAdded,
      linesRemoved: totalLinesRemoved,
    }, 'Recorded commits for user');
  }
}

/**
 * Check if a commit message indicates a merge commit
 */
export function isMergeCommit(message: string): boolean {
  return COMMIT_PATTERNS.MERGE.test(message);
}

/**
 * Check if a commit message indicates a revert commit
 */
export function isRevertCommit(message: string): boolean {
  return COMMIT_PATTERNS.REVERT.test(message);
}
