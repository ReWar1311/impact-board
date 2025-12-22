import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { logger } from './utils/logger';
import { config } from './config/env';
import { webhookSignatureMiddleware } from './webhook/verifySignature';
import { handleWebhook } from './webhook/handler';
import { repository } from './storage/repository';
import { readmePublisher } from './readme/publisher';
import { validateImpactYamlConfig } from './config/impactYaml';

/**
 * HTTP Server
 * 
 * Express server that handles GitHub webhooks and serves SVG badges
 */

const app = express();

// Trust proxy for Railway/reverse proxy deployments
// This is required for express-rate-limit to work correctly
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Rate limiting for public endpoints
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

// Stricter rate limiting for webhooks
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Readiness check (includes database connectivity)
app.get('/ready', async (_req: Request, res: Response) => {
  try {
    // Test database connection
    await repository.query('SELECT 1');
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (error) {
    logger.error({ error }, 'Readiness check failed');
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
    });
  }
});

// GitHub webhook endpoint
// Parse raw body for signature verification
app.post(
  '/webhook',
  webhookLimiter,
  express.raw({ type: 'application/json', limit: '10mb' }),
  (req: Request & { rawBody?: Buffer }, res: Response, next: NextFunction) => {
    // Store the raw body for signature verification
    req.rawBody = req.body as Buffer;
    next();
  },
  webhookSignatureMiddleware,
  (req: Request, res: Response, next: NextFunction) => {
    // Parse the raw body after signature verification
    try {
      const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
      if (rawBody) {
        req.body = JSON.parse(rawBody.toString());
      }
      next();
    } catch (error) {
      res.status(400).json({ error: 'Invalid JSON payload' });
    }
  },
  handleWebhook
);

// Public SVG badge endpoints
app.get('/badge/leaderboard/:installationId', publicLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const installationIdStr = req.params.installationId;
    if (!installationIdStr) {
      res.status(400).json({ error: 'Missing installation ID' });
      return;
    }
    
    const installationId = parseInt(installationIdStr, 10);
    const compact = req.query.compact === 'true';
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 10, 25);
    
    if (isNaN(installationId)) {
      res.status(400).json({ error: 'Invalid installation ID' });
      return;
    }

    // Get installation
    const installation = await repository.installations.getById(installationId);
    if (!installation) {
      res.status(404).json({ error: 'Installation not found' });
      return;
    }

    // Import and generate SVG
    const { generateLeaderboardSvg, generateCompactLeaderboardSvg } = await import('./svg/leaderboard');
    
    // Get stats and transform to leaderboard format
    const stats = await repository.aggregates.getByOrg(installationId, '30d');
    const sortedStats = stats
      .sort((a, b) => b.weightedScore - a.weightedScore)
      .slice(0, limit);
    
    // Transform to LeaderboardEntry format
    const leaderboard = sortedStats.map((stat, index) => ({
      rank: index + 1,
      userId: stat.userId,
      userLogin: stat.userLogin,
      userAvatarUrl: stat.userAvatarUrl,
      weightedScore: stat.weightedScore,
      contributorRank: stat.rank,
      currentStreak: stat.currentStreak,
      topMetric: 'commits',
      topMetricValue: stat.totalCommits,
    }));
    
    const svg = compact 
      ? generateCompactLeaderboardSvg(leaderboard)
      : generateLeaderboardSvg(leaderboard, installation.orgName);

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=1800'); // 30 min cache
    res.send(svg);
  } catch (error) {
    next(error);
  }
});

app.get('/badge/contributor/:installationId/:username', publicLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const installationIdStr = req.params.installationId;
    const usernameParam = req.params.username;
    
    if (!installationIdStr || !usernameParam) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }
    
    const installationId = parseInt(installationIdStr, 10);
    
    if (isNaN(installationId)) {
      res.status(400).json({ error: 'Invalid installation ID' });
      return;
    }

    // Check privacy settings
    const user = await repository.users.getByUsername(installationId, usernameParam);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const privacy = await repository.privacy.get(installationId, user.id);
    if (privacy?.optedOut) {
      res.status(403).json({ error: 'User has opted out of public display' });
      return;
    }

    // Get stats and generate card
    const stats = await repository.aggregates.get(installationId, user.id, 'all-time');
    const streak = await repository.streaks.get(installationId, user.id);
    
    if (!stats) {
      res.status(404).json({ error: 'No stats available' });
      return;
    }

    const { generateContributorCardSvg } = await import('./svg/badges');
    const { calculateRank } = await import('./stats/ranks');
    
    const rank = calculateRank(stats.weightedScore);
    
    const svg = generateContributorCardSvg({
      username: usernameParam,
      rank,
      score: stats.weightedScore,
      streak: streak?.currentStreak ?? 0,
      commits: stats.totalCommits,
      prs: stats.totalPullRequestsMerged,
      issues: stats.totalIssuesClosed,
    });

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=1800');
    res.send(svg);
  } catch (error) {
    next(error);
  }
});

app.get('/badge/heatmap/:installationId/:username', publicLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const installationIdStr = req.params.installationId;
    const usernameParam = req.params.username;
    const mini = req.query.mini === 'true';
    
    if (!installationIdStr || !usernameParam) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }
    
    const installationId = parseInt(installationIdStr, 10);
    
    if (isNaN(installationId)) {
      res.status(400).json({ error: 'Invalid installation ID' });
      return;
    }

    // Check privacy settings
    const user = await repository.users.getByUsername(installationId, usernameParam);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const privacy = await repository.privacy.get(installationId, user.id);
    if (privacy?.optedOut) {
      res.status(403).json({ error: 'User has opted out of public display' });
      return;
    }

    // Get contribution data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (mini ? 30 : 365));
    
    const contributions = await repository.contributions.getForPeriod(
      installationId,
      user.id,
      startDate,
      endDate
    );

    // Transform to heatmap format
    const heatmapData = contributions.map(c => ({
      date: c.date,
      count: c.commits + c.pullRequestsMerged + c.issuesClosed,
    }));

    const { generateHeatmapSvg, generateMiniHeatmapSvg } = await import('./svg/heatmap');
    
    const svg = mini
      ? generateMiniHeatmapSvg(heatmapData)
      : generateHeatmapSvg(heatmapData);

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=1800');
    res.send(svg);
  } catch (error) {
    next(error);
  }
});

// Opt-out endpoint for users
app.post('/privacy/opt-out', express.json(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { installationId, userId, optedOut, showDetailedStats, showOnLeaderboard } = req.body;

    if (!installationId || !userId) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // In a production app, you'd verify the user's identity here
    // For now, we'll just update the privacy settings
    await repository.privacy.upsert(
      installationId,
      userId,
      optedOut ?? false,
      showDetailedStats ?? true,
      showOnLeaderboard ?? true
    );

    res.status(200).json({ status: 'updated' });
  } catch (error) {
    next(error);
  }
});

// Rate limiter for README update endpoint (stricter to prevent abuse)
const readmeUpdateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour per org
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many README update requests. Please wait before trying again.' },
  keyGenerator: (req) => req.params.orgLogin || req.ip || 'unknown',
});

/**
 * Manual README Update Endpoint
 * 
 * Allows organizations to trigger a README update on-demand
 * instead of waiting for the scheduled update.
 * 
 * POST /api/readme/update/:orgLogin
 * 
 * Optional body:
 * - apiKey: string (for authentication if configured)
 */
app.post('/api/readme/update/:orgLogin', readmeUpdateLimiter, express.json(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgLogin } = req.params;

    if (!orgLogin) {
      res.status(400).json({ error: 'Missing organization login' });
      return;
    }

    // Look up the installation by org login
    const installation = await repository.installations.getByLogin(orgLogin);

    if (!installation) {
      res.status(404).json({ error: 'Organization not found. Make sure the app is installed.' });
      return;
    }

    // Check if README updates are enabled for this installation
    if (!installation.settings.enableReadmeUpdates) {
      res.status(403).json({ error: 'README updates are disabled for this organization.' });
      return;
    }

    logger.info({ orgLogin }, 'Manual README update triggered');

    // Trigger the README update
    const success = await readmePublisher.updateReadme(
      installation.installationId,
      orgLogin
    );

    if (success) {
      res.status(200).json({
        status: 'success',
        message: `README updated successfully for ${orgLogin}`,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(500).json({
        status: 'failed',
        message: 'Failed to update README. Check logs for details.',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error({ error, orgLogin: req.params.orgLogin }, 'Manual README update failed');
    next(error);
  }
});

/**
 * Get README update status for an organization
 * 
 * GET /api/readme/status/:orgLogin
 */
app.get('/api/readme/status/:orgLogin', publicLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgLogin } = req.params;

    if (!orgLogin) {
      res.status(400).json({ error: 'Missing organization login' });
      return;
    }

    const installation = await repository.installations.getByLogin(orgLogin);

    if (!installation) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    res.status(200).json({
      orgLogin,
      installationId: installation.installationId,
      readmeUpdatesEnabled: installation.settings.enableReadmeUpdates,
      updateSchedule: installation.settings.readmeUpdateSchedule || 'hourly',
      lastUpdated: installation.updatedAt,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Validate ImpactBoard YAML configuration
 * 
 * GET /api/readme/validate/:orgLogin
 * 
 * Returns validation result with detailed errors if any
 */
app.get('/api/readme/validate/:orgLogin', publicLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgLogin } = req.params;

    if (!orgLogin) {
      res.status(400).json({ error: 'Missing organization login' });
      return;
    }

    const installation = await repository.installations.getByLogin(orgLogin);

    if (!installation) {
      res.status(404).json({ error: 'Organization not found. Make sure the app is installed.' });
      return;
    }

    const result = await validateImpactYamlConfig(installation.installationId, orgLogin);

    if (result.valid) {
      res.status(200).json({
        valid: true,
        message: 'impactboard.yml is valid',
        config: result.config,
      });
    } else {
      res.status(200).json({
        valid: false,
        message: 'impactboard.yml has validation errors',
        errors: result.errors,
        rawYaml: result.rawYaml,
        hint: 'Check the schema requirements. Required fields: version (must be "v1"), mode (must be "full", "assets-only", or "template")',
      });
    }
  } catch (error) {
    next(error);
  }
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ error }, 'Unhandled error');
  
  res.status(500).json({
    error: config.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message,
  });
});

export { app };
