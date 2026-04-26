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
  const fixture = await createRemoteFixture(['feature/test', 'pr_123'], 'main');
  const launcherDir = await makeTempDir('gw-shell-launcher-');
  const workDir = join(fixture.rootDir, 'work');
  const homeDir = await makeTempDir('gw-shell-home-');
  const configDir = await makeTempDir('gw-shell-config-');

  await mkdir(workDir, { recursive: true });
  await createDistLauncher(launcherDir);

  return {
    env: {
      ...process.env,
      HOME: homeDir,
      PATH: `${launcherDir}:${process.env.PATH || ''}`,
      XDG_CONFIG_HOME: configDir,
    },
    configDir,
    homeDir,
    originPath: fixture.originPath,
    workDir: await realpath(workDir),
  };
}

describe('shell wrapper integration', () => {
  (hasBash ? test : test.skip)(
    'bash setup install sources generated integration when wrapper is active',
    async () => {
      const fixture = await createShellFixture();

      const result = await execa(
        'bash',
        [
          '--noprofile',
          '--norc',
          '-c',
          'set -e; eval "$(gw shell-init --shell bash)"; __gw_needs_cd() { return 1; }; gw setup --install --shell bash >/dev/null; cd "$1"; gw clone demo "$2" >/dev/null 2>/dev/null; test "$(pwd -P)" = "$1/demo/main"; printf OK',
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
          'set -e; source <(gw shell-init); cd "$1"; gw clone demo "$2" >/dev/null 2>/dev/null; test "$(pwd -P)" = "$1/demo/main"; gw switch feature/test >/dev/null 2>/dev/null; test "$(pwd -P)" = "$1/demo/feature~test"; cd "$1/demo/main"; gw switch pr_123 >/dev/null 2>/dev/null; test "$(pwd -P)" = "$1/demo/pr_123"; cd "$1/demo/main"; gw pr 123 >/dev/null 2>/dev/null; test "$(pwd -P)" = "$1/demo/pr_123"; gw list >/dev/null; printf OK',
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
    'zsh setup install sources generated integration when wrapper is active',
    async () => {
      const fixture = await createShellFixture();

      const result = await execa(
        'zsh',
        [
          '-f',
          '-c',
          'set -e; eval "$(gw shell-init --shell zsh)"; __gw_needs_cd() { return 1; }; gw setup --install --shell zsh >/dev/null; cd "$1"; gw clone demo "$2" >/dev/null 2>/dev/null; [[ "$(pwd -P)" == "$1/demo/main" ]]; printf OK',
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
          'set -e; source <(gw shell-init); cd "$1"; gw clone demo "$2" >/dev/null 2>/dev/null; [[ "$(pwd -P)" == "$1/demo/main" ]]; gw switch feature/test >/dev/null 2>/dev/null; [[ "$(pwd -P)" == "$1/demo/feature~test" ]]; cd "$1/demo/main"; gw switch pr_123 >/dev/null 2>/dev/null; [[ "$(pwd -P)" == "$1/demo/pr_123" ]]; cd "$1/demo/main"; gw pr 123 >/dev/null 2>/dev/null; [[ "$(pwd -P)" == "$1/demo/pr_123" ]]; gw list >/dev/null; printf OK',
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
    'fish setup installs an autoloaded gw function without config.fish',
    async () => {
      const fixture = await createShellFixture();
      const functionFile = join(
        fixture.configDir,
        'fish',
        'functions',
        'gw.fish'
      );

      const result = await execa(
        'fish',
        [
          '-c',
          'gw setup --install --shell fish; test -f "$XDG_CONFIG_HOME/fish/functions/gw.fish"; or exit 1; test ! -e "$XDG_CONFIG_HOME/fish/config.fish"; or exit 1; source "$XDG_CONFIG_HOME/fish/functions/gw.fish"; gw --help >/dev/null; functions -q gw; or exit 1; printf OK',
        ],
        { env: fixture.env }
      );

      expect(result.stdout).toContain(`function file: ${functionFile}`);
      expect(result.stdout).toContain(
        'Restart shell or run the following command:\n\n'
      );
      expect(result.stdout).toContain(`source "${functionFile}"`);
      expect(result.stdout).toContain('OK');
    },
    60_000
  );

  (hasFish ? test : test.skip)(
    'fish setup install sources generated integration when wrapper is active',
    async () => {
      const fixture = await createShellFixture();

      const result = await execa(
        'fish',
        [
          '--no-config',
          '-c',
          'gw shell-init --shell fish | source; functions -e __gw_needs_cd; function __gw_needs_cd; return 1; end; gw setup --install --shell fish >/dev/null; test -f "$XDG_CONFIG_HOME/fish/functions/gw.fish"; or exit 1; test ! -e "$XDG_CONFIG_HOME/fish/config.fish"; or exit 1; cd $argv[1]; gw clone demo $argv[2] >/dev/null 2>/dev/null; test (realpath .) = "$argv[1]/demo/main"; or exit 1; printf OK',
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
          'gw shell-init | source; cd $argv[1]; gw clone demo $argv[2] >/dev/null 2>/dev/null; test (realpath .) = "$argv[1]/demo/main"; or exit 1; gw switch feature/test >/dev/null 2>/dev/null; test (realpath .) = "$argv[1]/demo/feature~test"; or exit 1; cd $argv[1]/demo/main; gw switch pr_123 >/dev/null 2>/dev/null; test (realpath .) = "$argv[1]/demo/pr_123"; or exit 1; cd $argv[1]/demo/main; gw pr 123 >/dev/null 2>/dev/null; test (realpath .) = "$argv[1]/demo/pr_123"; or exit 1; gw list >/dev/null; printf OK',
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
          'gw shell-init | save --force $env.GW_INIT_PATH; source $env.GW_INIT_PATH; cd $env.GW_WORKDIR; gw clone demo $env.GW_ORIGIN | ignore; if ((pwd | get path) != $"($env.GW_WORKDIR)/demo/main") { exit 1 }; gw switch feature/test | ignore; if ((pwd | get path) != $"($env.GW_WORKDIR)/demo/feature~test") { exit 1 }; cd $"($env.GW_WORKDIR)/demo/main"; gw switch pr_123 | ignore; if ((pwd | get path) != $"($env.GW_WORKDIR)/demo/pr_123") { exit 1 }; cd $"($env.GW_WORKDIR)/demo/main"; gw pr 123 | ignore; if ((pwd | get path) != $"($env.GW_WORKDIR)/demo/pr_123") { exit 1 }; gw list | ignore',
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
