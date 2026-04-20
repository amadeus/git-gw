import type { Command } from 'commander';

export function registerHelpCommand(program: Command): void {
  program
    .command('help')
    .description('Show help')
    .action(() => {
      program.outputHelp();
    });
}
