import { graphql } from '@octokit/graphql';
import { createGraphQLClient } from './client';
import { logger } from '../utils/logger';

/**
 * GraphQL Queries for GitHub API
 * Used for efficient batch data fetching
 */

/**
 * Get user contributions for a specific period
 */
export const USER_CONTRIBUTIONS_QUERY = `
  query($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        totalCommitContributions
        totalIssueContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
  }
`;

/**
 * Get organization contribution stats
 */
export const ORG_CONTRIBUTIONS_QUERY = `
  query($org: String!, $first: Int!, $after: String) {
    organization(login: $org) {
      membersWithRole(first: $first, after: $after) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          login
          avatarUrl
          contributionsCollection {
            totalCommitContributions
            totalIssueContributions
            totalPullRequestContributions
            totalPullRequestReviewContributions
          }
        }
      }
    }
  }
`;

/**
 * Get repository contribution stats
 */
export const REPO_CONTRIBUTIONS_QUERY = `
  query($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      defaultBranchRef {
        target {
          ... on Commit {
            history(first: 100) {
              totalCount
              nodes {
                author {
                  user {
                    login
                  }
                }
                additions
                deletions
                committedDate
              }
            }
          }
        }
      }
    }
  }
`;

export interface UserContributionsResult {
  user: {
    contributionsCollection: {
      totalCommitContributions: number;
      totalIssueContributions: number;
      totalPullRequestContributions: number;
      totalPullRequestReviewContributions: number;
      contributionCalendar: {
        totalContributions: number;
        weeks: Array<{
          contributionDays: Array<{
            date: string;
            contributionCount: number;
          }>;
        }>;
      };
    };
  };
}

export interface OrgContributionsResult {
  organization: {
    membersWithRole: {
      totalCount: number;
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string;
      };
      nodes: Array<{
        login: string;
        avatarUrl: string;
        contributionsCollection: {
          totalCommitContributions: number;
          totalIssueContributions: number;
          totalPullRequestContributions: number;
          totalPullRequestReviewContributions: number;
        };
      }>;
    };
  };
}

/**
 * Fetch user contributions using GraphQL
 */
export async function fetchUserContributions(
  installationId: number,
  username: string,
  fromDate: Date,
  toDate: Date
): Promise<UserContributionsResult | null> {
  try {
    const client = await createGraphQLClient(installationId);
    
    const result = await client<UserContributionsResult>(USER_CONTRIBUTIONS_QUERY, {
      login: username,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
    });
    
    return result;
  } catch (error) {
    logger.error({ error, username }, 'Failed to fetch user contributions via GraphQL');
    return null;
  }
}

/**
 * Fetch organization member contributions
 */
export async function fetchOrgMemberContributions(
  installationId: number,
  orgLogin: string
): Promise<OrgContributionsResult['organization']['membersWithRole']['nodes']> {
  try {
    const client = await createGraphQLClient(installationId);
    const allMembers: OrgContributionsResult['organization']['membersWithRole']['nodes'] = [];
    
    let hasNextPage = true;
    let cursor: string | null = null;
    
    while (hasNextPage) {
      const result: OrgContributionsResult = await client<OrgContributionsResult>(ORG_CONTRIBUTIONS_QUERY, {
        org: orgLogin,
        first: 100,
        after: cursor,
      });
      
      allMembers.push(...result.organization.membersWithRole.nodes);
      hasNextPage = result.organization.membersWithRole.pageInfo.hasNextPage;
      cursor = result.organization.membersWithRole.pageInfo.endCursor;
    }
    
    return allMembers;
  } catch (error) {
    logger.error({ error, orgLogin }, 'Failed to fetch org member contributions via GraphQL');
    return [];
  }
}

/**
 * Get contribution calendar for heatmap generation
 */
export async function fetchContributionCalendar(
  installationId: number,
  username: string
): Promise<Array<{ date: string; count: number }> | null> {
  try {
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const result = await fetchUserContributions(
      installationId,
      username,
      oneYearAgo,
      now
    );
    
    if (!result) {
      return null;
    }
    
    const calendar: Array<{ date: string; count: number }> = [];
    
    for (const week of result.user.contributionsCollection.contributionCalendar.weeks) {
      for (const day of week.contributionDays) {
        calendar.push({
          date: day.date,
          count: day.contributionCount,
        });
      }
    }
    
    return calendar;
  } catch (error) {
    logger.error({ error, username }, 'Failed to fetch contribution calendar');
    return null;
  }
}
