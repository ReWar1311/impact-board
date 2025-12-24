import { Octokit } from '@octokit/rest';
import { graphql } from '@octokit/graphql';
import { getInstallationToken } from './auth';
import { logger, logGitHubApi } from '../utils/logger';
import { GITHUB_API_VERSION, PROFILE_REPO_NAME, PROFILE_README_PATH, CONFIG_FILE_NAME } from '../config/constants';
import type { GitHubRepository, GitHubUser, OrgSettings } from '../types';
import { DEFAULT_ORG_SETTINGS } from '../types';
import { orgConfigSchema } from '../types/schemas';
import yaml from 'js-yaml';

/**
 * GitHub API Client
 * 
 * Provides a high-level interface to GitHub's REST and GraphQL APIs
 * All operations use installation access tokens, never PATs
 */

/**
 * Create an authenticated Octokit client for an installation
 */
export async function createOctokitClient(installationId: number): Promise<Octokit> {
  const token = await getInstallationToken(installationId);
  
  return new Octokit({
    auth: token,
    headers: {
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
    },
    log: {
      debug: (message: string) => logger.debug({ github: true }, message),
      info: (message: string) => logger.info({ github: true }, message),
      warn: (message: string) => logger.warn({ github: true }, message),
      error: (message: string) => logger.error({ github: true }, message),
    },
  });
}

/**
 * Create an authenticated GraphQL client for an installation
 */
export async function createGraphQLClient(
  installationId: number
): Promise<typeof graphql> {
  const token = await getInstallationToken(installationId);
  
  return graphql.defaults({
    headers: {
      authorization: `token ${token}`,
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
    },
  });
}

/**
 * Get organization details
 */
export async function getOrganization(
  installationId: number,
  orgLogin: string
): Promise<{ id: number; login: string; avatarUrl: string } | null> {
  const startTime = Date.now();
  const octokit = await createOctokitClient(installationId);
  
  try {
    const { data } = await octokit.orgs.get({ org: orgLogin });
    
    logGitHubApi('GET', `/orgs/${orgLogin}`, installationId, Date.now() - startTime);
    
    return {
      id: data.id,
      login: data.login,
      avatarUrl: data.avatar_url,
    };
  } catch (error) {
    logger.error({ error, orgLogin }, 'Failed to get organization');
    return null;
  }
}

/**
 * Get user details by username
 */
export async function getUser(
  installationId: number,
  username: string
): Promise<GitHubUser | null> {
  const startTime = Date.now();
  const octokit = await createOctokitClient(installationId);
  
  try {
    const { data } = await octokit.users.getByUsername({ username });
    
    logGitHubApi('GET', `/users/${username}`, installationId, Date.now() - startTime);
  
    
    return {
      id: data.id,
      login: data.login,
      avatar_url: data.avatar_url,
      type: data.type as 'User' | 'Bot' | 'Organization',
    };
  } catch (error) {
    logger.error({ error, username }, 'Failed to get user');
    return null;
  }
}

/**
 * Check if the organization's profile repository exists
 */
export async function getProfileRepository(
  installationId: number,
  orgLogin: string
): Promise<GitHubRepository | null> {
  const startTime = Date.now();
  const octokit = await createOctokitClient(installationId);
  
  try {
    const { data } = await octokit.repos.get({
      owner: orgLogin,
      repo: PROFILE_REPO_NAME,
    });
    
    logGitHubApi('GET', `/repos/${orgLogin}/${PROFILE_REPO_NAME}`, installationId, Date.now() - startTime);
    
    return data as GitHubRepository;
  } catch (error) {
    // 404 is expected if repo doesn't exist
    if ((error as { status?: number }).status === 404) {
      return null;
    }
    logger.error({ error, orgLogin }, 'Failed to get profile repository');
    return null;
  }
}

/**
 * Create the organization's profile repository
 */
export async function createProfileRepository(
  installationId: number,
  orgLogin: string
): Promise<GitHubRepository | null> {
  const startTime = Date.now();
  const octokit = await createOctokitClient(installationId);
  
  try {
    const { data } = await octokit.repos.createInOrg({
      org: orgLogin,
      name: PROFILE_REPO_NAME,
      description: 'Organization profile and contribution stats',
      visibility: 'public',
      auto_init: true,
    });
    
    logGitHubApi('POST', `/orgs/${orgLogin}/repos`, installationId, Date.now() - startTime);
    
    logger.info({ orgLogin }, 'Created profile repository');
    return data as GitHubRepository;
  } catch (error) {
    logger.error({ error, orgLogin }, 'Failed to create profile repository');
    return null;
  }
}

/**
 * Get the profile README content
 */
export async function getProfileReadme(
  installationId: number,
  orgLogin: string
): Promise<{ content: string; sha: string } | null> {
  const startTime = Date.now();
  const octokit = await createOctokitClient(installationId);
  
  try {
    const { data } = await octokit.repos.getContent({
      owner: orgLogin,
      repo: PROFILE_REPO_NAME,
      path: PROFILE_README_PATH,
    });
    
    logGitHubApi('GET', `/repos/${orgLogin}/${PROFILE_REPO_NAME}/contents/${PROFILE_README_PATH}`, installationId, Date.now() - startTime);
    
    if ('content' in data && typeof data.content === 'string') {
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return { content, sha: data.sha };
    }
    
    return null;
  } catch (error) {
    if ((error as { status?: number }).status === 404) {
      return null;
    }
    logger.error({ error, orgLogin }, 'Failed to get profile README');
    return null;
  }
}

/**
 * Update the profile README content with retry logic for SHA conflicts
 */
export async function updateProfileReadme(
  installationId: number,
  orgLogin: string,
  content: string,
  sha?: string,
  maxRetries = 5
): Promise<boolean> {
  const octokit = await createOctokitClient(installationId);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const startTime = Date.now();
    
    // Get fresh SHA on each attempt if not provided or if retrying
    let currentSha = sha;
    if (attempt > 1 || !sha) {
      try {
        const existing = await octokit.repos.getContent({
          owner: orgLogin,
          repo: PROFILE_REPO_NAME,
          path: PROFILE_README_PATH,
        });
        if ('sha' in existing.data) currentSha = existing.data.sha as string;
      } catch (e: unknown) {
        // File doesn't exist - that's fine, sha stays undefined for create
        const is404 = e instanceof Error && 'status' in e && (e as { status: number }).status === 404;
        if (!is404) throw e;
        currentSha = undefined;
      }
    }
    
    try {
      const requestBody: {
        owner: string;
        repo: string;
        path: string;
        message: string;
        content: string;
        sha?: string;
      } = {
        owner: orgLogin,
        repo: PROFILE_REPO_NAME,
        path: PROFILE_README_PATH,
        message: '📊 Update contribution stats [impact-board-bot]',
        content: Buffer.from(content).toString('base64'),
      };
      
      if (currentSha) {
        requestBody.sha = currentSha;
      }
      
      await octokit.repos.createOrUpdateFileContents(requestBody);
      
      logGitHubApi('PUT', `/repos/${orgLogin}/${PROFILE_REPO_NAME}/contents/${PROFILE_README_PATH}`, installationId, Date.now() - startTime);
      
      logger.info({ orgLogin }, 'Updated profile README');
      return true;
    } catch (error: unknown) {
      const isConflict = error instanceof Error && 'status' in error && (error as { status: number }).status === 409;
      if (isConflict && attempt < maxRetries) {
        // SHA conflict - exponential backoff with jitter
        const baseDelay = 200 * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 100;
        await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter));
        continue;
      }
      logger.error({ error, orgLogin, attempt }, 'Failed to update profile README');
      return false;
    }
  }
  
  return false;
}

/**
 * Get the organization's config file (.impact-board.yml)
 */
export async function getOrgConfig(
  installationId: number,
  orgLogin: string
): Promise<OrgSettings> {
  const startTime = Date.now();
  const octokit = await createOctokitClient(installationId);
  
  try {
    const { data } = await octokit.repos.getContent({
      owner: orgLogin,
      repo: PROFILE_REPO_NAME,
      path: CONFIG_FILE_NAME,
    });
    
    logGitHubApi('GET', `/repos/${orgLogin}/${PROFILE_REPO_NAME}/contents/${CONFIG_FILE_NAME}`, installationId, Date.now() - startTime);
    
    if ('content' in data && typeof data.content === 'string') {
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      const parsed = yaml.load(content);
      const validated = orgConfigSchema.safeParse(parsed);
      
      if (validated.success) {
        // Merge with defaults
        return {
          ...DEFAULT_ORG_SETTINGS,
          ...validated.data.settings,
          customScoringWeights: validated.data.scoring,
          customRankThresholds: validated.data.ranks,
          customAntiGaming: validated.data.antiGaming,
        };
      }
      
      logger.warn({ orgLogin }, 'Invalid org config file, using defaults');
    }
    
    return DEFAULT_ORG_SETTINGS;
  } catch (error) {
    if ((error as { status?: number }).status === 404) {
      // Config file doesn't exist, use defaults
      return DEFAULT_ORG_SETTINGS;
    }
    logger.error({ error, orgLogin }, 'Failed to get org config');
    return DEFAULT_ORG_SETTINGS;
  }
}

/**
 * Get commit details including line changes
 */
export async function getCommitDetails(
  installationId: number,
  owner: string,
  repo: string,
  sha: string
): Promise<{ additions: number; deletions: number; files: number } | null> {
  const startTime = Date.now();
  const octokit = await createOctokitClient(installationId);
  
  try {
    const { data } = await octokit.repos.getCommit({
      owner,
      repo,
      ref: sha,
    });
    
    logGitHubApi('GET', `/repos/${owner}/${repo}/commits/${sha}`, installationId, Date.now() - startTime);
    
    return {
      additions: data.stats?.additions ?? 0,
      deletions: data.stats?.deletions ?? 0,
      files: data.files?.length ?? 0,
    };
  } catch (error) {
    logger.error({ error, owner, repo, sha }, 'Failed to get commit details');
    return null;
  }
}

/**
 * Get pull request details
 */
export async function getPullRequestDetails(
  installationId: number,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<{ additions: number; deletions: number; changedFiles: number; merged: boolean } | null> {
  const startTime = Date.now();
  const octokit = await createOctokitClient(installationId);
  
  try {
    const { data } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    });
    
    logGitHubApi('GET', `/repos/${owner}/${repo}/pulls/${pullNumber}`, installationId, Date.now() - startTime);
    
    return {
      additions: data.additions,
      deletions: data.deletions,
      changedFiles: data.changed_files,
      merged: data.merged,
    };
  } catch (error) {
    logger.error({ error, owner, repo, pullNumber }, 'Failed to get PR details');
    return null;
  }
}

/**
 * Get organization members
 */
export async function getOrgMembers(
  installationId: number,
  orgLogin: string
): Promise<GitHubUser[]> {
  const startTime = Date.now();
  const octokit = await createOctokitClient(installationId);
  
  try {
    const members: GitHubUser[] = [];
    
    for await (const response of octokit.paginate.iterator(octokit.orgs.listMembers, {
      org: orgLogin,
      per_page: 100,
    })) {
      for (const member of response.data) {
        members.push({
          id: member.id,
          login: member.login,
          avatar_url: member.avatar_url,
          type: member.type as 'User' | 'Bot' | 'Organization',
        });
      }
    }
    
    logGitHubApi('GET', `/orgs/${orgLogin}/members`, installationId, Date.now() - startTime);
    
    return members;
  } catch (error) {
    logger.error({ error, orgLogin }, 'Failed to get org members');
    return [];
  }
}

/**
 * Get organization repositories
 */
export async function getOrgRepositories(
  installationId: number,
  orgLogin: string
): Promise<GitHubRepository[]> {
  const startTime = Date.now();
  const octokit = await createOctokitClient(installationId);
  
  try {
    const repos: GitHubRepository[] = [];
    
    for await (const response of octokit.paginate.iterator(octokit.repos.listForOrg, {
      org: orgLogin,
      type: 'all',
      per_page: 100,
    })) {
      for (const repo of response.data) {
        repos.push(repo as GitHubRepository);
      }
    }
    
    logGitHubApi('GET', `/orgs/${orgLogin}/repos`, installationId, Date.now() - startTime);
    
    return repos;
  } catch (error) {
    logger.error({ error, orgLogin }, 'Failed to get org repositories');
    return [];
  }
}

/**
 * Get rate limit information
 */
export async function getRateLimit(
  installationId: number
): Promise<{ remaining: number; reset: Date } | null> {
  const octokit = await createOctokitClient(installationId);
  
  try {
    const { data } = await octokit.rateLimit.get();
    
    return {
      remaining: data.resources.core.remaining,
      reset: new Date(data.resources.core.reset * 1000),
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get rate limit');
    return null;
  }
}
