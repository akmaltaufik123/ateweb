import type { SmmService, OrderResponse, OrderStatus, BalanceResponse } from '@/types/smm';

const BASE = '/api';

export async function fetchServices(): Promise<SmmService[]> {
  const res = await fetch(`${BASE}/services`);
  if (!res.ok) throw new Error('Failed to fetch services');
  return res.json();
}

export async function placeOrder(data: {
  service: number;
  link: string;
  quantity: number;
  comments?: string;
  runs?: number;
  interval?: number;
}): Promise<OrderResponse> {
  const res = await fetch(`${BASE}/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to place order');
  return res.json();
}

export async function checkOrderStatus(order: number): Promise<OrderStatus> {
  const res = await fetch(`${BASE}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order }),
  });
  if (!res.ok) throw new Error('Failed to check order status');
  return res.json();
}

export async function fetchBalance(): Promise<BalanceResponse> {
  const res = await fetch(`${BASE}/balance`);
  if (!res.ok) throw new Error('Failed to fetch balance');
  return res.json();
}

export async function requestRefill(order: number): Promise<unknown> {
  const res = await fetch(`${BASE}/refill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order }),
  });
  if (!res.ok) throw new Error('Failed to request refill');
  return res.json();
}

export async function cancelOrder(orders: string): Promise<unknown> {
  const res = await fetch(`${BASE}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orders }),
  });
  if (!res.ok) throw new Error('Failed to cancel order');
  return res.json();
}
