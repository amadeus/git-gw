import type { Command } from 'commander';

export interface PlaceholderCommandOptions {
  name: string;
  description: string;
  alias?: string;
}

export function registerPlaceholderCommand(
  program: Command,
  options: PlaceholderCommandOptions
): void {
  const command = program
    .command(options.name)
    .description(options.description)
    .allowUnknownOption()
    .allowExcessArguments(true)
    .action(() => {
      console.error(`gw: ${options.name} is not implemented yet`);
      process.exitCode = 1;
    });

  if (options.alias) {
    command.alias(options.alias);
  }
}
