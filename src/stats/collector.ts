import { logger } from '../utils/logger';
import { repository } from '../storage/repository';
import { formatDate } from '../utils/date';
import { getUser } from '../github/client';
import type { DailyContribution } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { aggregator } from './aggregator';

/**
 * Stats Collector
 * 
 * Collects contribution data from webhook events and stores it
 * Provides the interface for recording different types of contributions
 */

interface CommitContribution {
  installationId: number;
  orgId: number;
  orgLogin: string;
  userId: number;
  userLogin: string;
  repoId: number;
  repoName: string;
  commitCount: number;
  linesAdded: number;
  linesRemoved: number;
  date: Date;
}

interface PullRequestContribution {
  installationId: number;
  orgId: number;
  orgLogin: string;
  userId: number;
  userLogin: string;
  repoId: number;
  repoName: string;
  prNumber: number;
  linesAdded: number;
  linesRemoved: number;
  changedFiles: number;
  mergedAt: Date;
}

interface IssueOpenedContribution {
  installationId: number;
  orgId: number;
  orgLogin: string;
  userId: number;
  userLogin: string;
  repoId: number;
  repoName: string;
  issueNumber: number;
  openedAt: Date;
}

interface IssueClosedContribution {
  installationId: number;
  orgId: number;
  orgLogin: string;
  userId: number;
  userLogin: string;
  repoId: number;
  repoName: string;
  issueNumber: number;
  closedAt: Date;
}

class StatsCollector {
  /**
   * Record commits from a push event
   */
  async recordCommits(contribution: CommitContribution): Promise<void> {
    const dateStr = formatDate(contribution.date);

    // Resolve user ID if not provided
    let userId = contribution.userId;
    if (userId === 0) {
      const user = await getUser(contribution.installationId, contribution.userLogin);
      if (user) {
        userId = user.id;
        // Save user to database
        await repository.users.upsert({
          userId: user.id,
          login: user.login,
          avatarUrl: user.avatar_url,
          type: user.type,
        });
      } else {
        logger.warn({ userLogin: contribution.userLogin }, 'Could not resolve user ID');
        return;
      }
    }

    // Get or create daily contribution record
    let daily = await repository.contributions.getDaily(
      contribution.orgId,
      userId,
      dateStr
    );

    if (!daily) {
      daily = this.createEmptyDaily(contribution.orgId, userId, contribution.userLogin, dateStr);
    }

    // Update contribution counts
    daily.commits += contribution.commitCount;
    daily.linesAdded += contribution.linesAdded;
    daily.linesRemoved += contribution.linesRemoved;
    daily.repositoriesContributed.add(contribution.repoId);
    daily.updatedAt = new Date();

    // Recalculate scores
    this.calculateScores(daily);

    // Save
    await repository.contributions.upsertDaily(daily);

    // Trigger aggregation update
    await aggregator.updateAggregates(contribution.orgId, userId, contribution.userLogin);

    logger.debug({
      orgId: contribution.orgId,
      userId,
      date: dateStr,
      commits: daily.commits,
    }, 'Updated daily commit stats');
  }

  /**
   * Record a merged pull request
   */
  async recordPullRequest(contribution: PullRequestContribution): Promise<void> {
    const dateStr = formatDate(contribution.mergedAt);

    // Get or create daily contribution record
    let daily = await repository.contributions.getDaily(
      contribution.orgId,
      contribution.userId,
      dateStr
    );

    if (!daily) {
      daily = this.createEmptyDaily(
        contribution.orgId,
        contribution.userId,
        contribution.userLogin,
        dateStr
      );
    }

    // Update contribution counts
    daily.pullRequestsMerged += 1;
    daily.linesAdded += contribution.linesAdded;
    daily.linesRemoved += contribution.linesRemoved;
    daily.repositoriesContributed.add(contribution.repoId);
    daily.updatedAt = new Date();

    // Recalculate scores
    this.calculateScores(daily);

    // Save
    await repository.contributions.upsertDaily(daily);

    // Trigger aggregation update
    await aggregator.updateAggregates(contribution.orgId, contribution.userId, contribution.userLogin);

    logger.debug({
      orgId: contribution.orgId,
      userId: contribution.userId,
      date: dateStr,
      pullRequestsMerged: daily.pullRequestsMerged,
    }, 'Updated daily PR stats');
  }

  /**
   * Record an opened issue
   */
  async recordIssueOpened(contribution: IssueOpenedContribution): Promise<void> {
    const dateStr = formatDate(contribution.openedAt);

    // Get or create daily contribution record
    let daily = await repository.contributions.getDaily(
      contribution.orgId,
      contribution.userId,
      dateStr
    );

    if (!daily) {
      daily = this.createEmptyDaily(
        contribution.orgId,
        contribution.userId,
        contribution.userLogin,
        dateStr
      );
    }

    // Update contribution counts
    daily.issuesOpened += 1;
    daily.repositoriesContributed.add(contribution.repoId);
    daily.updatedAt = new Date();

    // Recalculate scores
    this.calculateScores(daily);

    // Save
    await repository.contributions.upsertDaily(daily);

    // Trigger aggregation update
    await aggregator.updateAggregates(contribution.orgId, contribution.userId, contribution.userLogin);

    logger.debug({
      orgId: contribution.orgId,
      userId: contribution.userId,
      date: dateStr,
      issuesOpened: daily.issuesOpened,
    }, 'Updated daily issue opened stats');
  }

  /**
   * Record a closed issue
   */
  async recordIssueClosed(contribution: IssueClosedContribution): Promise<void> {
    const dateStr = formatDate(contribution.closedAt);

    // Get or create daily contribution record
    let daily = await repository.contributions.getDaily(
      contribution.orgId,
      contribution.userId,
      dateStr
    );

    if (!daily) {
      daily = this.createEmptyDaily(
        contribution.orgId,
        contribution.userId,
        contribution.userLogin,
        dateStr
      );
    }

    // Update contribution counts
    daily.issuesClosed += 1;
    daily.repositoriesContributed.add(contribution.repoId);
    daily.updatedAt = new Date();

    // Recalculate scores
    this.calculateScores(daily);

    // Save
    await repository.contributions.upsertDaily(daily);

    // Trigger aggregation update
    await aggregator.updateAggregates(contribution.orgId, contribution.userId, contribution.userLogin);

    logger.debug({
      orgId: contribution.orgId,
      userId: contribution.userId,
      date: dateStr,
      issuesClosed: daily.issuesClosed,
    }, 'Updated daily issue closed stats');
  }

  /**
   * Create an empty daily contribution record
   */
  private createEmptyDaily(
    orgId: number,
    userId: number,
    userLogin: string,
    date: string
  ): DailyContribution {
    return {
      id: uuidv4(),
      orgId,
      userId,
      userLogin,
      date,
      commits: 0,
      linesAdded: 0,
      linesRemoved: 0,
      pullRequestsMerged: 0,
      issuesClosed: 0,
      issuesOpened: 0,
      repositoriesContributed: new Set(),
      rawScore: 0,
      weightedScore: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Calculate raw and weighted scores for a daily contribution
   */
  private calculateScores(daily: DailyContribution): void {
    const { SCORING } = require('../config/constants');

    // Raw score: simple sum of activities
    daily.rawScore =
      daily.commits * SCORING.COMMIT_WEIGHT +
      daily.pullRequestsMerged * SCORING.PR_MERGED_WEIGHT +
      daily.issuesClosed * SCORING.ISSUE_CLOSED_WEIGHT +
      daily.issuesOpened * SCORING.ISSUE_OPENED_WEIGHT;

    // Weighted score: includes line counts with caps
    const cappedLinesAdded = Math.min(daily.linesAdded, SCORING.MAX_LINES_PER_COMMIT * daily.commits);
    const cappedLinesRemoved = Math.min(daily.linesRemoved, SCORING.MAX_LINES_PER_COMMIT * daily.commits);

    daily.weightedScore =
      daily.rawScore +
      cappedLinesAdded * SCORING.LINE_ADDED_WEIGHT +
      cappedLinesRemoved * SCORING.LINE_REMOVED_WEIGHT;
  }
}

export const collector = new StatsCollector();
