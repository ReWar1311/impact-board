/**
 * Date utility functions
 */

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDate(timezone = 'UTC'): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
}

/**
 * Get the current month in YYYY-MM format
 */
export function getCurrentMonth(timezone = 'UTC'): string {
  const date = new Date();
  const year = date.toLocaleDateString('en-CA', { timeZone: timezone, year: 'numeric' });
  const month = date.toLocaleDateString('en-CA', { timeZone: timezone, month: '2-digit' });
  return `${year}-${month}`;
}

/**
 * Parse a date string to Date object
 */
export function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

/**
 * Format a date to YYYY-MM-DD
 */
export function formatDate(date: Date, timezone = 'UTC'): string {
  return date.toLocaleDateString('en-CA', { timeZone: timezone });
}

/**
 * Format a date to YYYY-MM
 */
export function formatMonth(date: Date, timezone = 'UTC'): string {
  const year = date.toLocaleDateString('en-CA', { timeZone: timezone, year: 'numeric' });
  const month = date.toLocaleDateString('en-CA', { timeZone: timezone, month: '2-digit' });
  return `${year}-${month}`;
}

/**
 * Get date N days ago
 */
export function getDaysAgo(days: number, timezone = 'UTC'): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDate(date, timezone);
}

/**
 * Get the start of a period (7d, 30d, 90d, monthly, all-time)
 */
export function getPeriodStartDate(period: string, timezone = 'UTC'): string {
  const now = new Date();

  switch (period) {
    case '7d':
      return getDaysAgo(7, timezone);
    case '30d':
      return getDaysAgo(30, timezone);
    case '90d':
      return getDaysAgo(90, timezone);
    case 'monthly': {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return formatDate(firstOfMonth, timezone);
    }
    case 'all-time':
      return '1970-01-01';
    default:
      return getDaysAgo(30, timezone);
  }
}

/**
 * Calculate the number of days between two dates
 */
export function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if a date is consecutive to another (streak calculation)
 */
export function isConsecutiveDay(previousDate: string, currentDate: string): boolean {
  const prev = new Date(previousDate);
  const curr = new Date(currentDate);
  const diffTime = curr.getTime() - prev.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays === 1;
}

/**
 * Check if a date is today
 */
export function isToday(dateStr: string, timezone = 'UTC'): boolean {
  return dateStr === getTodayDate(timezone);
}

/**
 * Check if a date is yesterday
 */
export function isYesterday(dateStr: string, timezone = 'UTC'): boolean {
  return dateStr === getDaysAgo(1, timezone);
}

/**
 * Get an array of dates for a period
 */
export function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const currentDate = new Date(startDate);
  const end = new Date(endDate);

  while (currentDate <= end) {
    dates.push(formatDate(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
}

/**
 * Get the week number of a date
 */
export function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

/**
 * Get the day of week (0 = Sunday, 6 = Saturday)
 */
export function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr).getDay();
}

/**
 * Format a date for display
 */
export function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a timestamp for display
 */
export function formatTimestamp(date: Date): string {
  return date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
}
