import Enquirer from 'enquirer';
import { constants } from 'node:fs';
import { access, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

import {
  resolveBranchName,
  resolveSwitchBranchName,
  type BranchResolutionCandidate,
  type SwitchBranchResolutionCandidate,
} from '@/core/branches';
import {
  getBranchPrefix,
  getPrimaryBranch,
  readGwConfig,
  type GwConfig,
} from '@/core/config';
import {
  getAnchorRepoPath,
  findProjectRoot,
  isPathInside,
  resolvePath,
} from '@/core/project';
import { listWorktrees, type WorktreeEntry } from '@/core/worktrees';

export interface ProjectContext {
  projectRoot: string;
  config: GwConfig;
  anchorRepo: string;
}

interface SelectChoice<T> {
  label: string;
  value: T;
  hint?: string;
  initial?: boolean;
}

export interface FormattedWorktreeRow {
  branchName: string;
  folderName: string;
  path: string;
  display: string;
  isCurrent: boolean;
}

export function commandAction<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<void>
): (...args: TArgs) => Promise<void> {
  return async (...args: TArgs) => {
    try {
      await handler(...args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      printGwError(message);
      process.exitCode = 1;
    }
  };
}

export function printGwError(message: string): void {
  process.stderr.write(`gw: ${message}\n`);
}

export async function loadProjectContext(
  cwd = process.cwd()
): Promise<ProjectContext> {
  const projectRoot = await findProjectRoot(cwd);
  if (!projectRoot) {
    throw new Error('not inside a gw project');
  }

  const config = await readGwConfig(projectRoot);
  const anchorRepo = await getAnchorRepoPath(projectRoot, config);

  return {
    projectRoot,
    config,
    anchorRepo,
  };
}

export function isInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export function getSelectedChoiceValue<T>(
  choiceValues: T[],
  selected: unknown
): T {
  if (typeof selected === 'string') {
    const selectedIndex = Number(selected);
    if (
      Number.isInteger(selectedIndex) &&
      String(selectedIndex) === selected &&
      selectedIndex >= 0 &&
      selectedIndex < choiceValues.length
    ) {
      return choiceValues[selectedIndex];
    }
  }

  return selected as T;
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectory(path: string): Promise<boolean> {
  const pathStat = await stat(path).catch(() => null);
  return Boolean(pathStat?.isDirectory());
}

export async function getCurrentDirectory(): Promise<string> {
  return resolvePath(process.cwd());
}

export async function requestDirectoryChange(
  targetPath: string
): Promise<void> {
  process.chdir(targetPath);

  const cwdFile = process.env.GW_CWD_FILE;
  if (cwdFile) {
    await writeFile(cwdFile, `${targetPath}\n`, 'utf8');
    return;
  }

  process.stdout.write(`${targetPath}\n`);
}

export async function formatWorktreeRows(
  anchorRepo: string,
  currentDir: string
): Promise<FormattedWorktreeRow[]> {
  const worktrees = await listWorktrees(anchorRepo);
  const rows: Omit<FormattedWorktreeRow, 'display'>[] = [];
  let maxFolderLength = 0;

  for (const worktree of worktrees) {
    const folderName = `./${basename(worktree.path)}`;
    const isCurrent = await isPathInside(currentDir, worktree.path);
    maxFolderLength = Math.max(maxFolderLength, folderName.length);

    rows.push({
      branchName: worktree.branchName,
      folderName,
      path: worktree.path,
      isCurrent,
    });
  }

  return rows.map((row) => ({
    ...row,
    display: `${row.isCurrent ? '*' : ' '} ${row.folderName.padEnd(maxFolderLength)} -> ${row.branchName}`,
  }));
}

async function selectValue<T>(
  message: string,
  choices: SelectChoice<T>[]
): Promise<T | null> {
  if (choices.length === 0) {
    return null;
  }

  const initial = choices.findIndex((choice) => choice.initial);
  const enquirer = new Enquirer<{ selected: unknown }>();

  try {
    const answer = await enquirer.prompt({
      type: 'select',
      name: 'selected',
      message,
      initial: initial === -1 ? undefined : initial,
      choices: choices.map((choice, index) => ({
        name: String(index),
        message: choice.label,
        value: choice.value,
        hint: choice.hint,
      })),
    });

    return getSelectedChoiceValue(
      choices.map((choice) => choice.value),
      answer.selected
    );
  } catch (error) {
    if (error == null || error === '') {
      return null;
    }

    throw error;
  }
}

function formatBranchCandidate(candidate: BranchResolutionCandidate): string {
  return `${candidate.branchName} -> ${candidate.worktreePath || 'no worktree'}`;
}

function formatSwitchBranchCandidate(
  candidate: SwitchBranchResolutionCandidate
): string {
  const details: string[] = [];
  if (candidate.local) {
    details.push('local');
  }
  if (candidate.remote) {
    details.push('remote');
  }
  if (candidate.worktreePath) {
    details.push(`worktree: ${candidate.worktreePath}`);
  }

  return `${candidate.branchName} -> ${details.join(', ') || 'new branch'}`;
}

export async function resolveBranchWithPrompt(
  context: ProjectContext,
  rawBranch: string,
  ignorePrefix: boolean
): Promise<string | null> {
  const resolution = await resolveBranchName({
    repoPath: context.anchorRepo,
    rawBranch,
    primaryBranch: getPrimaryBranch(context.config, context.projectRoot),
    branchPrefix: getBranchPrefix(context.config),
    ignorePrefix,
  });

  if (resolution.status === 'resolved') {
    return resolution.branchName;
  }

  if (!isInteractiveTerminal()) {
    printGwError('multiple matching branches found:');
    for (const candidate of resolution.candidates) {
      process.stderr.write(`  ${formatBranchCandidate(candidate)}\n`);
    }

    throw new Error(
      'rerun with an explicit prefixed branch name or --ignore-prefix'
    );
  }

  return selectValue(
    'Choose branch',
    resolution.candidates.map((candidate) => ({
      label: formatBranchCandidate(candidate),
      value: candidate.branchName,
      initial: candidate.worktreePath != null,
    }))
  );
}

export async function resolveSwitchBranchWithPrompt(
  context: ProjectContext,
  rawBranch: string,
  ignorePrefix: boolean,
  remoteName: string,
  worktrees: WorktreeEntry[]
): Promise<SwitchBranchResolutionCandidate | null> {
  const resolution = await resolveSwitchBranchName({
    repoPath: context.anchorRepo,
    rawBranch,
    remoteName,
    branchPrefix: getBranchPrefix(context.config),
    ignorePrefix,
    worktrees,
  });

  if (resolution.status === 'resolved') {
    return resolution.candidate;
  }

  if (!isInteractiveTerminal()) {
    printGwError('multiple matching branches found:');
    for (const candidate of resolution.candidates) {
      process.stderr.write(`  ${formatSwitchBranchCandidate(candidate)}\n`);
    }

    throw new Error(
      'rerun with an explicit prefixed branch name or --ignore-prefix'
    );
  }

  return selectValue(
    'Choose branch',
    resolution.candidates.map((candidate) => ({
      label: formatSwitchBranchCandidate(candidate),
      value: candidate,
      initial: candidate.worktreePath != null,
    }))
  );
}

export async function findChildRepoRoots(
  projectRoot: string
): Promise<string[]> {
  const entries = await readdir(projectRoot, { withFileTypes: true });
  const childPaths: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    childPaths.push(resolve(join(projectRoot, entry.name)));
  }

  return childPaths;
}
