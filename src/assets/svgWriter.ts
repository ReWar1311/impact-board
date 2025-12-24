import { generateLeaderboardSvg } from '../svg/leaderboard';
import { generateHeatmapSvg } from '../svg/heatmap';
import { DEFAULT_ASSETS_BASE_PATH } from '../config/constants';
import { createOctokitClient } from '../github/client';
import { repository } from '../storage/repository';
import type { LeaderboardEntry } from '../types';

/**
 * Upsert a file in the .github repo with retry logic for SHA conflicts
 * Returns the path that was written
 */
async function upsertFile(
  installationId: number,
  orgLogin: string,
  filePath: string,
  content: string,
  maxRetries = 3
): Promise<string> {
  const octokit = await createOctokitClient(installationId);
  const owner = orgLogin;
  const repo = '.github';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // Get fresh SHA on each attempt
    let sha: string | undefined;
    try {
      const existing = await octokit.repos.getContent({ owner, repo, path: filePath });
      if ('sha' in existing.data) sha = existing.data.sha as string;
    } catch (_) {}

    try {
      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: filePath,
        message: '🖼️ Update ImpactBoard assets',
        content: Buffer.from(content).toString('base64'),
        sha,
      });
      return filePath;
    } catch (error: unknown) {
      const isConflict = error instanceof Error && 'status' in error && (error as { status: number }).status === 409;
      if (isConflict && attempt < maxRetries) {
        // SHA conflict - wait briefly and retry with fresh SHA
        await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
        continue;
      }
      throw error;
    }
  }

  return filePath;
}

/**
 * Get the SVG reference URL for use in README
 */
export function getSvgReference(orgLogin: string, svgPath: string): string {
  // Use raw GitHub URL for the SVG
  return `https://raw.githubusercontent.com/${orgLogin}/.github/main/${svgPath}`;
}

/**
 * Generate a theme-aware picture element markdown for light/dark mode
 * Uses GitHub's special theme suffix hack
 */
export function getThemedSvgMarkdown(orgLogin: string, lightPath: string, darkPath: string, alt: string): string {
  const lightUrl = getSvgReference(orgLogin, lightPath);
  const darkUrl = getSvgReference(orgLogin, darkPath);
  // GitHub supports #gh-light-mode-only and #gh-dark-mode-only fragments
  return `<picture>
  <source media="(prefers-color-scheme: dark)" srcset="${darkUrl}">
  <source media="(prefers-color-scheme: light)" srcset="${lightUrl}">
  <img alt="${alt}" src="${lightUrl}">
</picture>`;
}

/**
 * Write leaderboard SVG (light mode) and return the file path
 */
export async function writeLeaderboardSvg(
  installationId: number,
  orgId: number,
  orgLogin: string,
  basePath: string | undefined,
  entries: LeaderboardEntry[]
): Promise<string> {
  const optedOut = new Set(await repository.privacy.getOptedOutUsers(orgId));
  const publicEntries = entries.filter((e) => !optedOut.has(e.userId));
  const svg = generateLeaderboardSvg(publicEntries, `${orgLogin} Top Contributors`, { darkMode: false });
  const filePath = `${basePath ?? DEFAULT_ASSETS_BASE_PATH}/leaderboard.svg`;
  await upsertFile(installationId, orgLogin, filePath, svg);
  return filePath;
}

/**
 * Write leaderboard SVG (dark mode) and return the file path
 */
export async function writeLeaderboardSvgDark(
  installationId: number,
  orgId: number,
  orgLogin: string,
  basePath: string | undefined,
  entries: LeaderboardEntry[]
): Promise<string> {
  const optedOut = new Set(await repository.privacy.getOptedOutUsers(orgId));
  const publicEntries = entries.filter((e) => !optedOut.has(e.userId));
  const svg = generateLeaderboardSvg(publicEntries, `${orgLogin} Top Contributors`, { darkMode: true });
  const filePath = `${basePath ?? DEFAULT_ASSETS_BASE_PATH}/leaderboard-dark.svg`;
  await upsertFile(installationId, orgLogin, filePath, svg);
  return filePath;
}

/**
 * Write heatmap SVG (light mode) and return the file path
 */
export async function writeHeatmapSvg(
  installationId: number,
  orgId: number,
  orgLogin: string,
  basePath: string | undefined,
  data: Array<{ date: string; count: number }>
): Promise<string> {
  // If no data, generate empty but valid SVG
  const svg = data.length > 0 ? generateHeatmapSvg(data, { darkMode: false }) : '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>';
  const filePath = `${basePath ?? DEFAULT_ASSETS_BASE_PATH}/heatmap.svg`;
  await upsertFile(installationId, orgLogin, filePath, svg);
  return filePath;
}

/**
 * Write heatmap SVG (dark mode) and return the file path
 */
export async function writeHeatmapSvgDark(
  installationId: number,
  orgId: number,
  orgLogin: string,
  basePath: string | undefined,
  data: Array<{ date: string; count: number }>
): Promise<string> {
  const svg = data.length > 0 ? generateHeatmapSvg(data, { darkMode: true }) : '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>';
  const filePath = `${basePath ?? DEFAULT_ASSETS_BASE_PATH}/heatmap-dark.svg`;
  await upsertFile(installationId, orgLogin, filePath, svg);
  return filePath;
}

export interface SvgAssetPaths {
  leaderboard: string;
  leaderboardDark: string;
  heatmap: string;
  heatmapDark: string;
}

/**
 * Write all SVG assets (light + dark) and return their paths
 */
export async function writeAllSvgAssets(
  installationId: number,
  orgId: number,
  orgLogin: string,
  basePath: string | undefined,
  entries: LeaderboardEntry[],
  heatmapData: Array<{ date: string; count: number }>
): Promise<SvgAssetPaths> {
  const [leaderboard, leaderboardDark, heatmap, heatmapDark] = await Promise.all([
    writeLeaderboardSvg(installationId, orgId, orgLogin, basePath, entries),
    writeLeaderboardSvgDark(installationId, orgId, orgLogin, basePath, entries),
    writeHeatmapSvg(installationId, orgId, orgLogin, basePath, heatmapData),
    writeHeatmapSvgDark(installationId, orgId, orgLogin, basePath, heatmapData),
  ]);
  return { leaderboard, leaderboardDark, heatmap, heatmapDark };
}