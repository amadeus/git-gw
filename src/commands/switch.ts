import type { Command } from 'commander';
import { join } from 'node:path';

import {
  commandAction,
  getCurrentDirectory,
  loadProjectContext,
  pathExists,
  printGwError,
  requestDirectoryChange,
  resolveBranchWithPrompt,
  selectWorktreePath,
} from '@/commands/shared';
import { encodeBranchPath } from '@/core/branches';
import { getBranchPrefix, getRemoteName } from '@/core/config';
import {
  addWorktree,
  branchExists,
  fetchRemoteBranchRef,
  remoteBranchExists,
  setBranchUpstream,
  syncRelativeHooksPath,
} from '@/core/git';
import { findCurrentRepoPath } from '@/core/project';
import {
  findWorktreeForBranch,
  findWorktreeForFolderName,
  listWorktrees,
} from '@/core/worktrees';

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

            const selectedPath = await selectWorktreePath(
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
          const folderWorktree = findWorktreeForFolderName(
            worktrees,
            rawBranch
          );
          if (folderWorktree) {
            await requestDirectoryChange(folderWorktree);
            return;
          }

          const remoteName = getRemoteName(context.config);
          let resolvedBranch: string;
          let remoteStartRef: string | undefined;

          if (await branchExists(context.anchorRepo, rawBranch)) {
            resolvedBranch = rawBranch;
          } else if (
            await remoteBranchExists(context.anchorRepo, remoteName, rawBranch)
          ) {
            resolvedBranch = rawBranch;
            remoteStartRef = `${remoteName}/${rawBranch}`;
          } else {
            const branchChoice = await resolveBranchWithPrompt(
              context,
              rawBranch,
              ignorePrefix
            );

            if (!branchChoice) {
              process.exitCode = 1;
              return;
            }

            resolvedBranch = branchChoice;
          }

          const existingWorktree = findWorktreeForBranch(
            worktrees,
            resolvedBranch
          );
          if (existingWorktree) {
            await requestDirectoryChange(existingWorktree);
            return;
          }

          const branchPrefix = getBranchPrefix(context.config);
          const folderName = encodeBranchPath(resolvedBranch, branchPrefix);
          const targetPath = join(context.projectRoot, folderName);

          if (await pathExists(targetPath)) {
            throw new Error(`target path already exists: ${targetPath}`);
          }

          if (await branchExists(context.anchorRepo, resolvedBranch)) {
            await addWorktree(context.anchorRepo, targetPath, {
              branchName: resolvedBranch,
            });
          } else if (remoteStartRef) {
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
