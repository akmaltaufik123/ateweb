import { HttpError, requireThat, normalizeService } from './domain.js';

export function createProvider({ url, key, timeout = 15000, fetchImpl = fetch }) {
  requireThat(Number.isSafeInteger(timeout) && timeout >= 1 && timeout <= 60000, 500, 'Provider timeout must be 1–60000 milliseconds');
  const endpoint = new URL(url);
  requireThat(endpoint.protocol === 'https:' && !endpoint.username && !endpoint.password, 500, 'Provider endpoint must use HTTPS');
  let cache = null, inflight = null;
  async function call(params) {
    requireThat(Boolean(key), 503, 'Provider connection not configured');
    const read = ['services', 'status', 'balance', 'refill_status'].includes(params.action);
    for (let attempt = 0; attempt < (read ? 2 : 1); attempt++) {
      try {
        const response = await fetchImpl(url, { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...params, key }), signal: AbortSignal.timeout(timeout) });
        requireThat(response.ok, 502, 'Provider temporarily unavailable');
        // Bound a streamed response before JSON parsing, including slow response bodies.
        let size = 0; const chunks = [];
        for await (const chunk of response.body) { size += chunk.length; requireThat(size <= 8 * 1024 * 1024, 502, 'Provider response too large'); chunks.push(chunk); }
        const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        requireThat(result && typeof result === 'object' && !result.error, 502, 'Provider rejected request');
        return result;
      } catch (error) {
        if (attempt === (read ? 1 : 0)) throw new HttpError(error.status || 502, 'Provider request failed; review connection or reconcile the request');
      }
    }
  }
  async function services(fresh = false) {
    if (!fresh && cache && Date.now() - cache.at < 120000) return cache.services;
    if (!inflight) inflight = (async () => {
      const result = await call({ action: 'services' });
      requireThat(Array.isArray(result), 502, 'Invalid provider catalogue');
      const items = result.map(normalizeService);
      requireThat(new Set(items.map(s => s.service)).size === items.length, 502, 'Duplicate provider service IDs');
      cache = { at: Date.now(), services: items }; return items;
    })().finally(() => { inflight = null; });
    return inflight;
  }
  return { call, services };
}
