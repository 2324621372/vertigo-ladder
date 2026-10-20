import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const base = process.env.TEST_URL || 'http://127.0.0.1:4174/public/';
const server = process.env.TEST_URL ? null : spawn(process.execPath, ['scripts/serve.mjs'], { stdio: 'ignore' });
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, ...(process.env.TEST_PROXY ? { proxy: { server: process.env.TEST_PROXY } } : {}), args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const kind of ['desktop', 'mobile', ...(process.env.TEST_URL ? [] : ['file'])]) {
    const mobile = kind === 'mobile';
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage(), errors = [], resources = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    page.on('request', r => { if (!r.isNavigationRequest() && !r.url().startsWith('data:')) resources.push(r.url()); });
    const url = kind === 'file' ? pathToFileURL(resolve('public/index.html')).href : new URL('index.html', base).href;
    await page.goto(url);
    await page.waitForFunction(() => document.body.dataset.screen === 'play' && document.querySelector('#arena').dataset.renderer === 'webgl-3d');
    assert.equal(await page.locator('#modal').evaluate(el => el.open), false);
    assert.equal(await page.locator('#home').count(), 0);
    await page.waitForFunction(() => parseFloat(document.querySelector('#timer').textContent) > .1);
    assert.ok(await page.evaluate(() => { const r = document.querySelector('#arena').getBoundingClientRect(); return Math.abs(r.width - innerWidth) < 2 && Math.abs(r.height - innerHeight) < 2; }));
    if (mobile) {
      assert.ok(await page.locator('#strike').evaluate(el => typeof el.ontouchstart === 'function'));
      const cdp = await context.newCDPSession(page);
      const center = async id => { const b = await page.locator(id).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
      const left = await center('#move-left'), jump = await center('#strike');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...left, id: 0 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...left, id: 0 }, { ...jump, id: 1 }] });
      await page.waitForTimeout(120);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      // Attaching CDP can blur the window and trigger the game's automatic pause.
      if (!await page.locator('#modal').evaluate(el => el.open)) await page.locator('#pause').tap();
    } else { await page.keyboard.press('Space'); await page.locator('#pause').click(); }
    await page.locator('#resume').waitFor();
    const timer = await page.locator('#timer').innerText(); await page.waitForTimeout(150); assert.equal(await page.locator('#timer').innerText(), timer);
    if (mobile) await page.locator('#resume').tap(); else await page.locator('#resume').click();
    assert.equal(await page.locator('#modal').evaluate(el => el.open), false);
    await page.screenshot({ path: `test-results/single-${kind}.png` });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []); assert.deepEqual(resources, [], 'Game must make no external resource requests');
    console.log(`${kind}: auto start, 3D, controls, pause, zero external resources passed`);
    await context.close();
  }
} finally { await browser.close(); server?.kill(); }