import {
  createDistLauncher,
  createRemoteFixture,
  ensureBuiltCli,
  makeTempDir,
  shellExists,
} from '@test/helpers';
import { execa } from 'execa';
import { mkdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';

const hasBash = await shellExists('bash');
const hasZsh = await shellExists('zsh');
const hasFish = await shellExists('fish');
const hasNu = await shellExists('nu');

beforeAll(async () => {
  await ensureBuiltCli();
});

async function createShellFixture() {
  const fixture = await createRemoteFixture(['feature/test'], 'main');
  const launcherDir = await makeTempDir('gw-shell-launcher-');
  const workDir = join(fixture.rootDir, 'work');

  await mkdir(workDir, { recursive: true });
  await createDistLauncher(launcherDir);

  return {
    env: {
      ...process.env,
      PATH: `${launcherDir}:${process.env.PATH || ''}`,
    },
    originPath: fixture.originPath,
    workDir: await realpath(workDir),
  };
}

describe('shell wrapper integration', () => {
  (hasBash ? test : test.skip)(
    'supports the bash wrapper flow',
    async () => {
      const fixture = await createShellFixture();

      const result = await execa(
        'bash',
        [
          '--noprofile',
          '--norc',
          '-c',
          'set -e; source <(gw shell-init); cd "$1"; gw clone demo "$2" >/dev/null 2>/dev/null; test "$(pwd -P)" = "$1/demo/main"; gw switch feature/test >/dev/null 2>/dev/null; test "$(pwd -P)" = "$1/demo/feature~test"; gw list >/dev/null; printf OK',
          '_',
          fixture.workDir,
          fixture.originPath,
        ],
        { env: fixture.env }
      );

      expect(result.stdout).toContain('OK');
    },
    60_000
  );

  (hasZsh ? test : test.skip)(
    'supports the zsh wrapper flow',
    async () => {
      const fixture = await createShellFixture();

      const result = await execa(
        'zsh',
        [
          '-f',
          '-c',
          'set -e; source <(gw shell-init); cd "$1"; gw clone demo "$2" >/dev/null 2>/dev/null; [[ "$(pwd -P)" == "$1/demo/main" ]]; gw switch feature/test >/dev/null 2>/dev/null; [[ "$(pwd -P)" == "$1/demo/feature~test" ]]; gw list >/dev/null; printf OK',
          '_',
          fixture.workDir,
          fixture.originPath,
        ],
        { env: fixture.env }
      );

      expect(result.stdout).toContain('OK');
    },
    60_000
  );

  (hasFish ? test : test.skip)(
    'supports the fish wrapper flow',
    async () => {
      const fixture = await createShellFixture();

      const result = await execa(
        'fish',
        [
          '--no-config',
          '-c',
          'gw shell-init | source; cd $argv[1]; gw clone demo $argv[2] >/dev/null 2>/dev/null; test (realpath .) = "$argv[1]/demo/main"; or exit 1; gw switch feature/test >/dev/null 2>/dev/null; test (realpath .) = "$argv[1]/demo/feature~test"; or exit 1; gw list >/dev/null; printf OK',
          fixture.workDir,
          fixture.originPath,
        ],
        { env: fixture.env }
      );

      expect(result.stdout).toContain('OK');
    },
    60_000
  );

  (hasNu ? test : test.skip)(
    'supports the nu wrapper flow',
    async () => {
      const fixture = await createShellFixture();
      const initPath = join(fixture.workDir, 'gw-init.nu');

      await execa(
        'nu',
        [
          '-c',
          'gw shell-init | save --force $env.GW_INIT_PATH; source $env.GW_INIT_PATH; cd $env.GW_WORKDIR; gw clone demo $env.GW_ORIGIN | ignore; if ((pwd | get path) != $"($env.GW_WORKDIR)/demo/main") { exit 1 }; gw switch feature/test | ignore; if ((pwd | get path) != $"($env.GW_WORKDIR)/demo/feature~test") { exit 1 }; gw list | ignore',
        ],
        {
          env: {
            ...fixture.env,
            GW_INIT_PATH: initPath,
            GW_ORIGIN: fixture.originPath,
            GW_WORKDIR: fixture.workDir,
          },
        }
      );

      expect(true).toBe(true);
    },
    60_000
  );
});
