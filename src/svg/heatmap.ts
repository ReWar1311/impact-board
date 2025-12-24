import type { SvgTheme, SvgOptions } from '../types';
import { DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME } from '../types';
import { SVG } from '../config/constants';
import { getDayOfWeek, getWeekNumber } from '../utils/date';

/**
 * Heatmap SVG Generator
 * 
 * Generates GitHub-style contribution heatmaps
 * Shows activity patterns over time
 */

const DEFAULT_OPTIONS: SvgOptions = {
  width: 800,
  height: 150,
  darkMode: false,
  animated: false,
  theme: DEFAULT_LIGHT_THEME,
};

interface HeatmapData {
  date: string;
  count: number;
}

/**
 * Generate a contribution heatmap SVG
 */
export function generateHeatmapSvg(
  data: HeatmapData[],
  options: Partial<SvgOptions> = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const isDarkMode = opts.darkMode ?? false;
  const theme = isDarkMode ? DEFAULT_DARK_THEME : opts.theme;
  
  const cellSize = SVG.HEATMAP.CELL_SIZE;
  const cellGap = SVG.HEATMAP.CELL_GAP;
  const totalCellSize = cellSize + cellGap;
  const weeks = SVG.HEATMAP.WEEKS;
  
  const padding = 40;
  const dayLabelWidth = 30;
  const monthLabelHeight = 20;
  
  const width = padding * 2 + dayLabelWidth + weeks * totalCellSize;
  const height = padding + monthLabelHeight + 7 * totalCellSize + 20;
  
  // Create a map for quick lookup
  const dataMap = new Map<string, number>();
  let maxCount = 0;
  
  for (const item of data) {
    dataMap.set(item.date, item.count);
    if (item.count > maxCount) {
      maxCount = item.count;
    }
  }
  
  // Generate weeks going back from today
  const cells: string[] = [];
  const monthLabels: string[] = [];
  const today = new Date();
  let currentMonth = -1;
  
  for (let week = 0; week < weeks; week++) {
    for (let day = 0; day < 7; day++) {
      const date = new Date(today);
      date.setDate(date.getDate() - ((weeks - 1 - week) * 7 + (6 - day)));
      
      const dateStr = date.toISOString().split('T')[0];
      if (!dateStr) continue;
      
      const count = dataMap.get(dateStr) ?? 0;
      const intensity = maxCount > 0 ? count / maxCount : 0;
      const color = getHeatmapColor(intensity, theme, isDarkMode);
      
      const x = padding + dayLabelWidth + week * totalCellSize;
      const y = padding + monthLabelHeight + day * totalCellSize;
      
      cells.push(`
        <rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" fill="${color}">
          <title>${dateStr}: ${count} contributions</title>
        </rect>
      `);
      
      // Add month label at the start of each month
      if (date.getMonth() !== currentMonth && day === 0) {
        currentMonth = date.getMonth();
        const monthName = date.toLocaleDateString('en-US', { month: 'short' });
        monthLabels.push(`
          <text x="${x}" y="${padding + monthLabelHeight - 5}" 
                font-family="Inter, sans-serif" 
                font-size="10" 
                fill="${theme.text}" 
                opacity="0.7">
            ${monthName}
          </text>
        `);
      }
    }
  }
  
  // Day labels
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    .map((label, index) => {
      if (index % 2 === 0) return ''; // Only show every other day
      const y = padding + monthLabelHeight + index * totalCellSize + cellSize / 2 + 4;
      return `
        <text x="${padding}" y="${y}" 
              font-family="Inter, sans-serif" 
              font-size="10" 
              fill="${theme.text}" 
              opacity="0.7">
          ${label}
        </text>
      `;
    })
    .join('');
  
  // Legend
  const legendX = width - padding - 120;
  const legendY = height - 15;
  const legendLevels = [0, 0.25, 0.5, 0.75, 1];
  const legend = legendLevels.map((level, index) => {
    const color = getHeatmapColor(level, theme, isDarkMode);
    return `<rect x="${legendX + 50 + index * 15}" y="${legendY - 10}" width="${cellSize}" height="${cellSize}" rx="2" fill="${color}"/>`;
  }).join('');
  
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&amp;display=swap');
    </style>
  </defs>
  
  <!-- Background -->
  <rect width="${width}" height="${height}" rx="12" fill="${theme.background}"/>
  <rect width="${width}" height="${height}" rx="12" fill="none" stroke="${theme.barBackground}" stroke-width="1"/>
  
  <!-- Title -->
  <text x="${padding}" y="${padding - 10}" 
        font-family="Inter, sans-serif" 
        font-weight="600" 
        font-size="14" 
        fill="${theme.text}">
    Contribution Activity
  </text>
  
  <!-- Month labels -->
  ${monthLabels.join('')}
  
  <!-- Day labels -->
  ${dayLabels}
  
  <!-- Cells -->
  ${cells.join('')}
  
  <!-- Legend -->
  <text x="${legendX}" y="${legendY}" font-family="Inter, sans-serif" font-size="10" fill="${theme.text}" opacity="0.7">Less</text>
  ${legend}
  <text x="${legendX + 130}" y="${legendY}" font-family="Inter, sans-serif" font-size="10" fill="${theme.text}" opacity="0.7">More</text>
</svg>`;
}

/**
 * GitHub-style heatmap color levels (light mode)
 */
const HEATMAP_COLORS_LIGHT = [
  '#ebedf0', // 0: no contributions (base)
  '#9be9a8', // 1: low
  '#40c463', // 2: medium-low  
  '#30a14e', // 3: medium-high
  '#216e39', // 4: high
];

/**
 * GitHub-style heatmap color levels (dark mode)
 */
const HEATMAP_COLORS_DARK = [
  '#161b22', // 0: no contributions (base)
  '#0e4429', // 1: low
  '#006d32', // 2: medium-low
  '#26a641', // 3: medium-high
  '#39d353', // 4: high
];

/**
 * Get heatmap color based on intensity using GitHub-style discrete levels
 */
function getHeatmapColor(intensity: number, theme: SvgTheme, isDarkMode: boolean = false): string {
  const colors = isDarkMode ? HEATMAP_COLORS_DARK : HEATMAP_COLORS_LIGHT;
  
  if (intensity === 0) {
    return colors[0]!;
  }
  
  // Map intensity (0-1) to color level (1-4)
  if (intensity <= 0.25) {
    return colors[1]!;
  } else if (intensity <= 0.5) {
    return colors[2]!;
  } else if (intensity <= 0.75) {
    return colors[3]!;
  } else {
    return colors[4]!;
  }
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result && result[1] && result[2] && result[3]
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Generate a mini heatmap (last 30 days)
 */
export function generateMiniHeatmapSvg(
  data: HeatmapData[],
  options: Partial<SvgOptions> = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, width: 400, height: 60, ...options };
  const isDarkMode = opts.darkMode ?? false;
  const theme = isDarkMode ? DEFAULT_DARK_THEME : opts.theme;
  
  const cellSize = 10;
  const cellGap = 2;
  const totalCellSize = cellSize + cellGap;
  const days = 30;
  
  const padding = 10;
  const width = padding * 2 + days * totalCellSize;
  const height = padding * 2 + cellSize + 20;
  
  // Create a map for quick lookup
  const dataMap = new Map<string, number>();
  let maxCount = 0;
  
  for (const item of data) {
    dataMap.set(item.date, item.count);
    if (item.count > maxCount) {
      maxCount = item.count;
    }
  }
  
  // Generate last 30 days
  const cells: string[] = [];
  const today = new Date();
  
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - (days - 1 - i));
    
    const dateStr = date.toISOString().split('T')[0];
    if (!dateStr) continue;
    
    const count = dataMap.get(dateStr) ?? 0;
    const intensity = maxCount > 0 ? count / maxCount : 0;
    const color = getHeatmapColor(intensity, theme, isDarkMode);
    
    const x = padding + i * totalCellSize;
    const y = padding;
    
    cells.push(`
      <rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" fill="${color}">
        <title>${dateStr}: ${count}</title>
      </rect>
    `);
  }
  
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="8" fill="${theme.background}"/>
  <text x="${padding}" y="${height - 8}" font-family="Inter, sans-serif" font-size="10" fill="${theme.text}" opacity="0.7">Last 30 days</text>
  ${cells.join('')}
</svg>`;
}
