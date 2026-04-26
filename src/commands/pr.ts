import type { Command } from 'commander';
import { join } from 'node:path';

import {
  commandAction,
  loadProjectContext,
  pathExists,
  printGwError,
  requestDirectoryChange,
} from '@/commands/shared';
import { getRemoteName } from '@/core/config';
import {
  addRemote,
  addWorktree,
  branchExists,
  fetchRemoteBranchRef,
  getRemoteUrl,
  listRemotes,
  setBranchUpstream,
  syncRelativeHooksPath,
} from '@/core/git';
import { getPullRequestHead } from '@/core/github';
import {
  choosePullRequestRemoteName,
  derivePullRequestRemoteUrl,
} from '@/core/pull-requests';
import { findWorktreeForBranch, listWorktrees } from '@/core/worktrees';

async function findRemoteByUrl(
  repoPath: string,
  remoteUrl: string
): Promise<string | null> {
  const remotes = await listRemotes(repoPath);

  for (const remote of remotes) {
    if ((await getRemoteUrl(repoPath, remote)) === remoteUrl) {
      return remote;
    }
  }

  return null;
}

async function ensurePullRequestRemote(
  repoPath: string,
  headRepositoryOwner: string,
  remoteUrl: string
): Promise<string> {
  const existingRemote = await findRemoteByUrl(repoPath, remoteUrl);
  if (existingRemote) {
    return existingRemote;
  }

  const existingRemotes = await listRemotes(repoPath);
  const remoteName = choosePullRequestRemoteName(
    headRepositoryOwner,
    existingRemotes
  );
  await addRemote(repoPath, remoteName, remoteUrl);

  return remoteName;
}

export function registerPrCommand(program: Command): void {
  program
    .command('pr')
    .description('Check out a GitHub pull request into a worktree')
    .argument('<number>')
    .action(
      commandAction(async (prNumber: string) => {
        if (!/^[0-9]+$/u.test(prNumber)) {
          throw new Error('PR number must be numeric');
        }

        const context = await loadProjectContext();
        const branchName = `pr_${prNumber}`;
        const targetPath = join(context.projectRoot, branchName);
        const worktrees = await listWorktrees(context.anchorRepo);
        const existingWorktree = findWorktreeForBranch(worktrees, branchName);

        if (existingWorktree) {
          await requestDirectoryChange(existingWorktree);
          return;
        }

        if (await pathExists(targetPath)) {
          throw new Error(`target path already exists: ${targetPath}`);
        }

        const pullRequestHead = await getPullRequestHead(
          context.anchorRepo,
          prNumber
        );
        const baseRemoteName = getRemoteName(context.config);
        const baseRemoteUrl = await getRemoteUrl(
          context.anchorRepo,
          baseRemoteName
        );
        const pullRequestRemoteUrl = derivePullRequestRemoteUrl(
          baseRemoteUrl,
          pullRequestHead.headRepositoryOwner
        );
        const pullRequestRemoteName = await ensurePullRequestRemote(
          context.anchorRepo,
          pullRequestHead.headRepositoryOwner,
          pullRequestRemoteUrl
        );
        const upstreamRef = `${pullRequestRemoteName}/${pullRequestHead.headRefName}`;

        await fetchRemoteBranchRef(
          context.anchorRepo,
          pullRequestRemoteName,
          pullRequestHead.headRefName
        );

        if (await branchExists(context.anchorRepo, branchName)) {
          await addWorktree(context.anchorRepo, targetPath, { branchName });
        } else {
          await addWorktree(context.anchorRepo, targetPath, {
            branchName,
            createBranch: true,
            startPoint: upstreamRef,
          });
        }

        await setBranchUpstream(targetPath, branchName, upstreamRef);

        try {
          await syncRelativeHooksPath(context.anchorRepo, targetPath);
        } catch {
          printGwError(`failed to sync hooks into new worktree: ${targetPath}`);
        }

        await requestDirectoryChange(targetPath);
      })
    );
}
