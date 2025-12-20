import { z } from 'zod';

/**
 * Zod schemas for runtime validation
 */

// ============================================================================
// Environment Configuration Schema
// ============================================================================

export const envSchema = z.object({
  GITHUB_APP_ID: z.string().min(1, 'GITHUB_APP_ID is required'),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1, 'GITHUB_APP_PRIVATE_KEY is required'),
  GITHUB_WEBHOOK_SECRET: z.string().min(1, 'GITHUB_WEBHOOK_SECRET is required'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  ENABLE_README_UPDATES: z.string().transform((v) => v === 'true').default('true'),
  ENABLE_SVG_GENERATION: z.string().transform((v) => v === 'true').default('true'),
  ENABLE_ANTI_GAMING: z.string().transform((v) => v === 'true').default('true'),
  MAX_DAILY_COMMITS_SCORED: z.string().transform(Number).default('50'),
  MIN_LINES_FOR_COMMIT: z.string().transform(Number).default('5'),
  COMMIT_WEIGHT: z.string().transform(Number).default('1'),
  PR_WEIGHT: z.string().transform(Number).default('5'),
  ISSUE_WEIGHT: z.string().transform(Number).default('3'),
});

export type EnvConfig = z.infer<typeof envSchema>;

// ============================================================================
// Organization Config File Schema (.org-motivation.yml)
// ============================================================================

export const orgConfigSchema = z.object({
  version: z.literal(1).default(1),
  settings: z
    .object({
      enableReadmeUpdates: z.boolean().optional(),
      enableSvgGeneration: z.boolean().optional(),
      enableAntiGaming: z.boolean().optional(),
      enablePrivacyMode: z.boolean().optional(),
      showLeaderboard: z.boolean().optional(),
      showStreaks: z.boolean().optional(),
      showAwards: z.boolean().optional(),
      leaderboardSize: z.number().min(1).max(50).optional(),
      excludedUsers: z.array(z.string()).optional(),
      excludedRepositories: z.array(z.string()).optional(),
      readmeUpdateSchedule: z.enum(['realtime', 'hourly', 'daily']).optional(),
      timezone: z.string().optional(),
    })
    .optional(),
  scoring: z
    .object({
      commit: z.number().min(0).max(100).optional(),
      pullRequest: z.number().min(0).max(100).optional(),
      issue: z.number().min(0).max(100).optional(),
      lineAdded: z.number().min(0).max(1).optional(),
      lineRemoved: z.number().min(0).max(1).optional(),
    })
    .optional(),
  ranks: z
    .object({
      bronze: z.number().min(0).optional(),
      silver: z.number().min(0).optional(),
      gold: z.number().min(0).optional(),
      diamond: z.number().min(0).optional(),
    })
    .optional(),
  antiGaming: z
    .object({
      minLinesForCommit: z.number().min(0).optional(),
      maxDailyCommitsScored: z.number().min(1).optional(),
      ignoreBotUsers: z.boolean().optional(),
      ignoreMergeCommits: z.boolean().optional(),
      ignoreRevertCommits: z.boolean().optional(),
      minPrChangesForScore: z.number().min(0).optional(),
    })
    .optional(),
});

export type OrgConfigFile = z.infer<typeof orgConfigSchema>;

// ============================================================================
// Webhook Payload Schemas
// ============================================================================

const gitHubUserSchema = z.object({
  id: z.number(),
  login: z.string(),
  avatar_url: z.string().url(),
  type: z.enum(['User', 'Bot', 'Organization']),
});

const gitHubOrgSchema = z.object({
  id: z.number(),
  login: z.string(),
  avatar_url: z.string().url().optional(),
});

const gitHubRepoSchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  owner: gitHubUserSchema.or(gitHubOrgSchema),
  private: z.boolean(),
  default_branch: z.string(),
});

const gitHubCommitSchema = z.object({
  sha: z.string(),
  message: z.string(),
  author: z.object({
    name: z.string(),
    email: z.string(),
    username: z.string().optional(),
  }),
  timestamp: z.string(),
  added: z.array(z.string()),
  removed: z.array(z.string()),
  modified: z.array(z.string()),
});

export const pushWebhookSchema = z.object({
  ref: z.string(),
  before: z.string(),
  after: z.string(),
  commits: z.array(gitHubCommitSchema),
  head_commit: gitHubCommitSchema.nullable(),
  pusher: z.object({
    name: z.string(),
    email: z.string(),
  }),
  sender: gitHubUserSchema,
  repository: gitHubRepoSchema,
  organization: gitHubOrgSchema.optional(),
  installation: z
    .object({
      id: z.number(),
      account: gitHubOrgSchema.or(gitHubUserSchema),
    })
    .optional(),
});

export const pullRequestWebhookSchema = z.object({
  action: z.enum(['opened', 'closed', 'merged', 'synchronize', 'reopened']),
  number: z.number(),
  pull_request: z.object({
    id: z.number(),
    number: z.number(),
    title: z.string(),
    state: z.enum(['open', 'closed']),
    merged: z.boolean(),
    merged_at: z.string().nullable(),
    user: gitHubUserSchema,
    additions: z.number(),
    deletions: z.number(),
    changed_files: z.number(),
  }),
  sender: gitHubUserSchema,
  repository: gitHubRepoSchema,
  organization: gitHubOrgSchema.optional(),
  installation: z
    .object({
      id: z.number(),
      account: gitHubOrgSchema.or(gitHubUserSchema),
    })
    .optional(),
});

export const issuesWebhookSchema = z.object({
  action: z.enum(['opened', 'closed', 'reopened', 'assigned', 'unassigned']),
  issue: z.object({
    id: z.number(),
    number: z.number(),
    title: z.string(),
    state: z.enum(['open', 'closed']),
    user: gitHubUserSchema,
    closed_at: z.string().nullable(),
    closed_by: gitHubUserSchema.optional(),
  }),
  sender: gitHubUserSchema,
  repository: gitHubRepoSchema,
  organization: gitHubOrgSchema.optional(),
  installation: z
    .object({
      id: z.number(),
      account: gitHubOrgSchema.or(gitHubUserSchema),
    })
    .optional(),
});

export const installationWebhookSchema = z.object({
  action: z.enum(['created', 'deleted', 'suspend', 'unsuspend']),
  installation: z.object({
    id: z.number(),
    account: gitHubOrgSchema.or(gitHubUserSchema),
    app_id: z.number(),
    target_type: z.enum(['Organization', 'User']),
    permissions: z.record(z.string()),
    events: z.array(z.string()),
    created_at: z.string(),
    updated_at: z.string(),
  }),
  repositories: z.array(gitHubRepoSchema).optional(),
  sender: gitHubUserSchema,
});

// ============================================================================
// API Request/Response Schemas
// ============================================================================

export const leaderboardRequestSchema = z.object({
  orgLogin: z.string(),
  period: z.enum(['7d', '30d', '90d', 'all-time', 'monthly']).default('30d'),
  limit: z.number().min(1).max(100).default(10),
});

export const userStatsRequestSchema = z.object({
  orgLogin: z.string(),
  userLogin: z.string(),
  period: z.enum(['7d', '30d', '90d', 'all-time', 'monthly']).default('30d'),
});

export const privacySettingsSchema = z.object({
  optedOut: z.boolean().optional(),
  hideFromLeaderboard: z.boolean().optional(),
  hideScore: z.boolean().optional(),
  hideStreak: z.boolean().optional(),
});

// ============================================================================
// Database Record Schemas
// ============================================================================

export const dailyContributionSchema = z.object({
  id: z.string().uuid(),
  orgId: z.number(),
  userId: z.number(),
  userLogin: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  commits: z.number().min(0),
  linesAdded: z.number().min(0),
  linesRemoved: z.number().min(0),
  pullRequestsMerged: z.number().min(0),
  issuesClosed: z.number().min(0),
  issuesOpened: z.number().min(0),
  repositoriesContributed: z.array(z.number()),
  rawScore: z.number().min(0),
  weightedScore: z.number().min(0),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const awardSchema = z.object({
  id: z.string().uuid(),
  orgId: z.number(),
  userId: z.number(),
  userLogin: z.string(),
  type: z.enum([
    'top-contributor',
    'rising-star',
    'consistency-champion',
    'pr-master',
    'issue-resolver',
    'code-reviewer',
    'first-contribution',
    'streak-holder',
  ]),
  title: z.string(),
  description: z.string(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  awardedAt: z.date(),
  metadata: z.record(z.unknown()).optional(),
});
