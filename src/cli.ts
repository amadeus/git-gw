import { Command } from 'commander';

import { registerCloneCommand } from '@/commands/clone';
import { registerHelpCommand } from '@/commands/help';
import { registerInitCommand } from '@/commands/init';
import { registerListCommand } from '@/commands/list';
import { registerPrCommand } from '@/commands/pr';
import { registerRemoveCommand } from '@/commands/remove';
import { registerSetupCommand } from '@/commands/setup';
import { registerShellInitCommand } from '@/commands/shell-init';
import { registerSwitchCommand } from '@/commands/switch';
import { readPackageVersion } from '@/core/package-version';

const program = new Command();
const packageVersion = await readPackageVersion();

program
  .name('gw')
  .description('Manage git worktree projects')
  .version(packageVersion, '-v, --version')
  .showHelpAfterError();

registerListCommand(program);
registerSwitchCommand(program);
registerPrCommand(program);
registerRemoveCommand(program);
registerCloneCommand(program);
registerInitCommand(program);
registerShellInitCommand(program);
registerSetupCommand(program);
registerHelpCommand(program);

program.action(() => {
  program.outputHelp();
});

await program.parseAsync(process.argv);
