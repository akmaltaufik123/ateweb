const $ = id => document.getElementById(id);
let csrf = '', orders = [], catalogue = null;
const notify = (message, error = false) => { $('notice').textContent = message; $('notice').classList.toggle('error', error); };
async function api(url, method = 'GET', body) {
  const r = await fetch(url, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await r.json();
  if (r.status === 401) signedIn(false);
  if (!r.ok) throw Error(data.error || 'Request failed');
  return data;
}
function signedIn(value) { $('workspace').hidden = !value; $('loginPanel').hidden = value; $('logout').hidden = !value; if (!value) { csrf = ''; orders = []; for (const id of ['orders', 'services', 'transactions', 'stats', 'events']) $(id).replaceChildren(); $('detail').close(); $('detailText').textContent = ''; $('balance').textContent = ''; $('financials').textContent = ''; catalogue = null; } }
const cell = (row, value) => { const c = row.insertCell(); c.textContent = String(value ?? '—'); return c; };
function button(parent, title, handler) {
  const b = document.createElement('button'); b.textContent = title;
  b.onclick = async () => { b.disabled = true; try { await handler(); } catch (e) { notify(e.message, true); } finally { b.disabled = false; } }; parent.append(b);
}
function audit(events) { $('events').replaceChildren(); for (const e of events) { const r = $('events').insertRow(); [e.at, e.actor, e.action, e.order_id, JSON.stringify(e.data)].forEach(v => cell(r, v)); } }
async function detail(id) { $('detailText').textContent = JSON.stringify(await api('/api/admin/orders/' + id), null, 2); $('detail').showModal(); }
async function action(o, name, body) { await api('/api/admin/orders/' + o.id + '/' + name, 'POST', body); await load(); notify('Saved: ' + name + ' · ' + o.id); }
function renderOrders() {
  $('orders').replaceChildren(); const q = $('orderSearch').value.toLowerCase(), status = $('orderStatus').value;
  for (const o of orders.filter(o => (!status || (status === 'disputed' ? o.disputed : o.status === status)) && [o.id, o.serviceName, o.service, o.link, o.providerOrderId || ''].join(' ').toLowerCase().includes(q))) {
    const r = $('orders').insertRow(); cell(r, o.id + '\n' + new Date(o.createdAt).toLocaleString());
    const target = cell(r, o.serviceName + ' (#' + o.service + ')\n'); const a = document.createElement('a');
    try { const url = new URL(o.link); if (['https:', 'http:'].includes(url.protocol)) { a.href = url.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = o.link; target.append(a); } } catch { /* legacy malformed target */ }
    cell(r, o.quantity); cell(r, [o.saleMYR.toFixed(2), (o.actualCostMYR ?? o.costMYR).toFixed(2), (o.saleMYR - (o.actualCostMYR ?? o.costMYR)).toFixed(2)].join(' / '));
    cell(r, o.status + (o.disputed ? '\nDISPUTED' : '') + (o.providerOrderId ? '\nProvider #' + o.providerOrderId : ''));
    const actions = r.insertCell(); button(actions, 'Details / history', () => detail(o.id));
    button(actions, o.disputed ? 'Resolve dispute' : 'Flag dispute', async () => { const note = prompt('Record the reason for this review (10–500 characters):'); if (note) await action(o, 'review', { disputed: !o.disputed, note }); });
    if (o.status === 'pending_payment' || o.paymentReviewRequired) button(actions, 'Confirm payment', async () => {
      const reference = prompt('After independently checking bank receipt, enter the bank transaction reference. Do not enter card or bank account details.'); if (!reference) return;
      if (confirm('I independently verified receipt of RM ' + o.saleMYR.toFixed(2) + ' for order ' + o.id + '. A screenshot or WhatsApp message alone is not proof.')) await action(o, 'confirm-payment', { verified: true, reference, amountMYR: o.saleMYR });
    });
    if (o.status === 'paid' && !o.disputed) button(actions, 'Submit paid order', async () => { if (confirm('Authorize provider spending for order ' + o.id + '?')) await action(o, 'submit', { authorized: true }); });
    if (['submitting', 'reconciliation_required'].includes(o.status)) button(actions, 'Reconcile provider ID', async () => {
      const providerOrderId = prompt('Check the provider account independently. Enter the matching provider order ID. Never guess or resubmit.'); if (!providerOrderId) return;
      const note = prompt('Record how service, target, quantity and submission time were matched (10–500 characters):'); if (note) await action(o, 'reconcile', { providerOrderId, note });
    });
    if (o.providerOrderId) {
      button(actions, 'Sync status', () => action(o, 'status', {}));
      if (o.refill && ['completed', 'partial'].includes(o.status)) { button(actions, 'Request refill', async () => { if (confirm('Request one provider refill? Check history first.')) await action(o, 'refill', { authorized: true }); }); button(actions, 'Refill status', () => action(o, 'refill-status', {})); }
      if (o.cancel && ['submitted', 'partial'].includes(o.status)) button(actions, 'Request cancellation', async () => { if (confirm('Request cancellation? This does not refund the customer.')) await action(o, 'cancel', { authorized: true }); });
    }
  }
  if (!$('orders').rows.length) cell($('orders').insertRow(), 'No matching orders.');
}
async function load() {
  const [list, summary, events] = await Promise.all([api('/api/admin/orders'), api('/api/admin/summary'), api('/api/admin/audit')]); orders = list; renderOrders();
  $('stats').replaceChildren();
  const counts = summary.counts;
  for (const [label, value] of [['Total orders', summary.orders], ['Pending payment', counts.pending_payment || 0], ['Paid · awaiting submission', counts.paid || 0], ['Submitted', counts.submitted || 0], ['Completed', counts.completed || 0], ['Needs attention', ['failed', 'partial', 'cancelled', 'reconciliation_required', 'submitting'].reduce((n, s) => n + (counts[s] || 0), 0)], ['Disputed orders', summary.disputedOrders], ['Sales MYR', summary.revenueMYR.toFixed(2)], ['Provider costs MYR', summary.providerCostsMYR.toFixed(2)], ['Est. profit MYR', summary.estimatedProfitMYR.toFixed(2)]]) {
    const div = document.createElement('div'); div.className = 'stat'; const span = document.createElement('span'); span.textContent = label; const strong = document.createElement('strong'); strong.textContent = value; div.append(span, strong); $('stats').append(div);
  }
  $('balance').textContent = summary.balance ? summary.balance.balance + ' ' + summary.balance.currency + (summary.currencyMismatch ? ' · WARNING: currency differs from pricing settings' : '') : 'Provider unavailable or not configured. Local orders and finances remain available.';
  $('financials').textContent = 'Receipts RM ' + summary.revenueMYR.toFixed(2) + ' · Provider costs RM ' + summary.providerCostsMYR.toFixed(2) + ' · Estimated profit RM ' + summary.estimatedProfitMYR.toFixed(2) + ' · Realized profit RM ' + summary.realizedProfitMYR.toFixed(2);
  audit(events);
}
async function loadSettings() {
  const s = await api('/api/admin/settings'); for (const name of ['fx', 'defaultMarkup', 'providerCurrency', 'whatsapp']) $('settings').elements[name].value = s[name];
  $('connection').textContent = (s.providerConfigured ? 'Provider credential configured. Check balance for live connectivity.' : 'Provider credential missing.') + ' Session: ' + s.sessionHours + ' hours. Account: ' + s.account + '.';
}
function renderServices() {
  if (!catalogue) return; const q = $('serviceSearch').value.toLowerCase(); $('services').replaceChildren();
  for (const s of catalogue.services.filter(s => [s.name, s.service, s.category].join(' ').toLowerCase().includes(q))) {
    const r = $('services').insertRow(), rule = catalogue.pricing[s.service] || {}; cell(r, s.service + '\n' + s.type + (s.supported ? '' : '\nUNSUPPORTED')); cell(r, s.name + '\n' + s.category); cell(r, s.rate + ' ' + catalogue.providerCurrency);
    cell(r, s.estimate ? [s.estimate.costMYR, s.estimate.saleMYR, s.estimate.saleMYR - s.estimate.costMYR].map(n => n.toFixed(2)).join(' / ') : 'Unavailable');
    const markup = document.createElement('input'); markup.type = 'number'; markup.min = '0'; markup.max = '10000'; markup.step = '0.01'; markup.value = rule.markup ?? catalogue.defaultMarkup; markup.setAttribute('aria-label', 'Markup for ' + s.service); r.insertCell().append(markup);
    const fixed = document.createElement('input'); fixed.type = 'number'; fixed.min = '0.01'; fixed.max = '1000000'; fixed.step = '0.01'; fixed.value = rule.sellingRateMYR ?? ''; fixed.placeholder = 'Auto'; fixed.setAttribute('aria-label', 'Fixed MYR rate for ' + s.service); r.insertCell().append(fixed);
    const enabled = document.createElement('input'); enabled.type = 'checkbox'; enabled.checked = rule.enabled !== false; enabled.disabled = !s.supported; enabled.setAttribute('aria-label', 'Enable service ' + s.service); r.insertCell().append(enabled);
    button(r.insertCell(), 'Save', async () => { if (!markup.checkValidity() || !fixed.checkValidity()) throw Error('Check price limits'); await api('/api/admin/pricing/' + s.service, 'PUT', { markup: Number(markup.value), sellingRateMYR: fixed.value === '' ? null : Number(fixed.value), enabled: enabled.checked }); await loadServices(); notify('Service ' + s.service + ' pricing saved.'); });
  }
}
async function loadServices() { catalogue = await api('/api/admin/pricing'); renderServices(); }
function handler(id, event, callback) { $(id).addEventListener(event, async e => { try { await callback(e); } catch (error) { notify(error.message, true); } }); }
$('orderStatus').append(...['pending_payment', 'paid', 'submitting', 'reconciliation_required', 'submitted', 'completed', 'partial', 'cancelled', 'failed', 'disputed'].map(s => { const option = document.createElement('option'); option.value = s; option.textContent = s; return option; }));
handler('login', 'submit', async e => { e.preventDefault(); const credential = $('token').value; $('token').value = ''; const result = await api('/api/session', 'POST', { token: credential }); csrf = result.csrf; signedIn(true); await Promise.all([load(), loadSettings()]); notify('Signed in.'); });
handler('logout', 'click', async () => { await api('/api/admin/logout', 'POST', {}); signedIn(false); notify('Signed out.'); });
handler('refresh', 'click', load); handler('loadServices', 'click', loadServices); handler('orderSearch', 'input', renderOrders); handler('orderStatus', 'change', renderOrders); handler('serviceSearch', 'input', renderServices);
handler('settings', 'submit', async e => { e.preventDefault(); const form = $('settings').elements; await api('/api/admin/settings', 'PUT', { fx: Number(form.fx.value), defaultMarkup: Number(form.defaultMarkup.value), providerCurrency: form.providerCurrency.value, whatsapp: form.whatsapp.value }); catalogue = null; $('services').replaceChildren(); await load(); notify('Settings saved. Reload services to see new prices.'); });
handler('export', 'click', () => { window.location.href = '/api/admin/export.csv'; });
handler('loadTransactions', 'click', async () => { const list = await api('/api/admin/transactions'); $('transactions').replaceChildren(); for (const p of list) { const r = $('transactions').insertRow(); [p.order_id, p.reference, (p.amount_cents / 100).toFixed(2), p.at, p.actor].forEach(v => cell(r, v)); } });
$('closeDetail').onclick = () => $('detail').close();
(async () => { try { const s = await api('/api/session'); csrf = s.csrf; signedIn(true); await Promise.all([load(), loadSettings()]); } catch { signedIn(false); } })();
