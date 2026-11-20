/** Public catalogue rates are authoritative MYR rates; no browser exchange conversion. */
export function formatMYR(amount: number): string {
  return `RM ${amount.toFixed(2)}`;
}
export function formatPrice(amountMYR: number): { myr: string; myrValue: number } {
  return { myr: formatMYR(amountMYR), myrValue: amountMYR };
}
