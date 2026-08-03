import { execaCommand } from 'execa';

export async function runCreateAction(
  command: string | undefined,
  worktreePath: string
): Promise<void> {
  const action = command?.trim();
  if (!action) {
    return;
  }

  try {
    const result = await execaCommand(action, {
      cwd: worktreePath,
      reject: false,
      shell: true,
      stdio: 'inherit',
    });

    if (result.exitCode === 0) {
      return;
    }

    const status =
      result.exitCode == null
        ? result.signal
          ? `signal ${result.signal}`
          : 'unknown status'
        : `exit ${result.exitCode}`;
    process.stderr.write(`gw: create action failed (${status}): ${action}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`gw: create action failed: ${message}\n`);
  }
}
