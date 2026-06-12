import { describe, expect, test, vi } from 'vitest';

import {
  cancelPromptSilently,
  configureBoundedSwitchPickerPrompt,
  getSwitchPickerViewport,
} from '@/tui/switch-picker';

interface FakeChoice {
  index: number;
  hint: string;
  message: string;
  name: string;
  searchText: string;
  value: string;
}

interface FakePrompt {
  choices: FakeChoice[];
  index: number;
  limit: number;
  alert(): unknown;
  down(): unknown;
  reset(...args: unknown[]): unknown;
  up(): unknown;
}

function createChoices(length: number): FakeChoice[] {
  return Array.from({ length }, (_, index) => ({
    index,
    hint: String(index),
    message: String(index),
    name: String(index),
    searchText: String(index),
    value: String(index),
  }));
}

function createReadlineClosedError(): Error & { code: string } {
  const error = new Error('readline was closed') as Error & { code: string };
  error.code = 'ERR_USE_AFTER_CLOSE';
  return error;
}

describe('switch picker', () => {
  test('shows an initial selection beyond the first rendered window', () => {
    const choices = createChoices(15);
    const viewport = getSwitchPickerViewport(choices, 12, 10);

    expect(viewport.choices.slice(0, 10).map((choice) => choice.index)).toEqual(
      [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    );
    expect(viewport.index).toBe(9);
    expect(viewport.choices[viewport.index].index).toBe(12);
  });

  test('keeps an initial selection that is already visible in place', () => {
    const choices = createChoices(15);
    const viewport = getSwitchPickerViewport(choices, 4, 10);

    expect(viewport.choices).toBe(choices);
    expect(viewport.index).toBe(4);
  });

  test('positions the initial selection using the actual rendered limit', async () => {
    const prompt: FakePrompt = {
      choices: createChoices(20),
      index: 12,
      limit: 5,
      alert: vi.fn(),
      down: vi.fn(),
      reset: vi.fn(),
      up: vi.fn(),
    };

    configureBoundedSwitchPickerPrompt(prompt);
    await prompt.reset();

    expect(prompt.choices.slice(0, 5).map((choice) => choice.index)).toEqual([
      8, 9, 10, 11, 12,
    ]);
    expect(prompt.index).toBe(4);
  });

  test('blocks up navigation at the first matching choice', () => {
    const alert = vi.fn();
    const up = vi.fn();
    const prompt: FakePrompt = {
      choices: createChoices(12),
      index: 0,
      limit: 10,
      alert,
      down: vi.fn(),
      reset: vi.fn(),
      up,
    };

    configureBoundedSwitchPickerPrompt(prompt);
    prompt.up();

    expect(alert).toHaveBeenCalledTimes(1);
    expect(up).not.toHaveBeenCalled();
  });

  test('blocks down navigation at the last matching choice', () => {
    const choices = createChoices(12);
    const alert = vi.fn();
    const down = vi.fn();
    const prompt: FakePrompt = {
      choices: choices.slice(2).concat(choices.slice(0, 2)),
      index: 9,
      limit: 10,
      alert,
      down,
      reset: vi.fn(),
      up: vi.fn(),
    };

    configureBoundedSwitchPickerPrompt(prompt);
    prompt.down();

    expect(alert).toHaveBeenCalledTimes(1);
    expect(down).not.toHaveBeenCalled();
  });

  test('keeps scrolling when the visible edge is not the list boundary', () => {
    const choices = createChoices(12);
    const alert = vi.fn();
    const up = vi.fn();
    const prompt: FakePrompt = {
      choices: choices.slice(2).concat(choices.slice(0, 2)),
      index: 0,
      limit: 10,
      alert,
      down: vi.fn(),
      reset: vi.fn(),
      up,
    };

    configureBoundedSwitchPickerPrompt(prompt);
    prompt.up();

    expect(alert).not.toHaveBeenCalled();
    expect(up).toHaveBeenCalledTimes(1);
  });

  test('silently cancels when Enquirer readline cleanup has already closed', async () => {
    const stop = vi.fn(() => {
      throw createReadlineClosedError();
    });
    const prompt: ThisParameterType<typeof cancelPromptSilently> = {
      state: {
        cancelled: false,
        submitted: false,
        size: 2,
      },
      clear: vi.fn(),
      emit: vi.fn(() => true),
      removeListener: vi.fn(),
      stop,
    };

    await expect(cancelPromptSilently.call(prompt)).resolves.toBeUndefined();

    expect(prompt.state.cancelled).toBe(true);
    expect(prompt.state.submitted).toBe(true);
    expect(prompt.state.closed).toBe(true);
    expect(prompt.clear).toHaveBeenCalledWith(2);
    expect(prompt.removeListener).toHaveBeenCalledWith('close', stop);
    expect(prompt.stop).toBeUndefined();
    expect(prompt.emit).toHaveBeenNthCalledWith(1, 'close');
    expect(prompt.emit).toHaveBeenNthCalledWith(2, 'cancel', '');
  });

  test('does not swallow unrelated Enquirer cleanup errors', async () => {
    const error = new Error('unexpected cleanup failure');
    const prompt: ThisParameterType<typeof cancelPromptSilently> = {
      state: {
        cancelled: false,
        submitted: false,
      },
      clear: vi.fn(),
      emit: vi.fn(() => true),
      removeListener: vi.fn(),
      stop: vi.fn(() => {
        throw error;
      }),
    };

    await expect(cancelPromptSilently.call(prompt)).rejects.toBe(error);
  });
});
