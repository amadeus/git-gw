import { execa } from 'execa';
import { basename } from 'node:path';

export interface WorktreeEntry {
  branchName: string;
  path: string;
}

export function parseWorktreeListPorcelain(output: string): WorktreeEntry[] {
  const entries: WorktreeEntry[] = [];
  let currentPath: string | undefined;
  let currentBranch: string | undefined;

  const flushEntry = () => {
    if (currentPath && currentBranch) {
      entries.push({
        branchName: currentBranch,
        path: currentPath,
      });
    }
  };

  for (const rawLine of output.split(/\r?\n/u)) {
    const line = rawLine.trimEnd();

    if (line.startsWith('worktree ')) {
      flushEntry();
      currentPath = line.slice('worktree '.length);
      currentBranch = undefined;
      continue;
    }

    if (line.startsWith('branch refs/heads/')) {
      currentBranch = line.slice('branch refs/heads/'.length);
    }
  }

  flushEntry();
  return entries;
}

export async function listWorktrees(
  repoPath: string
): Promise<WorktreeEntry[]> {
  const result = await execa('git', ['worktree', 'list', '--porcelain'], {
    cwd: repoPath,
    reject: false,
    stderr: 'pipe',
  });

  if (result.exitCode !== 0) {
    throw new Error(result.stderr || 'git worktree list --porcelain failed');
  }

  return parseWorktreeListPorcelain(result.stdout);
}

export function findWorktreeForBranch(
  worktrees: WorktreeEntry[],
  branchName: string
): string | null {
  const match = worktrees.find((entry) => entry.branchName === branchName);
  return match?.path || null;
}

export function findWorktreeForFolderName(
  worktrees: WorktreeEntry[],
  folderName: string
): string | null {
  const match = worktrees.find((entry) => basename(entry.path) === folderName);
  return match?.path || null;
}
