import Enquirer from 'enquirer';

import { formatWorktreeRows, isInteractiveTerminal } from '@/commands/shared';

interface SwitchPickerChoice {
  name: string;
  value: string;
  message: string;
  hint: string;
  searchText: string;
}

interface EnquirerPromptInternal {
  state: {
    cancelled: boolean;
    closed?: boolean;
    submitted: boolean;
    size?: number;
  };
  clear(lines?: number): void;
  emit(event: 'cancel', value: string): boolean;
  emit(event: 'close'): boolean;
  removeListener(event: 'close', listener: () => void): this;
  stop?: () => void;
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase();
}

function matchesSearch(input: string, searchText: string): boolean {
  const normalizedInput = normalizeSearchText(input).trim();
  if (normalizedInput === '') {
    return true;
  }

  return normalizedInput
    .split(/\s+/u)
    .every((term) => searchText.includes(term));
}

function formatPickerLabel(
  branchName: string,
  folderName: string,
  isCurrent: boolean
): string {
  return `${isCurrent ? '*' : ' '} ${branchName} ${folderName}`;
}

export async function cancelPromptSilently(
  this: EnquirerPromptInternal
): Promise<void> {
  this.state.cancelled = true;
  this.state.submitted = true;
  this.clear(this.state.size || 0);

  const stop = this.stop;
  if (stop) {
    this.removeListener('close', stop);
    this.stop = undefined;

    try {
      stop();
    } catch (error) {
      if (
        !(
          error instanceof Error &&
          'code' in error &&
          error.code === 'ERR_USE_AFTER_CLOSE'
        )
      ) {
        throw error;
      }
    }
  }

  this.state.closed = true;
  this.emit('close');
  this.emit('cancel', '');
}

export async function pickSwitchWorktreePath(
  anchorRepo: string,
  currentDir: string
): Promise<string | null> {
  if (!isInteractiveTerminal()) {
    throw new Error(
      'gw switch without a branch requires an interactive terminal'
    );
  }

  const rows = await formatWorktreeRows(anchorRepo, currentDir);
  if (rows.length === 0) {
    throw new Error('no attached worktrees found');
  }

  const choices: SwitchPickerChoice[] = rows.map((row, index) => ({
    name: String(index),
    value: row.path,
    message: formatPickerLabel(row.branchName, row.folderName, row.isCurrent),
    hint: row.path,
    searchText: normalizeSearchText(
      `${row.branchName} ${row.folderName} ${row.path}`
    ),
  }));

  const initial = rows.findIndex((row) => row.isCurrent);
  const enquirer = new Enquirer<{ selected: string }>();
  const promptOptions = {
    type: 'autocomplete',
    name: 'selected',
    message: 'gw switch',
    initial: initial === -1 ? undefined : initial,
    limit: 10,
    choices,
    cancel: cancelPromptSilently,
    suggest(input: string, promptChoices: SwitchPickerChoice[]) {
      return promptChoices.filter((choice) =>
        matchesSearch(input, choice.searchText)
      );
    },
  };

  try {
    const answer = await enquirer.prompt(promptOptions as never);

    return answer.selected;
  } catch (error) {
    if (error == null || error === '') {
      return null;
    }

    throw error;
  }
}
