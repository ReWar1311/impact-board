import { logger } from '../../utils/logger';
import { issuesWebhookSchema } from '../../types/schemas';
import type { IssuesWebhookPayload } from '../../types';
import { collector } from '../../stats/collector';
import { antiGaming } from '../../stats/antiGaming';

/**
 * Issues Event Handler
 * 
 * Processes issue events to track opened and closed issues
 * Credits the issue closer, not the opener, for closed issues
 */

/**
 * Handle an issues webhook event
 */
export async function handleIssuesEvent(
  payload: unknown,
  processingId: string
): Promise<void> {
  // Validate payload
  const validationResult = issuesWebhookSchema.safeParse(payload);
  if (!validationResult.success) {
    logger.warn({ processingId, errors: validationResult.error.errors }, 'Invalid issues payload');
    return;
  }

  const event = validationResult.data as IssuesWebhookPayload;

  // Skip if no installation
  if (!event.installation) {
    logger.debug({ processingId }, 'Issue event without installation, skipping');
    return;
  }

  // Only process opened and closed actions
  if (event.action !== 'opened' && event.action !== 'closed') {
    logger.debug({ processingId, action: event.action }, 'Ignoring non-relevant issue action');
    return;
  }

  // Skip if no repository (shouldn't happen)
  if (!event.repository) {
    logger.warn({ processingId }, 'Issues event without repository, skipping');
    return;
  }

  const installationId = event.installation.id;
  const orgId = event.organization?.id ?? event.repository.owner.id;
  const orgLogin = event.organization?.login ?? event.repository.owner.login;
  const repoId = event.repository.id;
  const repoName = event.repository.name;
  const issue = event.issue;

  logger.info({
    processingId,
    installationId,
    orgLogin,
    repoName,
    issueNumber: issue.number,
    action: event.action,
  }, 'Processing issue event');

  if (event.action === 'opened') {
    // Check if issue author is a bot
    if (antiGaming.isBotUser(issue.user.login, issue.user.type)) {
      logger.debug({ processingId, username: issue.user.login }, 'Skipping issue from bot user');
      return;
    }

    // Record the opened issue
    await collector.recordIssueOpened({
      installationId,
      orgId,
      orgLogin,
      userId: issue.user.id,
      userLogin: issue.user.login,
      repoId,
      repoName,
      issueNumber: issue.number,
      openedAt: new Date(),
    });

    logger.info({
      processingId,
      issueNumber: issue.number,
      issueAuthor: issue.user.login,
    }, 'Recorded opened issue');

  } else if (event.action === 'closed') {
    // Determine who closed the issue
    // Priority: closed_by > sender (if they have permission)
    const closer = issue.closed_by ?? event.sender;

    // Check if closer is a bot
    if (antiGaming.isBotUser(closer.login, closer.type)) {
      logger.debug({ processingId, username: closer.login }, 'Skipping issue closed by bot');
      return;
    }

    // Don't credit the issue author if they closed their own issue
    // (unless they're also a contributor who resolved it)
    // For now, we'll credit whoever closed it

    // Record the closed issue
    await collector.recordIssueClosed({
      installationId,
      orgId,
      orgLogin,
      userId: closer.id,
      userLogin: closer.login,
      repoId,
      repoName,
      issueNumber: issue.number,
      closedAt: issue.closed_at ? new Date(issue.closed_at) : new Date(),
    });

    logger.info({
      processingId,
      issueNumber: issue.number,
      closedBy: closer.login,
    }, 'Recorded closed issue');
  }
}
