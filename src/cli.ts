import { Command } from 'commander';

import { registerCloneCommand } from '@/commands/clone';
import { registerHelpCommand } from '@/commands/help';
import { registerInitCommand } from '@/commands/init';
import { registerListCommand } from '@/commands/list';
import { registerRemoveCommand } from '@/commands/remove';
import { registerSwitchCommand } from '@/commands/switch';

const program = new Command();

program
  .name('gw')
  .description('Manage git worktree projects')
  .showHelpAfterError();

registerListCommand(program);
registerSwitchCommand(program);
registerRemoveCommand(program);
registerCloneCommand(program);
registerInitCommand(program);
registerHelpCommand(program);

program.addHelpText(
  'after',
  '\nImplementation is in progress. See PLAN.md for the roadmap.\n'
);

program.action(() => {
  program.outputHelp();
});

await program.parseAsync(process.argv);
