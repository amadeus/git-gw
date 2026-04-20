import { execa } from 'execa';
import { constants } from 'node:fs';
import { access, cp, mkdir, readdir, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';

async function runGit(args: string[], cwd?: string) {
  return execa('git', args, {
    cwd,
    reject: false,
    stderr: 'pipe',
  });
}

async function expectGitSuccess(args: string[], cwd?: string): Promise<string> {
  const result = await runGit(args, cwd);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  }

  return result.stdout;
}

function parseRemoteHead(stdout: string): string | null {
  for (const line of stdout.split(/\r?\n/u)) {
    const match = /^ref: refs\/heads\/(.+)\s+HEAD$/u.exec(line);
    if (match) {
      return match[1];
    }
  }

  return null;
}

export async function resolveExistingPath(path: string): Promise<string> {
  return realpath(resolve(path));
}

export async function isInsideWorkTree(repoPath: string): Promise<boolean> {
  const result = await runGit(['rev-parse', '--is-inside-work-tree'], repoPath);
  return result.exitCode === 0;
}

export async function getGitTopLevel(
  cwd = process.cwd()
): Promise<string | null> {
  const result = await runGit(['rev-parse', '--show-toplevel'], cwd);
  if (result.exitCode !== 0 || !result.stdout.trim()) {
    return null;
  }

  return resolveExistingPath(result.stdout.trim());
}

export async function branchExists(
  repoPath: string,
  branchName: string
): Promise<boolean> {
  const result = await runGit(
    ['show-ref', '--verify', '--quiet', '--', `refs/heads/${branchName}`],
    repoPath
  );
  return result.exitCode === 0;
}

export async function remoteBranchRefExists(
  repoPath: string,
  remoteName: string,
  branchName: string
): Promise<boolean> {
  const result = await runGit(
    [
      'show-ref',
      '--verify',
      '--quiet',
      '--',
      `refs/remotes/${remoteName}/${branchName}`,
    ],
    repoPath
  );
  return result.exitCode === 0;
}

export async function remoteBranchExists(
  repoPath: string,
  remoteName: string,
  branchName: string
): Promise<boolean> {
  if (await remoteBranchRefExists(repoPath, remoteName, branchName)) {
    return true;
  }

  const result = await runGit(
    ['ls-remote', '--exit-code', '--heads', remoteName, branchName],
    repoPath
  );
  return result.exitCode === 0;
}

export async function fetchRemoteBranchRef(
  repoPath: string,
  remoteName: string,
  branchName: string
): Promise<void> {
  await expectGitSuccess(
    [
      'fetch',
      remoteName,
      `+refs/heads/${branchName}:refs/remotes/${remoteName}/${branchName}`,
    ],
    repoPath
  );
}

export async function listLocalBranches(repoPath: string): Promise<string[]> {
  const stdout = await expectGitSuccess(
    ['for-each-ref', '--format=%(refname:strip=2)', 'refs/heads'],
    repoPath
  );

  return stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function detectRemoteHeadFromUrl(
  target: string
): Promise<string | null> {
  const result = await runGit(['ls-remote', '--symref', target, 'HEAD']);
  if (result.exitCode !== 0) {
    return null;
  }

  return parseRemoteHead(result.stdout);
}

export async function listRemotes(repoPath: string): Promise<string[]> {
  const stdout = await expectGitSuccess(['remote'], repoPath);

  return stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function getPreferredRemote(repoPath: string): Promise<string> {
  const remotes = await listRemotes(repoPath);

  if (remotes.includes('origin')) {
    return 'origin';
  }

  if (remotes.length === 1) {
    return remotes[0];
  }

  throw new Error(`could not determine which remote to use for ${repoPath}`);
}

export async function detectRemoteHeadFromRepo(
  repoPath: string,
  remoteName: string
): Promise<string | null> {
  const result = await runGit(
    ['ls-remote', '--symref', remoteName, 'HEAD'],
    repoPath
  );
  if (result.exitCode !== 0) {
    return null;
  }

  return parseRemoteHead(result.stdout);
}

export async function syncRelativeHooksPath(
  sourceRepo: string,
  targetRepo: string
): Promise<void> {
  const result = await runGit(
    ['config', '--get', 'core.hooksPath'],
    sourceRepo
  );
  const hooksPath = result.stdout.trim();

  if (!hooksPath || isAbsolute(hooksPath)) {
    return;
  }

  const sourceHooks = join(sourceRepo, hooksPath);
  const sourceHooksStat = await stat(sourceHooks).catch(() => null);
  if (!sourceHooksStat?.isDirectory()) {
    return;
  }

  const targetHooks = join(targetRepo, hooksPath);
  try {
    await access(join(targetHooks, '.gitignore'), constants.F_OK);
    return;
  } catch {
    // Continue and sync hooks if a target .gitignore is not present.
  }

  await mkdir(targetHooks, { recursive: true });

  for (const entry of await readdir(sourceHooks)) {
    await cp(join(sourceHooks, entry), join(targetHooks, entry), {
      force: true,
      recursive: true,
    });
  }
}
