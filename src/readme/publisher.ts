import { logger } from '../utils/logger';
import { 
  getProfileRepository, 
  createProfileRepository, 
  getProfileReadme, 
  updateProfileReadme,
  getOrgConfig,
  createOctokitClient,
} from '../github/client';
import { repository } from '../storage/repository';
import { aggregator } from '../stats/aggregator';
import { streaks } from '../stats/streaks';
import { awards } from '../stats/awards';
import { 
  renderFullReadme, 
  hasRequiredMarkers, 
  addMissingMarkers,
} from './renderer';
import { fetchContributionCalendar } from '../github/queries';
import type { LeaderboardEntry, StoredInstallation, AggregatedStats } from '../types';
import fs from 'fs';
import path from 'path';
import { loadImpactYamlConfig } from '../config/impactYaml';
import { DEFAULT_ASSETS_BASE_PATH } from '../config/constants';
import { writeLeaderboardSvg, writeHeatmapSvg, writeAllSvgAssets, getSvgReference } from '../assets/svgWriter';
import { resolvePlaceholders } from './placeholderEngine';
import { renderTemplateReadme } from './templateEngine';

/**
 * README Publisher
 * 
 * Manages the organization profile README updates
 * Ensures deterministic, diff-friendly updates
 */

class ReadmePublisher {
  private templateContent: string | null = null;

  /**
   * Load the README template
   */
  private getTemplate(): string {
    if (this.templateContent) {
      return this.templateContent;
    }

    try {
      const templatePath = path.join(__dirname, 'template.md');
      this.templateContent = fs.readFileSync(templatePath, 'utf-8');
      return this.templateContent;
    } catch (error) {
      logger.warn('Could not load README template, using default');
      return this.getDefaultTemplate();
    }
  }

  /**
   * Get default template if file not found
   */
  private getDefaultTemplate(): string {
    return `# Organization Contribution Stats

<!-- IMPACT-BOARD:SUMMARY:START -->
<!-- IMPACT-BOARD:SUMMARY:END -->

## 🏆 Leaderboard

<!-- IMPACT-BOARD:LEADERBOARD:START -->
<!-- IMPACT-BOARD:LEADERBOARD:END -->

## 🔥 Streaks

<!-- IMPACT-BOARD:STREAKS:START -->
<!-- IMPACT-BOARD:STREAKS:END -->

## 🏅 Awards

<!-- IMPACT-BOARD:AWARDS:START -->
<!-- IMPACT-BOARD:AWARDS:END -->

<!-- IMPACT-BOARD:TIMESTAMP:START -->
<!-- IMPACT-BOARD:TIMESTAMP:END -->
`;
  }

  /**
   * Initialize the profile README for a new installation
   */
  async initializeReadme(installationId: number, orgLogin: string): Promise<boolean> {
    logger.info({ orgLogin }, 'Initializing profile README');

    // Check if profile repo exists
    let profileRepo = await getProfileRepository(installationId, orgLogin);

    if (!profileRepo) {
      // Try to create it
      profileRepo = await createProfileRepository(installationId, orgLogin);
      if (!profileRepo) {
        logger.warn({ orgLogin }, 'Could not create profile repository');
        return false;
      }
    }

    // Check if README exists
    const existingReadme = await getProfileReadme(installationId, orgLogin);

    if (existingReadme) {
      // Check if it has our markers
      if (hasRequiredMarkers(existingReadme.content)) {
        logger.info({ orgLogin }, 'README already has required markers');
        return true;
      }

      // Add markers to existing content
      const updatedContent = addMissingMarkers(existingReadme.content);
      const success = await updateProfileReadme(
        installationId,
        orgLogin,
        updatedContent,
        existingReadme.sha
      );

      if (success) {
        logger.info({ orgLogin }, 'Added markers to existing README');
      }

      return success;
    }

    // Create new README from template
    const template = this.getTemplate();
    const initialContent = template.replace('Organization Contribution Stats', `${orgLogin} Contribution Stats`);

    const success = await updateProfileReadme(installationId, orgLogin, initialContent);

    if (success) {
      logger.info({ orgLogin }, 'Created new profile README');
    }

    return success;
  }

  /**
   * Update the profile README with current stats
   * Supports YAML-driven modes: template, assets-only, full
   */
  async updateReadme(installationId: number, orgLogin: string): Promise<boolean> {
    logger.info({ orgLogin }, 'Updating profile README');

    // Get installation settings
    const installation = await repository.installations.get(installationId);
    if (!installation?.settings.enableReadmeUpdates) {
      logger.debug({ orgLogin }, 'README updates disabled for this installation');
      return false;
    }

    // Get org ID
    const orgData = await repository.installations.getByLogin(orgLogin);
    if (!orgData) {
      logger.warn({ orgLogin }, 'Installation not found');
      return false;
    }
    const orgId = orgData.accountId;

    // Load ImpactBoard YAML configuration
    const config = await loadImpactYamlConfig(installationId, orgLogin);

    // YAML-based mode handling
    if (config) {
      return this.handleYamlMode(installationId, orgId, orgLogin, config);
    }

    // Legacy mode: no YAML config, use original marker-based rendering
    logger.debug({ orgLogin }, 'No ImpactBoard YAML found, using legacy mode');
    return this.legacyUpdateReadme(installationId, orgId, orgLogin);
  }

  /**
   * Handle YAML-driven modes: template, assets-only, full
   */
  private async handleYamlMode(
    installationId: number,
    orgId: number,
    orgLogin: string,
    config: import('../types/schemas').ImpactYamlConfig
  ): Promise<boolean> {
    try {
      const basePath = config.assets?.base_path ?? DEFAULT_ASSETS_BASE_PATH;

      if (config.mode === 'template') {
        // Template mode: render predefined template README using SVG references
        const targetFile = config.template?.target?.file ?? '.github/profile/README.md';
        const content = await renderTemplateReadme(installationId, orgId, orgLogin, config);
        return this.upsertReadmeFile(installationId, orgLogin, targetFile, content);
      }

      if (config.mode === 'assets-only') {
        // Assets-only mode: ONLY generate SVGs, do NOT modify README
        const window = config.assets?.svgs?.leaderboard?.window ?? '30d';
        const limit = config.assets?.svgs?.leaderboard?.max_limit ?? 10;
        const stats = await aggregator.getOrgStats(orgId, window as any);
        const optedOut = new Set(await repository.privacy.getOptedOutUsers(orgId));
        const publicStats = stats.filter((s: AggregatedStats) => !optedOut.has(s.userId))
          .sort((a: AggregatedStats, b: AggregatedStats) => b.weightedScore - a.weightedScore)
          .slice(0, limit);
        const entries: LeaderboardEntry[] = publicStats.map((s: AggregatedStats, i: number) => ({
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

        // Heatmap data
        const heatmapData = await repository.contributions.getOrgDailyTotals(orgId, 30);

        // Write all SVG assets
        const paths = await writeAllSvgAssets(installationId, orgId, orgLogin, basePath, entries, heatmapData);

        logger.info({ orgLogin, paths }, 'Assets-only mode: SVGs updated, README unchanged');
        return true;
      }

      // Full mode: read from placeholder template, apply placeholders, then write to readme.file
      const readmeFile = config.readme?.file ?? '.github/profile/README.md';
      const placeholderTemplate = config.readme?.placeholder;

      if (!placeholderTemplate) {
        logger.error({ orgLogin }, 'Full mode requires readme.placeholder to be set in impactboard.yml');
        return false;
      }

      // First, write SVG assets so placeholders can reference them
      const window = config.data?.windows?.default ?? '30d';
      const stats = await aggregator.getOrgStats(orgId, window as any);
      const optedOut = new Set(await repository.privacy.getOptedOutUsers(orgId));
      const publicStats = stats.filter((s: AggregatedStats) => !optedOut.has(s.userId))
        .sort((a: AggregatedStats, b: AggregatedStats) => b.weightedScore - a.weightedScore)
        .slice(0, 10);
      const entries: LeaderboardEntry[] = publicStats.map((s: AggregatedStats, i: number) => ({
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
      const heatmapData = await repository.contributions.getOrgDailyTotals(orgId, 30);
      const svgPaths = await writeAllSvgAssets(installationId, orgId, orgLogin, basePath, entries, heatmapData);

      // Read the placeholder template file (NOT the main README)
      const octokit = await createOctokitClient(installationId);
      let templateContent = '';
      try {
        const res = await octokit.repos.getContent({
          owner: orgLogin,
          repo: placeholderTemplate.split('/')[0] || '.github',
          path: placeholderTemplate.split('/').slice(1).join('/'),
        });
        if ('content' in res.data) {
          templateContent = Buffer.from((res.data as any).content, 'base64').toString('utf8');
        }
      } catch (err) {
        logger.error({ orgLogin, placeholderTemplate }, 'Could not fetch placeholder template file');
        return false;
      }

      // Resolve placeholders in the template, passing SVG paths for reference
      const resolved = await resolvePlaceholders(orgId, installationId, orgLogin, templateContent, config, {
        svgPaths,
        basePath,
      });

      // Write resolved content to the actual README file
      return await this.upsertReadmeFile(installationId, orgLogin, readmeFile, resolved);
    } catch (error) {
      logger.error({ error, orgLogin }, 'Failed to handle YAML mode');
      return false;
    }
  }

  /**
   * Upsert README file in .github repo at specified path
   */
  private async upsertReadmeFile(
    installationId: number,
    orgLogin: string,
    filePath: string,
    content: string
  ): Promise<boolean> {
    try {
      const octokit = await createOctokitClient(installationId);
      const owner = orgLogin;
      const repo = filePath.split('/')[0] || '.github';
      const path = filePath.split('/').slice(1).join('/');

      // Try to get existing file to retrieve sha
      let sha: string | undefined;
      try {
        const existing = await octokit.repos.getContent({ owner, repo, path });
        if ('sha' in existing.data) sha = (existing.data as any).sha;
      } catch (_) {}

      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message: '📣 Update ImpactBoard README',
        content: Buffer.from(content).toString('base64'),
        sha,
      });

      logger.info({ orgLogin, filePath }, 'Successfully updated profile README');
      return true;
    } catch (error) {
      logger.error({ error, orgLogin, filePath }, 'Failed to upsert README file');
      return false;
    }
  }

  /**
   * Legacy update README (original marker-based rendering)
   */
  private async legacyUpdateReadme(
    installationId: number,
    orgId: number,
    orgLogin: string
  ): Promise<boolean> {
    // Get current README
    const existingReadme = await getProfileReadme(installationId, orgLogin);

    if (!existingReadme) {
      // Initialize if it doesn't exist
      const initialized = await this.initializeReadme(installationId, orgLogin);
      if (!initialized) {
        return false;
      }
      // Fetch again after initialization
      const newReadme = await getProfileReadme(installationId, orgLogin);
      if (!newReadme) {
        return false;
      }
    }

    // Gather all data for rendering
    const renderData = await this.gatherRenderData(installationId, orgId, orgLogin);

    // Render the updated content
    const updatedContent = renderFullReadme(
      renderData,
      existingReadme?.content
    );

    // Check if content actually changed (for deterministic updates)
    if (existingReadme && this.contentEquals(existingReadme.content, updatedContent)) {
      logger.debug({ orgLogin }, 'README content unchanged, skipping update');
      return true;
    }

    // Update the README
    const success = await updateProfileReadme(
      installationId,
      orgLogin,
      updatedContent,
      existingReadme?.sha
    );

    if (success) {
      logger.info({ orgLogin }, 'Successfully updated profile README');
    } else {
      logger.error({ orgLogin }, 'Failed to update profile README');
    }

    return success;
  }

  /**
   * Gather all data needed for rendering
   */
  private async gatherRenderData(
    installationId: number,
    orgId: number,
    orgLogin: string
  ): Promise<{
    orgLogin: string;
    leaderboard: LeaderboardEntry[];
    topStreaks: import('../types').StreakInfo[];
    awards: import('../types').Award[];
    stats: import('../types').AggregatedStats[];
    monthSummary?: {
      totalContributors: number;
      totalCommits: number;
      totalPrs: number;
      totalIssues: number;
      averageScore: number;
    };
    heatmapData?: Array<{ date: string; count: number }>;
  }> {
    // Get top contributors
    const topContributors = await aggregator.getTopContributors(orgId, 'monthly', 10);

    // Convert to leaderboard entries
    const leaderboard: LeaderboardEntry[] = topContributors.map((stats, index) => ({
      rank: index + 1,
      userId: stats.userId,
      userLogin: stats.userLogin,
      userAvatarUrl: stats.userAvatarUrl,
      weightedScore: stats.weightedScore,
      contributorRank: stats.rank,
      currentStreak: stats.currentStreak,
      topMetric: 'score',
      topMetricValue: stats.weightedScore,
    }));

    // Get top streaks
    const topStreaks = await streaks.getTopStreaks(orgId, 5);

    // Get monthly awards
    const monthlyAwards = await awards.getMonthlyAwards(orgId);

    // Get all stats for summary
    const allStats = await repository.aggregates.getByOrg(orgId, 'monthly');

    // Calculate summary
    const monthSummary = allStats.length > 0
      ? {
          totalContributors: allStats.length,
          totalCommits: allStats.reduce((sum: number, s: AggregatedStats) => sum + s.totalCommits, 0),
          totalPrs: allStats.reduce((sum: number, s: AggregatedStats) => sum + s.totalPullRequestsMerged, 0),
          totalIssues: allStats.reduce((sum: number, s: AggregatedStats) => sum + s.totalIssuesClosed, 0),
          averageScore: allStats.reduce((sum: number, s: AggregatedStats) => sum + s.weightedScore, 0) / allStats.length,
        }
      : undefined;

    // Get heatmap data (aggregate contributions per day)
    const heatmapData = await repository.contributions.getOrgDailyTotals(orgId, 30);

    return {
      orgLogin,
      leaderboard,
      topStreaks,
      awards: monthlyAwards,
      stats: allStats,
      monthSummary,
      heatmapData,
    };
  }

  /**
   * Compare content ignoring timestamp differences
   */
  private contentEquals(existing: string, updated: string): boolean {
    // Remove timestamp sections for comparison
    const timestampRegex = /<!-- IMPACT-BOARD:TIMESTAMP:START -->[\s\S]*?<!-- IMPACT-BOARD:TIMESTAMP:END -->/g;
    const existingNormalized = existing.replace(timestampRegex, '').trim();
    const updatedNormalized = updated.replace(timestampRegex, '').trim();

    return existingNormalized === updatedNormalized;
  }

  /**
   * Schedule README updates based on configuration
   */
  async scheduleUpdate(installation: StoredInstallation): Promise<void> {
    const { settings } = installation;

    if (!settings.enableReadmeUpdates) {
      return;
    }

    // Schedule based on configuration
    switch (settings.readmeUpdateSchedule) {
      case 'realtime':
        // Update immediately (handled by webhook processors)
        break;
      case 'hourly':
        // Will be handled by cron job
        break;
      case 'daily':
        // Will be handled by cron job
        break;
    }
  }

  /**
   * Bulk update all installations (for scheduled updates)
   */
  async updateAllInstallations(): Promise<void> {
    logger.info('Starting bulk README update');

    const installations = await repository.installations.getActive();

    for (const installation of installations) {
      try {
        await this.updateReadme(installation.installationId, installation.accountLogin);
      } catch (error) {
        logger.error(
          { error, installationId: installation.installationId },
          'Failed to update README for installation'
        );
      }
    }

    logger.info({ count: installations.length }, 'Completed bulk README update');
  }
}

export const readmePublisher = new ReadmePublisher();

/**
 * Schedule periodic README updates
 * Updates all installations every hour
 */
export function scheduleReadmeUpdates(): void {
  const UPDATE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  setInterval(async () => {
    try {
      await readmePublisher.updateAllInstallations();
    } catch (error) {
      logger.error({ error }, 'Scheduled README update failed');
    }
  }, UPDATE_INTERVAL_MS);

  logger.info('README update scheduler initialized (runs hourly)');
}
