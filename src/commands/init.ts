import type { Command } from 'commander';
import { join } from 'node:path';

import {
  commandAction,
  findChildRepoRoots,
  getCurrentDirectory,
  isDirectory,
} from '@/commands/shared';
import { hasGwConfig, writeGwConfig } from '@/core/config';
import {
  detectRemoteHeadFromRepo,
  getCurrentBranch,
  getGitTopLevel,
  getPreferredRemote,
} from '@/core/git';
import { resolvePath } from '@/core/project';

interface InitOptions {
  branchPrefix?: string;
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a gw project in the current directory')
    .option(
      '--branch-prefix <prefix>',
      'Prefix to apply when creating branches'
    )
    .action(
      commandAction(async (options: InitOptions) => {
        const projectRoot = await getCurrentDirectory();

        if (await hasGwConfig(projectRoot)) {
          throw new Error(`.gw_project already exists in ${projectRoot}`);
        }

        if (await getGitTopLevel(projectRoot)) {
          throw new Error(
            'run gw init from the top-level project directory, not from inside a worktree'
          );
        }

        const childPaths = await findChildRepoRoots(projectRoot);
        const childRepos: string[] = [];

        for (const childPath of childPaths) {
          const repoTop = await getGitTopLevel(childPath);
          if (repoTop && repoTop === childPath) {
            childRepos.push(childPath);
          }
        }

        if (childRepos.length === 0) {
          throw new Error('found no child worktrees to initialize');
        }

        const sampleRepo = childRepos[0];
        const remoteName = await getPreferredRemote(sampleRepo);
        const primaryBranch = await detectRemoteHeadFromRepo(
          sampleRepo,
          remoteName
        );
        if (!primaryBranch) {
          throw new Error(
            `could not detect the remote default branch from ${remoteName}`
          );
        }

        const primaryPath = join(projectRoot, primaryBranch);
        if (!(await isDirectory(primaryPath))) {
          throw new Error(
            `expected a child directory named after the default branch: ${primaryBranch}`
          );
        }

        const primaryRepoTop = await getGitTopLevel(primaryPath);
        if (!primaryRepoTop) {
          throw new Error(`${primaryPath} is not a valid worktree`);
        }

        if (primaryRepoTop !== (await resolvePath(primaryPath))) {
          throw new Error(`${primaryPath} is not a worktree root`);
        }

        const checkedOutBranch = await getCurrentBranch(primaryPath);
        if (checkedOutBranch !== primaryBranch) {
          throw new Error(
            `${primaryPath} is not checked out on ${primaryBranch}`
          );
        }

        await writeGwConfig(projectRoot, {
          primaryBranch,
          remoteName,
          branchPrefix: options.branchPrefix || '',
        });
      })
    );
}
