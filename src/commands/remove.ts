import type { Command } from 'commander';

import { registerPlaceholderCommand } from '@/commands/placeholder';

export function registerRemoveCommand(program: Command): void {
  registerPlaceholderCommand(program, {
    name: 'remove',
    alias: 'rm',
    description: 'Remove a worktree and optionally its branch',
  });
}
