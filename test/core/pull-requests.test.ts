import { describe, expect, it } from 'vitest';

import {
  choosePullRequestRemoteName,
  derivePullRequestRemoteUrl,
} from '@/core/pull-requests';

describe('pull request helpers', () => {
  it('derives a fork URL from an HTTPS remote URL', () => {
    expect(
      derivePullRequestRemoteUrl(
        'https://github.com/base/repo.git',
        'contributor'
      )
    ).toBe('https://github.com/contributor/repo.git');
  });

  it('derives a fork URL from an SSH remote URL', () => {
    expect(
      derivePullRequestRemoteUrl('git@github.com:base/repo.git', 'contributor')
    ).toBe('git@github.com:contributor/repo.git');
  });

  it('rejects unsupported remote URL shapes', () => {
    expect(() =>
      derivePullRequestRemoteUrl('/tmp/base/repo.git', 'contributor')
    ).toThrow('unsupported remote URL');
  });

  it('chooses a stable non-conflicting PR remote name', () => {
    expect(choosePullRequestRemoteName('Contributor', ['origin'])).toBe(
      'contributor'
    );
    expect(
      choosePullRequestRemoteName('Contributor', ['origin', 'contributor'])
    ).toBe('contributor-pr');
    expect(
      choosePullRequestRemoteName('Contributor', [
        'origin',
        'contributor',
        'contributor-pr',
        'contributor-pr-2',
      ])
    ).toBe('contributor-pr-3');
  });
});
