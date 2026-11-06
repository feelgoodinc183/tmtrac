// Prices as the app shows and charges them.

export const DEFAULT_CURRENCY = 'MYR';
export const DEFAULT_CURRENCY_SYMBOL = 'RM';

/** A single regatta pass, when no event-pass plan is set up, in the default currency */
export const EVENT_PASS_PRICE = 99;

/** "Free", "RM 199" (a letter symbol gets a space), or "$49" */
export function formatPrice(amount: number, symbol: string = DEFAULT_CURRENCY_SYMBOL): string {
  if (!amount) return 'Free';
  const sym = symbol || DEFAULT_CURRENCY_SYMBOL;
  return `${sym}${/[A-Za-z]$/.test(sym) ? ' ' : ''}${amount}`;
}
