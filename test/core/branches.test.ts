import { createRemoteFixture, runGit } from '@test/helpers';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  encodeBranchPath,
  findSuffixBranchCandidates,
  getSwitchTargetFolderName,
  resolveBranchName,
  resolveSwitchBranchName,
  stripBranchPrefix,
} from '@/core/branches';

async function cloneFixture(
  originPath: string,
  rootDir: string
): Promise<string> {
  const clonePath = join(rootDir, 'clone');
  await runGit(['clone', originPath, clonePath]);
  return clonePath;
}

describe('branch helpers', () => {
  it('strips a configured branch prefix when present', () => {
    expect(stripBranchPrefix('users/alice', 'users/')).toBe('alice');
    expect(stripBranchPrefix('alice', 'users/')).toBe('alice');
  });

  it('encodes branch paths using flat tilde naming', () => {
    expect(encodeBranchPath('users/feature/demo', 'users/')).toBe(
      'feature~demo'
    );
    expect(encodeBranchPath('feature/demo', '')).toBe('feature~demo');
  });

  it('finds suffix branch candidates when multiple namespaces share a name', () => {
    expect(
      findSuffixBranchCandidates(
        ['main', 'foo/test', 'bar/test', 'baz/other'],
        'test'
      )
    ).toEqual(['foo/test', 'bar/test']);
  });

  it('uses the full prefixed branch name when the stripped folder is occupied', () => {
    expect(getSwitchTargetFolderName('users/alice', 'users/', [])).toBe(
      'alice'
    );
    expect(
      getSwitchTargetFolderName('users/alice', 'users/', [
        { branchName: 'alice', path: '/tmp/alice' },
      ])
    ).toBe('users~alice');
    expect(
      getSwitchTargetFolderName('alice', 'users/', [
        { branchName: 'alice', path: '/tmp/alice' },
      ])
    ).toBe('alice');
  });
});

describe('resolveSwitchBranchName', () => {
  it('only considers an explicit prefixed branch name', async () => {
    const fixture = await createRemoteFixture(['users/alice', 'alice'], 'main');
    const clonePath = await cloneFixture(fixture.originPath, fixture.rootDir);

    const result = await resolveSwitchBranchName({
      repoPath: clonePath,
      rawBranch: 'users/alice',
      remoteName: 'origin',
      branchPrefix: 'users/',
    });

    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') {
      throw new Error('expected resolved branch');
    }
    expect(result.candidate.branchName).toBe('users/alice');
    expect(result.candidate.local).toBe(false);
    expect(result.candidate.remote).toBe(true);
  });

  it('does not use suffix matching when no prefix is configured', async () => {
    const fixture = await createRemoteFixture(['feature/test'], 'main');

    const result = await resolveSwitchBranchName({
      repoPath: fixture.seedPath,
      rawBranch: 'test',
      remoteName: 'origin',
    });

    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') {
      throw new Error('expected resolved branch');
    }
    expect(result.candidate.branchName).toBe('test');
    expect(result.candidate.local).toBe(false);
    expect(result.candidate.remote).toBe(false);
  });

  it('uses the prefixed branch when it is the only matching existing branch', async () => {
    const fixture = await createRemoteFixture(['users/alice'], 'main');
    const clonePath = await cloneFixture(fixture.originPath, fixture.rootDir);

    const result = await resolveSwitchBranchName({
      repoPath: clonePath,
      rawBranch: 'alice',
      remoteName: 'origin',
      branchPrefix: 'users/',
    });

    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') {
      throw new Error('expected resolved branch');
    }
    expect(result.candidate.branchName).toBe('users/alice');
    expect(result.candidate.local).toBe(false);
    expect(result.candidate.remote).toBe(true);
  });

  it('uses the unprefixed branch when it is the only matching existing branch', async () => {
    const fixture = await createRemoteFixture(['alice'], 'main');
    const clonePath = await cloneFixture(fixture.originPath, fixture.rootDir);

    const result = await resolveSwitchBranchName({
      repoPath: clonePath,
      rawBranch: 'alice',
      remoteName: 'origin',
      branchPrefix: 'users/',
    });

    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') {
      throw new Error('expected resolved branch');
    }
    expect(result.candidate.branchName).toBe('alice');
    expect(result.candidate.local).toBe(false);
    expect(result.candidate.remote).toBe(true);
  });

  it('creates the prefixed branch when neither candidate exists', async () => {
    const fixture = await createRemoteFixture([], 'main');

    const result = await resolveSwitchBranchName({
      repoPath: fixture.seedPath,
      rawBranch: 'alice',
      remoteName: 'origin',
      branchPrefix: 'users/',
    });

    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') {
      throw new Error('expected resolved branch');
    }
    expect(result.candidate.branchName).toBe('users/alice');
    expect(result.candidate.local).toBe(false);
    expect(result.candidate.remote).toBe(false);
  });

  it('returns ambiguous candidates when both prefixed and raw branches exist', async () => {
    const fixture = await createRemoteFixture(['users/alice', 'alice'], 'main');
    const clonePath = await cloneFixture(fixture.originPath, fixture.rootDir);

    const result = await resolveSwitchBranchName({
      repoPath: clonePath,
      rawBranch: 'alice',
      remoteName: 'origin',
      branchPrefix: 'users/',
    });

    expect(result.status).toBe('ambiguous');
    if (result.status !== 'ambiguous') {
      throw new Error('expected ambiguous branch resolution');
    }
    expect(result.candidates.map((candidate) => candidate.branchName)).toEqual([
      'users/alice',
      'alice',
    ]);
  });

  it('keeps both existing candidates ambiguous even when one has a worktree', async () => {
    const fixture = await createRemoteFixture(['users/alice', 'alice'], 'main');

    const result = await resolveSwitchBranchName({
      repoPath: fixture.seedPath,
      rawBranch: 'alice',
      remoteName: 'origin',
      branchPrefix: 'users/',
      worktrees: [{ branchName: 'alice', path: '/tmp/alice' }],
    });

    expect(result.status).toBe('ambiguous');
  });

  it('only considers the raw branch when ignoring the configured prefix', async () => {
    const fixture = await createRemoteFixture(['users/alice'], 'main');

    const result = await resolveSwitchBranchName({
      repoPath: fixture.seedPath,
      rawBranch: 'alice',
      remoteName: 'origin',
      branchPrefix: 'users/',
      ignorePrefix: true,
    });

    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') {
      throw new Error('expected resolved branch');
    }
    expect(result.candidate.branchName).toBe('alice');
    expect(result.candidate.local).toBe(false);
    expect(result.candidate.remote).toBe(false);
  });
});

describe('resolveBranchName', () => {
  it('uses suffix matches when no direct branch exists', async () => {
    const fixture = await createRemoteFixture(['feature/test'], 'main');

    const result = await resolveBranchName({
      repoPath: fixture.seedPath,
      rawBranch: 'test',
      primaryBranch: 'main',
    });

    expect(result).toEqual({
      status: 'resolved',
      branchName: 'feature/test',
    });
  });

  it('applies the configured prefix for a new branch name', async () => {
    const fixture = await createRemoteFixture([], 'main');

    const result = await resolveBranchName({
      repoPath: fixture.seedPath,
      rawBranch: 'alice',
      primaryBranch: 'main',
      branchPrefix: 'users/',
    });

    expect(result).toEqual({
      status: 'resolved',
      branchName: 'users/alice',
    });
  });

  it('prefers the single ambiguous candidate that already has a worktree', async () => {
    const fixture = await createRemoteFixture(['foo/test', 'bar/test'], 'main');

    const result = await resolveBranchName({
      repoPath: fixture.seedPath,
      rawBranch: 'test',
      primaryBranch: 'main',
      worktrees: [{ branchName: 'foo/test', path: '/tmp/foo-test' }],
    });

    expect(result).toEqual({
      status: 'resolved',
      branchName: 'foo/test',
    });
  });

  it('returns ambiguous candidates when multiple matches remain', async () => {
    const fixture = await createRemoteFixture(['foo/test', 'bar/test'], 'main');

    const result = await resolveBranchName({
      repoPath: fixture.seedPath,
      rawBranch: 'test',
      primaryBranch: 'main',
    });

    expect(result.status).toBe('ambiguous');
    if (result.status !== 'ambiguous') {
      throw new Error('expected ambiguous branch resolution');
    }

    const candidateBranchNames = result.candidates
      .map((candidate) => candidate.branchName)
      .sort();

    expect(candidateBranchNames).toEqual(['bar/test', 'foo/test']);
  });

  it('returns the raw branch name when ignoring prefix resolution', async () => {
    const fixture = await createRemoteFixture([], 'main');
    await runGit(['branch', 'users/alice'], { cwd: fixture.seedPath });

    const result = await resolveBranchName({
      repoPath: fixture.seedPath,
      rawBranch: 'alice',
      primaryBranch: 'main',
      branchPrefix: 'users/',
      ignorePrefix: true,
    });

    expect(result).toEqual({
      status: 'resolved',
      branchName: 'alice',
    });
  });
});
