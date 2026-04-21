import { makeTempDir } from '@test/helpers';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_REMOTE_NAME,
  getPrimaryBranch,
  getGwConfigPath,
  hasGwConfig,
  parseGwConfig,
  readGwConfig,
  writeGwConfig,
} from '@/core/config';

describe('config', () => {
  it('parses comments, trims values, and fills defaults', () => {
    const config = parseGwConfig(`
# comment
primary = main
remote = upstream
branch-prefix = users/

`);

    expect(config).toEqual({
      version: '1',
      primaryBranch: 'main',
      remoteName: 'upstream',
      branchPrefix: 'users/',
      pathStyle: 'flat-tilde',
    });
  });

  it('defaults remote and branch prefix when omitted', () => {
    const config = parseGwConfig('primary=main\n');

    expect(config.remoteName).toBe(DEFAULT_REMOTE_NAME);
    expect(config.branchPrefix).toBe('');
    expect(config.pathStyle).toBe('flat-tilde');
  });

  it('writes and reads a gw config roundtrip', async () => {
    const projectRoot = await makeTempDir('gw-config-');

    await writeGwConfig(projectRoot, {
      primaryBranch: 'main',
      remoteName: 'origin',
      branchPrefix: 'users/',
    });

    expect(await hasGwConfig(projectRoot)).toBe(true);
    expect(await readGwConfig(projectRoot)).toEqual({
      version: '1',
      primaryBranch: 'main',
      remoteName: 'origin',
      branchPrefix: 'users/',
      pathStyle: 'flat-tilde',
    });

    const writtenText = await readFile(getGwConfigPath(projectRoot), 'utf8');
    expect(writtenText).toContain('primary=main');
    expect(writtenText).toContain('branch-prefix=users/');
  });

  it('throws when the primary branch is missing', () => {
    expect(() =>
      getPrimaryBranch(parseGwConfig('remote=origin\n'), '/tmp/demo')
    ).toThrowError("missing 'primary' in /tmp/demo/.gw_project");
  });
});
