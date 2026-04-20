import type { Command } from 'commander';

import {
  commandAction,
  getCurrentDirectory,
  loadProjectContext,
  resolveBranchWithPrompt,
} from '@/commands/shared';
import { getPrimaryBranch, getRemoteName } from '@/core/config';
import {
  branchExists,
  deleteBranch,
  deleteRemoteBranch,
  removeWorktree,
} from '@/core/git';
import { isPathInside } from '@/core/project';
import { findWorktreeForBranch, listWorktrees } from '@/core/worktrees';

interface RemoveOptions {
  force?: boolean;
  remote?: boolean;
  ignorePrefix?: boolean;
}

export function registerRemoveCommand(program: Command): void {
  program
    .command('remove')
    .alias('rm')
    .description('Remove a worktree and optionally its branch')
    .argument('<branch>')
    .option('--force', 'Force worktree and branch removal')
    .option('--remote', 'Delete the remote branch after local removal')
    .option('--ignore-prefix', 'Ignore branch prefix resolution')
    .action(
      commandAction(async (rawBranch: string, options: RemoveOptions) => {
        const context = await loadProjectContext();
        const resolvedBranch = await resolveBranchWithPrompt(
          context,
          rawBranch,
          Boolean(options.ignorePrefix)
        );

        if (!resolvedBranch) {
          process.exitCode = 1;
          return;
        }

        if (
          resolvedBranch ===
          getPrimaryBranch(context.config, context.projectRoot)
        ) {
          throw new Error('refusing to remove the primary branch');
        }

        const worktrees = await listWorktrees(context.anchorRepo);
        const existingWorktree = findWorktreeForBranch(
          worktrees,
          resolvedBranch
        );
        const localBranchExists = await branchExists(
          context.anchorRepo,
          resolvedBranch
        );

        if (!localBranchExists && !existingWorktree) {
          throw new Error(`branch does not exist: ${resolvedBranch}`);
        }

        if (existingWorktree) {
          const currentDir = await getCurrentDirectory();
          if (await isPathInside(currentDir, existingWorktree)) {
            throw new Error(
              `cannot remove the current worktree while you are inside it: ${existingWorktree}`
            );
          }

          await removeWorktree(
            context.anchorRepo,
            existingWorktree,
            Boolean(options.force)
          );
        }

        if (localBranchExists) {
          await deleteBranch(
            context.anchorRepo,
            resolvedBranch,
            Boolean(options.force)
          );
        }

        if (options.remote) {
          await deleteRemoteBranch(
            context.anchorRepo,
            getRemoteName(context.config),
            resolvedBranch
          );
        }
      })
    );
}
