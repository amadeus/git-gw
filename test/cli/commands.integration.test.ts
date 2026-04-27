import {
  canonicalPath,
  commitEmpty,
  createRemoteFixture,
  createWorkDir,
  makeTempDir,
  pathExists,
  REPO_ROOT,
  runCli,
  runCliWithCwdCapture,
  runGit,
} from '@test/helpers';
import { execa } from 'execa';
import { chmod, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { hasGwConfig } from '@/core/config';
import { branchExists } from '@/core/git';

async function readExpectedPackageVersion(): Promise<string> {
  const packageJson = JSON.parse(
    await readFile(join(REPO_ROOT, 'package.json'), 'utf8')
  ) as { version: string };

  return packageJson.version;
}

async function createFakeGh(
  rootDir: string,
  prNumber: string,
  headRefName: string,
  headRepositoryOwner: string
): Promise<string> {
  const binDir = join(rootDir, 'fake-bin');
  const ghPath = join(binDir, 'gh');
  const response = JSON.stringify({
    headRefName,
    headRepositoryOwner: {
      login: headRepositoryOwner,
    },
  });

  await mkdir(binDir, { recursive: true });
  await writeFile(
    ghPath,
    `#!/bin/sh
if [ "$1" = "pr" ] && [ "$2" = "view" ] && [ "$3" = "${prNumber}" ]; then
  printf '%s\n' '${response}'
  exit 0
fi

printf 'unexpected gh args: %s\n' "$*" >&2
exit 1
`,
    'utf8'
  );
  await chmod(ghPath, 0o755);

  return binDir;
}

async function createForkRemote(
  rootDir: string,
  baseOriginPath: string,
  headRefName: string
): Promise<string> {
  const forkPath = join(rootDir, 'fork.git');
  const forkSeedPath = join(rootDir, 'fork-seed');

  await runGit(['init', '--bare', forkPath]);
  await runGit(['clone', baseOriginPath, forkSeedPath]);
  await runGit(['checkout', '-b', headRefName], { cwd: forkSeedPath });
  await commitEmpty(forkSeedPath, headRefName);
  await runGit(['remote', 'add', 'fork', forkPath], { cwd: forkSeedPath });
  await runGit(['push', '-u', 'fork', headRefName], { cwd: forkSeedPath });

  return forkPath;
}

async function createPathWithoutGh(): Promise<string> {
  const binDir = await makeTempDir('gw-no-gh-bin-');

  for (const command of ['bun', 'git']) {
    const commandPath = (await execa('which', [command])).stdout.trim();
    await symlink(commandPath, join(binDir, command));
  }

  return binDir;
}

describe('CLI integration', () => {
  it('prints the package version', async () => {
    const workDir = await makeTempDir('gw-version-');
    const packageVersion = await readExpectedPackageVersion();

    const longResult = await runCli(['--version'], { cwd: workDir });
    expect(longResult.exitCode).toBe(0);
    expect(longResult.stdout).toBe(packageVersion);

    const shortResult = await runCli(['-v'], { cwd: workDir });
    expect(shortResult.exitCode).toBe(0);
    expect(shortResult.stdout).toBe(packageVersion);
  });

  it('covers clone, list, switch, and remove against a real remote', async () => {
    const fixture = await createRemoteFixture(['feature/test'], 'main');
    const workDir = await createWorkDir(fixture.rootDir);

    const cloneResult = await runCliWithCwdCapture(
      ['clone', 'demo', fixture.originPath],
      { cwd: workDir }
    );

    expect(cloneResult.result.exitCode).toBe(0);
    expect(cloneResult.targetPath).toBe(
      await canonicalPath(join(workDir, 'demo', 'main'))
    );

    const mainPath = join(workDir, 'demo', 'main');
    const featurePath = join(workDir, 'demo', 'feature~test');
    const listFromMain = await runCli(['list'], { cwd: mainPath });
    expect(listFromMain.exitCode).toBe(0);
    expect(listFromMain.stdout).toContain('* ./main -> main');

    const switchResult = await runCliWithCwdCapture(
      ['switch', 'feature/test'],
      { cwd: mainPath }
    );

    expect(switchResult.result.exitCode).toBe(0);
    expect(switchResult.targetPath).toBe(await canonicalPath(featurePath));
    expect(await pathExists(featurePath)).toBe(true);

    const listFromFeature = await runCli(['list'], { cwd: featurePath });
    expect(listFromFeature.exitCode).toBe(0);
    expect(listFromFeature.stdout).toContain(
      '* ./feature~test -> feature/test'
    );

    const removeResult = await runCli(['remove', 'feature/test'], {
      cwd: mainPath,
    });
    expect(removeResult.exitCode).toBe(0);
    expect(await pathExists(featurePath)).toBe(false);
    await expect(branchExists(mainPath, 'feature/test')).resolves.toBe(false);
  }, 60_000);

  it('removes only the worktree with --worktree and trailing -w', async () => {
    const fixture = await createRemoteFixture(['feature/test'], 'main');
    const workDir = await createWorkDir(fixture.rootDir);

    await runCliWithCwdCapture(['clone', 'demo', fixture.originPath], {
      cwd: workDir,
    });

    const mainPath = join(workDir, 'demo', 'main');
    const featurePath = join(workDir, 'demo', 'feature~test');

    await runCliWithCwdCapture(['switch', 'feature/test'], { cwd: mainPath });

    const longResult = await runCli(['remove', '--worktree', 'feature/test'], {
      cwd: mainPath,
    });
    expect(longResult.exitCode).toBe(0);
    expect(await pathExists(featurePath)).toBe(false);
    await expect(branchExists(mainPath, 'feature/test')).resolves.toBe(true);

    await runCliWithCwdCapture(['switch', 'feature/test'], { cwd: mainPath });

    const shortResult = await runCli(['remove', 'feature/test', '-w'], {
      cwd: mainPath,
    });
    expect(shortResult.exitCode).toBe(0);
    expect(await pathExists(featurePath)).toBe(false);
    await expect(branchExists(mainPath, 'feature/test')).resolves.toBe(true);
  }, 60_000);

  it('rejects --worktree when no matching worktree exists', async () => {
    const fixture = await createRemoteFixture(['feature/test'], 'main');
    const workDir = await createWorkDir(fixture.rootDir);

    await runCliWithCwdCapture(['clone', 'demo', fixture.originPath], {
      cwd: workDir,
    });

    const mainPath = join(workDir, 'demo', 'main');
    await runGit(['branch', 'feature/test', 'origin/feature/test'], {
      cwd: mainPath,
    });

    const result = await runCli(['remove', '--worktree', 'feature/test'], {
      cwd: mainPath,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      'worktree does not exist for branch: feature/test'
    );
  }, 60_000);

  it('rejects --remote with --worktree', async () => {
    const fixture = await createRemoteFixture([], 'main');
    const workDir = await createWorkDir(fixture.rootDir);

    await runCliWithCwdCapture(['clone', 'demo', fixture.originPath], {
      cwd: workDir,
    });

    const result = await runCli(
      ['remove', '--remote', '--worktree', 'feature/test'],
      { cwd: join(workDir, 'demo', 'main') }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('--remote cannot be used with --worktree');
  }, 60_000);

  it('switches to prefixed remote branches by unprefixed name', async () => {
    const branchName = 'amadeus/diffs-improved-line-selection';
    const fixture = await createRemoteFixture([branchName], 'main');
    const workDir = await createWorkDir(fixture.rootDir);

    await runCliWithCwdCapture(
      ['clone', '--branch-prefix', 'amadeus/', 'demo', fixture.originPath],
      { cwd: workDir }
    );

    const mainPath = join(workDir, 'demo', 'main');
    const targetPath = join(workDir, 'demo', 'diffs-improved-line-selection');
    const switchResult = await runCliWithCwdCapture(
      ['switch', 'diffs-improved-line-selection'],
      { cwd: mainPath }
    );

    expect(switchResult.result.exitCode).toBe(0);
    expect(switchResult.targetPath).toBe(await canonicalPath(targetPath));
    expect(await pathExists(targetPath)).toBe(true);

    const currentBranch = await runGit(['branch', '--show-current'], {
      cwd: targetPath,
    });
    expect(currentBranch.stdout).toBe(branchName);

    const upstream = await runGit(
      ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
      { cwd: targetPath }
    );
    expect(upstream.stdout).toBe(`origin/${branchName}`);
  }, 60_000);

  it('uses a prefixed folder name when the stripped folder has another branch', async () => {
    const prefixedBranch = 'amadeus/topic';
    const fixture = await createRemoteFixture([prefixedBranch], 'main');
    const workDir = await createWorkDir(fixture.rootDir);

    await runCliWithCwdCapture(
      ['clone', '--branch-prefix', 'amadeus/', 'demo', fixture.originPath],
      { cwd: workDir }
    );

    const mainPath = join(workDir, 'demo', 'main');
    const rawPath = join(workDir, 'demo', 'topic');
    const prefixedPath = join(workDir, 'demo', 'amadeus~topic');

    const rawSwitch = await runCliWithCwdCapture(
      ['switch', '--ignore-prefix', 'topic'],
      { cwd: mainPath }
    );
    expect(rawSwitch.result.exitCode).toBe(0);
    expect(rawSwitch.targetPath).toBe(await canonicalPath(rawPath));

    const prefixedSwitch = await runCliWithCwdCapture(
      ['switch', prefixedBranch],
      { cwd: mainPath }
    );
    expect(prefixedSwitch.result.exitCode).toBe(0);
    expect(prefixedSwitch.targetPath).toBe(await canonicalPath(prefixedPath));

    const currentBranch = await runGit(['branch', '--show-current'], {
      cwd: prefixedPath,
    });
    expect(currentBranch.stdout).toBe(prefixedBranch);
  }, 60_000);

  it('reports ambiguous prefixed and unprefixed switch matches', async () => {
    const fixture = await createRemoteFixture(
      ['amadeus/conflict', 'conflict'],
      'main'
    );
    const workDir = await createWorkDir(fixture.rootDir);

    await runCliWithCwdCapture(
      ['clone', '--branch-prefix', 'amadeus/', 'demo', fixture.originPath],
      { cwd: workDir }
    );

    const result = await runCli(['switch', 'conflict'], {
      cwd: join(workDir, 'demo', 'main'),
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('multiple matching branches found');
    expect(result.stderr).toContain('amadeus/conflict');
    expect(result.stderr).toContain('conflict');
  }, 60_000);

  it('initializes a manually arranged child worktree layout', async () => {
    const fixture = await createRemoteFixture([], 'main');
    const projectRoot = join(fixture.rootDir, 'manual-project');

    await mkdir(projectRoot, { recursive: true });
    await runGit(['clone', fixture.originPath, join(projectRoot, 'main')]);

    const initResult = await runCli(['init'], { cwd: projectRoot });
    expect(initResult.exitCode).toBe(0);
    expect(await hasGwConfig(projectRoot)).toBe(true);

    const listResult = await runCli(['list'], { cwd: projectRoot });
    expect(listResult.exitCode).toBe(0);
    expect(listResult.stdout).toContain('./main -> main');
  }, 60_000);

  it('checks out a GitHub PR into a worktree and captures cwd', async () => {
    const fixture = await createRemoteFixture([], 'main');
    const workDir = await createWorkDir(fixture.rootDir);
    const headRefName = 'feature/pr-checkout';
    const forkPath = await createForkRemote(
      fixture.rootDir,
      fixture.originPath,
      headRefName
    );
    const fakeGhBin = await createFakeGh(
      fixture.rootDir,
      '123',
      headRefName,
      'contrib'
    );

    await runCliWithCwdCapture(['clone', 'demo', fixture.originPath], {
      cwd: workDir,
    });

    const mainPath = join(workDir, 'demo', 'main');
    const prPath = join(workDir, 'demo', 'pr_123');

    await runGit(
      ['remote', 'set-url', 'origin', 'https://example.test/base/repo.git'],
      { cwd: mainPath }
    );
    await runGit(
      [
        'config',
        `url.${forkPath}.insteadOf`,
        'https://example.test/contrib/repo.git',
      ],
      { cwd: mainPath }
    );

    const prResult = await runCliWithCwdCapture(['pr', '123'], {
      cwd: mainPath,
      env: {
        ...process.env,
        PATH: `${fakeGhBin}:${process.env.PATH || ''}`,
      },
    });

    expect(prResult.result.exitCode).toBe(0);
    expect(prResult.targetPath).toBe(await canonicalPath(prPath));
    expect(await pathExists(prPath)).toBe(true);

    const currentBranch = await runGit(['branch', '--show-current'], {
      cwd: prPath,
    });
    expect(currentBranch.stdout).toBe('pr_123');

    const upstream = await runGit(
      ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
      { cwd: prPath }
    );
    expect(upstream.stdout).toBe(`contrib/${headRefName}`);

    const remoteUrl = await runGit(['config', '--get', 'remote.contrib.url'], {
      cwd: mainPath,
    });
    expect(remoteUrl.stdout).toBe('https://example.test/contrib/repo.git');
  }, 60_000);

  it('reuses origin for a PR branch from the base repository', async () => {
    const headRefName = 'feature/origin-pr';
    const fixture = await createRemoteFixture([headRefName], 'main');
    const workDir = await createWorkDir(fixture.rootDir);
    const fakeGhBin = await createFakeGh(
      fixture.rootDir,
      '124',
      headRefName,
      'base'
    );

    await runCliWithCwdCapture(['clone', 'demo', fixture.originPath], {
      cwd: workDir,
    });

    const mainPath = join(workDir, 'demo', 'main');
    const prPath = join(workDir, 'demo', 'pr_124');

    await runGit(
      ['remote', 'set-url', 'origin', 'https://example.test/base/repo.git'],
      { cwd: mainPath }
    );
    await runGit(
      [
        'config',
        `url.${fixture.originPath}.insteadOf`,
        'https://example.test/base/repo.git',
      ],
      { cwd: mainPath }
    );

    const prResult = await runCliWithCwdCapture(['pr', '124'], {
      cwd: mainPath,
      env: {
        ...process.env,
        PATH: `${fakeGhBin}:${process.env.PATH || ''}`,
      },
    });

    expect(prResult.result.exitCode).toBe(0);
    expect(prResult.targetPath).toBe(await canonicalPath(prPath));

    const upstream = await runGit(
      ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
      { cwd: prPath }
    );
    expect(upstream.stdout).toBe(`origin/${headRefName}`);

    const remotes = await runGit(['remote'], { cwd: mainPath });
    const remotesStdout =
      typeof remotes.stdout === 'string' ? remotes.stdout : '';
    expect(remotesStdout.split(/\r?\n/u).filter(Boolean)).toEqual(['origin']);
  }, 60_000);

  it('prints setup guidance when gh is missing', async () => {
    const fixture = await createRemoteFixture([], 'main');
    const workDir = await createWorkDir(fixture.rootDir);
    const pathWithoutGh = await createPathWithoutGh();

    await runCliWithCwdCapture(['clone', 'demo', fixture.originPath], {
      cwd: workDir,
    });

    const result = await runCli(['pr', '123'], {
      cwd: join(workDir, 'demo', 'main'),
      env: {
        ...process.env,
        PATH: pathWithoutGh,
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('GitHub CLI is required for gw pr');
    expect(result.stderr).toContain('gh auth login');
  }, 60_000);

  it('preserves the non-interactive switch error when no branch is provided', async () => {
    const fixture = await createRemoteFixture([], 'main');
    const workDir = await createWorkDir(fixture.rootDir);

    await runCliWithCwdCapture(['clone', 'demo', fixture.originPath], {
      cwd: workDir,
    });

    const result = await runCli(['switch'], {
      cwd: join(workDir, 'demo', 'main'),
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      'gw switch without a branch requires an interactive terminal'
    );
  }, 60_000);

  it('refuses to remove the primary branch', async () => {
    const fixture = await createRemoteFixture([], 'main');
    const workDir = await createWorkDir(fixture.rootDir);

    await runCliWithCwdCapture(['clone', 'demo', fixture.originPath], {
      cwd: workDir,
    });

    const result = await runCli(['remove', 'main'], {
      cwd: join(workDir, 'demo', 'main'),
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('refusing to remove the primary branch');
  }, 60_000);
});
