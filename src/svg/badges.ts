import type { ContributorRank, SvgTheme, SvgOptions } from '../types';
import { DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME } from '../types';
import { SVG } from '../config/constants';
import { ranks } from '../stats/ranks';

/**
 * Badge SVG Generator
 * 
 * Generates rank badges and achievement badges
 * Used for displaying user ranks and awards
 */

const DEFAULT_OPTIONS: SvgOptions = {
  width: SVG.BADGE.WIDTH,
  height: SVG.BADGE.HEIGHT,
  darkMode: false,
  animated: false,
  theme: DEFAULT_LIGHT_THEME,
};

/**
 * Generate a rank badge SVG
 */
export function generateRankBadgeSvg(
  rank: ContributorRank,
  options: Partial<SvgOptions> = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const theme = opts.darkMode ? DEFAULT_DARK_THEME : opts.theme;
  
  const rankColor = getRankColor(rank, theme);
  const rankEmoji = ranks.getRankEmoji(rank);
  
  return `<svg width="${opts.width}" height="${opts.height}" viewBox="0 0 ${opts.width} ${opts.height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="rankGradient-${rank}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${rankColor};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${rankColor};stop-opacity:0.7" />
    </linearGradient>
  </defs>
  
  <rect width="${opts.width}" height="${opts.height}" rx="${opts.height / 2}" fill="url(#rankGradient-${rank})"/>
  
  <text x="${opts.width / 2}" y="${opts.height / 2 + 5}" 
        text-anchor="middle" 
        font-family="Inter, sans-serif" 
        font-weight="600" 
        font-size="12" 
        fill="#ffffff">
    ${rankEmoji} ${rank}
  </text>
</svg>`;
}

/**
 * Generate a streak badge SVG
 */
export function generateStreakBadgeSvg(
  streakDays: number,
  options: Partial<SvgOptions> = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, width: 140, ...options };
  const theme = opts.darkMode ? DEFAULT_DARK_THEME : opts.theme;
  
  const fireEmoji = streakDays >= 30 ? '🔥🔥🔥' : streakDays >= 14 ? '🔥🔥' : '🔥';
  const bgColor = streakDays >= 30 ? '#ff4500' : streakDays >= 14 ? '#ff6347' : '#ff8c00';
  
  return `<svg width="${opts.width}" height="${opts.height}" viewBox="0 0 ${opts.width} ${opts.height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${opts.width}" height="${opts.height}" rx="${opts.height / 2}" fill="${bgColor}"/>
  
  <text x="${opts.width / 2}" y="${opts.height / 2 + 5}" 
        text-anchor="middle" 
        font-family="Inter, sans-serif" 
        font-weight="600" 
        font-size="12" 
        fill="#ffffff">
    ${fireEmoji} ${streakDays} day streak
  </text>
</svg>`;
}

/**
 * Generate an award badge SVG
 */
export function generateAwardBadgeSvg(
  title: string,
  emoji: string,
  options: Partial<SvgOptions> = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, width: 160, height: 36, ...options };
  const theme = opts.darkMode ? DEFAULT_DARK_THEME : opts.theme;
  
  return `<svg width="${opts.width}" height="${opts.height}" viewBox="0 0 ${opts.width} ${opts.height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="awardGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${theme.gold};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${theme.gold};stop-opacity:0.8" />
    </linearGradient>
  </defs>
  
  <rect width="${opts.width}" height="${opts.height}" rx="${opts.height / 2}" fill="url(#awardGradient)"/>
  
  <text x="${opts.width / 2}" y="${opts.height / 2 + 5}" 
        text-anchor="middle" 
        font-family="Inter, sans-serif" 
        font-weight="600" 
        font-size="11" 
        fill="#333333">
    ${emoji} ${escapeXml(title)}
  </text>
</svg>`;
}

/**
 * Generate a score badge SVG
 */
export function generateScoreBadgeSvg(
  score: number,
  label: string,
  options: Partial<SvgOptions> = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, width: 100, ...options };
  const theme = opts.darkMode ? DEFAULT_DARK_THEME : opts.theme;
  
  return `<svg width="${opts.width}" height="${opts.height}" viewBox="0 0 ${opts.width} ${opts.height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${opts.width}" height="${opts.height}" rx="${opts.height / 2}" fill="${theme.barBackground}"/>
  
  <text x="10" y="${opts.height / 2 + 4}" 
        font-family="Inter, sans-serif" 
        font-weight="400" 
        font-size="11" 
        fill="${theme.text}">
    ${escapeXml(label)}:
  </text>
  
  <text x="${opts.width - 10}" y="${opts.height / 2 + 4}" 
        text-anchor="end" 
        font-family="Inter, sans-serif" 
        font-weight="600" 
        font-size="11" 
        fill="${theme.accent}">
    ${formatNumber(score)}
  </text>
</svg>`;
}

/**
 * Generate a contributor card SVG
 */
export function generateContributorCardSvg(
  data: {
    username: string;
    rank: ContributorRank;
    score: number;
    streak: number;
    commits: number;
    prs: number;
    issues: number;
  },
  options: Partial<SvgOptions> = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, width: 300, height: 150, ...options };
  const theme = opts.darkMode ? DEFAULT_DARK_THEME : opts.theme;
  
  const rankColor = getRankColor(data.rank, theme);
  const rankEmoji = ranks.getRankEmoji(data.rank);
  
  return `<svg width="${opts.width}" height="${opts.height}" viewBox="0 0 ${opts.width} ${opts.height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cardGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${theme.background};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${theme.barBackground};stop-opacity:0.5" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="${opts.width}" height="${opts.height}" rx="12" fill="url(#cardGradient)"/>
  <rect width="${opts.width}" height="${opts.height}" rx="12" fill="none" stroke="${theme.barBackground}" stroke-width="1"/>
  
  <!-- Rank accent bar -->
  <rect x="0" y="0" width="4" height="${opts.height}" rx="2" fill="${rankColor}"/>
  
  <!-- Username and rank -->
  <text x="20" y="30" font-family="Inter, sans-serif" font-weight="600" font-size="16" fill="${theme.text}">${escapeXml(data.username)}</text>
  <text x="20" y="50" font-family="Inter, sans-serif" font-size="12" fill="${rankColor}">${rankEmoji} ${data.rank} Contributor</text>
  
  <!-- Stats grid -->
  <g transform="translate(20, 70)">
    <text font-family="Inter, sans-serif" font-size="11" fill="${theme.text}" opacity="0.7">Score</text>
    <text y="15" font-family="Inter, sans-serif" font-weight="600" font-size="14" fill="${theme.accent}">${formatNumber(data.score)}</text>
  </g>
  
  <g transform="translate(90, 70)">
    <text font-family="Inter, sans-serif" font-size="11" fill="${theme.text}" opacity="0.7">Streak</text>
    <text y="15" font-family="Inter, sans-serif" font-weight="600" font-size="14" fill="${theme.text}">🔥 ${data.streak}</text>
  </g>
  
  <g transform="translate(160, 70)">
    <text font-family="Inter, sans-serif" font-size="11" fill="${theme.text}" opacity="0.7">Commits</text>
    <text y="15" font-family="Inter, sans-serif" font-weight="600" font-size="14" fill="${theme.text}">${formatNumber(data.commits)}</text>
  </g>
  
  <g transform="translate(20, 110)">
    <text font-family="Inter, sans-serif" font-size="11" fill="${theme.text}" opacity="0.7">PRs Merged</text>
    <text y="15" font-family="Inter, sans-serif" font-weight="600" font-size="14" fill="${theme.text}">${formatNumber(data.prs)}</text>
  </g>
  
  <g transform="translate(120, 110)">
    <text font-family="Inter, sans-serif" font-size="11" fill="${theme.text}" opacity="0.7">Issues Closed</text>
    <text y="15" font-family="Inter, sans-serif" font-weight="600" font-size="14" fill="${theme.text}">${formatNumber(data.issues)}</text>
  </g>
</svg>`;
}

/**
 * Get rank color from theme
 */
function getRankColor(rank: ContributorRank, theme: SvgTheme): string {
  switch (rank) {
    case 'Bronze': return theme.bronze;
    case 'Silver': return theme.silver;
    case 'Gold': return theme.gold;
    case 'Diamond': return theme.diamond;
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
 * Format large numbers for display
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}
