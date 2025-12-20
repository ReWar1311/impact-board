import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { repository } from '../storage/repository';
import { getCurrentMonth, formatMonth } from '../utils/date';
import type { Award, AwardType, AggregatedStats, StreakInfo } from '../types';
import { AWARD_DEFINITIONS } from '../types';

/**
 * Awards Generator
 * 
 * Generates monthly awards for top contributors
 * Awards are calculated at the end of each month or on demand
 */

class AwardsGenerator {
  /**
   * Generate all awards for a month
   */
  async generateMonthlyAwards(orgId: number, month?: string): Promise<Award[]> {
    const targetMonth = month ?? getCurrentMonth();
    
    logger.info({ orgId, month: targetMonth }, 'Generating monthly awards');
    
    const awards: Award[] = [];
    
    // Get aggregated stats for the month
    const stats = await repository.aggregates.getByOrg(orgId, 'monthly');
    
    if (stats.length === 0) {
      logger.info({ orgId, month: targetMonth }, 'No stats found for month, skipping awards');
      return [];
    }
    
    // Get streak information
    const allStreaks = await repository.streaks.getByOrg(orgId);
    const streakMap = new Map(allStreaks.map((s: StreakInfo) => [s.userId, s]));
    
    // Top Contributor
    const topContributor = this.findTopContributor(stats);
    if (topContributor) {
      awards.push(this.createAward(orgId, topContributor, 'top-contributor', targetMonth, {
        score: topContributor.weightedScore,
      }));
    }
    
    // Rising Star (biggest improvement)
    const risingStar = await this.findRisingStar(orgId, stats);
    if (risingStar) {
      awards.push(this.createAward(orgId, risingStar.stats, 'rising-star', targetMonth, {
        improvement: risingStar.improvement,
      }));
    }
    
    // Consistency Champion (longest streak)
    const streakChampion = this.findStreakChampion(allStreaks);
    if (streakChampion) {
      const userStats = stats.find((s: AggregatedStats) => s.userId === streakChampion.userId);
      if (userStats) {
        awards.push(this.createAward(orgId, userStats, 'consistency-champion', targetMonth, {
          streak: streakChampion.currentStreak,
        }));
      }
    }
    
    // PR Master
    const prMaster = this.findPrMaster(stats);
    if (prMaster) {
      awards.push(this.createAward(orgId, prMaster, 'pr-master', targetMonth, {
        pullRequests: prMaster.totalPullRequestsMerged,
      }));
    }
    
    // Issue Resolver
    const issueResolver = this.findIssueResolver(stats);
    if (issueResolver) {
      awards.push(this.createAward(orgId, issueResolver, 'issue-resolver', targetMonth, {
        issuesClosed: issueResolver.totalIssuesClosed,
      }));
    }
    
    // First Contributions
    const firstContributors = await this.findFirstContributors(orgId, targetMonth);
    for (const contributor of firstContributors) {
      const userStats = stats.find((s: AggregatedStats) => s.userId === contributor.userId);
      if (userStats) {
        awards.push(this.createAward(orgId, userStats, 'first-contribution', targetMonth));
      }
    }
    
    // Streak Holders (30+ day streak)
    const streakHolders = allStreaks.filter((s: StreakInfo) => s.currentStreak >= 30);
    for (const holder of streakHolders) {
      const userStats = stats.find((s: AggregatedStats) => s.userId === holder.userId);
      if (userStats) {
        awards.push(this.createAward(orgId, userStats, 'streak-holder', targetMonth, {
          streak: holder.currentStreak,
        }));
      }
    }
    
    // Save awards
    for (const award of awards) {
      await repository.awards.upsert(award);
    }
    
    logger.info({ orgId, month: targetMonth, awardCount: awards.length }, 'Generated monthly awards');
    
    return awards;
  }
  
  /**
   * Get awards for a specific month
   */
  async getMonthlyAwards(orgId: number, month?: string): Promise<Award[]> {
    const targetMonth = month ?? getCurrentMonth();
    return repository.awards.getByMonth(orgId, targetMonth);
  }
  
  /**
   * Get all awards for a user
   */
  async getUserAwards(orgId: number, userId: number): Promise<Award[]> {
    return repository.awards.getByUser(orgId, userId);
  }
  
  /**
   * Find the top contributor by weighted score
   */
  private findTopContributor(stats: AggregatedStats[]): AggregatedStats | null {
    if (stats.length === 0) return null;
    
    return stats.reduce((best, current) => {
      return current.weightedScore > best.weightedScore ? current : best;
    });
  }
  
  /**
   * Find the rising star (biggest improvement from last month)
   */
  private async findRisingStar(
    orgId: number,
    currentStats: AggregatedStats[]
  ): Promise<{ stats: AggregatedStats; improvement: number } | null> {
    const lastMonth = this.getLastMonth();
    const lastMonthStats = await repository.aggregates.getByOrgAndMonth(orgId, lastMonth);
    
    if (lastMonthStats.length === 0) return null;
    
    const lastMonthMap = new Map(lastMonthStats.map((s: AggregatedStats) => [s.userId, s]));
    
    let bestImprovement = 0;
    let risingStar: AggregatedStats | null = null;
    
    for (const current of currentStats) {
      const previous = lastMonthMap.get(current.userId);
      const previousScore = previous?.weightedScore ?? 0;
      const improvement = current.weightedScore - previousScore;
      
      // Must have improvement and be a meaningful contributor
      if (improvement > bestImprovement && current.weightedScore >= 50) {
        bestImprovement = improvement;
        risingStar = current;
      }
    }
    
    if (risingStar) {
      return { stats: risingStar, improvement: bestImprovement };
    }
    
    return null;
  }
  
  /**
   * Find the consistency champion (longest current streak)
   */
  private findStreakChampion(streaks: StreakInfo[]): StreakInfo | null {
    if (streaks.length === 0) return null;
    
    return streaks.reduce((best, current) => {
      return current.currentStreak > best.currentStreak ? current : best;
    });
  }
  
  /**
   * Find the PR master (most merged PRs)
   */
  private findPrMaster(stats: AggregatedStats[]): AggregatedStats | null {
    if (stats.length === 0) return null;
    
    const sorted = [...stats].sort((a, b) => b.totalPullRequestsMerged - a.totalPullRequestsMerged);
    const top = sorted[0];
    
    // Must have at least 1 PR
    return top && top.totalPullRequestsMerged > 0 ? top : null;
  }
  
  /**
   * Find the issue resolver (most issues closed)
   */
  private findIssueResolver(stats: AggregatedStats[]): AggregatedStats | null {
    if (stats.length === 0) return null;
    
    const sorted = [...stats].sort((a, b) => b.totalIssuesClosed - a.totalIssuesClosed);
    const top = sorted[0];
    
    // Must have at least 1 issue closed
    return top && top.totalIssuesClosed > 0 ? top : null;
  }
  
  /**
   * Find users who made their first contribution this month
   */
  private async findFirstContributors(
    orgId: number,
    month: string
  ): Promise<Array<{ userId: number; userLogin: string }>> {
    return repository.contributions.getFirstContributors(orgId, month);
  }
  
  /**
   * Create an award object
   */
  private createAward(
    orgId: number,
    stats: AggregatedStats,
    type: AwardType,
    month: string,
    metadata?: Record<string, unknown>
  ): Award {
    const definition = AWARD_DEFINITIONS[type];
    
    return {
      id: uuidv4(),
      orgId,
      userId: stats.userId,
      userLogin: stats.userLogin,
      type,
      title: definition.title,
      description: definition.description,
      month,
      awardedAt: new Date(),
      metadata,
    };
  }
  
  /**
   * Get last month in YYYY-MM format
   */
  private getLastMonth(): string {
    const now = new Date();
    now.setMonth(now.getMonth() - 1);
    return formatMonth(now);
  }
}

export const awards = new AwardsGenerator();
