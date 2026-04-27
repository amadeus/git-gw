import {
  createRemoteFixture,
  makeTempDir,
  readText,
  runGit,
} from '@test/helpers';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  detectRemoteHeadFromRepo,
  detectRemoteHeadFromUrl,
  getPreferredRemote,
  remoteBranchExists,
  syncRelativeHooksPath,
} from '@/core/git';

describe('git helpers', () => {
  it('detects the default branch from a remote URL', async () => {
    const fixture = await createRemoteFixture([], 'main');

    await expect(detectRemoteHeadFromUrl(fixture.originPath)).resolves.toBe(
      'main'
    );
  });

  it('detects the default branch from a repo remote', async () => {
    const fixture = await createRemoteFixture([], 'main');

    await expect(
      detectRemoteHeadFromRepo(fixture.seedPath, 'origin')
    ).resolves.toBe('main');
  });

  it('prefers origin when available and falls back to the only remote', async () => {
    const fixture = await createRemoteFixture([], 'main');
    const singleRemoteRepo = await makeTempDir('gw-remote-');

    await runGit(['init', singleRemoteRepo]);
    await runGit(['remote', 'add', 'upstream', fixture.originPath], {
      cwd: singleRemoteRepo,
    });

    await expect(getPreferredRemote(fixture.seedPath)).resolves.toBe('origin');
    await expect(getPreferredRemote(singleRemoteRepo)).resolves.toBe(
      'upstream'
    );
  });

  it('checks remote branch refs exactly', async () => {
    const fixture = await createRemoteFixture(['users/alice'], 'main');

    await expect(
      remoteBranchExists(fixture.seedPath, 'origin', 'users/alice')
    ).resolves.toBe(true);
    await expect(
      remoteBranchExists(fixture.seedPath, 'origin', 'alice')
    ).resolves.toBe(false);
  });

  it('syncs a relative hooks path into a new worktree', async () => {
    const sourceRepo = await makeTempDir('gw-hooks-source-');
    const targetRepo = await makeTempDir('gw-hooks-target-');

    await runGit(['init', sourceRepo]);
    await runGit(['init', targetRepo]);
    await mkdir(join(sourceRepo, '.githooks'), { recursive: true });
    await writeFile(
      join(sourceRepo, '.githooks', 'pre-commit'),
      '#!/bin/sh\nexit 0\n'
    );
    await runGit(['config', 'core.hooksPath', '.githooks'], {
      cwd: sourceRepo,
    });

    await syncRelativeHooksPath(sourceRepo, targetRepo);

    await expect(
      readText(join(targetRepo, '.githooks', 'pre-commit'))
    ).resolves.toContain('exit 0');
  });

  it('skips syncing hooks when the target hooks path already has a .gitignore', async () => {
    const sourceRepo = await makeTempDir('gw-hooks-source-');
    const targetRepo = await makeTempDir('gw-hooks-target-');

    await runGit(['init', sourceRepo]);
    await runGit(['init', targetRepo]);
    await mkdir(join(sourceRepo, '.githooks'), { recursive: true });
    await writeFile(
      join(sourceRepo, '.githooks', 'pre-commit'),
      '#!/bin/sh\nexit 0\n'
    );
    await runGit(['config', 'core.hooksPath', '.githooks'], {
      cwd: sourceRepo,
    });
    await mkdir(join(targetRepo, '.githooks'), { recursive: true });
    await writeFile(join(targetRepo, '.githooks', '.gitignore'), '*\n');

    await syncRelativeHooksPath(sourceRepo, targetRepo);

    await expect(
      readText(join(targetRepo, '.githooks', 'pre-commit'))
    ).rejects.toThrow();
  });
});
