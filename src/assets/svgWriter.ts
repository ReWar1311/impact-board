import { generateLeaderboardSvg } from '../svg/leaderboard';
import { generateHeatmapSvg } from '../svg/heatmap';
import { DEFAULT_ASSETS_BASE_PATH } from '../config/constants';
import { createOctokitClient } from '../github/client';
import { repository } from '../storage/repository';
import type { LeaderboardEntry } from '../types';

async function upsertFile(
  installationId: number,
  orgLogin: string,
  path: string,
  content: string
): Promise<void> {
  const octokit = await createOctokitClient(installationId);
  const owner = orgLogin;
  const repo = '.github';

  // Try to get existing file to retrieve sha
  let sha: string | undefined;
  try {
    const existing = await octokit.repos.getContent({ owner, repo, path });
    if ('sha' in existing.data) sha = existing.data.sha as string;
  } catch (_) {}

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message: '🖼️ Update ImpactBoard assets',
    content: Buffer.from(content).toString('base64'),
    sha,
  });
}

export async function writeLeaderboardSvg(
  installationId: number,
  orgId: number,
  orgLogin: string,
  basePath: string | undefined,
  entries: LeaderboardEntry[]
): Promise<void> {
  const optedOut = new Set(await repository.privacy.getOptedOutUsers(orgId));
  const publicEntries = entries.filter((e) => !optedOut.has(e.userId));
  const svg = generateLeaderboardSvg(publicEntries, `${orgLogin} Top Contributors`);
  const path = `${basePath ?? DEFAULT_ASSETS_BASE_PATH}/leaderboard.svg`;
  await upsertFile(installationId, orgLogin, path, svg);
}

export async function writeHeatmapSvg(
  installationId: number,
  orgId: number,
  orgLogin: string,
  basePath: string | undefined,
  data: Array<{ date: string; count: number }>
): Promise<void> {
  // If no data, generate empty but valid SVG
  const svg = data.length > 0 ? generateHeatmapSvg(data) : '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>';
  const path = `${basePath ?? DEFAULT_ASSETS_BASE_PATH}/heatmap.svg`;
  await upsertFile(installationId, orgLogin, path, svg);
}