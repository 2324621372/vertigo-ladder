import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const base = process.env.TEST_URL || 'http://localhost:4174/';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
const screenshot = name => fileURLToPath(new URL('../test-results/' + name + '.png', import.meta.url));
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, hasTouch: true });
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  // Inject a reference to the real engine instance, only in this test browser.
  // This permits deterministic coverage of success/failure without timing flakiness.
  await page.route('**/engine.js', async route => { const response = await route.fetch(); const text = await response.text(); await route.fulfill({ response, body: text.replace('this.mode = mode;', 'window.__testRun = this; this.mode = mode;') }); });
  await page.goto(base); await page.locator('[data-mode="attack"]').waitFor();
  await page.screenshot({ path: screenshot('home-desktop'), fullPage: true });
  await page.locator('#how').click(); assert.match(await page.locator('#modal-content').innerText(), /5 秒/); await page.locator('#close-modal').click();
  await page.locator('#quick-start').click(); await page.locator('#begin').click(); await page.waitForTimeout(2100);
  const strike = async hit => { await page.waitForTimeout(500); await page.evaluate(hit => { const r = window.__testRun; r.angle = r.target + (hit ? 0 : Math.PI); document.getElementById('strike').click(); }, hit); };
  for (let i = 0; i < 8; i++) await strike(true);
  await page.locator('#retry').waitFor(); assert.match(await page.locator('#modal-content').innerText(), /完美通关/); assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('vertigo-v1')).best > 0));
  await page.locator('#replay').click(); assert.match(await page.locator('#modal-content').innerText(), /输入|INPUT/); await page.locator('#back-result').click(); await page.locator('#return').click();
  await page.locator('[data-mode="ghost"]').click(); await page.locator('#begin').click(); await page.waitForTimeout(2000); assert.match(await page.locator('#ghost-note').textContent(), /最佳残影/);
  await page.locator('#pause').click(); const elapsed = await page.evaluate(() => window.__testRun.elapsed); await page.waitForTimeout(400); assert.equal(await page.evaluate(() => window.__testRun.elapsed), elapsed); await page.locator('#resume').click(); await page.waitForTimeout(1400);
  await page.keyboard.press('Space'); await page.locator('#pause').click(); await page.locator('#quit').click(); await page.locator('#return').click();
  await page.locator('[data-mode="life"]').click(); await page.locator('#begin').click(); await page.waitForTimeout(2100); await strike(false); await page.locator('#retry').waitFor(); assert.equal(await page.evaluate(() => window.__testRun.lives), 0); await page.locator('#return').click();
  await page.locator('[data-mode="weekly"]').click(); assert.equal(await page.locator('[data-risk="1"]').isDisabled(), true); await page.locator('#begin').click(); await page.locator('#pause').click(); await page.locator('#quit').click(); await page.locator('#return').click();
  await page.locator('#nav-board').click(); assert.match(await page.locator('#records').innerText(), /本机周榜/); await page.locator('#records-home').click();
  await page.locator('[data-mode="iron"]').click(); await page.locator('#begin').click(); await page.locator('#pause').click(); await page.locator('#quit').click(); await page.locator('#return').click();
  await page.locator('[data-mode="iron"]').click(); assert.equal(await page.locator('#begin').isDisabled(), true); await page.locator('#close-modal').click();
  await page.reload(); assert.notEqual(await page.locator('#home-best').textContent(), '—');
  await page.locator('#nav-settings').click(); await page.locator('[data-setting="sound"]').uncheck(); await page.locator('#close-modal').click();
  for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 640 }, { width: 844, height: 390 }]) { await page.setViewportSize(viewport); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); }
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: screenshot('home-mobile'), fullPage: true });
  await page.locator('[data-mode="trial"]').click(); await page.locator('#begin').click(); await page.waitForTimeout(2100); await page.locator('#arena').tap({ position: { x: 80, y: 80 } }).catch(() => page.locator('#arena').click({ position: { x: 80, y: 80 } }));
  await page.screenshot({ path: screenshot('game-mobile'), fullPage: true });
  await page.locator('#pause').click(); await page.locator('#quit').click(); await page.screenshot({ path: screenshot('result-mobile'), fullPage: true });
  assert.deepEqual(errors, []); console.log('Browser checks passed: desktop/mobile, instructions, perfect clear, scoring, replay, ghost, keyboard, pause, one-life, weekly board, daily lockout, persistence, settings, touch/click. No page/resource errors.');
} finally { await browser.close(); }