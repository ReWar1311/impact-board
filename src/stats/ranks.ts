import type { ContributorRank, RankThresholds } from '../types';
import { DEFAULT_RANK_THRESHOLDS, RANK_THRESHOLDS } from '../config/constants';

/**
 * Rank Calculator
 * 
 * Calculates contributor ranks based on weighted scores
 * Ranks: Bronze -> Silver -> Gold -> Diamond
 */

class RankCalculator {
  private thresholds: RankThresholds;

  constructor(thresholds?: Partial<RankThresholds>) {
    this.thresholds = {
      ...DEFAULT_RANK_THRESHOLDS,
      ...thresholds,
    };
  }

  /**
   * Calculate rank based on weighted score
   */
  calculateRank(weightedScore: number): ContributorRank {
    if (weightedScore >= this.thresholds.diamond) {
      return 'Diamond';
    }
    if (weightedScore >= this.thresholds.gold) {
      return 'Gold';
    }
    if (weightedScore >= this.thresholds.silver) {
      return 'Silver';
    }
    return 'Bronze';
  }

  /**
   * Get the score required for the next rank
   */
  getNextRankThreshold(currentRank: ContributorRank): number | null {
    switch (currentRank) {
      case 'Bronze':
        return this.thresholds.silver;
      case 'Silver':
        return this.thresholds.gold;
      case 'Gold':
        return this.thresholds.diamond;
      case 'Diamond':
        return null; // Already at max rank
    }
  }

  /**
   * Get progress percentage to next rank
   */
  getProgressToNextRank(weightedScore: number, currentRank: ContributorRank): number {
    const nextThreshold = this.getNextRankThreshold(currentRank);
    if (nextThreshold === null) {
      return 100; // Already at max rank
    }

    const currentThreshold = this.getCurrentRankThreshold(currentRank);
    const range = nextThreshold - currentThreshold;
    const progress = weightedScore - currentThreshold;

    return Math.min(100, Math.max(0, (progress / range) * 100));
  }

  /**
   * Get the threshold for the current rank
   */
  getCurrentRankThreshold(rank: ContributorRank): number {
    switch (rank) {
      case 'Bronze':
        return this.thresholds.bronze;
      case 'Silver':
        return this.thresholds.silver;
      case 'Gold':
        return this.thresholds.gold;
      case 'Diamond':
        return this.thresholds.diamond;
    }
  }

  /**
   * Get rank color for display
   */
  getRankColor(rank: ContributorRank): string {
    switch (rank) {
      case 'Bronze':
        return '#cd7f32';
      case 'Silver':
        return '#c0c0c0';
      case 'Gold':
        return '#ffd700';
      case 'Diamond':
        return '#b9f2ff';
    }
  }

  /**
   * Get rank emoji for display
   */
  getRankEmoji(rank: ContributorRank): string {
    switch (rank) {
      case 'Bronze':
        return '🥉';
      case 'Silver':
        return '🥈';
      case 'Gold':
        return '🥇';
      case 'Diamond':
        return '💎';
    }
  }

  /**
   * Get rank description
   */
  getRankDescription(rank: ContributorRank): string {
    switch (rank) {
      case 'Bronze':
        return 'Starting contributor';
      case 'Silver':
        return 'Active contributor';
      case 'Gold':
        return 'Top contributor';
      case 'Diamond':
        return 'Elite contributor';
    }
  }

  /**
   * Update thresholds from org settings
   */
  updateThresholds(thresholds: Partial<RankThresholds>): void {
    this.thresholds = {
      ...this.thresholds,
      ...thresholds,
    };
  }

  /**
   * Get all thresholds
   */
  getThresholds(): RankThresholds {
    return { ...this.thresholds };
  }
}

export const ranks = new RankCalculator({
  bronze: RANK_THRESHOLDS.BRONZE,
  silver: RANK_THRESHOLDS.SILVER,
  gold: RANK_THRESHOLDS.GOLD,
  diamond: RANK_THRESHOLDS.DIAMOND,
});

// Standalone exports for convenience
export const calculateRank = (weightedScore: number): ContributorRank => 
  ranks.calculateRank(weightedScore);

export const getRankColor = (rank: ContributorRank): string => 
  ranks.getRankColor(rank);

export const getRankEmoji = (rank: ContributorRank): string => 
  ranks.getRankEmoji(rank);

/**
 * Get contributor ranks for an organization
 * Returns ranked list of contributors with their stats
 */
export async function getContributorRanks(
  installationId: number,
  period: string,
  limit: number
): Promise<Array<{
  username: string;
  avatarUrl: string;
  rank: ContributorRank;
  score: number;
  position: number;
}>> {
  // Dynamic import to avoid circular dependency
  const { repository } = await import('../storage/repository');
  
  const stats = await repository.aggregates.getByOrg(installationId, period as import('../types').StatsPeriod);
  
  // Sort by weighted score
  const sorted = stats
    .sort((a, b) => b.weightedScore - a.weightedScore)
    .slice(0, limit);

  // Get user info for each stat
  const results = await Promise.all(
    sorted.map(async (stat, index) => {
      const user = await repository.users.getById(installationId, stat.userId);
      return {
        username: user?.login ?? `User ${stat.userId}`,
        avatarUrl: user?.avatarUrl ?? '',
        rank: ranks.calculateRank(stat.weightedScore),
        score: stat.weightedScore,
        position: index + 1,
      };
    })
  );

  return results;
}
