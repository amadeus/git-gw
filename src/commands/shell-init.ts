import { type Command, Option } from 'commander';

import { commandAction } from '@/commands/shared';
import {
  renderShellInit,
  resolveShellName,
  SHELL_NAMES,
  type ShellName,
} from '@/core/shell';

export function registerShellInitCommand(program: Command): void {
  program
    .command('shell-init')
    .description('Print shell integration code')
    .addOption(
      new Option(
        '--shell <shell>',
        'Shell to generate integration for'
      ).choices(SHELL_NAMES)
    )
    .action(
      commandAction(
        async (options: { shell?: ShellName }, command: Command) => {
          const shell = await resolveShellName(
            options.shell || command.args[0]
          );

          process.stdout.write(renderShellInit(shell));
        }
      )
    );
}
