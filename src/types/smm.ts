export interface SmmService {
  service: number;
  name: string;
  type: string;
  category: string;
  rate: string;
  min: number;
  max: number;
  dripfeed?: boolean;
  refill: boolean;
  cancel: boolean;
}

export interface OrderResponse {
  order?: number;
  error?: string;
}

export interface OrderStatus {
  charge?: string;
  start_count?: string;
  status?: string;
  remains?: string;
  currency?: string;
  error?: string;
}

export interface BalanceResponse {
  balance: string;
  currency: string;
}

export type PlatformKey =
  | 'instagram'
  | 'tiktok'
  | 'facebook'
  | 'youtube'
  | 'twitter'
  | 'telegram'
  | 'snapchat'
  | 'spotify'
  | 'threads'
  | 'other';

export interface PlatformInfo {
  key: PlatformKey;
  label: string;
  match: (category: string) => boolean;
}
