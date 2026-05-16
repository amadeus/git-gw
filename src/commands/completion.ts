import type { Command } from 'commander';
import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

import {
  buildCompletionCandidates,
  needsWorktreeCompletion,
  normalizeCompletionWords,
  type CompletionCandidate,
} from '@/core/completion';
import {
  getBranchPrefix,
  getGwConfigPath,
  getPrimaryBranch,
  parseGwConfig,
} from '@/core/config';
import { type WorktreeEntry } from '@/core/worktrees';

const execFileAsync = promisify(execFile);

function normalizeVariadicWords(
  words: string[] | string | undefined
): string[] {
  if (Array.isArray(words)) {
    return words;
  }

  if (typeof words === 'string') {
    return [words];
  }

  return [];
}

function normalizeRawCompletionWords(rawWords: string[]): string[] {
  return rawWords[0] === '--' ? rawWords.slice(1) : rawWords;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function findCompletionProjectRoot(
  startPath = process.cwd()
): Promise<string | null> {
  let dir = resolve(startPath);

  while (true) {
    if (await fileExists(getGwConfigPath(dir))) {
      return dir;
    }

    const parentDir = dirname(dir);
    if (parentDir === dir) {
      return null;
    }

    dir = parentDir;
  }
}

function parseCompletionWorktrees(output: string): WorktreeEntry[] {
  const worktrees: WorktreeEntry[] = [];
  let path: string | undefined;
  let branchName: string | undefined;

  const flush = () => {
    if (path && branchName) {
      worktrees.push({ path, branchName });
    }
  };

  for (const rawLine of output.split(/\r?\n/u)) {
    const line = rawLine.trimEnd();
    if (line.startsWith('worktree ')) {
      flush();
      path = line.slice('worktree '.length);
      branchName = undefined;
      continue;
    }

    if (line.startsWith('branch refs/heads/')) {
      branchName = line.slice('branch refs/heads/'.length);
    }
  }

  flush();
  return worktrees;
}

async function listCompletionWorktrees(
  repoPath: string
): Promise<WorktreeEntry[]> {
  const { stdout } = await execFileAsync(
    'git',
    ['worktree', 'list', '--porcelain'],
    {
      cwd: repoPath,
    }
  );

  return parseCompletionWorktrees(stdout);
}

async function loadCompletionData() {
  const projectRoot = await findCompletionProjectRoot();
  if (!projectRoot) {
    return undefined;
  }

  const config = parseGwConfig(
    await readFile(getGwConfigPath(projectRoot), 'utf8')
  );
  const primaryBranch = getPrimaryBranch(config, projectRoot);

  return {
    branchPrefix: getBranchPrefix(config),
    primaryBranch,
    worktrees: await listCompletionWorktrees(join(projectRoot, primaryBranch)),
  };
}

function sanitizeCompletionField(value: string): string {
  return value.replace(/[\t\r\n]/gu, ' ');
}

function formatCompletionCandidate(candidate: CompletionCandidate): string {
  const value = sanitizeCompletionField(candidate.value);
  const description = candidate.description
    ? sanitizeCompletionField(candidate.description)
    : '';

  return description ? `${value}\t${description}` : value;
}

export async function runCompletion(rawWords: string[]): Promise<void> {
  try {
    const completedWords = normalizeCompletionWords(
      normalizeRawCompletionWords(rawWords)
    );
    const request = {
      completedWords,
      current: process.env.GW_COMPLETE_CURRENT || '',
    };
    const data = needsWorktreeCompletion(request)
      ? await loadCompletionData()
      : undefined;
    const candidates = buildCompletionCandidates(request, data);

    if (candidates.length > 0) {
      process.stdout.write(
        `${candidates.map(formatCompletionCandidate).join('\n')}\n`
      );
    }
  } catch {
    // Completion should never interrupt the user's prompt.
  }
}

export function registerCompletionCommand(program: Command): void {
  program
    .command('__complete', { hidden: true })
    .allowUnknownOption()
    .allowExcessArguments()
    .argument('[words...]')
    .action(async (words: string[] | string | undefined) => {
      await runCompletion(normalizeVariadicWords(words));
    });
}
