import type { Command } from 'commander';

import { registerPlaceholderCommand } from '@/commands/placeholder';

export function registerSwitchCommand(program: Command): void {
  registerPlaceholderCommand(program, {
    name: 'switch',
    description: 'Switch to or create a worktree for a branch',
  });
}
