import { describe, expect, it } from 'vitest';

import { DIRECTORY_CHANGE_COMMANDS, renderShellInit } from '@/core/shell';

describe('shell integration helpers', () => {
  it('treats gw pr as a directory-changing command', () => {
    expect(DIRECTORY_CHANGE_COMMANDS).toContain('pr');
    expect(renderShellInit('bash')).toContain('switch|clone|pr');
    expect(renderShellInit('zsh')).toContain('switch|clone|pr');
    expect(renderShellInit('fish')).toContain('case switch clone pr');
    expect(renderShellInit('nu')).toContain("['switch', 'clone', 'pr']");
  });
});
