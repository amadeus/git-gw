import { execa } from 'execa';

import type { PullRequestHead } from '@/core/pull-requests';

const MISSING_GH_MESSAGE =
  "GitHub CLI is required for gw pr. Install it from https://cli.github.com/ and run 'gh auth login'.";

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    error != null &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === code
  );
}

function getOutputText(output: unknown): string {
  return typeof output === 'string' ? output : '';
}

function isMissingGhExit(
  exitCode: number | undefined,
  stderr: string,
  message: string
): boolean {
  const diagnostic = `${stderr}\n${message}`;

  return (
    (exitCode === 127 &&
      (stderr === '' ||
        /command not found|not found|ENOENT|No such file/iu.test(stderr))) ||
    (exitCode == null &&
      /ENOENT|Executable not found|not found in \$PATH/iu.test(diagnostic))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object';
}

function parsePullRequestHead(stdout: string): PullRequestHead | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || typeof parsed.headRefName !== 'string') {
    return null;
  }

  const owner = parsed.headRepositoryOwner;
  if (!isRecord(owner) || typeof owner.login !== 'string') {
    return null;
  }

  return {
    headRefName: parsed.headRefName,
    headRepositoryOwner: owner.login,
  };
}

export async function getPullRequestHead(
  repoPath: string,
  prNumber: string,
  env?: NodeJS.ProcessEnv
): Promise<PullRequestHead> {
  try {
    const result = await execa(
      'gh',
      ['pr', 'view', prNumber, '--json', 'headRefName,headRepositoryOwner'],
      {
        cwd: repoPath,
        env,
        reject: false,
        stderr: 'pipe',
      }
    );

    const stdout = getOutputText(result.stdout);
    const stderr = getOutputText(result.stderr).trim();
    const message = getOutputText(result.message);

    if (isMissingGhExit(result.exitCode, stderr, message)) {
      throw new Error(MISSING_GH_MESSAGE);
    }

    if ((result.exitCode ?? 1) !== 0) {
      throw new Error(stderr || `gh pr view ${prNumber} failed`);
    }

    const pullRequestHead = parsePullRequestHead(stdout);
    if (!pullRequestHead) {
      throw new Error('failed to read PR head branch information from gh');
    }

    return pullRequestHead;
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) {
      throw new Error(MISSING_GH_MESSAGE);
    }

    throw error;
  }
}
