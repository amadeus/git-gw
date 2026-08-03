import type { Command } from 'commander';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import {
  commandAction,
  getCurrentDirectory,
  pathExists,
  requestDirectoryChange,
} from '@/commands/shared';
import { writeGwConfig } from '@/core/config';
import { cloneRepo, detectRemoteHeadFromUrl } from '@/core/git';

interface CloneOptions {
  branchPrefix?: string;
  createAction?: string;
}

export function registerCloneCommand(program: Command): void {
  program
    .command('clone')
    .description('Clone a repository into a gw project layout')
    .argument('<project-name>')
    .argument('<repo-url>')
    .option(
      '--branch-prefix <prefix>',
      'Prefix to apply when creating branches'
    )
    .option(
      '--create-action <command>',
      'Command to run after creating a worktree'
    )
    .action(
      commandAction(
        async (projectName: string, repoUrl: string, options: CloneOptions) => {
          const currentDir = await getCurrentDirectory();
          const projectRoot = join(currentDir, projectName);

          if (await pathExists(projectRoot)) {
            throw new Error(`target directory already exists: ${projectRoot}`);
          }

          const primaryBranch = await detectRemoteHeadFromUrl(repoUrl);
          if (!primaryBranch) {
            throw new Error(
              `could not detect the remote default branch for ${repoUrl}`
            );
          }

          await mkdir(projectRoot, { recursive: true });

          const cloneTarget = join(projectRoot, primaryBranch);
          await cloneRepo(repoUrl, cloneTarget);
          await writeGwConfig(projectRoot, {
            primaryBranch,
            remoteName: 'origin',
            branchPrefix: options.branchPrefix || '',
            createAction: options.createAction,
          });

          await requestDirectoryChange(cloneTarget);
        }
      )
    );
}
