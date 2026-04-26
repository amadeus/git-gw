import { makeTempDir } from '@test/helpers';
import { describe, expect, it } from 'vitest';

import { getPullRequestHead } from '@/core/github';

describe('GitHub CLI helpers', () => {
  it('explains how to set up gh when the command is missing', async () => {
    const repoPath = await makeTempDir('gw-gh-missing-repo-');
    const emptyPath = await makeTempDir('gw-gh-missing-path-');

    await expect(
      getPullRequestHead(repoPath, '123', {
        PATH: emptyPath,
      })
    ).rejects.toThrow(
      "GitHub CLI is required for gw pr. Install it from https://cli.github.com/ and run 'gh auth login'."
    );
  });
});
