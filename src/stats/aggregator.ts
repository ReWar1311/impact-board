import { logger } from '../utils/logger';
import { repository } from '../storage/repository';
import { getPeriodStartDate, getTodayDate } from '../utils/date';
import { streaks } from './streaks';
import { ranks } from './ranks';
import type { AggregatedStats, StatsPeriod, DailyContribution } from '../types';

/**
 * Stats Aggregator
 * 
 * Aggregates daily contribution data into period-based statistics
 * Handles 7d, 30d, 90d, monthly, and all-time windows
 */

class StatsAggregator {
  /**
   * Update all aggregates for a user after a contribution is recorded
   */
  async updateAggregates(orgId: number, userId: number, userLogin: string): Promise<void> {
    const periods: StatsPeriod[] = ['7d', '30d', '90d', 'monthly', 'all-time'];

    for (const period of periods) {
      try {
        await this.aggregateForPeriod(orgId, userId, userLogin, period);
      } catch (error) {
        logger.error({ error, orgId, userId, period }, 'Failed to update aggregate');
      }
    }

    // Update streak information
    await streaks.updateStreak(orgId, userId, userLogin);
  }

  /**
   * Aggregate stats for a specific period
   */
  async aggregateForPeriod(
    orgId: number,
    userId: number,
    userLogin: string,
    period: StatsPeriod
  ): Promise<AggregatedStats | null> {
    const startDate = getPeriodStartDate(period);
    const endDate = getTodayDate();

    // Get all daily contributions for the period
    const dailyContributions = await repository.contributions.getRange(
      orgId,
      userId,
      startDate,
      endDate
    );

    if (dailyContributions.length === 0) {
      return null;
    }

    // Aggregate the daily stats
    const aggregated = this.aggregateDailyStats(dailyContributions, period, startDate, endDate);
    aggregated.userId = userId;
    aggregated.userLogin = userLogin;
    aggregated.orgId = orgId;

    // Get user avatar URL
    const userInfo = await repository.users.get(userId);
    aggregated.userAvatarUrl = userInfo?.avatarUrl ?? '';

    // Get streak info
    const streakInfo = await repository.streaks.get(orgId, userId);
    if (streakInfo) {
      aggregated.currentStreak = streakInfo.currentStreak;
      aggregated.longestStreak = streakInfo.longestStreak;
    }

    // Calculate rank
    aggregated.rank = ranks.calculateRank(aggregated.weightedScore);

    // Save the aggregate
    await repository.aggregates.upsert(aggregated);

    return aggregated;
  }

  /**
   * Aggregate daily contribution records into summary stats
   */
  private aggregateDailyStats(
    dailyContributions: DailyContribution[],
    period: StatsPeriod,
    startDate: string,
    endDate: string
  ): AggregatedStats {
    const allRepos = new Set<number>();

    let totalCommits = 0;
    let totalLinesAdded = 0;
    let totalLinesRemoved = 0;
    let totalPullRequestsMerged = 0;
    let totalIssuesClosed = 0;
    let totalIssuesOpened = 0;
    let totalRawScore = 0;
    let totalWeightedScore = 0;

    for (const daily of dailyContributions) {
      totalCommits += daily.commits;
      totalLinesAdded += daily.linesAdded;
      totalLinesRemoved += daily.linesRemoved;
      totalPullRequestsMerged += daily.pullRequestsMerged;
      totalIssuesClosed += daily.issuesClosed;
      totalIssuesOpened += daily.issuesOpened;
      totalRawScore += daily.rawScore;
      totalWeightedScore += daily.weightedScore;

      for (const repoId of daily.repositoriesContributed) {
        allRepos.add(repoId);
      }
    }

    return {
      userId: 0,
      userLogin: '',
      userAvatarUrl: '',
      orgId: 0,
      period,
      startDate,
      endDate,
      totalCommits,
      totalLinesAdded,
      totalLinesRemoved,
      totalPullRequestsMerged,
      totalIssuesClosed,
      totalIssuesOpened,
      uniqueRepositories: allRepos.size,
      currentStreak: 0,
      longestStreak: 0,
      rawScore: totalRawScore,
      weightedScore: totalWeightedScore,
      rank: 'Bronze',
      activeDays: dailyContributions.length,
    };
  }

  /**
   * Get aggregated stats for a specific period and org
   */
  async getOrgStats(orgId: number, period: StatsPeriod): Promise<AggregatedStats[]> {
    return repository.aggregates.getByOrg(orgId, period);
  }

  /**
   * Get aggregated stats for a specific user
   */
  async getUserStats(
    orgId: number,
    userId: number,
    period: StatsPeriod
  ): Promise<AggregatedStats | null> {
    return repository.aggregates.get(orgId, userId, period);
  }

  /**
   * Recalculate all aggregates for an organization
   * Used for periodic refresh or after configuration changes
   */
  async recalculateOrgAggregates(orgId: number): Promise<void> {
    logger.info({ orgId }, 'Recalculating all organization aggregates');

    // Get all users who have contributed
    const users = await repository.contributions.getContributors(orgId);

    for (const user of users) {
      await this.updateAggregates(orgId, user.userId, user.userLogin);
    }

    logger.info({ orgId, userCount: users.length }, 'Finished recalculating organization aggregates');
  }

  /**
   * Get the top contributors for an organization
   */
  async getTopContributors(
    orgId: number,
    period: StatsPeriod,
    limit: number
  ): Promise<AggregatedStats[]> {
    const allStats = await repository.aggregates.getByOrg(orgId, period);

    // Sort by weighted score descending
    allStats.sort((a: AggregatedStats, b: AggregatedStats) => b.weightedScore - a.weightedScore);

    return allStats.slice(0, limit);
  }
}

export const aggregator = new StatsAggregator();
