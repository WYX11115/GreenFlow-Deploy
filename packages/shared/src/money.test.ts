import { describe, expect, it } from 'vitest';
import { formatMockUsd } from './money.js';

describe('formatMockUsd', () => {
  it('formats integer six-decimal subunits without floating point math', () => {
    expect(formatMockUsd('1000000000')).toBe('$1,000');
    expect(formatMockUsd(300_500_000n)).toBe('$300.5');
  });
});

