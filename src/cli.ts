if (process.argv[2] === '__complete') {
  const { runCompletion } = await import('@/commands/completion');
  await runCompletion(process.argv.slice(3));
} else {
  const { Command } = await import('commander');
  const { registerCloneCommand } = await import('@/commands/clone');
  const { registerCompletionCommand } = await import('@/commands/completion');
  const { registerHelpCommand } = await import('@/commands/help');
  const { registerInitCommand } = await import('@/commands/init');
  const { registerListCommand } = await import('@/commands/list');
  const { registerPrCommand } = await import('@/commands/pr');
  const { registerRemoveCommand } = await import('@/commands/remove');
  const { registerSetupCommand } = await import('@/commands/setup');
  const { registerShellInitCommand } = await import('@/commands/shell-init');
  const { registerSwitchCommand } = await import('@/commands/switch');
  const { readPackageVersion } = await import('@/core/package-version');

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
  registerCompletionCommand(program);
  registerShellInitCommand(program);
  registerSetupCommand(program);
  registerHelpCommand(program);

  program.action(() => {
    program.outputHelp();
  });

  await program.parseAsync(process.argv);
}

export {};
