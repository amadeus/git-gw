import { execa } from 'execa';
import { mkdtemp, mkdir, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

interface PackFile {
  path: string;
}

interface PackResult {
  filename: string;
  files?: PackFile[];
}

function parseNpmPackJson(stdout: string): PackResult[] {
  const trimmedStdout = stdout.trim();
  const jsonStart = trimmedStdout.lastIndexOf('\n[');
  const jsonText =
    jsonStart === -1 ? trimmedStdout : trimmedStdout.slice(jsonStart + 1);

  return JSON.parse(jsonText) as PackResult[];
}

async function makeTempDir(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

async function runGit(
  args: string[],
  cwd?: string,
  env?: NodeJS.ProcessEnv
): Promise<void> {
  await execa('git', args, {
    cwd,
    env,
  });
}

async function createPackedTarball(repoRoot: string): Promise<string> {
  await execa('bun', ['run', 'build'], { cwd: repoRoot });

  const packDir = await makeTempDir('gw-pack-');
  const result = await execa(
    'npm',
    ['pack', '--json', '--pack-destination', packDir],
    { cwd: repoRoot }
  );

  const parsed = parseNpmPackJson(result.stdout);
  const packageInfo = parsed[0];
  const tarballFileName = packageInfo?.filename;
  if (!tarballFileName) {
    throw new Error('npm pack did not produce a tarball filename');
  }

  const packedFiles = new Set(
    (packageInfo.files || []).map((file) => file.path)
  );
  const expectedFiles = new Set([
    'LICENSE',
    'README.md',
    'dist/cli.js',
    'package.json',
  ]);

  if (
    packedFiles.size !== expectedFiles.size ||
    [...expectedFiles].some((path) => !packedFiles.has(path))
  ) {
    throw new Error(
      `unexpected npm pack contents: ${[...packedFiles].sort().join(', ')}`
    );
  }

  return join(packDir, tarballFileName);
}

async function installPackedTarball(tarballPath: string): Promise<string> {
  const installDir = await makeTempDir('gw-install-');

  await execa('npm', ['init', '-y'], { cwd: installDir });
  await execa('npm', ['install', tarballPath], { cwd: installDir });

  return installDir;
}

async function createRemoteFixture(rootDir: string): Promise<string> {
  const originPath = join(rootDir, 'origin.git');
  const seedPath = join(rootDir, 'seed');

  await runGit(['init', '--bare', originPath]);
  await runGit(['init', seedPath]);
  await runGit(['checkout', '-b', 'main'], seedPath);
  await runGit(
    [
      '-c',
      'user.name=gw-test',
      '-c',
      'user.email=gw-test@example.com',
      'commit',
      '--allow-empty',
      '-m',
      'init',
    ],
    seedPath
  );
  await runGit(['remote', 'add', 'origin', originPath], seedPath);
  await runGit(['push', '-u', 'origin', 'main'], seedPath);
  await runGit(['checkout', '-b', 'feature/test'], seedPath);
  await runGit(
    [
      '-c',
      'user.name=gw-test',
      '-c',
      'user.email=gw-test@example.com',
      'commit',
      '--allow-empty',
      '-m',
      'feature',
    ],
    seedPath
  );
  await runGit(['push', '-u', 'origin', 'feature/test'], seedPath);

  return originPath;
}

async function verifyInstalledCli(installDir: string): Promise<void> {
  const binPath = join(installDir, 'node_modules', '.bin');
  const env = {
    ...process.env,
    PATH: `${binPath}:${process.env.PATH || ''}`,
  };
  const fixtureRoot = await makeTempDir('gw-pack-fixture-');
  const workDir = join(fixtureRoot, 'work');
  const originPath = await createRemoteFixture(fixtureRoot);

  await mkdir(workDir, { recursive: true });
  const resolvedWorkDir = await realpath(workDir);

  await execa('gw', ['--help'], {
    cwd: installDir,
    env,
  });

  await execa(
    'bash',
    [
      '--noprofile',
      '--norc',
      '-c',
      'set -e; source <(gw shell-init); cd "$1"; gw clone demo "$2" >/dev/null 2>/dev/null; test "$(pwd -P)" = "$1/demo/main"; gw switch feature/test >/dev/null 2>/dev/null; test "$(pwd -P)" = "$1/demo/feature~test"; gw list >/dev/null',
      '_',
      resolvedWorkDir,
      originPath,
    ],
    {
      cwd: installDir,
      env,
    }
  );
}

async function main(): Promise<void> {
  const repoRoot = resolve(process.cwd());
  const tarballPath = await createPackedTarball(repoRoot);
  const installDir = await installPackedTarball(tarballPath);

  await verifyInstalledCli(installDir);
  process.stdout.write(`Tarball smoke test passed: ${tarballPath}\n`);
}

await main();
