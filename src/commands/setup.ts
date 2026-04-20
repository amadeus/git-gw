import { type Command, Option } from 'commander';
import Enquirer from 'enquirer';

import { commandAction, isInteractiveTerminal } from '@/commands/shared';
import {
  getSessionActivationCommand,
  getShellRcFilePath,
  installShellIntegration,
  resolveShellName,
  SHELL_NAMES,
  type ShellName,
} from '@/core/shell';

interface SetupOptions {
  install?: boolean;
  shell?: ShellName;
}

async function promptForInstall(
  shell: ShellName,
  rcFilePath: string
): Promise<boolean> {
  const enquirer = new Enquirer<{ install: boolean }>();

  try {
    const answer = await enquirer.prompt({
      type: 'confirm',
      name: 'install',
      message: `Install persistent ${shell} integration into ${rcFilePath}?`,
      initial: false,
    });

    return answer.install;
  } catch (error) {
    if (error == null || error === '') {
      return false;
    }

    throw error;
  }
}

export function registerSetupCommand(program: Command): void {
  program
    .command('setup')
    .description(
      'Help configure shell integration for this session or persistently'
    )
    .addOption(
      new Option('--shell <shell>', 'Shell to configure').choices(SHELL_NAMES)
    )
    .option(
      '--install',
      'Install persistent shell integration without prompting'
    )
    .action(
      commandAction(async (options: SetupOptions) => {
        const shell = await resolveShellName(options.shell);
        const sessionCommand = getSessionActivationCommand(shell);
        const rcFilePath = await getShellRcFilePath(shell);

        process.stdout.write(`Detected shell: ${shell}\n`);
        process.stdout.write('\n');
        process.stdout.write('Session activation:\n');
        process.stdout.write(`  ${sessionCommand}\n`);

        let shouldInstall = Boolean(options.install);
        if (!shouldInstall && isInteractiveTerminal()) {
          process.stdout.write('\n');
          shouldInstall = await promptForInstall(shell, rcFilePath);
        }

        if (!shouldInstall) {
          process.stdout.write('\n');
          process.stdout.write('Persistent install:\n');
          process.stdout.write(`  gw setup --install --shell ${shell}\n`);
          return;
        }

        const installResult = await installShellIntegration(shell);
        process.stdout.write('\n');
        process.stdout.write('Installed persistent shell integration:\n');
        process.stdout.write(`  rc file: ${installResult.rcFilePath}\n`);
        process.stdout.write(`  init file: ${installResult.initFilePath}\n`);

        if (installResult.updatedRcFile) {
          process.stdout.write('  status: rc file updated\n');
        } else {
          process.stdout.write('  status: rc file already up to date\n');
        }
      })
    );
}
