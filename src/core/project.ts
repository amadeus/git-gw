import { dirname, join, sep } from 'node:path';

import {
  GW_CONFIG_FILENAME,
  type GwConfig,
  getPrimaryBranch,
} from '@/core/config';
import {
  getGitTopLevel,
  isInsideWorkTree,
  resolveExistingPath,
} from '@/core/git';

export async function resolvePath(path: string): Promise<string> {
  return resolveExistingPath(path);
}

export async function findProjectRoot(
  startPath = process.cwd()
): Promise<string | null> {
  let dir = await resolvePath(startPath);

  while (true) {
    try {
      await resolvePath(join(dir, GW_CONFIG_FILENAME));
      return dir;
    } catch {
      const parentDir = dirname(dir);
      if (parentDir === dir) {
        return null;
      }

      dir = parentDir;
    }
  }
}

export async function isPathInside(
  childPath: string,
  parentPath: string
): Promise<boolean> {
  try {
    const [child, parent] = await Promise.all([
      resolvePath(childPath),
      resolvePath(parentPath),
    ]);
    return child === parent || child.startsWith(`${parent}${sep}`);
  } catch {
    return false;
  }
}

export async function getAnchorRepoPath(
  projectRoot: string,
  config: GwConfig
): Promise<string> {
  const primaryBranch = getPrimaryBranch(config, projectRoot);
  const anchorRepoPath = join(projectRoot, primaryBranch);

  if (!(await isInsideWorkTree(anchorRepoPath))) {
    throw new Error(
      `primary worktree is missing or invalid: ${anchorRepoPath}`
    );
  }

  return resolvePath(anchorRepoPath);
}

export async function findCurrentRepoPath(
  projectRoot: string,
  cwd = process.cwd()
): Promise<string | null> {
  const repoPath = await getGitTopLevel(cwd);
  if (!repoPath) {
    return null;
  }

  if (!(await isPathInside(repoPath, projectRoot))) {
    return null;
  }

  return repoPath;
}
