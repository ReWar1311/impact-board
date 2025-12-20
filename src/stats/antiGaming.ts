import type { GitHubCommit } from '../types';
import { COMMIT_PATTERNS, SCORING } from '../config/constants';

/**
 * Anti-Gaming Module
 * 
 * Implements safeguards against contribution gaming
 * Ensures fair and accurate contribution tracking
 */

class AntiGaming {
  private config = {
    minLinesForCommit: SCORING.MIN_LINES_FOR_COMMIT,
    maxDailyCommitsScored: SCORING.MAX_DAILY_COMMITS_SCORED,
    maxLinesPerCommit: SCORING.MAX_LINES_PER_COMMIT,
    minPrChangesForScore: SCORING.MIN_PR_CHANGES_FOR_SCORE,
    ignoreBotUsers: true,
    ignoreMergeCommits: true,
    ignoreRevertCommits: true,
  };

  /**
   * Check if a commit is valid for scoring
   */
  isValidCommit(commit: GitHubCommit): boolean {
    // Skip merge commits
    if (this.config.ignoreMergeCommits && this.isMergeCommit(commit.message)) {
      return false;
    }

    // Skip revert commits
    if (this.config.ignoreRevertCommits && this.isRevertCommit(commit.message)) {
      return false;
    }

    // Skip if all files are trivial (lock files, etc.)
    if (this.hasOnlyTrivialFiles(commit)) {
      return false;
    }

    // Skip if author is a bot
    if (this.config.ignoreBotUsers && commit.author.username) {
      if (this.isBotUsername(commit.author.username)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a message indicates a merge commit
   */
  isMergeCommit(message: string): boolean {
    return COMMIT_PATTERNS.MERGE.test(message);
  }

  /**
   * Check if a message indicates a revert commit
   */
  isRevertCommit(message: string): boolean {
    return COMMIT_PATTERNS.REVERT.test(message);
  }

  /**
   * Check if a commit only touches trivial files
   */
  hasOnlyTrivialFiles(commit: GitHubCommit): boolean {
    const allFiles = [...commit.added, ...commit.removed, ...commit.modified];
    
    if (allFiles.length === 0) {
      return true;
    }

    return allFiles.every((file) => 
      COMMIT_PATTERNS.TRIVIAL_FILES.some((pattern) => file.endsWith(pattern))
    );
  }

  /**
   * Check if a username belongs to a bot
   */
  isBotUsername(username: string): boolean {
    return (COMMIT_PATTERNS.BOT_USERS as readonly string[]).includes(username.toLowerCase());
  }

  /**
   * Check if a user is a bot based on username and type
   */
  isBotUser(username: string, userType: string): boolean {
    return userType === 'Bot' || this.isBotUsername(username);
  }

  /**
   * Check if line count meets minimum threshold
   */
  meetsMinimumLines(totalLines: number): boolean {
    return totalLines >= this.config.minLinesForCommit;
  }

  /**
   * Check if PR meets minimum changes threshold
   */
  meetsMinimumPrChanges(changedFiles: number): boolean {
    return changedFiles >= this.config.minPrChangesForScore;
  }

  /**
   * Apply daily commit cap
   */
  applyDailyCap<T>(commits: T[]): T[] {
    if (commits.length <= this.config.maxDailyCommitsScored) {
      return commits;
    }
    return commits.slice(0, this.config.maxDailyCommitsScored);
  }

  /**
   * Cap line counts to prevent gaming through massive commits
   */
  capLineCount(lines: number, commitCount: number): number {
    const maxLines = this.config.maxLinesPerCommit * commitCount;
    return Math.min(lines, maxLines);
  }

  /**
   * Calculate adjusted score with anti-gaming measures
   */
  calculateAdjustedScore(rawScore: number, metadata: {
    commitCount: number;
    linesAdded: number;
    linesRemoved: number;
    isFirstContribution: boolean;
  }): number {
    let adjustedScore = rawScore;

    // Cap line contributions
    const cappedLines = this.capLineCount(
      metadata.linesAdded + metadata.linesRemoved,
      Math.max(1, metadata.commitCount)
    );
    
    const originalLines = metadata.linesAdded + metadata.linesRemoved;
    if (originalLines > cappedLines) {
      // Reduce score proportionally
      const lineRatio = cappedLines / originalLines;
      adjustedScore *= lineRatio;
    }

    // Boost for first contribution (encourages new contributors)
    if (metadata.isFirstContribution) {
      adjustedScore *= 1.5;
    }

    return Math.round(adjustedScore * 100) / 100;
  }

  /**
   * Check if activity pattern suggests gaming
   */
  detectSuspiciousPattern(dailyStats: Array<{
    date: string;
    commits: number;
    linesAdded: number;
    linesRemoved: number;
  }>): boolean {
    // Check for sudden spikes (more than 5x average)
    if (dailyStats.length < 7) {
      return false;
    }

    const commitCounts = dailyStats.map(d => d.commits);
    const average = commitCounts.reduce((a, b) => a + b, 0) / commitCounts.length;
    const maxCommits = Math.max(...commitCounts);

    if (maxCommits > average * 5 && maxCommits > 20) {
      return true;
    }

    // Check for consistent exactly-at-cap commits
    const atCapCount = commitCounts.filter(c => c === this.config.maxDailyCommitsScored).length;
    if (atCapCount > dailyStats.length * 0.5) {
      return true;
    }

    return false;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): typeof this.config {
    return { ...this.config };
  }
}

export const antiGaming = new AntiGaming();
