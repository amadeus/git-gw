import type { Command } from 'commander';

import { registerPlaceholderCommand } from '@/commands/placeholder';

export function registerInitCommand(program: Command): void {
  registerPlaceholderCommand(program, {
    name: 'init',
    description: 'Initialize a gw project in the current directory',
  });
}
