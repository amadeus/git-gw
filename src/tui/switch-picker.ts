import Enquirer from 'enquirer';

import {
  formatWorktreeRows,
  getSelectedChoiceValue,
  isInteractiveTerminal,
} from '@/commands/shared';

interface SwitchPickerChoice {
  name: string;
  value: string;
  message: string;
  hint: string;
  searchText: string;
  index?: number;
}

interface SwitchPickerPromptInternal {
  choices: SwitchPickerChoice[];
  index: number;
  limit: number;
  alert(): unknown;
  down(): unknown;
  reset(...args: unknown[]): unknown;
  up(): unknown;
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

function getChoiceOrder(choice: SwitchPickerChoice, fallback: number): number {
  return typeof choice.index === 'number' ? choice.index : fallback;
}

function isAtPickerBoundary(
  choices: SwitchPickerChoice[],
  index: number,
  direction: 'up' | 'down'
): boolean {
  const focused = choices[index];
  if (!focused) {
    return true;
  }

  const focusedOrder = getChoiceOrder(focused, index);
  const boundaryOrder = choices.reduce((boundary, choice, choiceIndex) => {
    const order = getChoiceOrder(choice, choiceIndex);
    return direction === 'up'
      ? Math.min(boundary, order)
      : Math.max(boundary, order);
  }, focusedOrder);

  return focusedOrder === boundaryOrder;
}

export function getSwitchPickerViewport<T>(
  choices: T[],
  selectedIndex: number,
  limit: number
): { choices: T[]; index: number } {
  if (choices.length === 0) {
    return { choices, index: 0 };
  }

  const boundedSelectedIndex = Math.max(
    0,
    Math.min(selectedIndex, choices.length - 1)
  );
  const visibleLimit = Math.max(1, Math.min(limit, choices.length));
  const start = Math.max(
    0,
    Math.min(
      boundedSelectedIndex - visibleLimit + 1,
      choices.length - visibleLimit
    )
  );

  if (start === 0) {
    return { choices, index: boundedSelectedIndex };
  }

  return {
    choices: choices.slice(start).concat(choices.slice(0, start)),
    index: boundedSelectedIndex - start,
  };
}

export function configureBoundedSwitchPickerPrompt(
  prompt: SwitchPickerPromptInternal
): void {
  // Enquirer scrolls autocomplete lists by rotating choices; keep that model,
  // but stop delegating once the focused original choice is at a boundary.
  const reset = prompt.reset.bind(prompt);
  prompt.reset = async (...args: unknown[]) => {
    const result = await reset(...args);
    const viewport = getSwitchPickerViewport(
      prompt.choices,
      prompt.index,
      prompt.limit
    );

    prompt.choices = viewport.choices;
    prompt.index = viewport.index;

    return result;
  };

  const up = prompt.up.bind(prompt);
  prompt.up = () => {
    if (isAtPickerBoundary(prompt.choices, prompt.index, 'up')) {
      return prompt.alert();
    }

    return up();
  };

  const down = prompt.down.bind(prompt);
  prompt.down = () => {
    if (isAtPickerBoundary(prompt.choices, prompt.index, 'down')) {
      return prompt.alert();
    }

    return down();
  };
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
  enquirer.on('prompt', (prompt: SwitchPickerPromptInternal) => {
    configureBoundedSwitchPickerPrompt(prompt);
  });

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

    return getSelectedChoiceValue(
      choices.map((choice) => choice.value),
      answer.selected
    );
  } catch (error) {
    if (error == null || error === '') {
      return null;
    }

    throw error;
  }
}
