import { describe, expect, test, vi } from 'vitest';

import { cancelPromptSilently } from '@/tui/switch-picker';

function createReadlineClosedError(): Error & { code: string } {
  const error = new Error('readline was closed') as Error & { code: string };
  error.code = 'ERR_USE_AFTER_CLOSE';
  return error;
}

describe('switch picker', () => {
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
