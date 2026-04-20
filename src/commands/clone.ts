import type { Command } from 'commander';

import { registerPlaceholderCommand } from '@/commands/placeholder';

export function registerCloneCommand(program: Command): void {
  registerPlaceholderCommand(program, {
    name: 'clone',
    description: 'Clone a repository into a gw project layout',
  });
}
