import { repository } from '../storage/repository';
import { aggregator } from '../stats/aggregator';
import { getSvgReference } from '../assets/svgWriter';
import type { AggregatedStats, StatsPeriod } from '../types';
import type { ImpactYamlConfig } from '../types/schemas';

interface PlaceholderMatch {
  full: string;
  entity: 'USER' | 'REPO' | 'ORG' | 'SVG';
  selector: string;
  field: string;
  options: Record<string, string>;
}

interface PlaceholderContext {
  svgPaths?: { leaderboard: string; heatmap: string };
  basePath?: string;
}

const PLACEHOLDER_REGEX = /\{\{IMPACTBOARD:([A-Z]+)\.([A-Z_]+(?:\([^}]*\))?)\.?([a-z_]*)(?:\s*\|\s*([^}]+))?\}\}/g;

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
  // TOP(n), RANK(n), USERNAME(x)
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
  return null;
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
  // If YAML does not allow entities, leave content unchanged
  if (yaml.mode !== 'full' || !yaml.readme) return readmeContent;

  const matches = parsePlaceholder(readmeContent);
  if (matches.length === 0) return readmeContent;

  // Enforce max placeholders
  const maxPlaceholders = yaml.readme.allow.max_placeholders;
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

    // Handle SVG placeholders - e.g., {{IMPACTBOARD:SVG.LEADERBOARD}}
    if (p.entity === 'SVG') {
      if (context?.svgPaths) {
        const svgType = p.selector.toLowerCase();
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
      }
      result = result.replace(p.full, fallback);
      continue;
    }

    // Check if this entity type is allowed (only USER, REPO, ORG - not SVG)
    if (!yaml.readme.allow.entities.includes(p.entity as 'USER' | 'REPO' | 'ORG')) continue;

    const window = getPeriodFromOptions(p.options, allowedWindows as string[], defaultWindow as StatsPeriod);

    if (p.entity === 'USER') {
      // Fetch stats for window
      const statsRaw = await aggregator.getOrgStats(orgId, window as StatsPeriod);
      // Privacy before ranking
      const stats = applyPrivacyFilter(orgId, statsRaw, optedOutIds).sort((a, b) => b.weightedScore - a.weightedScore);

      // Enforce TOP(n) bounds from YAML
      const topMax = yaml.readme.allow.user_selectors.top_max;
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

    // REPO/ORG entities can be extended; for now, leave unchanged
  }

  return result;
}