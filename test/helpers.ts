import { execa, type ResultPromise } from 'execa';
import {
  access,
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const REPO_ROOT = resolve(import.meta.dirname, '..');
export const CLI_SOURCE_PATH = join(REPO_ROOT, 'src', 'cli.ts');
export const CLI_DIST_PATH = join(REPO_ROOT, 'dist', 'cli.js');

interface CliOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
}

interface GitOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  reject?: boolean;
}

export interface RemoteFixture {
  rootDir: string;
  originPath: string;
  seedPath: string;
}

export interface CwdCaptureResult {
  result: Awaited<ReturnType<typeof runCli>>;
  targetPath: string | null;
}

export async function makeTempDir(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

export async function readText(path: string): Promise<string> {
  return readFile(path, 'utf8');
}

export async function canonicalPath(path: string): Promise<string> {
  return realpath(path);
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function runCli(
  args: string[],
  options: CliOptions
): Promise<ResultPromise> {
  return execa('bun', ['run', CLI_SOURCE_PATH, ...args], {
    cwd: options.cwd,
    env: options.env,
    reject: false,
  });
}

export async function runCliWithCwdCapture(
  args: string[],
  options: CliOptions
): Promise<CwdCaptureResult> {
  const tempDir = await makeTempDir('gw-cwd-');
  const cwdFile = join(tempDir, 'cwd.txt');
  const result = await runCli(args, {
    ...options,
    env: {
      ...options.env,
      GW_CWD_FILE: cwdFile,
    },
  });

  let targetPath: string | null = null;
  try {
    targetPath = (await readText(cwdFile)).trim() || null;
  } catch {
    targetPath = null;
  }

  return {
    result,
    targetPath,
  };
}

export async function runGit(
  args: string[],
  options: GitOptions = {}
): Promise<ResultPromise> {
  return execa('git', args, {
    cwd: options.cwd,
    env: options.env,
    reject: options.reject ?? true,
  });
}

export async function commitEmpty(
  repoPath: string,
  message: string
): Promise<void> {
  await runGit(
    [
      '-c',
      'user.name=gw-test',
      '-c',
      'user.email=gw-test@example.com',
      'commit',
      '--allow-empty',
      '-m',
      message,
    ],
    { cwd: repoPath }
  );
}

export async function createRemoteFixture(
  extraBranches: string[] = ['feature/test'],
  mainBranch = 'main'
): Promise<RemoteFixture> {
  const rootDir = await makeTempDir('gw-fixture-');
  const originPath = join(rootDir, 'origin.git');
  const seedPath = join(rootDir, 'seed');

  await runGit(['init', '--bare', originPath]);
  await runGit(['init', seedPath]);
  await runGit(['checkout', '-b', mainBranch], { cwd: seedPath });
  await commitEmpty(seedPath, 'init');
  await runGit(['remote', 'add', 'origin', originPath], { cwd: seedPath });
  await runGit(['push', '-u', 'origin', mainBranch], { cwd: seedPath });
  await runGit(['symbolic-ref', 'HEAD', `refs/heads/${mainBranch}`], {
    cwd: originPath,
  });

  for (const branchName of extraBranches) {
    await runGit(['checkout', '-b', branchName], { cwd: seedPath });
    await commitEmpty(seedPath, branchName);
    await runGit(['push', '-u', 'origin', branchName], { cwd: seedPath });
  }

  await runGit(['checkout', mainBranch], { cwd: seedPath });

  return {
    rootDir,
    originPath,
    seedPath,
  };
}

export async function ensureBuiltCli(): Promise<void> {
  await execa('bun', ['run', 'build'], {
    cwd: REPO_ROOT,
  });
}

export async function createDistLauncher(tempDir: string): Promise<string> {
  const launcherPath = join(tempDir, 'gw');
  await writeFile(
    launcherPath,
    `#!/bin/sh\nexec node "${CLI_DIST_PATH}" "$@"\n`,
    'utf8'
  );
  await chmod(launcherPath, 0o755);
  return launcherPath;
}

export async function shellExists(shell: string): Promise<boolean> {
  const result = await execa(shell, ['--version'], {
    reject: false,
  });

  return result.exitCode === 0;
}

export async function createWorkDir(rootDir: string): Promise<string> {
  const workDir = join(rootDir, 'work');
  await mkdir(workDir, { recursive: true });
  return workDir;
}
