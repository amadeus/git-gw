import { Command } from 'commander';

function addPlaceholderCommand(program: Command, name: string, description: string, alias?: string) {
  const command = program
    .command(name)
    .description(description)
    .allowUnknownOption()
    .allowExcessArguments(true)
    .action(() => {
      console.error(`gw: ${name} is not implemented yet`);
      process.exitCode = 1;
    });

  if (alias) {
    command.alias(alias);
  }
}

const program = new Command();

program
  .name('gw')
  .description('Manage git worktree projects')
  .showHelpAfterError();

addPlaceholderCommand(program, 'list', 'List worktrees in the current gw project');
addPlaceholderCommand(program, 'switch', 'Switch to or create a worktree for a branch');
addPlaceholderCommand(program, 'remove', 'Remove a worktree and optionally its branch', 'rm');
addPlaceholderCommand(program, 'clone', 'Clone a repository into a gw project layout');
addPlaceholderCommand(program, 'init', 'Initialize a gw project in the current directory');

program.command('help').description('Show help').action(() => {
  program.outputHelp();
});

program.addHelpText('after', '\nImplementation is in progress. See PLAN.md for the roadmap.\n');

program.action(() => {
  program.outputHelp();
});

await program.parseAsync(process.argv);
