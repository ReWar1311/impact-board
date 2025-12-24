import { repository } from '../storage/repository';
import { aggregator } from '../stats/aggregator';
import { getSvgReference, getThemedSvgMarkdown } from '../assets/svgWriter';
import type { AggregatedStats, RepoAggregatedStats, OrgStatsSummary, StatsPeriod } from '../types';
import type { ImpactYamlConfig } from '../types/schemas';

interface PlaceholderMatch {
  full: string;
  entity: 'USER' | 'REPO' | 'ORG' | 'SVG';
  selector: string;
  field: string;
  options: Record<string, string>;
}

interface PlaceholderContext {
  svgPaths?: { leaderboard: string; leaderboardDark: string; heatmap: string; heatmapDark: string };
  basePath?: string;
}

const PLACEHOLDER_REGEX = /\{\{IMPACTBOARD:([A-Z]+)\.([A-Z_]+(?:\([^)]*\))?)\.?([a-z_]*)(?:\s*\|\s*([^}]+))?\}\}/g;

function parseOptions(raw?: string): Record<string, string> {
  if (!raw) return {};
  const result: Record<string, string> = {};
  for (const part of raw.split(',').map((s) => s.trim())) {
    const [k, v] = part.split('=').map((s) => s.trim());
    if (k) result[k] = v ?? '';
  }
  return result;
}

function parsePlaceholder(text: string): PlaceholderMatch[] {
  const matches: PlaceholderMatch[] = [];
  let m: RegExpExecArray | null;
  while ((m = PLACEHOLDER_REGEX.exec(text)) !== null) {
    matches.push({
      full: m[0],
      entity: m[1] as PlaceholderMatch['entity'],
      selector: m[2] ?? '',
      field: m[3] ?? '',
      options: parseOptions(m[4]),
    });
  }
  return matches;
}

function getPeriodFromOptions(options: Record<string, string>, allowed: string[], def: StatsPeriod): StatsPeriod {
  const opt = options['window'];
  if (opt && (allowed as string[]).includes(opt)) {
    return opt as StatsPeriod;
  }
  return def;
}

function applyPrivacyFilter(orgId: number, stats: AggregatedStats[], optedOut: Set<number>): AggregatedStats[] {
  return stats.filter((s) => !optedOut.has(s.userId));
}

function resolveUserField(field: string, stat: AggregatedStats): string {
  switch (field) {
    case 'username':
      return `@${stat.userLogin}`;
    case 'commits':
      return String(stat.totalCommits);
    case 'prs':
      return String(stat.totalPullRequestsMerged);
    case 'issues_closed':
      return String(stat.totalIssuesClosed);
    case 'issues_open':
      return String(stat.totalIssuesOpened);
    case 'loc_added':
      return String(stat.totalLinesAdded);
    case 'loc_removed':
      return String(stat.totalLinesRemoved);
    case 'streak':
      return String(stat.currentStreak);
    case 'rank':
      return stat.rank;
    case 'impact':
      return String(Math.round(stat.weightedScore));
    case 'repos':
      return String(stat.uniqueRepositories);
    case 'last_active':
      return stat.endDate;
    default:
      return '';
  }
}

function selectUser(stats: AggregatedStats[], selector: string): AggregatedStats | null {
  // TOP(n), RANK(n), USERNAME(x), NEW(n), ACTIVE(n)
  const topMatch = /^TOP\((\d+)\)$/.exec(selector);
  if (topMatch) {
    const idx = parseInt(topMatch[1] ?? '0', 10) - 1;
    if (idx >= 0 && idx < stats.length) return stats[idx] ?? null;
    return null;
  }
  const rankMatch = /^RANK\((\d+)\)$/.exec(selector);
  if (rankMatch) {
    const idx = parseInt(rankMatch[1] ?? '0', 10) - 1;
    if (idx >= 0 && idx < stats.length) return stats[idx] ?? null;
    return null;
  }
  const usernameMatch = /^USERNAME\(([^)]+)\)$/.exec(selector);
  if (usernameMatch) {
    const login = usernameMatch[1];
    return stats.find((s) => s.userLogin === login) ?? null;
  }
  // NEW(n) - newest contributors (by start date descending)
  const newMatch = /^NEW\((\d+)\)$/.exec(selector);
  if (newMatch) {
    const sorted = [...stats].sort((a, b) => b.startDate.localeCompare(a.startDate));
    const idx = parseInt(newMatch[1] ?? '0', 10) - 1;
    if (idx >= 0 && idx < sorted.length) return sorted[idx] ?? null;
    return null;
  }
  // ACTIVE(n) - most recently active
  const activeMatch = /^ACTIVE\((\d+)\)$/.exec(selector);
  if (activeMatch) {
    const sorted = [...stats].sort((a, b) => b.endDate.localeCompare(a.endDate));
    const idx = parseInt(activeMatch[1] ?? '0', 10) - 1;
    if (idx >= 0 && idx < sorted.length) return sorted[idx] ?? null;
    return null;
  }
  return null;
}

/**
 * Select a repo from stats by selector
 */
function selectRepo(stats: RepoAggregatedStats[], selector: string): RepoAggregatedStats | null {
  // TOP(n), RANK(n), NAME(x)
  const topMatch = /^TOP\((\d+)\)$/.exec(selector);
  if (topMatch) {
    const idx = parseInt(topMatch[1] ?? '0', 10) - 1;
    if (idx >= 0 && idx < stats.length) return stats[idx] ?? null;
    return null;
  }
  const rankMatch = /^RANK\((\d+)\)$/.exec(selector);
  if (rankMatch) {
    const idx = parseInt(rankMatch[1] ?? '0', 10) - 1;
    if (idx >= 0 && idx < stats.length) return stats[idx] ?? null;
    return null;
  }
  const nameMatch = /^NAME\(([^)]+)\)$/.exec(selector);
  if (nameMatch) {
    const name = nameMatch[1];
    return stats.find((s) => s.repoName === name) ?? null;
  }
  return null;
}

/**
 * Resolve REPO fields
 */
function resolveRepoField(field: string, stat: RepoAggregatedStats): string {
  switch (field) {
    case 'name':
      return stat.repoName;
    case 'commits':
      return String(stat.totalCommits);
    case 'prs':
      return String(stat.totalPullRequestsMerged);
    case 'issues':
      return String(stat.totalIssues);
    case 'loc_added':
      return String(stat.totalLinesAdded);
    case 'contributors':
      return String(stat.uniqueContributors);
    case 'status':
      return stat.status;
    default:
      return '';
  }
}

/**
 * Resolve ORG fields from summary
 */
function resolveOrgField(field: string, summary: OrgStatsSummary): string {
  switch (field) {
    case 'active_users':
      return String(summary.activeUsers);
    case 'total_commits':
      return String(summary.totalCommits);
    case 'total_prs':
      return String(summary.totalPullRequests);
    case 'total_loc_added':
      return String(summary.totalLinesAdded);
    case 'total_repos':
      return String(summary.totalRepositories);
    case 'health_score':
      return String(summary.healthScore);
    default:
      return '';
  }
}

/**
 * Resolve placeholders in README content with privacy-safe behavior.
 * - YAML decides what’s allowed; disallowed placeholders are left untouched.
 * - Privacy filtering applied before ranking/selection.
 * - Fallback used when resolution fails. * - SVG placeholders resolve to file references (not inline). */
export async function resolvePlaceholders(
  orgId: number,
  installationId: number,
  orgLogin: string,
  readmeContent: string,
  yaml: ImpactYamlConfig,
  context?: PlaceholderContext
): Promise<string> {
  // If not in full mode, leave content unchanged
  if (yaml.mode !== 'full') return readmeContent;

  const matches = parsePlaceholder(readmeContent);
  if (matches.length === 0) return readmeContent;

  // Use defaults if readme config is not defined
  const readmeConfig = yaml.readme ?? {
    file: '.github/profile/README.md',
    allow: {
      entities: ['USER', 'REPO', 'ORG'] as ('USER' | 'REPO' | 'ORG')[],
      user_selectors: { top_max: 5, allow_username: true },
      fields: ['username', 'commits', 'prs', 'streak', 'loc_added', 'impact'] as const,
      max_placeholders: 100,
    },
  };

  // Enforce max placeholders
  const maxPlaceholders = readmeConfig.allow.max_placeholders;
  const limited = matches.slice(0, maxPlaceholders);

  // Determine default/allowed windows
  const defaultWindow = yaml.data?.windows?.default ?? '30d';
  const allowedWindows = yaml.data?.windows?.allowed ?? ['7d', '30d', '90d', 'all-time'];

  // Preload privacy data
  const optedOutIds = new Set<number>(await repository.privacy.getOptedOutUsers(orgId));

  // Resolve each placeholder independently
  let result = readmeContent;
  for (const p of limited) {
    const fallback = p.options['fallback'] ?? '';

    // Handle SVG placeholders - e.g., {{IMPACTBOARD:SVG.LEADERBOARD}} or {{IMPACTBOARD:SVG.LEADERBOARD_THEMED}}
    if (p.entity === 'SVG') {
      if (context?.svgPaths) {
        const svgType = p.selector.toLowerCase();
        // Themed variants emit <picture> with light/dark sources
        if (svgType === 'leaderboard_themed' && context.svgPaths.leaderboard && context.svgPaths.leaderboardDark) {
          const html = getThemedSvgMarkdown(orgLogin, context.svgPaths.leaderboard, context.svgPaths.leaderboardDark, 'Leaderboard');
          result = result.replace(p.full, html);
          continue;
        }
        if (svgType === 'heatmap_themed' && context.svgPaths.heatmap && context.svgPaths.heatmapDark) {
          const html = getThemedSvgMarkdown(orgLogin, context.svgPaths.heatmap, context.svgPaths.heatmapDark, 'Activity Heatmap');
          result = result.replace(p.full, html);
          continue;
        }
        // Non-themed - just light mode URL
        if (svgType === 'leaderboard' && context.svgPaths.leaderboard) {
          const url = getSvgReference(orgLogin, context.svgPaths.leaderboard);
          result = result.replace(p.full, url);
          continue;
        }
        if (svgType === 'heatmap' && context.svgPaths.heatmap) {
          const url = getSvgReference(orgLogin, context.svgPaths.heatmap);
          result = result.replace(p.full, url);
          continue;
        }
        // Dark-only variants
        if (svgType === 'leaderboard_dark' && context.svgPaths.leaderboardDark) {
          const url = getSvgReference(orgLogin, context.svgPaths.leaderboardDark);
          result = result.replace(p.full, url);
          continue;
        }
        if (svgType === 'heatmap_dark' && context.svgPaths.heatmapDark) {
          const url = getSvgReference(orgLogin, context.svgPaths.heatmapDark);
          result = result.replace(p.full, url);
          continue;
        }
      }
      result = result.replace(p.full, fallback);
      continue;
    }

    // Check if this entity type is allowed (only USER, REPO, ORG - not SVG)
    if (!readmeConfig.allow.entities.includes(p.entity as 'USER' | 'REPO' | 'ORG')) continue;

    const window = getPeriodFromOptions(p.options, allowedWindows as string[], defaultWindow as StatsPeriod);

    if (p.entity === 'USER') {
      // Fetch stats for window
      const statsRaw = await aggregator.getOrgStats(orgId, window as StatsPeriod);
      // Privacy before ranking
      const stats = applyPrivacyFilter(orgId, statsRaw, optedOutIds).sort((a, b) => b.weightedScore - a.weightedScore);

      // Enforce TOP(n) bounds from YAML
      const topMax = readmeConfig.allow.user_selectors.top_max;
      const topMatch = /^TOP\((\d+)\)$/.exec(p.selector);
      if (topMatch) {
        const n = parseInt(topMatch[1] ?? '0', 10);
        if (n > topMax) {
          // Skip or fallback when exceeding bounds
          result = result.replace(p.full, fallback);
          continue;
        }
      }

      const selected = selectUser(stats, p.selector);
      if (!selected) {
        result = result.replace(p.full, fallback);
        continue;
      }

      // Field-level privacy via YAML (public users only)
      const publicRules = yaml.privacy?.public_users?.[selected.userLogin];
      if (publicRules?.hide?.includes(p.field as any)) {
        result = result.replace(p.full, fallback);
        continue;
      }

      const value = resolveUserField(p.field, selected);
      result = result.replace(p.full, value || fallback);
      continue;
    }

    // Handle REPO entity
    if (p.entity === 'REPO') {
      const repoStats = await repository.repoAggregates.getByOrg(orgId, window as StatsPeriod);
      // Sort by commits (most active)
      const sorted = [...repoStats].sort((a, b) => b.totalCommits - a.totalCommits);
      const selected = selectRepo(sorted, p.selector);
      if (!selected) {
        result = result.replace(p.full, fallback);
        continue;
      }
      const value = resolveRepoField(p.field, selected);
      result = result.replace(p.full, value || fallback);
      continue;
    }

    // Handle ORG entity - simple fields without selector
    if (p.entity === 'ORG') {
      const summary = await repository.orgStats.getSummary(orgId, window as StatsPeriod);
      // For ORG, the selector IS the field (e.g., {{IMPACTBOARD:ORG.active_users}})
      const field = p.selector.toLowerCase();
      const value = resolveOrgField(field, summary);
      result = result.replace(p.full, value || fallback);
      continue;
    }
  }

  return result;
}

/**
 * Format a value according to format option
 */
export function formatValue(value: string | number, format?: string): string {
  const num = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (isNaN(num)) return String(value);

  switch (format) {
    case 'compact':
      if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
      if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
      return String(num);
    case 'number':
      return num.toLocaleString();
    case 'badge':
      return `\`${num}\``;
    case 'fire':
      return num > 0 ? `🔥 ${num}` : String(num);
    default:
      return String(value);
  }
}