import type { ImpactYamlConfig } from '../types/schemas';
import { aggregator } from '../stats/aggregator';
import { repository } from '../storage/repository';
import { writeLeaderboardSvg, writeLeaderboardSvgDark, writeHeatmapSvg, writeHeatmapSvgDark, getThemedSvgMarkdown } from '../assets/svgWriter';
import { DEFAULT_ASSETS_BASE_PATH } from '../config/constants';

/**
 * Template mode: generate README content from predefined templates.
 * SVGs are stored as files (light + dark) and referenced via <picture> for theme support.
 * If required data is unavailable, omit the section.
 */
export async function renderTemplateReadme(
  installationId: number,
  orgId: number,
  orgLogin: string,
  yaml: ImpactYamlConfig
): Promise<string> {
  const opts = yaml.template?.overrides;
  const window = (opts?.window ?? '30d') as '7d' | '30d' | '90d' | 'all-time';
  const basePath = yaml.assets?.base_path ?? DEFAULT_ASSETS_BASE_PATH;

  const sections: string[] = [];
  sections.push(`# ${orgLogin} ImpactBoard`);

  // Leaderboard section
  if (yaml.template?.options?.show_leaderboard !== false) {
    const stats = await aggregator.getOrgStats(orgId, window);
    const optedOut = new Set(await repository.privacy.getOptedOutUsers(orgId));
    const publicStats = stats.filter((s) => !optedOut.has(s.userId)).sort((a, b) => b.weightedScore - a.weightedScore);
    const limit = opts?.leaderboard_limit ?? 10;
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
      // Write light and dark SVGs
      const [lightPath, darkPath] = await Promise.all([
        writeLeaderboardSvg(installationId, orgId, orgLogin, basePath, entries),
        writeLeaderboardSvgDark(installationId, orgId, orgLogin, basePath, entries),
      ]);
      const themedMarkdown = getThemedSvgMarkdown(orgLogin, lightPath, darkPath, 'Leaderboard');
      
      sections.push(`
## 🏆 Leaderboard

${themedMarkdown}`);
    }
  }

  // Heatmap section
  if (yaml.template?.options?.show_heatmap !== false) {
    const heatmapData = await repository.contributions.getOrgDailyTotals(orgId, 30);
    if (heatmapData.length > 0) {
      const [lightPath, darkPath] = await Promise.all([
        writeHeatmapSvg(installationId, orgId, orgLogin, basePath, heatmapData),
        writeHeatmapSvgDark(installationId, orgId, orgLogin, basePath, heatmapData),
      ]);
      const themedMarkdown = getThemedSvgMarkdown(orgLogin, lightPath, darkPath, 'Activity Heatmap');
      
      sections.push(`
## 📊 Activity

${themedMarkdown}`);
    }
  }

  return sections.join('\n\n');
}