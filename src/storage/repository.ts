import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config/env';
import { logger, logDatabase } from '../utils/logger';
import { DATABASE } from '../config/constants';
import type {
  StoredInstallation,
  DailyContribution,
  AggregatedStats,
  StreakInfo,
  Award,
  UserPrivacySettings,
  ProcessedEvent,
  OrgSettings,
  StatsPeriod,
} from '../types';

/**
 * Database Repository
 * 
 * Provides data access layer for all database operations
 * Uses connection pooling for efficiency
 */

// Database pool
let pool: Pool | null = null;

/**
 * Initialize the database pool
 */
export function initializePool(): Pool {
  if (pool) {
    return pool;
  }

  pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: DATABASE.POOL_SIZE,
    idleTimeoutMillis: DATABASE.IDLE_TIMEOUT,
    connectionTimeoutMillis: DATABASE.CONNECTION_TIMEOUT,
  });

  pool.on('error', (err) => {
    logger.error({ err }, 'Unexpected database pool error');
  });

  logger.info('Database pool initialized');
  return pool;
}

/**
 * Get the database pool
 */
export function getPool(): Pool {
  if (!pool) {
    return initializePool();
  }
  return pool;
}

/**
 * Close the database pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database pool closed');
  }
}

/**
 * Execute a query with timing
 */
async function query<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const startTime = Date.now();
  const client = await getPool().connect();
  
  try {
    const result = await client.query(sql, params);
    logDatabase('query', 'various', Date.now() - startTime);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

/**
 * Execute a single-row query
 */
async function queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

// ============================================================================
// Installations Repository
// ============================================================================

const installationsRepo = {
  async create(installation: StoredInstallation): Promise<void> {
    await query(
      `INSERT INTO installations (installation_id, account_id, account_login, account_type, settings, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (installation_id) 
       DO UPDATE SET account_login = $3, settings = $5, is_active = $6, updated_at = $8`,
      [
        installation.installationId,
        installation.accountId,
        installation.accountLogin,
        installation.accountType,
        JSON.stringify(installation.settings),
        installation.isActive,
        installation.createdAt,
        installation.updatedAt,
      ]
    );
  },

  async get(installationId: number): Promise<StoredInstallation | null> {
    const row = await queryOne<{
      installation_id: number;
      account_id: number;
      account_login: string;
      account_type: string;
      settings: OrgSettings;
      is_active: boolean;
      created_at: Date;
      updated_at: Date;
    }>(
      'SELECT * FROM installations WHERE installation_id = $1',
      [installationId]
    );

    if (!row) return null;

    return {
      installationId: row.installation_id,
      accountId: row.account_id,
      accountLogin: row.account_login,
      accountType: row.account_type as 'Organization' | 'User',
      settings: row.settings,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  async getByLogin(accountLogin: string): Promise<StoredInstallation | null> {
    const row = await queryOne<{
      installation_id: number;
      account_id: number;
      account_login: string;
      account_type: string;
      settings: OrgSettings;
      is_active: boolean;
      created_at: Date;
      updated_at: Date;
    }>(
      'SELECT * FROM installations WHERE account_login = $1 AND is_active = true',
      [accountLogin]
    );

    if (!row) return null;

    return {
      installationId: row.installation_id,
      accountId: row.account_id,
      accountLogin: row.account_login,
      accountType: row.account_type as 'Organization' | 'User',
      settings: row.settings,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  async getActive(): Promise<StoredInstallation[]> {
    const rows = await query<{
      installation_id: number;
      account_id: number;
      account_login: string;
      account_type: string;
      settings: OrgSettings;
      is_active: boolean;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM installations WHERE is_active = true');

    return rows.map((row) => ({
      installationId: row.installation_id,
      accountId: row.account_id,
      accountLogin: row.account_login,
      accountType: row.account_type as 'Organization' | 'User',
      settings: row.settings,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  },

  async deactivate(installationId: number): Promise<void> {
    await query(
      'UPDATE installations SET is_active = false, updated_at = NOW() WHERE installation_id = $1',
      [installationId]
    );
  },

  async activate(installationId: number, settings: OrgSettings): Promise<void> {
    await query(
      'UPDATE installations SET is_active = true, settings = $2, updated_at = NOW() WHERE installation_id = $1',
      [installationId, JSON.stringify(settings)]
    );
  },

  // Alias for getById
  async getById(installationId: number): Promise<{ installationId: number; orgName: string; settings: OrgSettings } | null> {
    const installation = await this.get(installationId);
    if (!installation) return null;
    return {
      installationId: installation.installationId,
      orgName: installation.accountLogin,
      settings: installation.settings,
    };
  },
};

// ============================================================================
// Users Repository
// ============================================================================

const usersRepo = {
  async upsert(user: { userId: number; login: string; avatarUrl: string; type: string }): Promise<void> {
    await query(
      `INSERT INTO users (user_id, login, avatar_url, user_type)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) 
       DO UPDATE SET login = $2, avatar_url = $3, user_type = $4`,
      [user.userId, user.login, user.avatarUrl, user.type]
    );
  },

  async get(userId: number): Promise<{ userId: number; login: string; avatarUrl: string } | null> {
    const row = await queryOne<{ user_id: number; login: string; avatar_url: string }>(
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );

    if (!row) return null;

    return {
      userId: row.user_id,
      login: row.login,
      avatarUrl: row.avatar_url,
    };
  },

  async getById(installationId: number, userId: number): Promise<{ id: number; login: string; avatarUrl: string } | null> {
    // For now, installation scoping is handled at application level
    const row = await queryOne<{ user_id: number; login: string; avatar_url: string }>(
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );

    if (!row) return null;

    return {
      id: row.user_id,
      login: row.login,
      avatarUrl: row.avatar_url,
    };
  },

  async getByUsername(installationId: number, username: string): Promise<{ id: number; login: string; avatarUrl: string } | null> {
    // For now, installation scoping is handled at application level
    const row = await queryOne<{ user_id: number; login: string; avatar_url: string }>(
      'SELECT * FROM users WHERE login = $1',
      [username]
    );

    if (!row) return null;

    return {
      id: row.user_id,
      login: row.login,
      avatarUrl: row.avatar_url,
    };
  },
};

// ============================================================================
// Daily Contributions Repository
// ============================================================================

const contributionsRepo = {
  async getDaily(orgId: number, userId: number, date: string): Promise<DailyContribution | null> {
    const row = await queryOne<{
      id: string;
      org_id: number;
      user_id: number;
      user_login: string;
      date: string;
      commits: number;
      lines_added: number;
      lines_removed: number;
      pull_requests_merged: number;
      issues_closed: number;
      issues_opened: number;
      repositories_contributed: number[];
      raw_score: string;
      weighted_score: string;
      created_at: Date;
      updated_at: Date;
    }>(
      'SELECT * FROM daily_contributions WHERE org_id = $1 AND user_id = $2 AND date = $3',
      [orgId, userId, date]
    );

    if (!row) return null;

    return {
      id: row.id,
      orgId: row.org_id,
      userId: row.user_id,
      userLogin: row.user_login,
      date: row.date,
      commits: row.commits,
      linesAdded: row.lines_added,
      linesRemoved: row.lines_removed,
      pullRequestsMerged: row.pull_requests_merged,
      issuesClosed: row.issues_closed,
      issuesOpened: row.issues_opened,
      repositoriesContributed: new Set(row.repositories_contributed),
      rawScore: parseFloat(row.raw_score),
      weightedScore: parseFloat(row.weighted_score),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  async upsertDaily(contribution: DailyContribution): Promise<void> {
    await query(
      `INSERT INTO daily_contributions 
       (id, org_id, user_id, user_login, date, commits, lines_added, lines_removed, 
        pull_requests_merged, issues_closed, issues_opened, repositories_contributed, 
        raw_score, weighted_score, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       ON CONFLICT (org_id, user_id, date) 
       DO UPDATE SET 
         commits = $6, lines_added = $7, lines_removed = $8,
         pull_requests_merged = $9, issues_closed = $10, issues_opened = $11,
         repositories_contributed = $12, raw_score = $13, weighted_score = $14,
         updated_at = $16`,
      [
        contribution.id,
        contribution.orgId,
        contribution.userId,
        contribution.userLogin,
        contribution.date,
        contribution.commits,
        contribution.linesAdded,
        contribution.linesRemoved,
        contribution.pullRequestsMerged,
        contribution.issuesClosed,
        contribution.issuesOpened,
        Array.from(contribution.repositoriesContributed),
        contribution.rawScore,
        contribution.weightedScore,
        contribution.createdAt,
        contribution.updatedAt,
      ]
    );
  },

  async getRange(orgId: number, userId: number, startDate: string, endDate: string): Promise<DailyContribution[]> {
    const rows = await query<{
      id: string;
      org_id: number;
      user_id: number;
      user_login: string;
      date: string;
      commits: number;
      lines_added: number;
      lines_removed: number;
      pull_requests_merged: number;
      issues_closed: number;
      issues_opened: number;
      repositories_contributed: number[];
      raw_score: string;
      weighted_score: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT * FROM daily_contributions 
       WHERE org_id = $1 AND user_id = $2 AND date >= $3 AND date <= $4
       ORDER BY date ASC`,
      [orgId, userId, startDate, endDate]
    );

    return rows.map((row) => ({
      id: row.id,
      orgId: row.org_id,
      userId: row.user_id,
      userLogin: row.user_login,
      date: row.date,
      commits: row.commits,
      linesAdded: row.lines_added,
      linesRemoved: row.lines_removed,
      pullRequestsMerged: row.pull_requests_merged,
      issuesClosed: row.issues_closed,
      issuesOpened: row.issues_opened,
      repositoriesContributed: new Set(row.repositories_contributed),
      rawScore: parseFloat(row.raw_score),
      weightedScore: parseFloat(row.weighted_score),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  },

  async getDates(orgId: number, userId: number): Promise<string[]> {
    const rows = await query<{ date: string }>(
      'SELECT DISTINCT date FROM daily_contributions WHERE org_id = $1 AND user_id = $2 ORDER BY date ASC',
      [orgId, userId]
    );
    return rows.map((r) => r.date);
  },

  async getContributors(orgId: number): Promise<Array<{ userId: number; userLogin: string }>> {
    const rows = await query<{ user_id: number; user_login: string }>(
      'SELECT DISTINCT user_id, user_login FROM daily_contributions WHERE org_id = $1',
      [orgId]
    );
    return rows.map((r) => ({ userId: r.user_id, userLogin: r.user_login }));
  },

  async getFirstContributors(orgId: number, month: string): Promise<Array<{ userId: number; userLogin: string }>> {
    const [year, monthNum] = month.split('-');
    const startDate = `${year}-${monthNum}-01`;
    const endDate = `${year}-${monthNum}-31`;

    const rows = await query<{ user_id: number; user_login: string }>(
      `SELECT DISTINCT user_id, user_login 
       FROM daily_contributions 
       WHERE org_id = $1 AND date >= $2 AND date <= $3
       AND user_id NOT IN (
         SELECT DISTINCT user_id FROM daily_contributions 
         WHERE org_id = $1 AND date < $2
       )`,
      [orgId, startDate, endDate]
    );

    return rows.map((r) => ({ userId: r.user_id, userLogin: r.user_login }));
  },

  async getOrgDailyTotals(orgId: number, days: number): Promise<Array<{ date: string; count: number }>> {
    const rows = await query<{ date: string; total: string }>(
      `SELECT date, SUM(commits + pull_requests_merged + issues_closed) as total
       FROM daily_contributions 
       WHERE org_id = $1 AND date >= NOW() - INTERVAL '${days} days'
       GROUP BY date
       ORDER BY date ASC`,
      [orgId]
    );

    return rows.map((r) => ({ date: r.date, count: parseInt(r.total, 10) }));
  },

  async getForPeriod(
    orgId: number,
    userId: number,
    startDate: Date,
    endDate: Date
  ): Promise<DailyContribution[]> {
    const startStr = startDate.toISOString().split('T')[0] ?? '';
    const endStr = endDate.toISOString().split('T')[0] ?? '';
    return this.getRange(orgId, userId, startStr, endStr);
  },
};

// ============================================================================
// Aggregated Stats Repository
// ============================================================================

const aggregatesRepo = {
  async upsert(stats: AggregatedStats): Promise<void> {
    await query(
      `INSERT INTO aggregated_stats 
       (id, org_id, user_id, user_login, user_avatar_url, period, start_date, end_date,
        total_commits, total_lines_added, total_lines_removed, total_pull_requests_merged,
        total_issues_closed, total_issues_opened, unique_repositories, current_streak,
        longest_streak, raw_score, weighted_score, rank, active_days)
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       ON CONFLICT (org_id, user_id, period) 
       DO UPDATE SET 
         user_login = $3, user_avatar_url = $4, start_date = $6, end_date = $7,
         total_commits = $8, total_lines_added = $9, total_lines_removed = $10,
         total_pull_requests_merged = $11, total_issues_closed = $12, total_issues_opened = $13,
         unique_repositories = $14, current_streak = $15, longest_streak = $16,
         raw_score = $17, weighted_score = $18, rank = $19, active_days = $20`,
      [
        stats.orgId,
        stats.userId,
        stats.userLogin,
        stats.userAvatarUrl,
        stats.period,
        stats.startDate,
        stats.endDate,
        stats.totalCommits,
        stats.totalLinesAdded,
        stats.totalLinesRemoved,
        stats.totalPullRequestsMerged,
        stats.totalIssuesClosed,
        stats.totalIssuesOpened,
        stats.uniqueRepositories,
        stats.currentStreak,
        stats.longestStreak,
        stats.rawScore,
        stats.weightedScore,
        stats.rank,
        stats.activeDays,
      ]
    );
  },

  async get(orgId: number, userId: number, period: StatsPeriod): Promise<AggregatedStats | null> {
    const row = await queryOne<{
      org_id: number;
      user_id: number;
      user_login: string;
      user_avatar_url: string;
      period: string;
      start_date: string;
      end_date: string;
      total_commits: number;
      total_lines_added: number;
      total_lines_removed: number;
      total_pull_requests_merged: number;
      total_issues_closed: number;
      total_issues_opened: number;
      unique_repositories: number;
      current_streak: number;
      longest_streak: number;
      raw_score: string;
      weighted_score: string;
      rank: string;
      active_days: number;
    }>(
      'SELECT * FROM aggregated_stats WHERE org_id = $1 AND user_id = $2 AND period = $3',
      [orgId, userId, period]
    );

    if (!row) return null;

    return mapAggregatedStats(row);
  },

  async getByOrg(orgId: number, period: StatsPeriod): Promise<AggregatedStats[]> {
    const rows = await query<{
      org_id: number;
      user_id: number;
      user_login: string;
      user_avatar_url: string;
      period: string;
      start_date: string;
      end_date: string;
      total_commits: number;
      total_lines_added: number;
      total_lines_removed: number;
      total_pull_requests_merged: number;
      total_issues_closed: number;
      total_issues_opened: number;
      unique_repositories: number;
      current_streak: number;
      longest_streak: number;
      raw_score: string;
      weighted_score: string;
      rank: string;
      active_days: number;
    }>(
      'SELECT * FROM aggregated_stats WHERE org_id = $1 AND period = $2 ORDER BY weighted_score DESC',
      [orgId, period]
    );

    return rows.map(mapAggregatedStats);
  },

  async getByOrgAndMonth(orgId: number, month: string): Promise<AggregatedStats[]> {
    const rows = await query<{
      org_id: number;
      user_id: number;
      user_login: string;
      user_avatar_url: string;
      period: string;
      start_date: string;
      end_date: string;
      total_commits: number;
      total_lines_added: number;
      total_lines_removed: number;
      total_pull_requests_merged: number;
      total_issues_closed: number;
      total_issues_opened: number;
      unique_repositories: number;
      current_streak: number;
      longest_streak: number;
      raw_score: string;
      weighted_score: string;
      rank: string;
      active_days: number;
    }>(
      `SELECT * FROM aggregated_stats 
       WHERE org_id = $1 AND period = 'monthly' AND start_date LIKE $2`,
      [orgId, `${month}%`]
    );

    return rows.map(mapAggregatedStats);
  },
};

function mapAggregatedStats(row: {
  org_id: number;
  user_id: number;
  user_login: string;
  user_avatar_url: string;
  period: string;
  start_date: string;
  end_date: string;
  total_commits: number;
  total_lines_added: number;
  total_lines_removed: number;
  total_pull_requests_merged: number;
  total_issues_closed: number;
  total_issues_opened: number;
  unique_repositories: number;
  current_streak: number;
  longest_streak: number;
  raw_score: string;
  weighted_score: string;
  rank: string;
  active_days: number;
}): AggregatedStats {
  return {
    orgId: row.org_id,
    userId: row.user_id,
    userLogin: row.user_login,
    userAvatarUrl: row.user_avatar_url,
    period: row.period as StatsPeriod,
    startDate: row.start_date,
    endDate: row.end_date,
    totalCommits: row.total_commits,
    totalLinesAdded: row.total_lines_added,
    totalLinesRemoved: row.total_lines_removed,
    totalPullRequestsMerged: row.total_pull_requests_merged,
    totalIssuesClosed: row.total_issues_closed,
    totalIssuesOpened: row.total_issues_opened,
    uniqueRepositories: row.unique_repositories,
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    rawScore: parseFloat(row.raw_score),
    weightedScore: parseFloat(row.weighted_score),
    rank: row.rank as AggregatedStats['rank'],
    activeDays: row.active_days,
  };
}

// ============================================================================
// Streaks Repository
// ============================================================================

const streaksRepo = {
  async upsert(streak: StreakInfo): Promise<void> {
    await query(
      `INSERT INTO streaks 
       (id, org_id, user_id, user_login, current_streak, longest_streak, 
        last_contribution_date, streak_start_date, longest_streak_start_date, longest_streak_end_date)
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (org_id, user_id) 
       DO UPDATE SET 
         current_streak = $4, longest_streak = $5, last_contribution_date = $6,
         streak_start_date = $7, longest_streak_start_date = $8, longest_streak_end_date = $9`,
      [
        streak.orgId,
        streak.userId,
        streak.userLogin,
        streak.currentStreak,
        streak.longestStreak,
        streak.lastContributionDate,
        streak.streakStartDate,
        streak.longestStreakStartDate,
        streak.longestStreakEndDate,
      ]
    );
  },

  async get(orgId: number, userId: number): Promise<StreakInfo | null> {
    const row = await queryOne<{
      org_id: number;
      user_id: number;
      user_login: string;
      current_streak: number;
      longest_streak: number;
      last_contribution_date: string;
      streak_start_date: string;
      longest_streak_start_date: string;
      longest_streak_end_date: string;
    }>(
      'SELECT * FROM streaks WHERE org_id = $1 AND user_id = $2',
      [orgId, userId]
    );

    if (!row) return null;

    return {
      orgId: row.org_id,
      userId: row.user_id,
      userLogin: row.user_login,
      currentStreak: row.current_streak,
      longestStreak: row.longest_streak,
      lastContributionDate: row.last_contribution_date,
      streakStartDate: row.streak_start_date,
      longestStreakStartDate: row.longest_streak_start_date,
      longestStreakEndDate: row.longest_streak_end_date,
    };
  },

  async getByOrg(orgId: number): Promise<StreakInfo[]> {
    const rows = await query<{
      org_id: number;
      user_id: number;
      user_login: string;
      current_streak: number;
      longest_streak: number;
      last_contribution_date: string;
      streak_start_date: string;
      longest_streak_start_date: string;
      longest_streak_end_date: string;
    }>(
      'SELECT * FROM streaks WHERE org_id = $1 ORDER BY current_streak DESC',
      [orgId]
    );

    return rows.map((row) => ({
      orgId: row.org_id,
      userId: row.user_id,
      userLogin: row.user_login,
      currentStreak: row.current_streak,
      longestStreak: row.longest_streak,
      lastContributionDate: row.last_contribution_date,
      streakStartDate: row.streak_start_date,
      longestStreakStartDate: row.longest_streak_start_date,
      longestStreakEndDate: row.longest_streak_end_date,
    }));
  },
};

// ============================================================================
// Awards Repository
// ============================================================================

const awardsRepo = {
  async upsert(award: Award): Promise<void> {
    await query(
      `INSERT INTO awards 
       (id, org_id, user_id, user_login, award_type, title, description, month, awarded_at, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (org_id, user_id, award_type, month) 
       DO UPDATE SET title = $6, description = $7, awarded_at = $9, metadata = $10`,
      [
        award.id,
        award.orgId,
        award.userId,
        award.userLogin,
        award.type,
        award.title,
        award.description,
        award.month,
        award.awardedAt,
        award.metadata ? JSON.stringify(award.metadata) : null,
      ]
    );
  },

  async getByMonth(orgId: number, month: string): Promise<Award[]> {
    const rows = await query<{
      id: string;
      org_id: number;
      user_id: number;
      user_login: string;
      award_type: string;
      title: string;
      description: string;
      month: string;
      awarded_at: Date;
      metadata: Record<string, unknown>;
    }>(
      'SELECT * FROM awards WHERE org_id = $1 AND month = $2',
      [orgId, month]
    );

    return rows.map((row) => ({
      id: row.id,
      orgId: row.org_id,
      userId: row.user_id,
      userLogin: row.user_login,
      type: row.award_type as Award['type'],
      title: row.title,
      description: row.description,
      month: row.month,
      awardedAt: row.awarded_at,
      metadata: row.metadata,
    }));
  },

  async getByUser(orgId: number, userId: number): Promise<Award[]> {
    const rows = await query<{
      id: string;
      org_id: number;
      user_id: number;
      user_login: string;
      award_type: string;
      title: string;
      description: string;
      month: string;
      awarded_at: Date;
      metadata: Record<string, unknown>;
    }>(
      'SELECT * FROM awards WHERE org_id = $1 AND user_id = $2 ORDER BY awarded_at DESC',
      [orgId, userId]
    );

    return rows.map((row) => ({
      id: row.id,
      orgId: row.org_id,
      userId: row.user_id,
      userLogin: row.user_login,
      type: row.award_type as Award['type'],
      title: row.title,
      description: row.description,
      month: row.month,
      awardedAt: row.awarded_at,
      metadata: row.metadata,
    }));
  },
};

// ============================================================================
// Processed Events Repository
// ============================================================================

const processedEventsRepo = {
  async record(event: ProcessedEvent): Promise<void> {
    await query(
      `INSERT INTO processed_events (id, event_type, delivery_id, installation_id, org_id, processed_at, success, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (delivery_id) DO NOTHING`,
      [
        event.id,
        event.eventType,
        event.deliveryId,
        event.installationId,
        event.orgId,
        event.processedAt,
        event.success,
        event.error,
      ]
    );
  },

  async exists(deliveryId: string): Promise<boolean> {
    const row = await queryOne<{ id: string }>(
      'SELECT id FROM processed_events WHERE delivery_id = $1',
      [deliveryId]
    );
    return row !== null;
  },
};

// ============================================================================
// Privacy Repository
// ============================================================================

const privacyRepo = {
  async get(installationId: number, userId: number): Promise<UserPrivacySettings | null> {
    const row = await queryOne<{
      org_id: number;
      user_id: number;
      user_login: string;
      opted_out: boolean;
      hide_from_leaderboard: boolean;
      hide_score: boolean;
      hide_streak: boolean;
      created_at: Date;
      updated_at: Date;
    }>(
      'SELECT * FROM user_privacy WHERE org_id = $1 AND user_id = $2',
      [installationId, userId]
    );

    if (!row) return null;

    return {
      orgId: row.org_id,
      userId: row.user_id,
      userLogin: row.user_login,
      optedOut: row.opted_out,
      hideFromLeaderboard: row.hide_from_leaderboard,
      hideScore: row.hide_score,
      hideStreak: row.hide_streak,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  async upsert(
    orgId: number,
    userId: number,
    optedOut: boolean,
    showDetailedStats: boolean,
    showOnLeaderboard: boolean
  ): Promise<void> {
    await query(
      `INSERT INTO user_privacy (org_id, user_id, user_login, opted_out, hide_from_leaderboard, hide_score, hide_streak, updated_at)
       VALUES ($1, $2, '', $3, $4, $5, $5, NOW())
       ON CONFLICT (org_id, user_id) 
       DO UPDATE SET 
         opted_out = $3,
         hide_from_leaderboard = $4,
         hide_score = $5,
         hide_streak = $5,
         updated_at = NOW()`,
      [orgId, userId, optedOut, !showOnLeaderboard, !showDetailedStats]
    );
  },

  async getOptedOutUsers(orgId: number): Promise<number[]> {
    const rows = await query<{ user_id: number }>(
      'SELECT user_id FROM user_privacy WHERE org_id = $1 AND opted_out = true',
      [orgId]
    );
    return rows.map((r) => r.user_id);
  },
};

// ============================================================================
// Export Repository
// ============================================================================

export const repository = {
  installations: installationsRepo,
  users: usersRepo,
  contributions: contributionsRepo,
  aggregates: aggregatesRepo,
  streaks: streaksRepo,
  awards: awardsRepo,
  processedEvents: processedEventsRepo,
  privacy: privacyRepo,
  
  // Pool management
  initialize: initializePool,
  close: closePool,
  getPool,
  
  // Direct query access
  async query<T = Record<string, unknown>>(
    text: string, 
    params?: unknown[]
  ): Promise<T[]> {
    return query<T>(text, params);
  },
};
