import type { Command } from 'commander';
import { join } from 'node:path';

import {
  commandAction,
  getCurrentDirectory,
  loadProjectContext,
  pathExists,
  printGwError,
  requestDirectoryChange,
  resolveSwitchBranchWithPrompt,
} from '@/commands/shared';
import { getSwitchTargetFolderName } from '@/core/branches';
import { getBranchPrefix, getRemoteName } from '@/core/config';
import {
  addWorktree,
  branchExists,
  fetchRemoteBranchRef,
  setBranchUpstream,
  syncRelativeHooksPath,
} from '@/core/git';
import { findCurrentRepoPath } from '@/core/project';
import {
  findWorktreeForBranch,
  findWorktreeForFolderName,
  listWorktrees,
} from '@/core/worktrees';
import { pickSwitchWorktreePath } from '@/tui/switch-picker';

interface SwitchOptions {
  ignorePrefix?: boolean;
}

export function registerSwitchCommand(program: Command): void {
  program
    .command('switch')
    .description('Switch to or create a worktree for a branch')
    .argument('[branch]')
    .option('--ignore-prefix', 'Ignore branch prefix resolution')
    .action(
      commandAction(
        async (rawBranch: string | undefined, options: SwitchOptions) => {
          const context = await loadProjectContext();
          const currentDir = await getCurrentDirectory();
          const ignorePrefix = Boolean(options.ignorePrefix);

          if (!rawBranch) {
            if (ignorePrefix) {
              throw new Error('--ignore-prefix requires a branch name');
            }

            const selectedPath = await pickSwitchWorktreePath(
              context.anchorRepo,
              currentDir
            );
            if (!selectedPath) {
              return;
            }

            await requestDirectoryChange(selectedPath);
            return;
          }

          const worktrees = await listWorktrees(context.anchorRepo);
          if (rawBranch.includes('~')) {
            const folderWorktree = findWorktreeForFolderName(
              worktrees,
              rawBranch
            );
            if (folderWorktree) {
              await requestDirectoryChange(folderWorktree);
              return;
            }
          }

          const remoteName = getRemoteName(context.config);
          const branchPrefix = getBranchPrefix(context.config);
          const branchChoice = await resolveSwitchBranchWithPrompt(
            context,
            rawBranch,
            ignorePrefix,
            remoteName,
            worktrees
          );

          if (!branchChoice) {
            process.exitCode = 1;
            return;
          }

          const resolvedBranch = branchChoice.branchName;

          const existingWorktree = findWorktreeForBranch(
            worktrees,
            resolvedBranch
          );
          if (existingWorktree) {
            await requestDirectoryChange(existingWorktree);
            return;
          }

          const folderName = getSwitchTargetFolderName(
            resolvedBranch,
            branchPrefix,
            worktrees
          );
          const targetPath = join(context.projectRoot, folderName);

          if (await pathExists(targetPath)) {
            throw new Error(`target path already exists: ${targetPath}`);
          }

          if (await branchExists(context.anchorRepo, resolvedBranch)) {
            await addWorktree(context.anchorRepo, targetPath, {
              branchName: resolvedBranch,
            });
          } else if (branchChoice.remote) {
            const remoteStartRef = `${remoteName}/${resolvedBranch}`;
            await fetchRemoteBranchRef(
              context.anchorRepo,
              remoteName,
              resolvedBranch
            );
            await addWorktree(context.anchorRepo, targetPath, {
              branchName: resolvedBranch,
              createBranch: true,
              startPoint: remoteStartRef,
            });
            await setBranchUpstream(targetPath, resolvedBranch, remoteStartRef);
          } else {
            const baseRepo =
              (await findCurrentRepoPath(context.projectRoot)) ||
              context.anchorRepo;
            await addWorktree(baseRepo, targetPath, {
              branchName: resolvedBranch,
              createBranch: true,
            });
          }

          try {
            await syncRelativeHooksPath(context.anchorRepo, targetPath);
          } catch {
            printGwError(
              `failed to sync hooks into new worktree: ${targetPath}`
            );
          }

          await requestDirectoryChange(targetPath);
        }
      )
    );
}
