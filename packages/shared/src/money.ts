import { MOCK_USD_DECIMALS } from './constants.js';

export function formatMockUsd(subunits: string | bigint): string {
  const value = typeof subunits === 'bigint' ? subunits : BigInt(subunits);
  const scale = 10n ** BigInt(MOCK_USD_DECIMALS);
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(MOCK_USD_DECIMALS, '0');
  const trimmed = fraction.replace(/0+$/, '');

  return `$${whole.toLocaleString('en-US')}${trimmed ? `.${trimmed}` : ''}`;
}

