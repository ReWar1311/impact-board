import yaml from 'js-yaml';
import { logger } from '../utils/logger';
import { IMPACTBOARD_YAML_PATH, PROFILE_REPO_NAME } from '../config/constants';
import { createOctokitClient } from '../github/client';
import { impactYamlSchema, type ImpactYamlConfig } from '../types/schemas';

/**
 * Load and validate ImpactBoard YAML configuration (.github/impactboard.yml)
 * - Strict schema validation (reject unknown keys)
 * - Mode specific required blocks enforced via schema
 * - Returns null if file missing or invalid (caller decides fallback behavior)
 */
export async function loadImpactYamlConfig(
  installationId: number,
  orgLogin: string
): Promise<ImpactYamlConfig | null> {
  try {
    const octokit = await createOctokitClient(installationId);
    const { data } = await octokit.repos.getContent({
      owner: orgLogin,
      repo: PROFILE_REPO_NAME,
      path: IMPACTBOARD_YAML_PATH,
    });

    if ('content' in data && typeof data.content === 'string') {
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      const parsed = yaml.load(content);
      const validated = impactYamlSchema.safeParse(parsed);
      if (validated.success) {
        return validated.data;
      }
      logger.warn({ orgLogin }, 'Invalid impactboard.yml, skipping');
      return null;
    }
    // Not a file (e.g., directory) – treat as missing
    return null;
  } catch (error) {
    // 404 means no YAML – caller should use legacy behavior
    if ((error as { status?: number }).status === 404) {
      return null;
    }
    logger.error({ error, orgLogin }, 'Failed to load impactboard.yml');
    return null;
  }
}