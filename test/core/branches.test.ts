import { createRemoteFixture, runGit } from '@test/helpers';
import { describe, expect, it } from 'vitest';

import {
  encodeBranchPath,
  findSuffixBranchCandidates,
  resolveBranchName,
  stripBranchPrefix,
} from '@/core/branches';

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
