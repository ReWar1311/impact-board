import { generateLeaderboardSvg } from '../svg/leaderboard';
import { generateHeatmapSvg } from '../svg/heatmap';
import { DEFAULT_ASSETS_BASE_PATH } from '../config/constants';
import { createOctokitClient } from '../github/client';
import { repository } from '../storage/repository';
import type { LeaderboardEntry } from '../types';

/**
 * Upsert a file in the .github repo
 * Returns the path that was written
 */
async function upsertFile(
  installationId: number,
  orgLogin: string,
  filePath: string,
  content: string
): Promise<string> {
  const octokit = await createOctokitClient(installationId);
  const owner = orgLogin;
  const repo = '.github';

  // Try to get existing file to retrieve sha
  let sha: string | undefined;
  try {
    const existing = await octokit.repos.getContent({ owner, repo, path: filePath });
    if ('sha' in existing.data) sha = existing.data.sha as string;
  } catch (_) {}

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: filePath,
    message: '🖼️ Update ImpactBoard assets',
    content: Buffer.from(content).toString('base64'),
    sha,
  });

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
 * Write leaderboard SVG and return the file path
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
  const svg = generateLeaderboardSvg(publicEntries, `${orgLogin} Top Contributors`);
  const filePath = `${basePath ?? DEFAULT_ASSETS_BASE_PATH}/leaderboard.svg`;
  await upsertFile(installationId, orgLogin, filePath, svg);
  return filePath;
}

/**
 * Write heatmap SVG and return the file path
 */
export async function writeHeatmapSvg(
  installationId: number,
  orgId: number,
  orgLogin: string,
  basePath: string | undefined,
  data: Array<{ date: string; count: number }>
): Promise<string> {
  // If no data, generate empty but valid SVG
  const svg = data.length > 0 ? generateHeatmapSvg(data) : '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>';
  const filePath = `${basePath ?? DEFAULT_ASSETS_BASE_PATH}/heatmap.svg`;
  await upsertFile(installationId, orgLogin, filePath, svg);
  return filePath;
}

/**
 * Write all SVG assets and return their paths
 */
export async function writeAllSvgAssets(
  installationId: number,
  orgId: number,
  orgLogin: string,
  basePath: string | undefined,
  entries: LeaderboardEntry[],
  heatmapData: Array<{ date: string; count: number }>
): Promise<{ leaderboard: string; heatmap: string }> {
  const leaderboardPath = await writeLeaderboardSvg(installationId, orgId, orgLogin, basePath, entries);
  const heatmapPath = await writeHeatmapSvg(installationId, orgId, orgLogin, basePath, heatmapData);
  return { leaderboard: leaderboardPath, heatmap: heatmapPath };
}