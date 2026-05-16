import { describe, expect, it } from 'vitest';

import {
  buildCompletionCandidates,
  needsWorktreeCompletion,
  normalizeCompletionWords,
} from '@/core/completion';
import { type WorktreeEntry } from '@/core/worktrees';

const worktrees: WorktreeEntry[] = [
  { branchName: 'main', path: '/repo/main' },
  { branchName: 'feature/test', path: '/repo/feature~test' },
];

function values(candidates: { value: string }[]): string[] {
  return candidates.map((candidate) => candidate.value);
}

describe('completion helpers', () => {
  it('normalizes a leading gw command word', () => {
    expect(normalizeCompletionWords(['gw', 'switch'])).toEqual(['switch']);
    expect(normalizeCompletionWords(['/usr/local/bin/gw', 'switch'])).toEqual([
      'switch',
    ]);
  });

  it('completes root commands', () => {
    expect(
      values(buildCompletionCandidates({ completedWords: [], current: 'sw' }))
    ).toEqual(['switch']);
  });

  it('suggests existing switch worktree branch names only', () => {
    expect(
      values(
        buildCompletionCandidates(
          { completedWords: ['switch'], current: '' },
          { primaryBranch: 'main', worktrees }
        )
      )
    ).toEqual(['main', 'feature/test']);
  });

  it('suggests removable worktree branches except the primary branch', () => {
    expect(
      values(
        buildCompletionCandidates(
          { completedWords: ['remove'], current: '' },
          { primaryBranch: 'main', worktrees }
        )
      )
    ).toEqual(['feature/test']);
  });

  it('uses the remove candidate behavior for the rm alias', () => {
    expect(
      values(
        buildCompletionCandidates(
          { completedWords: ['rm'], current: 'feature/' },
          { primaryBranch: 'main', worktrees }
        )
      )
    ).toEqual(['feature/test']);
  });

  it('does not suggest another branch after a branch argument exists', () => {
    expect(
      buildCompletionCandidates(
        { completedWords: ['switch', 'feature/test'], current: '' },
        { primaryBranch: 'main', worktrees }
      )
    ).toEqual([]);
  });

  it('strips configured branch prefixes when unambiguous', () => {
    expect(
      values(
        buildCompletionCandidates(
          { completedWords: ['switch'], current: '' },
          {
            branchPrefix: 'amadeus/',
            primaryBranch: 'main',
            worktrees: [
              { branchName: 'main', path: '/repo/main' },
              { branchName: 'amadeus/fix-build', path: '/repo/fix-build' },
            ],
          }
        )
      )
    ).toEqual(['main', 'fix-build']);
  });

  it('keeps full branch names when prefix stripping would be ambiguous', () => {
    expect(
      values(
        buildCompletionCandidates(
          { completedWords: ['switch'], current: '' },
          {
            branchPrefix: 'amadeus/',
            primaryBranch: 'main',
            worktrees: [
              { branchName: 'amadeus/topic', path: '/repo/amadeus~topic' },
              { branchName: 'topic', path: '/repo/topic' },
            ],
          }
        )
      )
    ).toEqual(['amadeus/topic', 'topic']);
  });

  it('does not strip branch prefixes when --ignore-prefix is present', () => {
    expect(
      values(
        buildCompletionCandidates(
          { completedWords: ['switch', '--ignore-prefix'], current: '' },
          {
            branchPrefix: 'amadeus/',
            primaryBranch: 'main',
            worktrees: [
              { branchName: 'amadeus/fix-build', path: '/repo/fix-build' },
            ],
          }
        )
      )
    ).toEqual(['amadeus/fix-build']);
  });

  it('requires worktree data only for branch argument completion', () => {
    expect(
      needsWorktreeCompletion({ completedWords: ['switch'], current: '' })
    ).toBe(true);
    expect(
      needsWorktreeCompletion({ completedWords: ['switch'], current: '--' })
    ).toBe(false);
  });
});
