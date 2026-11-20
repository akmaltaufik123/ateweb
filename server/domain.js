export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const requireThat = (ok, status, message) => { if (!ok) throw new HttpError(status, message); };
export const numeric = (n, min, max) => (typeof n === 'number' || (typeof n === 'string' && n.trim() !== '')) && Number.isFinite(Number(n)) && Number(n) >= min && Number(n) <= max;
export const cents = n => Math.round((n + Number.EPSILON) * 100);
export const supported = s => ['default', 'custom comments'].includes(s.type.toLowerCase());
export function normalizeService(s) {
  const service = Number(s.service), min = Number(s.min), max = Number(s.max);
  requireThat(Number.isSafeInteger(service) && service > 0 && Number.isSafeInteger(min) && min > 0 && Number.isSafeInteger(max) && max >= min && numeric(s.rate, 0, 100000) && typeof s.name === 'string' && typeof s.type === 'string', 502, 'Invalid provider catalogue');
  return { service, name: s.name.slice(0, 500), category: String(s.category || '').slice(0, 500), type: s.type, min, max, rate: String(s.rate), refill: s.refill === true || s.refill === 'true', cancel: s.cancel === true || s.cancel === 'true' };
}
export function quote(s, quantity, settings, override = {}) {
  const fx = settings.providerCurrency === 'USD' ? settings.fx : 1;
  const cost = Number(s.rate) * quantity * fx / 1000;
  const raw = override.sellingRateMYR != null ? override.sellingRateMYR * quantity / 1000 : cost * (1 + (override.markup ?? settings.defaultMarkup) / 100);
  const saleCents = Math.ceil(Number(raw.toFixed(10)) * 100 - 1e-8);
  requireThat(Number.isSafeInteger(saleCents) && saleCents > 0 && saleCents <= 100000000, 400, 'Order price outside supported range');
  return { saleMYR: saleCents / 100, costMYR: cents(cost) / 100, saleCents, costCents: cents(cost), fx, providerCurrency: settings.providerCurrency, providerRate: s.rate };
}
export function validateCheckout(body, s) {
  requireThat(body && typeof body === 'object' && Object.keys(body).every(k => ['service', 'quantity', 'link', 'comments'].includes(k)), 400, 'Unsupported order parameters');
  requireThat(supported(s), 400, 'Service type not supported by checkout');
  requireThat(typeof body.link === 'string' && body.link.length <= 2048 && !/[\s\u0000-\u001f]/.test(body.link), 400, 'Invalid target URL');
  let url; try { url = new URL(body.link); } catch { throw new HttpError(400, 'Invalid target URL'); }
  requireThat(['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && url.hostname.includes('.') && !/^(localhost|127\.|0\.|169\.254\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname), 400, 'Invalid target URL');
  const custom = s.type.toLowerCase() === 'custom comments';
  requireThat(body.comments === undefined || (typeof body.comments === 'string' && body.comments.length <= 5000), 400, 'Invalid comments');
  const comments = custom ? (body.comments || '').split(/\r?\n/).map(v => v.trim()).filter(Boolean).join('\n') : '';
  requireThat(custom || !body.comments, 400, 'Comments unsupported by this service');
  const quantity = custom ? comments.split('\n').filter(Boolean).length : Number(body.quantity);
  requireThat(numeric(body.quantity, 1, Number.MAX_SAFE_INTEGER) && Number.isSafeInteger(quantity) && quantity >= s.min && quantity <= s.max && (!custom || Number(body.quantity) === quantity), 400, custom ? 'Quantity must equal comment line count and meet service limits' : 'Quantity outside service limits');
  return { service: s.service, link: url.href, quantity, comments };
}
