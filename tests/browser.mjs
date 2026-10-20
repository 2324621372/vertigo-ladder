import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
const base = process.env.TEST_URL || 'http://127.0.0.1:4174/';
const server = process.env.TEST_URL ? null : spawn(process.execPath, ['scripts/serve.mjs'], { stdio: 'ignore' });
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, ...(process.env.TEST_PROXY ? { proxy: { server: process.env.TEST_PROXY } } : {}), args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    await page.route('**/engine.js', async route => { const res = await route.fetch(); await route.fulfill({ response: res, body: (await res.text()).replace('this.mode = mode;', 'window.__testRun = this; this.mode = mode;') }); });
    await page.goto(base); await page.locator('#quick-start').waitFor();
    await page.waitForFunction(() => document.querySelector('#preview-3d').dataset.renderer === 'webgl-3d');
    if (!mobile) { await page.locator('#fullscreen').click(); await page.waitForFunction(() => Boolean(document.fullscreenElement)); await page.locator('#fullscreen').click(); await page.waitForFunction(() => !document.fullscreenElement); }
    await page.screenshot({ path: `test-results/3d-home-${mobile ? 'mobile' : 'desktop'}.png`, fullPage: true });
    await page.locator('#how').click(); assert.match(await page.locator('#modal-content').innerText(), /3D PARKOUR/); await page.locator('#close-modal').click();
    await page.locator('#quick-start').click(); await page.locator('#begin').click(); await page.waitForTimeout(2000);
    assert.equal(await page.locator('#arena').getAttribute('data-renderer'), 'webgl-3d');
    assert.ok(await page.evaluate(() => { const r = document.querySelector('#arena').getBoundingClientRect(); return Math.abs(r.width - innerWidth) < 2 && Math.abs(r.height - innerHeight) < 2; }), '3D canvas must fill the viewport');
    await page.locator('#strike').click(); assert.ok(await page.evaluate(() => !window.__testRun.player.grounded));
    await page.locator('#pause').click(); const t = await page.evaluate(() => window.__testRun.elapsed); await page.waitForTimeout(200); assert.equal(await page.evaluate(() => window.__testRun.elapsed), t);
    await page.locator('#resume').click();
    if (mobile) { await page.setViewportSize({ width: 844, height: 390 }); assert.ok(await page.evaluate(() => { const r = document.querySelector('#strike').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })); await page.setViewportSize({ width: 390, height: 844 }); }
    await page.screenshot({ path: `test-results/3d-game-${mobile ? 'mobile' : 'desktop'}.png`, fullPage: true });
    await page.locator('#pause').click(); await page.locator('#quit').click(); await page.locator('#retry').waitFor(); await page.locator('#return').click();
    await page.locator('[data-mode="life"]').click(); await page.locator('#begin').click(); await page.waitForTimeout(7000); await page.locator('#retry').waitFor({ timeout: 10000 });
    assert.equal(await page.evaluate(() => window.__testRun.lives), 0); await page.locator('#replay').click(); assert.match(await page.locator('#modal-content').innerText(), /INPUT ANALYSIS/);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); assert.deepEqual(errors, []); console.log(`${mobile ? 'Mobile' : 'Desktop'} 3D browser check passed`); await context.close();
  }
} finally { await browser.close(); server?.kill(); }