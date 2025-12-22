/**
 * Core type definitions for the Impact Board GitHub App
 */

// ============================================================================
// GitHub Types
// ============================================================================

export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  type: 'User' | 'Bot' | 'Organization';
}

export interface GitHubOrganization {
  id: number;
  login: string;
  avatar_url: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: GitHubUser | GitHubOrganization;
  private: boolean;
  default_branch: string;
}

export interface GitHubCommit {
  id: string;  // GitHub uses 'id' not 'sha' in webhook payloads
  message: string;
  author: {
    name: string;
    email: string;
    username?: string;
  };
  timestamp: string;
  added: string[];
  removed: string[];
  modified: string[];
  tree_id?: string;
  distinct?: boolean;
  url?: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  merged: boolean;
  merged_at: string | null;
  user: GitHubUser;
  additions: number;
  deletions: number;
  changed_files: number;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  user: GitHubUser;
  closed_at: string | null;
  closed_by?: GitHubUser;
}

// ============================================================================
// Installation Types
// ============================================================================

export interface Installation {
  id: number;
  account: GitHubOrganization | GitHubUser;
  app_id: number;
  target_type: 'Organization' | 'User';
  permissions: Record<string, string>;
  events: string[];
  created_at: string;
  updated_at: string;
}

export interface StoredInstallation {
  installationId: number;
  accountId: number;
  accountLogin: string;
  accountType: 'Organization' | 'User';
  createdAt: Date;
  updatedAt: Date;
  settings: OrgSettings;
  isActive: boolean;
}

// ============================================================================
// Contribution Types
// ============================================================================

export interface DailyContribution {
  id: string;
  orgId: number;
  userId: number;
  userLogin: string;
  date: string; // YYYY-MM-DD format
  commits: number;
  linesAdded: number;
  linesRemoved: number;
  pullRequestsMerged: number;
  issuesClosed: number;
  issuesOpened: number;
  repositoriesContributed: Set<number>;
  rawScore: number;
  weightedScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AggregatedStats {
  userId: number;
  userLogin: string;
  userAvatarUrl: string;
  orgId: number;
  period: StatsPeriod;
  startDate: string;
  endDate: string;
  totalCommits: number;
  totalLinesAdded: number;
  totalLinesRemoved: number;
  totalPullRequestsMerged: number;
  totalIssuesClosed: number;
  totalIssuesOpened: number;
  uniqueRepositories: number;
  currentStreak: number;
  longestStreak: number;
  rawScore: number;
  weightedScore: number;
  rank: ContributorRank;
  activeDays: number;
}

export type StatsPeriod = '7d' | '30d' | '90d' | 'all-time' | 'monthly';

// ============================================================================
// Ranking Types
// ============================================================================

export type ContributorRank = 'Bronze' | 'Silver' | 'Gold' | 'Diamond';

export interface RankThresholds {
  bronze: number;
  silver: number;
  gold: number;
  diamond: number;
}

export const DEFAULT_RANK_THRESHOLDS: RankThresholds = {
  bronze: 0,
  silver: 100,
  gold: 500,
  diamond: 2000,
};

// ============================================================================
// Award Types
// ============================================================================

export type AwardType =
  | 'top-contributor'
  | 'rising-star'
  | 'consistency-champion'
  | 'pr-master'
  | 'issue-resolver'
  | 'code-reviewer'
  | 'first-contribution'
  | 'streak-holder';

export interface Award {
  id: string;
  orgId: number;
  userId: number;
  userLogin: string;
  type: AwardType;
  title: string;
  description: string;
  month: string; // YYYY-MM format
  awardedAt: Date;
  metadata?: Record<string, unknown>;
}

export const AWARD_DEFINITIONS: Record<AwardType, { title: string; description: string }> = {
  'top-contributor': {
    title: '🏆 Top Contributor',
    description: 'Highest weighted contribution score this month',
  },
  'rising-star': {
    title: '⭐ Rising Star',
    description: 'Biggest improvement in contribution score',
  },
  'consistency-champion': {
    title: '🔥 Consistency Champion',
    description: 'Longest contribution streak this month',
  },
  'pr-master': {
    title: '🎯 PR Master',
    description: 'Most pull requests merged this month',
  },
  'issue-resolver': {
    title: '🔧 Issue Resolver',
    description: 'Most issues closed this month',
  },
  'code-reviewer': {
    title: '👀 Code Reviewer',
    description: 'Most pull request reviews this month',
  },
  'first-contribution': {
    title: '🎉 First Contribution',
    description: 'Made their first contribution to the organization',
  },
  'streak-holder': {
    title: '📅 Streak Holder',
    description: 'Maintained a contribution streak for 30+ days',
  },
};

// ============================================================================
// Streak Types
// ============================================================================

export interface StreakInfo {
  userId: number;
  userLogin: string;
  orgId: number;
  currentStreak: number;
  longestStreak: number;
  lastContributionDate: string;
  streakStartDate: string | null;
  longestStreakStartDate: string | null;
  longestStreakEndDate: string | null;
}

// ============================================================================
// Scoring Types
// ============================================================================

export interface ScoringWeights {
  commit: number;
  pullRequest: number;
  issue: number;
  lineAdded: number;
  lineRemoved: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  commit: 1,
  pullRequest: 5,
  issue: 3,
  lineAdded: 0.01,
  lineRemoved: 0.005,
};

export interface AntiGamingConfig {
  minLinesForCommit: number;
  maxDailyCommitsScored: number;
  ignoreBotUsers: boolean;
  ignoreMergeCommits: boolean;
  ignoreRevertCommits: boolean;
  minPrChangesForScore: number;
}

export const DEFAULT_ANTI_GAMING_CONFIG: AntiGamingConfig = {
  minLinesForCommit: 5,
  maxDailyCommitsScored: 50,
  ignoreBotUsers: true,
  ignoreMergeCommits: true,
  ignoreRevertCommits: true,
  minPrChangesForScore: 1,
};

// ============================================================================
// Organization Settings
// ============================================================================

export interface OrgSettings {
  enableReadmeUpdates: boolean;
  enableSvgGeneration: boolean;
  enableAntiGaming: boolean;
  enablePrivacyMode: boolean;
  showLeaderboard: boolean;
  showStreaks: boolean;
  showAwards: boolean;
  leaderboardSize: number;
  excludedUsers: string[];
  excludedRepositories: string[];
  customScoringWeights?: Partial<ScoringWeights>;
  customRankThresholds?: Partial<RankThresholds>;
  customAntiGaming?: Partial<AntiGamingConfig>;
  readmeUpdateSchedule: 'realtime' | 'hourly' | 'daily';
  timezone: string;
}

export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  enableReadmeUpdates: true,
  enableSvgGeneration: true,
  enableAntiGaming: true,
  enablePrivacyMode: false,
  showLeaderboard: true,
  showStreaks: true,
  showAwards: true,
  leaderboardSize: 10,
  excludedUsers: [],
  excludedRepositories: [],
  readmeUpdateSchedule: 'hourly',
  timezone: 'UTC',
};

// ============================================================================
// Privacy Types
// ============================================================================

export interface UserPrivacySettings {
  orgId: number;
  userId: number;
  userLogin: string;
  optedOut: boolean;
  hideFromLeaderboard: boolean;
  hideScore: boolean;
  hideStreak: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Webhook Event Types
// ============================================================================

export interface WebhookPayload {
  action?: string;
  sender: GitHubUser;
  repository?: GitHubRepository;
  organization?: GitHubOrganization;
  installation?: {
    id: number;
    account: GitHubOrganization | GitHubUser;
  };
}

export interface PushWebhookPayload extends WebhookPayload {
  ref: string;
  before: string;
  after: string;
  commits: GitHubCommit[];
  head_commit: GitHubCommit | null;
  pusher: {
    name: string;
    email: string;
  };
}

export interface PullRequestWebhookPayload extends WebhookPayload {
  action: 'opened' | 'closed' | 'merged' | 'synchronize' | 'reopened';
  number: number;
  pull_request: GitHubPullRequest;
}

export interface IssuesWebhookPayload extends WebhookPayload {
  action: 'opened' | 'closed' | 'reopened' | 'assigned' | 'unassigned';
  issue: GitHubIssue;
}

export interface InstallationWebhookPayload extends WebhookPayload {
  action: 'created' | 'deleted' | 'suspend' | 'unsuspend';
  installation: Installation;
  repositories?: GitHubRepository[];
}

// ============================================================================
// API Response Types
// ============================================================================

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  userLogin: string;
  userAvatarUrl: string;
  weightedScore: number;
  contributorRank: ContributorRank;
  currentStreak: number;
  topMetric: string;
  topMetricValue: number;
}

export interface Leaderboard {
  orgId: number;
  orgLogin: string;
  period: StatsPeriod;
  generatedAt: Date;
  entries: LeaderboardEntry[];
  totalContributors: number;
}

// ============================================================================
// SVG Types
// ============================================================================

export interface SvgOptions {
  width: number;
  height: number;
  darkMode: boolean;
  animated: boolean;
  theme: SvgTheme;
}

export interface SvgTheme {
  background: string;
  text: string;
  accent: string;
  bronze: string;
  silver: string;
  gold: string;
  diamond: string;
  barBackground: string;
  barFill: string;
}

export const DEFAULT_LIGHT_THEME: SvgTheme = {
  background: '#ffffff',
  text: '#24292f',
  accent: '#0969da',
  bronze: '#cd7f32',
  silver: '#c0c0c0',
  gold: '#ffd700',
  diamond: '#b9f2ff',
  barBackground: '#eaeef2',
  barFill: '#0969da',
};

export const DEFAULT_DARK_THEME: SvgTheme = {
  background: '#0d1117',
  text: '#c9d1d9',
  accent: '#58a6ff',
  bronze: '#cd7f32',
  silver: '#c0c0c0',
  gold: '#ffd700',
  diamond: '#b9f2ff',
  barBackground: '#21262d',
  barFill: '#58a6ff',
};

// ============================================================================
// README Types
// ============================================================================

export interface ReadmeSection {
  id: string;
  startMarker: string;
  endMarker: string;
  content: string;
}

export interface ReadmeConfig {
  sections: ReadmeSection[];
  preserveManualContent: boolean;
  addTimestamp: boolean;
}

// ============================================================================
// Event Processing Types
// ============================================================================

export interface ProcessedEvent {
  id: string;
  eventType: string;
  deliveryId: string;
  installationId: number;
  orgId: number;
  processedAt: Date;
  success: boolean;
  error?: string;
}

// ============================================================================
// Health & Metrics Types
// ============================================================================

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  database: {
    connected: boolean;
    latency: number;
  };
  github: {
    rateLimit: {
      remaining: number;
      reset: Date;
    };
  };
  lastEventProcessed: Date | null;
}
