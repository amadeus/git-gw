import type { Command } from 'commander';

import { registerPlaceholderCommand } from '@/commands/placeholder';

export function registerListCommand(program: Command): void {
  registerPlaceholderCommand(program, {
    name: 'list',
    description: 'List worktrees in the current gw project',
  });
}
