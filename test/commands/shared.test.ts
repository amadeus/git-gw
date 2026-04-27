import { describe, expect, it } from 'vitest';

import { getSelectedChoiceValue } from '@/commands/shared';

describe('getSelectedChoiceValue', () => {
  it('maps Enquirer choice names back to choice values', () => {
    const prefixed = { branchName: 'amadeus/topic' };
    const raw = { branchName: 'topic' };

    expect(getSelectedChoiceValue([prefixed, raw], '1')).toBe(raw);
  });

  it('keeps returned values when Enquirer returns the choice value directly', () => {
    expect(getSelectedChoiceValue(['alpha', 'beta'], 'topic')).toBe('topic');
  });
});
