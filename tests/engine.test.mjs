import test from 'node:test';
import assert from 'node:assert/strict';
import { Run, recordKey } from '../engine.js';
function auto(run) {
  for (let i = 0; i < 30000 && !run.over; i++) {
    const p = run.player, current = run.platforms[run.checkpoint], next = run.platforms[run.checkpoint + 1];
    const obstacle = current.obstacle && p.z > current.z - .6 ? current : next.obstacle ? next : null;
    const target = obstacle ? run.platformX(obstacle) + obstacle.width * .4 : run.platformX(next);
    run.input = Math.max(-1, Math.min(1, (target - p.x) * 5));
    if (p.grounded && p.z < current.z - current.length / 2 + 1.15) run.jump();
    run.tick(1 / 120);
  }
  return run;
}
test('jump is physical and disallows second jump', () => { const r = new Run(); assert.ok(r.jump()); assert.equal(r.jump(), false); r.tick(.1); assert.ok(r.player.y > 0); assert.ok(r.player.z < .5); });
test('no jump causes fall and respawn', () => { const r = new Run(); for (let i = 0; i < 400 && !r.misses; i++) r.tick(.016); assert.equal(r.misses, 1); assert.equal(r.lives, 2); assert.equal(r.player.grounded, true); });
test('one life ends on fall', () => { const r = new Run({ mode: 'life' }); for (let i = 0; i < 500 && !r.over; i++) r.tick(.016); assert.equal(r.over, true); assert.equal(r.lives, 0); });
test('weekly course is reproducible', () => { assert.deepEqual(new Run({ mode: 'weekly', week: '2026-10-19' }).platforms, new Run({ mode: 'weekly', week: '2026-10-19' }).platforms); });
test('risk narrows platforms and increases speed', () => { const a = new Run(), b = new Run({ risk: 3 }); assert.ok(b.speed > a.speed); assert.ok(b.platforms[1].width < a.platforms[1].width); });
test('eight platforms reachable using actual physics', () => { const r = auto(new Run()); assert.equal(r.won, true, JSON.stringify({ hits: r.hits, misses: r.misses, last: r.lastMiss })); assert.equal(r.hits, 8); assert.ok(r.score > 0); assert.ok(r.frames.length); });
test('trial can be completed using actual physics', () => { const r = auto(new Run({ mode: 'trial' })); assert.ok(r.won, JSON.stringify(r.lastMiss)); assert.equal(r.completed, 10); });
test('moving obstacle costs life', () => { const r = new Run(); r.invincible = 0; const p = r.platforms[3]; r.checkpoint = 3; r.support = 3; r.player = { x: r.platformX(p) + Math.sin(.001 * 2 + p.phase) * p.width * .23, y: p.y, z: p.z, vy: 0, grounded: true }; assert.equal(r.tick(.001)?.reason, 'obstacle'); });
test('3D records separate and ghost shares attack record', () => { assert.ok(recordKey('attack', 1, 1).startsWith('3d:')); assert.equal(recordKey('attack', 1, 1), recordKey('ghost', 1, 1)); });
test('completed runs cannot advance', () => { const r = new Run(); r.over = true; assert.equal(r.tick(.1), null); assert.equal(r.jump(), false); assert.equal(r.elapsed, 0); });
test('late jump within coyote window succeeds once', () => {
  const r = new Run(); r.player.z = -3.59; r.tick(.02);
  assert.equal(r.player.grounded, false); assert.ok(r.coyote > 0);
  assert.equal(r.jump(), true); assert.equal(r.jump(), false);
});
test('jump pressed just before landing is buffered', () => {
  const r = new Run(); r.player.y = .02; r.player.vy = -1; r.player.grounded = false;
  assert.equal(r.jump(), false); r.tick(.06);
  assert.ok(r.player.vy > 0); assert.equal(r.player.grounded, false);
});
test('crystals are collected once and three grant a shield', () => {
  const r = new Run();
  for (const i of [1, 2, 4]) { const p = r.platforms[i]; r.checkpoint = i; r.support = i; r.player = { x: r.platformX(p) + p.gemOffset, y: p.y, z: p.z, vy: 0, grounded: true }; r.tick(.001); r.tick(.001); }
  assert.equal(r.gems, 3); assert.equal(r.shield, true); assert.equal(r.parts.style, 450);
});
test('shield absorbs obstacle and prevents repeated contact damage', () => {
  const r = new Run(); r.shield = true; r.invincible = 0; const p = r.platforms[3]; p.gem = false;
  r.checkpoint = 3; r.support = 3; r.player = { x: r.platformX(p) + Math.sin(.001 * 2 + p.phase) * p.width * .23, y: p.y, z: p.z, vy: 0, grounded: true };
  r.tick(.001); assert.equal(r.shield, false); r.tick(.03); assert.equal(r.lives, 3); assert.equal(r.misses, 0);
});