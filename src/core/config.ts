import { constants } from 'node:fs';
import { access, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const GW_CONFIG_FILENAME = '.gw_project';
export const GW_CONFIG_VERSION = '1';
export const GW_PATH_STYLE = 'flat-tilde';
export const DEFAULT_REMOTE_NAME = 'origin';

export interface GwConfig {
  version: string;
  primaryBranch?: string;
  remoteName: string;
  branchPrefix: string;
  pathStyle: string;
}

export interface WriteGwConfigOptions {
  primaryBranch: string;
  remoteName?: string;
  branchPrefix?: string;
}

export function getGwConfigPath(projectRoot: string): string {
  return join(projectRoot, GW_CONFIG_FILENAME);
}

export async function hasGwConfig(projectRoot: string): Promise<boolean> {
  try {
    await access(getGwConfigPath(projectRoot), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function parseGwConfig(text: string): GwConfig {
  const values = new Map<string, string>();

  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || values.has(key)) {
      continue;
    }

    const value = line.slice(separatorIndex + 1).trim();
    values.set(key, value);
  }

  const primaryBranch = values.get('primary') || undefined;

  return {
    version: values.get('version') || GW_CONFIG_VERSION,
    primaryBranch,
    remoteName: values.get('remote') || DEFAULT_REMOTE_NAME,
    branchPrefix: values.get('branch-prefix') || '',
    pathStyle: values.get('path_style') || GW_PATH_STYLE,
  };
}

export async function readGwConfig(projectRoot: string): Promise<GwConfig> {
  const configText = await readFile(getGwConfigPath(projectRoot), 'utf8');
  return parseGwConfig(configText);
}

export async function writeGwConfig(
  projectRoot: string,
  options: WriteGwConfigOptions
): Promise<void> {
  const remoteName = options.remoteName || DEFAULT_REMOTE_NAME;
  const branchPrefix = options.branchPrefix || '';
  const configText = [
    `version=${GW_CONFIG_VERSION}`,
    `primary=${options.primaryBranch}`,
    `remote=${remoteName}`,
    `path_style=${GW_PATH_STYLE}`,
    `branch-prefix=${branchPrefix}`,
  ].join('\n');

  await writeFile(getGwConfigPath(projectRoot), `${configText}\n`, 'utf8');
}

export function getPrimaryBranch(
  config: GwConfig,
  projectRoot: string
): string {
  if (!config.primaryBranch) {
    throw new Error(`missing 'primary' in ${getGwConfigPath(projectRoot)}`);
  }

  return config.primaryBranch;
}

export function getRemoteName(config: GwConfig): string {
  return config.remoteName || DEFAULT_REMOTE_NAME;
}

export function getBranchPrefix(config: GwConfig): string {
  return config.branchPrefix || '';
}
