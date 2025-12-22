import type { ImpactYamlConfig } from '../types/schemas';
import { aggregator } from '../stats/aggregator';
import { repository } from '../storage/repository';
import { generateLeaderboardSvg } from '../svg/leaderboard';

/**
 * Template mode: generate README content from predefined templates.
 * If required data is unavailable, omit the section.
 */
export async function renderTemplateReadme(
  orgId: number,
  orgLogin: string,
  yaml: ImpactYamlConfig
): Promise<string> {
  const opts = yaml.template?.overrides ?? {};
  const window = (opts.window ?? '30d') as any;

  const sections: string[] = [];
  sections.push(`# ${orgLogin} ImpactBoard`);

  // Leaderboard section
  if (yaml.template?.options?.show_leaderboard !== false) {
    const stats = await aggregator.getOrgStats(orgId, window);
    const optedOut = new Set(await repository.privacy.getOptedOutUsers(orgId));
    const publicStats = stats.filter((s) => !optedOut.has(s.userId)).sort((a, b) => b.weightedScore - a.weightedScore);
    const limit = yaml.template?.overrides?.leaderboard_limit ?? 10;
    const entries = publicStats.slice(0, limit).map((s, i) => ({
      rank: i + 1,
      userId: s.userId,
      userLogin: s.userLogin,
      userAvatarUrl: s.userAvatarUrl,
      weightedScore: s.weightedScore,
      contributorRank: s.rank,
      currentStreak: s.currentStreak,
      topMetric: 'score',
      topMetricValue: s.weightedScore,
    }));
    if (entries.length > 0) {
      const svg = generateLeaderboardSvg(entries, `${orgLogin} Top Contributors`);
      const encoded = Buffer.from(svg).toString('base64');
      sections.push(`
## 🏆 Leaderboard

<img alt="Leaderboard" src="data:image/svg+xml;base64,${encoded}">`);
    }
  }

  // Awards / repositories sections can be added similarly in future

  return sections.join('\n\n');
}