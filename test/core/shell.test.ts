import { describe, expect, it } from 'vitest';

import { DIRECTORY_CHANGE_COMMANDS, renderShellInit } from '@/core/shell';

describe('shell integration helpers', () => {
  it('tracks gw pr as a directory-changing command', () => {
    expect(DIRECTORY_CHANGE_COMMANDS).toContain('pr');
  });

  it('passes handoff files through every generated wrapper', () => {
    expect(renderShellInit('bash')).toContain('GW_CWD_FILE');
    expect(renderShellInit('bash')).toContain('GW_SOURCE_FILE');
    expect(renderShellInit('zsh')).toContain('GW_CWD_FILE');
    expect(renderShellInit('zsh')).toContain('GW_SOURCE_FILE');
    expect(renderShellInit('fish')).toContain('GW_CWD_FILE');
    expect(renderShellInit('fish')).toContain('GW_SOURCE_FILE');
    expect(renderShellInit('nu')).toContain('GW_CWD_FILE');
    expect(renderShellInit('nu')).toContain('GW_SOURCE_FILE');
  });

  it('renders shell completion hooks for supported shells', () => {
    expect(renderShellInit('bash')).toContain('__gw_bash_complete');
    expect(renderShellInit('zsh')).toContain('__gw_zsh_complete');
    expect(renderShellInit('fish')).toContain('complete -c gw');
  });
});
