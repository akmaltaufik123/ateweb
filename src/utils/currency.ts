/** USD to MYR exchange rate — update as needed */
export const USD_TO_MYR = 4.47;

/** Format USD amount */
export function formatUSD(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/** Format MYR amount */
export function formatMYR(amount: number): string {
  return `RM ${amount.toFixed(2)}`;
}

/** Convert USD rate (per 1000) to MYR */
export function usdToMyr(usdAmount: number): number {
  return usdAmount * USD_TO_MYR;
}

/** Format price showing both USD and MYR */
export function formatPrice(usdAmount: number): { usd: string; myr: string; myrValue: number } {
  const myrValue = usdToMyr(usdAmount);
  return {
    usd: formatUSD(usdAmount),
    myr: formatMYR(myrValue),
    myrValue,
  };
}
