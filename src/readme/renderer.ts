import { logger } from '../utils/logger';
import { README_MARKERS } from '../config/constants';
import { formatTimestamp, getCurrentMonth } from '../utils/date';
import { generateLeaderboardSvg } from '../svg/leaderboard';
import { generateHeatmapSvg, generateMiniHeatmapSvg } from '../svg/heatmap';
import { generateStreakBadgeSvg, generateAwardBadgeSvg } from '../svg/badges';
import { ranks } from '../stats/ranks';
import type { Leaderboard, LeaderboardEntry, Award, StreakInfo, AggregatedStats } from '../types';

/**
 * README Renderer
 * 
 * Renders contribution stats into README content
 * Generates markdown and SVG sections for insertion
 */

interface RenderData {
  orgLogin: string;
  leaderboard: LeaderboardEntry[];
  topStreaks: StreakInfo[];
  awards: Award[];
  stats: AggregatedStats[];
  heatmapData?: Array<{ date: string; count: number }>;
  monthSummary?: {
    totalContributors: number;
    totalCommits: number;
    totalPrs: number;
    totalIssues: number;
    averageScore: number;
  };
}

/**
 * Render the leaderboard section
 */
export function renderLeaderboardSection(
  entries: LeaderboardEntry[],
  orgLogin: string
): string {
  if (entries.length === 0) {
    return `
${README_MARKERS.LEADERBOARD_START}

*No contributions recorded yet. Start contributing to appear on the leaderboard!*

${README_MARKERS.LEADERBOARD_END}`;
  }

  // Generate SVG for visual leaderboard
  const svgContent = generateLeaderboardSvg(entries, `${orgLogin} Top Contributors`);
  const encodedSvg = Buffer.from(svgContent).toString('base64');

  // Also generate a markdown table as fallback
  const tableRows = entries
    .slice(0, 10)
    .map((entry) => {
      const rankEmoji = ranks.getRankEmoji(entry.contributorRank);
      return `| ${entry.rank} | ${rankEmoji} | @${entry.userLogin} | ${entry.contributorRank} | ${Math.round(entry.weightedScore)} | ${entry.currentStreak}🔥 |`;
    })
    .join('\n');

  return `
${README_MARKERS.LEADERBOARD_START}

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="data:image/svg+xml;base64,${encodedSvg}">
  <source media="(prefers-color-scheme: light)" srcset="data:image/svg+xml;base64,${encodedSvg}">
  <img alt="Leaderboard" src="data:image/svg+xml;base64,${encodedSvg}">
</picture>

<details>
<summary>📊 View as Table</summary>

| Rank | | Contributor | Tier | Score | Streak |
|:----:|:-:|:------------|:----:|------:|:------:|
${tableRows}

</details>

${README_MARKERS.LEADERBOARD_END}`;
}

/**
 * Render the streaks section
 */
export function renderStreaksSection(streaks: StreakInfo[]): string {
  if (streaks.length === 0) {
    return `
${README_MARKERS.STREAKS_START}

*No active streaks yet. Make your first contribution today!*

${README_MARKERS.STREAKS_END}`;
  }

  const streakItems = streaks
    .filter((s) => s.currentStreak > 0)
    .slice(0, 5)
    .map((streak) => {
      const fire = streak.currentStreak >= 30 ? '🔥🔥🔥' : streak.currentStreak >= 14 ? '🔥🔥' : '🔥';
      return `- ${fire} **@${streak.userLogin}** - ${streak.currentStreak} day streak (longest: ${streak.longestStreak} days)`;
    })
    .join('\n');

  return `
${README_MARKERS.STREAKS_START}

${streakItems}

${README_MARKERS.STREAKS_END}`;
}

/**
 * Render the awards section
 */
export function renderAwardsSection(awards: Award[]): string {
  if (awards.length === 0) {
    return `
${README_MARKERS.AWARDS_START}

*No awards for this month yet. Keep contributing!*

${README_MARKERS.AWARDS_END}`;
  }

  const awardsByType = new Map<string, Award[]>();
  for (const award of awards) {
    const existing = awardsByType.get(award.type) ?? [];
    existing.push(award);
    awardsByType.set(award.type, existing);
  }

  const awardSections: string[] = [];
  
  for (const [type, typeAwards] of awardsByType.entries()) {
    const firstAward = typeAwards[0];
    if (!firstAward) continue;
    
    const winners = typeAwards
      .map((a) => `@${a.userLogin}`)
      .join(', ');
    
    awardSections.push(`- ${firstAward.title} - ${winners}`);
  }

  return `
${README_MARKERS.AWARDS_START}

### 🏅 ${getCurrentMonth()} Awards

${awardSections.join('\n')}

${README_MARKERS.AWARDS_END}`;
}

/**
 * Render the summary section
 */
export function renderSummarySection(summary?: RenderData['monthSummary']): string {
  if (!summary) {
    return `
${README_MARKERS.SUMMARY_START}

*Stats will be updated soon!*

${README_MARKERS.SUMMARY_END}`;
  }

  return `
${README_MARKERS.SUMMARY_START}

### 📈 This Month's Highlights

| Metric | Count |
|:-------|------:|
| 👥 Active Contributors | ${summary.totalContributors} |
| 📝 Commits | ${summary.totalCommits.toLocaleString()} |
| 🔀 Pull Requests Merged | ${summary.totalPrs.toLocaleString()} |
| ✅ Issues Resolved | ${summary.totalIssues.toLocaleString()} |
| ⭐ Average Score | ${Math.round(summary.averageScore)} |

${README_MARKERS.SUMMARY_END}`;
}

/**
 * Render the heatmap section
 */
export function renderHeatmapSection(
  data?: Array<{ date: string; count: number }>
): string {
  if (!data || data.length === 0) {
    return `
${README_MARKERS.HEATMAP_START}

*Contribution heatmap will appear once there's activity!*

${README_MARKERS.HEATMAP_END}`;
  }

  const svgContent = generateMiniHeatmapSvg(data);
  const encodedSvg = Buffer.from(svgContent).toString('base64');

  return `
${README_MARKERS.HEATMAP_START}

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="data:image/svg+xml;base64,${encodedSvg}">
  <source media="(prefers-color-scheme: light)" srcset="data:image/svg+xml;base64,${encodedSvg}">
  <img alt="Activity Heatmap" src="data:image/svg+xml;base64,${encodedSvg}">
</picture>

${README_MARKERS.HEATMAP_END}`;
}

/**
 * Render the timestamp section
 */
export function renderTimestampSection(): string {
  const timestamp = formatTimestamp(new Date());

  return `
${README_MARKERS.TIMESTAMP_START}
*Last updated: ${timestamp}*
${README_MARKERS.TIMESTAMP_END}`;
}

/**
 * Render all sections and combine into full content
 */
export function renderFullReadme(data: RenderData, existingContent?: string): string {
  const sections = {
    summary: renderSummarySection(data.monthSummary),
    leaderboard: renderLeaderboardSection(data.leaderboard, data.orgLogin),
    streaks: renderStreaksSection(data.topStreaks),
    awards: renderAwardsSection(data.awards),
    heatmap: renderHeatmapSection(data.heatmapData),
    timestamp: renderTimestampSection(),
  };

  if (existingContent) {
    // Update existing content by replacing marked sections
    let content = existingContent;
    
    content = replaceSection(content, README_MARKERS.SUMMARY_START, README_MARKERS.SUMMARY_END, sections.summary);
    content = replaceSection(content, README_MARKERS.LEADERBOARD_START, README_MARKERS.LEADERBOARD_END, sections.leaderboard);
    content = replaceSection(content, README_MARKERS.STREAKS_START, README_MARKERS.STREAKS_END, sections.streaks);
    content = replaceSection(content, README_MARKERS.AWARDS_START, README_MARKERS.AWARDS_END, sections.awards);
    content = replaceSection(content, README_MARKERS.HEATMAP_START, README_MARKERS.HEATMAP_END, sections.heatmap);
    content = replaceSection(content, README_MARKERS.TIMESTAMP_START, README_MARKERS.TIMESTAMP_END, sections.timestamp);
    
    return content;
  }

  // Generate new content from template
  return `# ${data.orgLogin} Contribution Stats

Welcome to **${data.orgLogin}**! Here's a summary of our community's contributions.

${sections.summary}

## 🏆 Leaderboard

Our top contributors this month:

${sections.leaderboard}

## 🔥 Contribution Streaks

Current active streaks:

${sections.streaks}

## 🏅 Monthly Awards

Recognition for outstanding contributions:

${sections.awards}

## 📊 Activity

${sections.heatmap}

---

${sections.timestamp}

*Powered by [Org Contribution Motivation](https://github.com/apps/org-contribution-motivation) - A GitHub App that motivates and celebrates contributors.*
`;
}

/**
 * Replace a marked section in content
 */
function replaceSection(
  content: string,
  startMarker: string,
  endMarker: string,
  newContent: string
): string {
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1) {
    // Markers not found, append at end
    return content + '\n\n' + newContent;
  }

  const before = content.substring(0, startIndex);
  const after = content.substring(endIndex + endMarker.length);

  return before + newContent + after;
}

/**
 * Check if content has all required markers
 */
export function hasRequiredMarkers(content: string): boolean {
  return (
    content.includes(README_MARKERS.LEADERBOARD_START) &&
    content.includes(README_MARKERS.LEADERBOARD_END)
  );
}

/**
 * Add required markers to content
 */
export function addMissingMarkers(content: string): string {
  let result = content;

  if (!result.includes(README_MARKERS.LEADERBOARD_START)) {
    result += `\n\n## 🏆 Leaderboard\n\n${README_MARKERS.LEADERBOARD_START}\n${README_MARKERS.LEADERBOARD_END}\n`;
  }

  if (!result.includes(README_MARKERS.STREAKS_START)) {
    result += `\n\n## 🔥 Streaks\n\n${README_MARKERS.STREAKS_START}\n${README_MARKERS.STREAKS_END}\n`;
  }

  if (!result.includes(README_MARKERS.AWARDS_START)) {
    result += `\n\n## 🏅 Awards\n\n${README_MARKERS.AWARDS_START}\n${README_MARKERS.AWARDS_END}\n`;
  }

  if (!result.includes(README_MARKERS.TIMESTAMP_START)) {
    result += `\n\n${README_MARKERS.TIMESTAMP_START}\n${README_MARKERS.TIMESTAMP_END}\n`;
  }

  return result;
}
