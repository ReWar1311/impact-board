import { z } from 'zod';
import { logger } from './logger';

/**
 * Validation utility functions
 */

/**
 * Validate data against a Zod schema
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Safely validate data against a Zod schema
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validate and log errors
 */
export function validateWithLogging<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context: string
): T | null {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }

  logger.warn({
    message: 'Validation failed',
    context,
    errors: result.error.errors,
  });

  return null;
}

/**
 * Check if a string is a valid GitHub username
 */
export function isValidGitHubUsername(username: string): boolean {
  // GitHub usernames can contain alphanumeric characters and hyphens
  // Cannot start or end with a hyphen
  // Maximum 39 characters
  const pattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
  return pattern.test(username);
}

/**
 * Check if a string is a valid repository name
 */
export function isValidRepoName(name: string): boolean {
  // Repository names can contain alphanumeric characters, hyphens, underscores, and periods
  // Cannot start with a period
  // Maximum 100 characters
  const pattern = /^[a-zA-Z0-9_-][a-zA-Z0-9._-]{0,99}$/;
  return pattern.test(name);
}

/**
 * Check if a string is a valid organization name
 */
export function isValidOrgName(name: string): boolean {
  // Same rules as GitHub username
  return isValidGitHubUsername(name);
}

/**
 * Sanitize a string for safe display
 */
export function sanitizeString(str: string, maxLength = 200): string {
  return str
    .replace(/[<>&"']/g, (char) => {
      switch (char) {
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '&':
          return '&amp;';
        case '"':
          return '&quot;';
        case "'":
          return '&#39;';
        default:
          return char;
      }
    })
    .substring(0, maxLength);
}

/**
 * Validate a webhook delivery ID
 */
export function isValidDeliveryId(id: string): boolean {
  // UUID v4 format
  const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return pattern.test(id);
}

/**
 * Validate a date string in YYYY-MM-DD format
 */
export function isValidDateString(dateStr: string): boolean {
  const pattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!pattern.test(dateStr)) {
    return false;
  }

  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Validate a month string in YYYY-MM format
 */
export function isValidMonthString(monthStr: string): boolean {
  const pattern = /^\d{4}-\d{2}$/;
  if (!pattern.test(monthStr)) {
    return false;
  }

  const [year, month] = monthStr.split('-').map(Number);
  return year !== undefined && month !== undefined && 
         year >= 1970 && year <= 2100 && month >= 1 && month <= 12;
}

/**
 * Ensure a number is within a range
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Check if a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Check if a value is a positive number
 */
export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && value > 0;
}

/**
 * Check if a value is a non-negative number
 */
export function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && value >= 0;
}
