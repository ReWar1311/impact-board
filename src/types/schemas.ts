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
// Organization Config File Schema (.impact-board.yml)
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

// Simpler repo schema for installation webhooks (GitHub sends less data)
const gitHubRepoSimpleSchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  private: z.boolean(),
  node_id: z.string().optional(),
});

const gitHubCommitSchema = z.object({
  id: z.string(),  // GitHub uses 'id' not 'sha' in webhook payloads
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
  tree_id: z.string().optional(),
  distinct: z.boolean().optional(),
  url: z.string().optional(),
});

// Simple installation reference in webhook payloads
const installationRefSchema = z.object({
  id: z.number(),
  node_id: z.string().optional(),
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
  installation: installationRefSchema.optional(),
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
  installation: installationRefSchema.optional(),
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
  installation: installationRefSchema.optional(),
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
  repositories: z.array(gitHubRepoSimpleSchema).optional(),
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
// ImpactBoard YAML Schema (authoritative)
// ============================================================================

const yamlEntities = z.enum(['USER', 'REPO', 'ORG']);
const yamlModes = z.enum(['full', 'assets-only', 'template']).default('full');
const yamlWindows = z.enum(['7d', '30d', '90d', 'all-time']);

// Helper to allow null and convert to undefined (for optional object fields)
const nullableObject = <T extends z.ZodTypeAny>(schema: T) =>
  z.union([schema, z.null()]).transform((val) => val ?? undefined);

export const impactYamlSchema = z
  .object({
    version: z.literal('v1').default('v1'),
    mode: yamlModes,
    
    // README settings (for full mode)
    readme: z
      .object({
        file: z.string().default('.github/profile/README.md'),
        placeholder: z.string().optional(),
        // Template file for placeholder resolution (required for full mode)
        allow: z
          .object({
            entities: z.array(yamlEntities).default(['USER', 'REPO', 'ORG']),
            user_selectors: z
              .object({
                top_max: z.number().min(1).max(100).default(5),
                allow_username: z.boolean().default(true),
              })
              .default({ top_max: 5, allow_username: true }),
            fields: z
              .array(
                z.enum([
                  'username',
                  'commits',
                  'prs',
                  'issues_closed',
                  'issues_open',
                  'loc_added',
                  'loc_removed',
                  'streak',
                  'rank',
                  'impact',
                  'repos',
                  'last_active',
                  'badge_svg',
                ])
              )
              .default(['username', 'commits', 'prs', 'streak', 'loc_added', 'impact']),
            max_placeholders: z.number().min(1).max(500).default(100),
          })
          .default({
            entities: ['USER', 'REPO', 'ORG'],
            user_selectors: { top_max: 5, allow_username: true },
            fields: ['username', 'commits', 'prs', 'streak', 'loc_added', 'impact'],
            max_placeholders: 100,
          }),
      })
      .optional(),
    
    // Allow at root level (legacy/shorthand) - merged into readme.allow
    allow: z
      .object({
        entities: z.array(yamlEntities).optional(),
      })
      .optional(),
    user_selectors: z
      .object({
        top_max: z.number().min(1).max(100).optional(),
        allow_username: z.boolean().optional(),
      })
      .optional(),
    fields: z
      .array(
        z.enum([
          'username',
          'commits',
          'prs',
          'issues_closed',
          'issues_open',
          'loc_added',
          'loc_removed',
          'streak',
          'rank',
          'impact',
          'repos',
          'last_active',
          'badge_svg',
        ])
      )
      .optional(),
    max_placeholders: z.number().min(1).max(500).optional(),
    
    // Template settings
    template: z
      .object({
        name: z.string().default('default'),
        version: z.string().default('1.0'),
        target: z.object({ file: z.string() }).default({ file: '.github/profile/README.md' }),
        options: z
          .object({
            show_leaderboard: z.boolean().default(true),
            show_heatmap: z.boolean().default(true),
            show_awards: z.boolean().default(true),
            show_repositories: z.boolean().default(false),
          })
          .default({ show_leaderboard: true, show_heatmap: true, show_awards: true, show_repositories: false }),
        overrides: z
          .object({
            window: yamlWindows.default('30d'),
            leaderboard_limit: z.number().min(1).max(100).default(10),
          })
          .default({ window: '30d', leaderboard_limit: 10 }),
      })
      .optional(),
    
    // Assets settings
    assets: z
      .object({
        base_path: z.string().default('assets/impactboard'),
        svgs: z
          .object({
            leaderboard: nullableObject(
              z.object({
                enabled: z.boolean().default(true),
                max_limit: z.number().min(1).max(100).default(10),
                window: yamlWindows.default('30d'),
              })
            ).optional(),
            badges: nullableObject(z.object({ enabled: z.boolean().default(true) })).optional(),
            heatmap: nullableObject(z.object({ enabled: z.boolean().default(false) })).optional(),
          })
          .default({ leaderboard: { enabled: true, max_limit: 10, window: '30d' }, badges: { enabled: true }, heatmap: { enabled: false } }),
      })
      .optional(),
    
    // Data windows
    data: z
      .object({
        windows: z
          .object({
            default: yamlWindows.default('30d'),
            // Accept 'all' as alias for 'all-time'
            allowed: z
              .array(z.string())
              .default(['7d', '30d', '90d', 'all-time'])
              .transform((arr) =>
                arr.map((v) => (v === 'all' ? 'all-time' : v)).filter((v) =>
                  ['7d', '30d', '90d', 'all-time'].includes(v)
                ) as ('7d' | '30d' | '90d' | 'all-time')[]
              ),
          })
          .default({ default: '30d', allowed: ['7d', '30d', '90d', 'all-time'] }),
        scoring: nullableObject(
          z.object({
            commit: z.number().default(1),
            merged_pr: z.number().default(5),
            closed_issue: z.number().default(3),
            loc_weight: z.number().default(0.1),
          })
        ).optional(),
      })
      .optional(),
    
    // Privacy
    privacy: nullableObject(
      z.object({
        default_visibility: z.enum(['public', 'private']).default('public'),
        public_users: z
          .record(
            z.object({
              hide: z.array(z.enum(['rank', 'streak', 'impact'])).optional(),
            })
          )
          .optional(),
      })
    ).optional(),
    
    // Advanced settings
    advanced: nullableObject(
      z.object({
        anti_gaming: nullableObject(
          z.object({
            min_loc_change: z.number().default(5),
            max_commits_per_day: z.number().default(50),
            ignore_self_closed_issues: z.boolean().default(false),
          })
        ).optional(),
        behavior: nullableObject(
          z.object({
            fail_on_invalid_config: z.boolean().default(false),
          })
        ).optional(),
      })
    ).optional(),
    
    // Root-level behavior (legacy/shorthand)
    behavior: nullableObject(
      z.object({
        fail_on_invalid_config: z.boolean().default(false),
      })
    ).optional(),
    
    // Logging (ignored but accepted)
    logging: z.any().optional(),
  })
  .passthrough() // Allow unknown keys but ignore them
  .transform((data) => {
    // Merge root-level shorthand fields into proper nested structure
    const result: Record<string, unknown> = { ...data };
    
    // Merge allow, user_selectors, fields, max_placeholders into readme.allow
    if (data.allow || data.user_selectors || data.fields || data.max_placeholders) {
      const existingReadme = result.readme as Record<string, unknown> | undefined;
      const existingAllow = existingReadme?.allow as Record<string, unknown> | undefined;
      const existingUserSelectors = existingAllow?.user_selectors as Record<string, unknown> | undefined;
      
      result.readme = {
        file: existingReadme?.file ?? '.github/profile/README.md',
        placeholder: existingReadme?.placeholder,
        allow: {
          entities: data.allow?.entities ?? existingAllow?.entities ?? ['USER', 'REPO', 'ORG'],
          user_selectors: {
            top_max: data.user_selectors?.top_max ?? existingUserSelectors?.top_max ?? 5,
            allow_username: data.user_selectors?.allow_username ?? existingUserSelectors?.allow_username ?? true,
          },
          fields: data.fields ?? existingAllow?.fields ?? ['username', 'commits', 'prs', 'streak', 'loc_added', 'impact'],
          max_placeholders: data.max_placeholders ?? existingAllow?.max_placeholders ?? 100,
        },
      };
    }
    
    // Merge root-level behavior into advanced.behavior
    if (data.behavior) {
      const existingAdvanced = result.advanced as Record<string, unknown> | undefined;
      const existingBehavior = existingAdvanced?.behavior as Record<string, unknown> | undefined;
      
      result.advanced = {
        ...existingAdvanced,
        behavior: {
          fail_on_invalid_config: data.behavior?.fail_on_invalid_config ?? existingBehavior?.fail_on_invalid_config ?? false,
        },
      };
    }
    
    return result as typeof data;
  });

export type ImpactYamlConfig = z.infer<typeof impactYamlSchema>;

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
