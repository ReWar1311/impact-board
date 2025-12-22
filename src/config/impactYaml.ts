import yaml from 'js-yaml';
import { logger } from '../utils/logger';
import { IMPACTBOARD_YAML_PATH, PROFILE_REPO_NAME } from '../config/constants';
import { createOctokitClient } from '../github/client';
import { impactYamlSchema, type ImpactYamlConfig } from '../types/schemas';

interface ValidationError {
  path: string;
  message: string;
  code: string;
}

interface ValidationResult {
  valid: boolean;
  config: ImpactYamlConfig | null;
  errors: ValidationError[];
  rawYaml: unknown;
  failOnInvalidConfig: boolean;
}

/**
 * Check if raw YAML has fail_on_invalid_config set
 */
function checkFailOnInvalidConfig(raw: unknown): boolean {
  if (typeof raw !== 'object' || raw === null) return false;
  const obj = raw as Record<string, unknown>;
  // Check root-level behavior
  if (typeof obj.behavior === 'object' && obj.behavior !== null) {
    const behavior = obj.behavior as Record<string, unknown>;
    if (behavior.fail_on_invalid_config === true) return true;
  }
  // Check advanced.behavior
  if (typeof obj.advanced === 'object' && obj.advanced !== null) {
    const advanced = obj.advanced as Record<string, unknown>;
    if (typeof advanced.behavior === 'object' && advanced.behavior !== null) {
      const behavior = advanced.behavior as Record<string, unknown>;
      if (behavior.fail_on_invalid_config === true) return true;
    }
  }
  return false;
}

/**
 * Load and validate ImpactBoard YAML configuration (.github/impactboard.yml)
 * - Lenient schema with sensible defaults
 * - Returns null if file missing
 * - Respects fail_on_invalid_config: if true, returns null on validation errors
 */
export async function loadImpactYamlConfig(
  installationId: number,
  orgLogin: string
): Promise<ImpactYamlConfig | null> {
  const result = await validateImpactYamlConfig(installationId, orgLogin);
  
  if (result.valid) {
    return result.config;
  }
  
  // Log validation errors
  if (result.errors.length > 0) {
    const level = result.failOnInvalidConfig ? 'error' : 'warn';
    logger[level](
      { orgLogin, errors: result.errors, rawYaml: result.rawYaml, failOnInvalidConfig: result.failOnInvalidConfig },
      result.failOnInvalidConfig 
        ? 'Invalid impactboard.yml - fail_on_invalid_config is true, skipping README update'
        : 'Invalid impactboard.yml - using legacy behavior'
    );
  }
  
  return null;
}

/**
 * Validate ImpactBoard YAML and return detailed errors
 * Useful for API endpoints to show users what's wrong
 */
export async function validateImpactYamlConfig(
  installationId: number,
  orgLogin: string
): Promise<ValidationResult> {
  try {
    const octokit = await createOctokitClient(installationId);
    const { data } = await octokit.repos.getContent({
      owner: orgLogin,
      repo: PROFILE_REPO_NAME,
      path: IMPACTBOARD_YAML_PATH,
    });

    if ('content' in data && typeof data.content === 'string') {
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      let parsed: unknown;
      try {
        parsed = yaml.load(content);
      } catch (yamlError) {
        return {
          valid: false,
          config: null,
          errors: [{ path: '', message: `YAML syntax error: ${(yamlError as Error).message}`, code: 'yaml_syntax' }],
          rawYaml: content,
          failOnInvalidConfig: false,
        };
      }

      // Check fail_on_invalid_config BEFORE parsing
      const failOnInvalidConfig = checkFailOnInvalidConfig(parsed);

      const validated = impactYamlSchema.safeParse(parsed);
      if (validated.success) {
        return {
          valid: true,
          config: validated.data,
          errors: [],
          rawYaml: parsed,
          failOnInvalidConfig,
        };
      }

      const errors = validated.error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
        code: e.code,
      }));
      return {
        valid: false,
        config: null,
        errors,
        rawYaml: parsed,
        failOnInvalidConfig,
      };
    }

    // Not a file (e.g., directory)
    return {
      valid: false,
      config: null,
      errors: [{ path: '', message: 'impactboard.yml is not a file', code: 'not_a_file' }],
      rawYaml: null,
      failOnInvalidConfig: false,
    };
  } catch (error) {
    // 404 means no YAML
    if ((error as { status?: number }).status === 404) {
      return {
        valid: false,
        config: null,
        errors: [], // No errors for missing file - just use legacy
        rawYaml: null,
        failOnInvalidConfig: false,
      };
    }
    logger.error({ error, orgLogin }, 'Failed to load impactboard.yml');
    return {
      valid: false,
      config: null,
      errors: [{ path: '', message: `Failed to fetch: ${(error as Error).message}`, code: 'fetch_error' }],
      rawYaml: null,
      failOnInvalidConfig: false,
    };
  }
}