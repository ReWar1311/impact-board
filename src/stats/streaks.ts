import { logger } from '../utils/logger';
import { repository } from '../storage/repository';
import { getTodayDate, getDaysAgo, isConsecutiveDay, isToday, isYesterday } from '../utils/date';
import type { StreakInfo } from '../types';

/**
 * Streak Calculator
 * 
 * Calculates contribution streaks for users
 * A streak is maintained by contributing on consecutive days
 */

class StreakCalculator {
  /**
   * Update streak information for a user after a contribution
   */
  async updateStreak(orgId: number, userId: number, userLogin: string): Promise<StreakInfo> {
    const today = getTodayDate();
    
    // Get existing streak info
    let streakInfo = await repository.streaks.get(orgId, userId);
    
    if (!streakInfo) {
      // First contribution - start a new streak
      streakInfo = {
        userId,
        userLogin,
        orgId,
        currentStreak: 1,
        longestStreak: 1,
        lastContributionDate: today,
        streakStartDate: today,
        longestStreakStartDate: today,
        longestStreakEndDate: today,
      };
      
      await repository.streaks.upsert(streakInfo);
      return streakInfo;
    }
    
    // Check if we already counted today
    if (streakInfo.lastContributionDate === today) {
      return streakInfo;
    }
    
    // Check if this continues the streak
    if (isConsecutiveDay(streakInfo.lastContributionDate, today)) {
      // Continue the streak
      streakInfo.currentStreak += 1;
      streakInfo.lastContributionDate = today;
      
      // Check if this is the new longest streak
      if (streakInfo.currentStreak > streakInfo.longestStreak) {
        streakInfo.longestStreak = streakInfo.currentStreak;
        streakInfo.longestStreakEndDate = today;
        if (!streakInfo.longestStreakStartDate) {
          streakInfo.longestStreakStartDate = streakInfo.streakStartDate;
        }
      }
    } else if (isYesterday(streakInfo.lastContributionDate) || isToday(streakInfo.lastContributionDate)) {
      // Edge case: same day or yesterday, streak continues
      streakInfo.lastContributionDate = today;
    } else {
      // Streak broken - start a new one
      streakInfo.currentStreak = 1;
      streakInfo.streakStartDate = today;
      streakInfo.lastContributionDate = today;
    }
    
    await repository.streaks.upsert(streakInfo);
    return streakInfo;
  }
  
  /**
   * Calculate streak from historical daily contributions
   * Used for backfilling or recalculating
   */
  async calculateHistoricalStreak(
    orgId: number,
    userId: number,
    userLogin: string
  ): Promise<StreakInfo> {
    // Get all contribution dates in order
    const contributions = await repository.contributions.getDates(orgId, userId);
    
    if (contributions.length === 0) {
      return {
        userId,
        userLogin,
        orgId,
        currentStreak: 0,
        longestStreak: 0,
        lastContributionDate: '',
        streakStartDate: null,
        longestStreakStartDate: null,
        longestStreakEndDate: null,
      };
    }
    
    // Sort dates chronologically
    const dates = contributions.sort();
    
    let currentStreak = 1;
    let longestStreak = 1;
    let currentStreakStart = dates[0];
    let longestStreakStart = dates[0];
    let longestStreakEnd = dates[0];
    
    for (let i = 1; i < dates.length; i++) {
      const prevDate = dates[i - 1];
      const currDate = dates[i];
      
      if (prevDate && currDate && isConsecutiveDay(prevDate, currDate)) {
        currentStreak++;
        
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
          longestStreakStart = currentStreakStart ?? currDate;
          longestStreakEnd = currDate;
        }
      } else {
        currentStreak = 1;
        currentStreakStart = currDate ?? '';
      }
    }
    
    // Check if current streak is still active (includes today or yesterday)
    const lastDate = dates[dates.length - 1];
    if (lastDate && !isToday(lastDate) && !isYesterday(lastDate)) {
      currentStreak = 0;
      currentStreakStart = undefined;
    }
    
    const streakInfo: StreakInfo = {
      userId,
      userLogin,
      orgId,
      currentStreak,
      longestStreak,
      lastContributionDate: lastDate ?? '',
      streakStartDate: currentStreakStart ?? null,
      longestStreakStartDate: longestStreakStart ?? null,
      longestStreakEndDate: longestStreakEnd ?? null,
    };
    
    await repository.streaks.upsert(streakInfo);
    return streakInfo;
  }
  
  /**
   * Get streak information for a user
   */
  async getStreak(orgId: number, userId: number): Promise<StreakInfo | null> {
    return repository.streaks.get(orgId, userId);
  }
  
  /**
   * Get top streaks for an organization
   */
  async getTopStreaks(orgId: number, limit: number): Promise<StreakInfo[]> {
    const allStreaks = await repository.streaks.getByOrg(orgId);
    
    // Sort by current streak descending
    allStreaks.sort((a: StreakInfo, b: StreakInfo) => b.currentStreak - a.currentStreak);
    
    return allStreaks.slice(0, limit);
  }
  
  /**
   * Check if a user's streak is at risk (no contribution today)
   */
  async getAtRiskStreaks(orgId: number, minStreak = 7): Promise<StreakInfo[]> {
    const allStreaks = await repository.streaks.getByOrg(orgId);
    const yesterday = getDaysAgo(1);
    
    return allStreaks.filter((streak: StreakInfo) => {
      return streak.currentStreak >= minStreak && 
             streak.lastContributionDate === yesterday;
    });
  }
}

export const streaks = new StreakCalculator();
