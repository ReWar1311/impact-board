/**
 * Application constants and defaults
 */

// ============================================================================
// Application Info
// ============================================================================

export const APP_NAME = 'org-contribution-motivation';
export const APP_VERSION = '1.0.0';
export const APP_DESCRIPTION = 'A GitHub App that tracks and motivates organization contributions';

// ============================================================================
// GitHub API
// ============================================================================

export const GITHUB_API_VERSION = '2022-11-28';
export const GITHUB_API_BASE_URL = 'https://api.github.com';
export const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

// ============================================================================
// Webhook Events
// ============================================================================

export const SUPPORTED_WEBHOOK_EVENTS = [
  'push',
  'pull_request',
  'issues',
  'installation',
  'installation_repositories',
] as const;

// ============================================================================
// Profile Repository
// ============================================================================

export const PROFILE_REPO_NAME = '.github';
export const PROFILE_README_PATH = 'profile/README.md';
export const CONFIG_FILE_NAME = '.org-motivation.yml';

// ImpactBoard (new system) YAML location inside the profile repo
// File location is fixed and non-configurable per documentation
export const IMPACTBOARD_YAML_PATH = 'impactboard.yml';

// Default assets base path used in assets-only mode when not specified in YAML
export const DEFAULT_ASSETS_BASE_PATH = 'assets/impactboard';
export const README_TARGET_PATH = 'profile/README.md';

// ============================================================================
// README Markers
// ============================================================================

export const README_MARKERS = {
  LEADERBOARD_START: '<!-- ORG-MOTIVATION:LEADERBOARD:START -->',
  LEADERBOARD_END: '<!-- ORG-MOTIVATION:LEADERBOARD:END -->',
  STREAKS_START: '<!-- ORG-MOTIVATION:STREAKS:START -->',
  STREAKS_END: '<!-- ORG-MOTIVATION:STREAKS:END -->',
  AWARDS_START: '<!-- ORG-MOTIVATION:AWARDS:START -->',
  AWARDS_END: '<!-- ORG-MOTIVATION:AWARDS:END -->',
  SUMMARY_START: '<!-- ORG-MOTIVATION:SUMMARY:START -->',
  SUMMARY_END: '<!-- ORG-MOTIVATION:SUMMARY:END -->',
  HEATMAP_START: '<!-- ORG-MOTIVATION:HEATMAP:START -->',
  HEATMAP_END: '<!-- ORG-MOTIVATION:HEATMAP:END -->',
  TIMESTAMP_START: '<!-- ORG-MOTIVATION:TIMESTAMP:START -->',
  TIMESTAMP_END: '<!-- ORG-MOTIVATION:TIMESTAMP:END -->',
} as const;

// ============================================================================
// Scoring Defaults
// ============================================================================

export const SCORING = {
  // Base weights
  COMMIT_WEIGHT: 1,
  PR_MERGED_WEIGHT: 5,
  ISSUE_CLOSED_WEIGHT: 3,
  ISSUE_OPENED_WEIGHT: 1,
  LINE_ADDED_WEIGHT: 0.01,
  LINE_REMOVED_WEIGHT: 0.005,

  // Anti-gaming limits
  MAX_DAILY_COMMITS_SCORED: 50,
  MIN_LINES_FOR_COMMIT: 5,
  MAX_LINES_PER_COMMIT: 1000, // Cap to prevent gaming with large commits
  MIN_PR_CHANGES_FOR_SCORE: 1,

  // Streak bonuses
  STREAK_BONUS_MULTIPLIER: 0.1, // 10% bonus per streak day, capped
  MAX_STREAK_BONUS: 2.0, // Maximum 200% bonus
} as const;

// ============================================================================
// Rank Thresholds
// ============================================================================

export const RANK_THRESHOLDS = {
  BRONZE: 0,
  SILVER: 100,
  GOLD: 500,
  DIAMOND: 2000,
} as const;

export const DEFAULT_RANK_THRESHOLDS = {
  bronze: RANK_THRESHOLDS.BRONZE,
  silver: RANK_THRESHOLDS.SILVER,
  gold: RANK_THRESHOLDS.GOLD,
  diamond: RANK_THRESHOLDS.DIAMOND,
};

// ============================================================================
// Time Windows
// ============================================================================

export const TIME_WINDOWS = {
  SEVEN_DAYS: 7,
  THIRTY_DAYS: 30,
  NINETY_DAYS: 90,
} as const;

// ============================================================================
// Rate Limiting
// ============================================================================

export const RATE_LIMITS = {
  WEBHOOK_PROCESSING: {
    WINDOW_MS: 60 * 1000, // 1 minute
    MAX_REQUESTS: 100,
  },
  API_REQUESTS: {
    WINDOW_MS: 60 * 1000,
    MAX_REQUESTS: 60,
  },
} as const;

// ============================================================================
// Cache TTLs (in seconds)
// ============================================================================

export const CACHE_TTL = {
  INSTALLATION_TOKEN: 60 * 55, // 55 minutes (tokens valid for 60)
  LEADERBOARD: 60 * 5, // 5 minutes
  USER_STATS: 60 * 5, // 5 minutes
  ORG_CONFIG: 60 * 10, // 10 minutes
} as const;

// ============================================================================
// SVG Dimensions
// ============================================================================

export const SVG = {
  LEADERBOARD: {
    WIDTH: 800,
    HEIGHT: 400,
    ROW_HEIGHT: 35,
    PADDING: 20,
  },
  BADGE: {
    WIDTH: 120,
    HEIGHT: 30,
  },
  HEATMAP: {
    CELL_SIZE: 12,
    CELL_GAP: 2,
    WEEKS: 52,
  },
} as const;

// ============================================================================
// Database
// ============================================================================

export const DATABASE = {
  POOL_SIZE: 10,
  IDLE_TIMEOUT: 30000,
  CONNECTION_TIMEOUT: 5000,
} as const;

// ============================================================================
// Patterns for Commit Filtering
// ============================================================================

export const COMMIT_PATTERNS = {
  MERGE: /^Merge (branch|pull request|remote-tracking)/i,
  REVERT: /^Revert "/i,
  BOT_USERS: ['dependabot[bot]', 'renovate[bot]', 'github-actions[bot]', 'snyk-bot'],
  TRIVIAL_FILES: [
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'composer.lock',
    'Gemfile.lock',
    'Cargo.lock',
    'poetry.lock',
  ],
} as const;

// ============================================================================
// HTTP Status Codes
// ============================================================================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;
