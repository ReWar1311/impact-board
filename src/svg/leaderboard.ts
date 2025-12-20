import type { LeaderboardEntry, SvgTheme, SvgOptions } from '../types';
import { DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME } from '../types';
import { SVG } from '../config/constants';
import { ranks } from '../stats/ranks';

/**
 * Leaderboard SVG Generator
 * 
 * Generates SVG leaderboards for display in README
 * Supports both light and dark themes
 */

const DEFAULT_OPTIONS: SvgOptions = {
  width: SVG.LEADERBOARD.WIDTH,
  height: SVG.LEADERBOARD.HEIGHT,
  darkMode: false,
  animated: true,
  theme: DEFAULT_LIGHT_THEME,
};

/**
 * Generate a leaderboard SVG
 */
export function generateLeaderboardSvg(
  entries: LeaderboardEntry[],
  title: string,
  options: Partial<SvgOptions> = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const theme = opts.darkMode ? DEFAULT_DARK_THEME : opts.theme;
  
  const rowHeight = SVG.LEADERBOARD.ROW_HEIGHT;
  const padding = SVG.LEADERBOARD.PADDING;
  const headerHeight = 50;
  const contentHeight = entries.length * rowHeight + headerHeight + padding * 2;
  const height = Math.max(opts.height, contentHeight);
  
  // Find max score for bar scaling
  const maxScore = Math.max(...entries.map(e => e.weightedScore), 1);
  
  const rows = entries.map((entry, index) => 
    generateLeaderboardRow(entry, index, maxScore, theme, opts.width, padding, headerHeight, rowHeight, opts.animated)
  ).join('\n');
  
  return `<svg width="${opts.width}" height="${height}" viewBox="0 0 ${opts.width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&amp;display=swap');
      .leaderboard-title { font-family: 'Inter', sans-serif; font-weight: 600; font-size: 18px; fill: ${theme.text}; }
      .leaderboard-rank { font-family: 'Inter', sans-serif; font-weight: 600; font-size: 14px; fill: ${theme.text}; }
      .leaderboard-name { font-family: 'Inter', sans-serif; font-weight: 500; font-size: 14px; fill: ${theme.text}; }
      .leaderboard-score { font-family: 'Inter', sans-serif; font-weight: 400; font-size: 12px; fill: ${theme.text}; opacity: 0.8; }
      .leaderboard-badge { font-family: 'Inter', sans-serif; font-weight: 500; font-size: 11px; }
      ${opts.animated ? `
      .bar-fill {
        animation: grow 0.8s ease-out forwards;
        transform-origin: left;
      }
      @keyframes grow {
        from { transform: scaleX(0); }
        to { transform: scaleX(1); }
      }
      ` : ''}
    </style>
    <linearGradient id="barGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${theme.barFill};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${theme.accent};stop-opacity:0.7" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="${opts.width}" height="${height}" rx="12" fill="${theme.background}"/>
  
  <!-- Border -->
  <rect width="${opts.width}" height="${height}" rx="12" fill="none" stroke="${theme.barBackground}" stroke-width="1"/>
  
  <!-- Title -->
  <text x="${padding}" y="${padding + 24}" class="leaderboard-title">${escapeXml(title)}</text>
  
  <!-- Entries -->
  ${rows}
</svg>`;
}

/**
 * Generate a single leaderboard row
 */
function generateLeaderboardRow(
  entry: LeaderboardEntry,
  index: number,
  maxScore: number,
  theme: SvgTheme,
  width: number,
  padding: number,
  headerHeight: number,
  rowHeight: number,
  animated: boolean
): string {
  const y = headerHeight + padding + index * rowHeight;
  const barWidth = width - padding * 2 - 250; // Space for rank, name, and score
  const barX = padding + 180;
  const filledWidth = (entry.weightedScore / maxScore) * barWidth;
  
  const rankColor = getRankColor(entry.contributorRank, theme);
  const rankEmoji = ranks.getRankEmoji(entry.contributorRank);
  
  const animationDelay = animated ? `style="animation-delay: ${index * 0.1}s"` : '';
  
  return `
  <g transform="translate(0, ${y})">
    <!-- Rank Number -->
    <text x="${padding}" y="22" class="leaderboard-rank">#${entry.rank}</text>
    
    <!-- Avatar (placeholder circle) -->
    <circle cx="${padding + 50}" cy="15" r="12" fill="${theme.barBackground}"/>
    <text x="${padding + 50}" y="19" text-anchor="middle" font-size="10" fill="${theme.text}">${entry.userLogin.charAt(0).toUpperCase()}</text>
    
    <!-- Username -->
    <text x="${padding + 70}" y="12" class="leaderboard-name">${escapeXml(entry.userLogin)}</text>
    
    <!-- Rank Badge -->
    <g transform="translate(${padding + 70}, 18)">
      <rect width="60" height="16" rx="8" fill="${rankColor}" opacity="0.2"/>
      <text x="30" y="12" text-anchor="middle" class="leaderboard-badge" fill="${rankColor}">${rankEmoji} ${entry.contributorRank}</text>
    </g>
    
    <!-- Score Bar Background -->
    <rect x="${barX}" y="8" width="${barWidth}" height="14" rx="7" fill="${theme.barBackground}"/>
    
    <!-- Score Bar Fill -->
    <rect x="${barX}" y="8" width="${filledWidth}" height="14" rx="7" fill="url(#barGradient)" class="bar-fill" ${animationDelay}/>
    
    <!-- Score Text -->
    <text x="${barX + barWidth + 10}" y="19" class="leaderboard-score">${Math.round(entry.weightedScore)} pts</text>
  </g>`;
}

/**
 * Get rank color from theme
 */
function getRankColor(rank: string, theme: SvgTheme): string {
  switch (rank) {
    case 'Bronze': return theme.bronze;
    case 'Silver': return theme.silver;
    case 'Gold': return theme.gold;
    case 'Diamond': return theme.diamond;
    default: return theme.bronze;
  }
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate a compact leaderboard for inline display
 */
export function generateCompactLeaderboardSvg(
  entries: LeaderboardEntry[],
  options: Partial<SvgOptions> = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, width: 400, height: 200, ...options };
  const theme = opts.darkMode ? DEFAULT_DARK_THEME : opts.theme;
  const topEntries = entries.slice(0, 5);
  
  const rows = topEntries.map((entry, index) => {
    const y = 40 + index * 30;
    const rankEmoji = ranks.getRankEmoji(entry.contributorRank);
    
    return `
    <g transform="translate(10, ${y})">
      <text x="0" y="0" font-family="Inter, sans-serif" font-size="12" fill="${theme.text}">
        #${entry.rank} ${rankEmoji} ${escapeXml(entry.userLogin)} - ${Math.round(entry.weightedScore)} pts
      </text>
    </g>`;
  }).join('\n');
  
  return `<svg width="${opts.width}" height="${opts.height}" viewBox="0 0 ${opts.width} ${opts.height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${opts.width}" height="${opts.height}" rx="8" fill="${theme.background}"/>
  <text x="10" y="25" font-family="Inter, sans-serif" font-weight="600" font-size="14" fill="${theme.text}">🏆 Top Contributors</text>
  ${rows}
</svg>`;
}
