import type { Command } from 'commander';

import {
  commandAction,
  formatWorktreeRows,
  getCurrentDirectory,
  loadProjectContext,
} from '@/commands/shared';

export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('List worktrees in the current gw project')
    .action(
      commandAction(async () => {
        const context = await loadProjectContext();
        const currentDir = await getCurrentDirectory();
        const rows = await formatWorktreeRows(context.anchorRepo, currentDir);

        for (const row of rows) {
          process.stdout.write(`${row.display}\n`);
        }
      })
    );
}
