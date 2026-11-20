import type { SmmService } from '@/types/smm';

export async function fetchServices(): Promise<SmmService[]> {
  const res = await fetch('/api/services');
  if (!res.ok) throw new Error('Services temporarily unavailable');
  return res.json();
}

export interface CheckoutDetails { service: number; link: string; quantity: number; comments?: string }
export interface CheckoutResult { id: string; amountMYR: number; status: string; whatsappUrl: string }
export async function createCheckout(details: CheckoutDetails): Promise<CheckoutResult> {
  const body = JSON.stringify(details);
  // Retain the key after a lost response, refresh, or modal close. Never retry with a new key.
  const saved = sessionStorage.getItem('booster-checkout');
  let attempt: { body: string; key: string } | null = null;
  try { attempt = saved ? JSON.parse(saved) : null; } catch { /* replace corrupt browser state */ }
  if (!attempt || attempt.body !== body) attempt = { body, key: crypto.randomUUID() };
  sessionStorage.setItem('booster-checkout', JSON.stringify(attempt));
  const response = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': attempt.key }, body });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Tempahan tidak dapat direkodkan. Cuba lagi.');
  return data;
}
