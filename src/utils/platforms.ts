import type { PlatformInfo } from '@/types/smm';

export const PLATFORMS: PlatformInfo[] = [
  {
    key: 'instagram',
    label: 'Instagram',
    match: (c) => /instagram/i.test(c),
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    match: (c) => /tiktok/i.test(c),
  },
  {
    key: 'facebook',
    label: 'Facebook',
    match: (c) => /facebook/i.test(c),
  },
  {
    key: 'youtube',
    label: 'YouTube',
    match: (c) => /youtube/i.test(c),
  },
  {
    key: 'twitter',
    label: 'X / Twitter',
    match: (c) => /twitter/i.test(c),
  },
  {
    key: 'telegram',
    label: 'Telegram',
    match: (c) => /telegram/i.test(c),
  },
  {
    key: 'snapchat',
    label: 'Snapchat',
    match: (c) => /snapchat/i.test(c),
  },
  {
    key: 'spotify',
    label: 'Spotify',
    match: (c) => /spotify/i.test(c),
  },
  {
    key: 'threads',
    label: 'Threads',
    match: (c) => /threads/i.test(c),
  },
  {
    key: 'other',
    label: 'Other',
    match: () => true, // fallback
  },
];

/** Group services by platform, unmatched go to "other" */
export function groupByPlatform(services: { category: string }[]) {
  const groups: Record<string, typeof services> = {};
  for (const p of PLATFORMS) {
    groups[p.key] = [];
  }
  for (const svc of services) {
    let matched = false;
    for (const p of PLATFORMS) {
      if (p.key !== 'other' && p.match(svc.category)) {
        groups[p.key].push(svc);
        matched = true;
        break;
      }
    }
    if (!matched) {
      groups['other'].push(svc);
    }
  }
  return groups;
}
