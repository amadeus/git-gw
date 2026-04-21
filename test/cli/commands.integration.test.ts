import {
  canonicalPath,
  createRemoteFixture,
  createWorkDir,
  pathExists,
  runCli,
  runCliWithCwdCapture,
  runGit,
} from '@test/helpers';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { hasGwConfig } from '@/core/config';
import { branchExists } from '@/core/git';

describe('CLI integration', () => {
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
