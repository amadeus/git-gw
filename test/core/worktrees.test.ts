import { describe, expect, it } from 'vitest';

import {
  findWorktreeForBranch,
  findWorktreeForFolderName,
  parseWorktreeListPorcelain,
} from '@/core/worktrees';

describe('worktree parsing', () => {
  it('parses attached worktrees from porcelain output', () => {
    const entries = parseWorktreeListPorcelain(`
worktree /tmp/demo/main
HEAD abc123
branch refs/heads/main

worktree /tmp/demo/feature~test
HEAD def456
branch refs/heads/feature/test

worktree /tmp/demo/detached
HEAD aaa111
detached
`);

    expect(entries).toEqual([
      { branchName: 'main', path: '/tmp/demo/main' },
      { branchName: 'feature/test', path: '/tmp/demo/feature~test' },
    ]);
  });

  it('finds worktrees by branch and folder name', () => {
    const worktrees = [
      { branchName: 'main', path: '/tmp/demo/main' },
      { branchName: 'feature/test', path: '/tmp/demo/feature~test' },
    ];

    expect(findWorktreeForBranch(worktrees, 'feature/test')).toBe(
      '/tmp/demo/feature~test'
    );
    expect(findWorktreeForFolderName(worktrees, 'feature~test')).toBe(
      '/tmp/demo/feature~test'
    );
    expect(findWorktreeForBranch(worktrees, 'missing')).toBeNull();
  });
});
