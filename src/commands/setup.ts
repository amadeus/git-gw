import { type Command, Option } from 'commander';
import Enquirer from 'enquirer';
import { writeFile } from 'node:fs/promises';

import { commandAction, isInteractiveTerminal } from '@/commands/shared';
import {
  getSessionActivationCommand,
  getShellInstallPath,
  installShellIntegration,
  resolveShellName,
  SHELL_NAMES,
  type ShellName,
} from '@/core/shell';

interface SetupOptions {
  install?: boolean;
  shell?: ShellName;
}

async function requestShellSource(sourcePath: string): Promise<boolean> {
  const sourceFile = process.env.GW_SOURCE_FILE;
  if (!sourceFile) {
    return false;
  }

  await writeFile(sourceFile, `${sourcePath}\n`, 'utf8');
  return true;
}

function quoteShellPath(path: string): string {
  return `"${path
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('$', '\\$')}"`;
}

function getSourceCommand(path: string): string {
  return `source ${quoteShellPath(path)}`;
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
        const installPath = await getShellInstallPath(shell);

        process.stdout.write(`Detected shell: ${shell}\n`);
        process.stdout.write('\n');
        process.stdout.write('Session activation:\n');
        process.stdout.write(`  ${sessionCommand}\n`);

        let shouldInstall = Boolean(options.install);
        if (!shouldInstall && isInteractiveTerminal()) {
          process.stdout.write('\n');
          shouldInstall = await promptForInstall(shell, installPath);
        }

        if (!shouldInstall) {
          process.stdout.write('\n');
          process.stdout.write('Persistent install:\n');
          process.stdout.write(`  gw setup --install --shell ${shell}\n`);
          return;
        }

        const installResult = await installShellIntegration(shell);
        const didRequestShellSource = await requestShellSource(
          installResult.initFilePath
        );

        process.stdout.write('\n');
        process.stdout.write('Installed persistent shell integration:\n');
        process.stdout.write(
          `  ${installResult.rcFileLabel}: ${installResult.rcFilePath}\n`
        );

        if (installResult.initFilePath !== installResult.rcFilePath) {
          process.stdout.write(`  init file: ${installResult.initFilePath}\n`);
        }

        if (installResult.updatedRcFile) {
          process.stdout.write(
            `  status: ${installResult.rcFileLabel} updated\n`
          );
        } else {
          process.stdout.write(
            `  status: ${installResult.rcFileLabel} already up to date\n`
          );
        }

        if (!didRequestShellSource) {
          process.stdout.write('\n');
          process.stdout.write('Current shell activation:\n');
          process.stdout.write(
            `  ${getSourceCommand(installResult.initFilePath)}\n`
          );
        }
      })
    );
}
