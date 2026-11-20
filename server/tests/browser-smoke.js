import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

// Start node server/tests/preview.js separately. This runner refuses remote targets.
const base = process.env.BOOSTER_QA_URL || 'http://127.0.0.1:3000';
assert.equal(new URL(base).hostname, '127.0.0.1');
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', message => { if (message.type() === 'error' && /Content Security Policy|Refused to/.test(message.text())) errors.push(message.text()); });
await mkdir('artifacts/qa', { recursive: true });
try {
  await page.goto(base + '/admin/booster');
  await page.locator('#token').fill('fixture-credential-with-at-least-32-characters');
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await page.locator('#stats .stat').first().waitFor();
  assert.equal(await page.locator('#orders tr').count(), 3);
  assert.ok((await page.locator('#balance').innerText()).includes('124.70 USD'));
  await page.getByRole('button', { name: 'Load live catalogue' }).click();
  await page.locator('#services tr').first().waitFor();
  assert.equal(await page.locator('#services tr').count(), 3);
  await page.locator('#serviceSearch').fill('TikTok');
  assert.equal(await page.locator('#services tr').count(), 1);
  await page.locator('#serviceSearch').fill('');
  await page.getByRole('button', { name: 'Load payment transactions' }).click();
  await page.locator('#transactions tr').first().waitFor();
  assert.equal(await page.locator('#transactions tr').count(), 2);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: 'artifacts/qa/admin-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile dashboard overflows viewport');
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: 'artifacts/qa/admin-mobile.png', fullPage: true });
  await page.locator('#orders button').filter({ hasText: 'Details / history' }).first().click();
  await page.locator('#detail[open]').waitFor();
  assert.ok((await page.locator('#detailText').innerText()).includes('checkout_created'));
  await page.locator('#closeDetail').click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.locator('#loginPanel').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#orders tr').count(), 0);
  await page.goto(base + '/booster/');
  await page.locator('#smm-panel').getByRole('button', { name: 'Select Package' }).first().waitFor();
  await page.locator('#smm-panel').getByRole('button', { name: 'Select Package' }).first().click();
  await page.locator('input[type=url]').fill('https://instagram.com/visual-qa');
  await page.locator('input[type=number]').fill('1000');
  // Verify the request and durable quote, but do not open WhatsApp during automated QA.
  await page.route('**/api/checkout', async route => {
    const response = await route.fetch(); const result = await response.json();
    assert.equal(response.status(), 201); assert.equal(result.amountMYR, 11.63);
    assert.ok(result.whatsappUrl.startsWith('https://wa.me/60189451570?text='));
    await route.fulfill({ response, json: { ...result, whatsappUrl: '/booster/?fixture-handoff=ok' } });
  });
  await page.getByRole('button', { name: /Tempah melalui WhatsApp/ }).click();
  await page.waitForURL('**/booster/?fixture-handoff=ok');
  await page.screenshot({ path: 'artifacts/qa/customer-mobile.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('Browser smoke passed: sign-in, overview, orders, catalogue search, transactions, details, logout, responsive layout, customer checkout and mock WhatsApp handoff.');
} catch (error) { await page.screenshot({ path: 'artifacts/qa/browser-failure.png', fullPage: true }).catch(() => {}); console.error('Browser state:', await page.locator('#notice').textContent().catch(() => ''), errors); throw error; } finally { await browser.close(); }
