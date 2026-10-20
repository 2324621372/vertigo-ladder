export const TAU = Math.PI * 2;
export const MODES = [
  { id: 'attack', en: 'SCORE ATTACK', name: '得分突击', desc: '一阶，无限重试。唯一敌人是你上一次的分数。', action: '打破最佳', tag: 'PERSONAL BEST' },
  { id: 'trial', en: 'TEN-RUNG TRIAL', name: '闯关试炼', desc: '十阶连攀。共享生命。登上去，或崩盘。', action: '进入试炼', tag: '10 RUNGS' },
  { id: 'life', en: 'ONE LIFE', name: '一命模式', desc: '一次失误即结束。活下来，分数会爆炸。', action: '押上一切', tag: 'NO SECOND CHANCE' },
  { id: 'weekly', en: 'WEEKLY LADDER', name: '每周天梯', desc: '每周一刷新种子。规则相同。打破本机周榜。', action: '夺取排名', tag: 'FIXED SEED' },
  { id: 'ghost', en: 'GHOST DUEL', name: '残影对决', desc: '与个人纪录残影竞速。过去追不上你。', action: '甩开过去', tag: 'BEAT YOURSELF' },
  { id: 'iron', en: 'IRON SEED', name: '钢铁种子', desc: '每天一次固定种子局。提交或放弃。没有仁慈。', action: '接受钢铁局', tag: 'DAILY · ONE SHOT' }
];
export const CONFIG = Object.freeze({ maxRung: 120, gravity: 23, jumpVelocity: 8.6, playerRadius: .22, timeout: 99 });
export function dateKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function weekKey(date = new Date()) { const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return dateKey(d); }
export function hash(text) { let h = 2166136261; for (const c of String(text)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function seeded(seed) { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = Math.imul(a ^ a >>> 15, a | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function tier(rung) { return rung <= 10 ? '地基' : rung <= 25 ? '高压' : rung <= 50 ? '碎裂' : rung <= 75 ? '眩晕' : rung <= 100 ? '顶点' : '彼岸'; }
export function recordKey(mode, rung, risk, week = weekKey()) { return `3d:${mode === 'ghost' ? 'attack' : mode}:${['attack', 'ghost'].includes(mode) ? rung : 1}:${risk}:${mode === 'weekly' ? week : 'all'}`; }
export class Run {
  constructor({ mode = 'attack', rung = 1, risk = 1, seed, date = dateKey(), week = weekKey() } = {}) {
    if (!MODES.some(m => m.id === mode)) throw new Error('Unknown mode');
    this.mode = mode; this.risk = [1, 2, 3].includes(risk) ? risk : 1; this.date = date; this.week = week;
    this.startRung = ['attack', 'ghost'].includes(mode) ? Math.max(1, Math.min(120, Math.floor(rung) || 1)) : 1;
    this.rung = this.startRung; this.seed = mode === 'weekly' ? hash('week:' + week) : mode === 'iron' ? hash('iron:' + date) : seed ?? hash('3d:' + this.startRung);
    this.random = seeded(this.seed); this.total = ['attack', 'ghost'].includes(mode) ? 8 : mode === 'trial' ? 10 : 120;
    this.platforms = [{ index: 0, x: 0, y: 0, z: 0, width: 4.2, length: 7, motion: 0, phase: 0, obstacle: false }];
    for (let i = 1; i <= this.total + 3; i++) {
      const prev = this.platforms.at(-1), difficulty = Math.min(1, (this.startRung + i - 2) / 100);
      this.platforms.push({ index: i, x: Math.max(-2.3, Math.min(2.3, prev.x + (this.random() - .5) * 1.7)), y: i * .42, z: prev.z - 6.4, width: Math.max(1.55, 3.5 - difficulty - (this.risk - 1) * .35), length: 4.8, motion: i > 3 && i % 4 === 0 ? .35 + difficulty * .25 : 0, phase: this.random() * Math.PI * 2, obstacle: i > 2 && i % 3 === 0 });
    }
    this.elapsed = 0; this.targetTime = 0; this.hits = 0; this.rungHits = 0; this.perfects = 0; this.misses = 0; this.combo = 0; this.maxCombo = 0; this.completed = 0; this.lives = ['life', 'iron'].includes(mode) ? 1 : 3;
    this.gems = 0; this.shield = false; this.jumpBuffer = 0; this.coyote = 0; this.invincible = 0;
    this.parts = { base: 0, time: 0, precision: 0, style: 0, sustain: 0 }; this.trace = []; this.frames = []; this.events = []; this.lastMiss = null; this.over = false; this.won = false; this.checkpoint = 0; this.input = 0; this.sampleTime = 0; this.resetPlayer();
    for (const p of this.platforms) { p.gem = p.index > 0 && p.index <= this.total; p.gemOffset = p.obstacle ? -p.width * .3 : p.index % 2 ? p.width * .22 : -p.width * .22; }
  }
  platformX(p) { return p.x + Math.sin(this.elapsed * 1.4 + p.phase) * p.motion; }
  resetPlayer() { const p = this.platforms[this.checkpoint]; this.player = { x: this.platformX(p), y: p.y, z: p.z + .5, vy: 0, grounded: true }; this.support = p.index; this.input = 0; this.jumpBuffer = 0; this.coyote = 0; this.invincible = 1; }
  get speed() { return 5.3 + (this.risk - 1) * .5 + Math.min(1.2, (this.startRung + this.hits - 1) * .012); }
  get score() { const p = this.parts; return Math.round((p.base + p.time + p.precision) * this.risk + p.style + p.sustain); }
  get accuracy() { return this.hits ? this.trace.filter(e => e.hit).reduce((n, e) => n + e.accuracy, 0) / this.hits : 0; }
  get perfect() { return this.won && !this.misses && this.perfects === this.hits; }
  get grade() { const a = this.accuracy; return !this.hits ? 'D' : this.perfect && this.startRung >= 76 ? 'V' : a >= .94 && !this.misses ? 'SSS' : a >= .85 && !this.misses ? 'SS' : a >= .72 && this.misses <= 1 ? 'S' : a >= .6 ? 'A' : a >= .4 ? 'B' : 'C'; }
  jump() { if (this.over) return false; if (!this.player.grounded && this.coyote <= 0) { this.jumpBuffer = .14; return false; } this.jumpBuffer = 0; this.coyote = 0; this.player.vy = CONFIG.jumpVelocity; this.player.grounded = false; this.support = -1; return true; }
  tick(dt) {
    if (this.over) return null;
    // Fixed substeps prevent tunnelling through narrow platforms at low frame rates.
    let event = null, remaining = Math.min(.1, Math.max(0, dt));
    while (remaining > 1e-8 && !event && !this.over) { const step = Math.min(1 / 120, remaining); event = this.step(step); remaining -= step; }
    return event;
  }
  step(dt) {
    this.elapsed += dt; this.targetTime += dt; const p = this.player, oldY = p.y;
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt); this.coyote = Math.max(0, this.coyote - dt); this.invincible = Math.max(0, this.invincible - dt);
    if (p.grounded && this.jumpBuffer > 0) this.jump();
    p.x += Math.max(-1, Math.min(1, this.input)) * 4.8 * dt; p.z -= this.speed * dt;
    if (p.grounded) { const support = this.platforms[this.support]; if (!support || Math.abs(p.x - this.platformX(support)) > support.width / 2 + .1 || Math.abs(p.z - support.z) > support.length / 2 + .1) { p.grounded = false; p.vy = 0; this.coyote = .1; } }
    if (!p.grounded) { p.vy -= CONFIG.gravity * dt; p.y += p.vy * dt;
      if (p.vy <= 0) for (const platform of this.platforms) { if (platform.index < this.checkpoint) continue; if (oldY >= platform.y - .02 && p.y <= platform.y && Math.abs(p.x - this.platformX(platform)) <= platform.width / 2 && Math.abs(p.z - platform.z) <= platform.length / 2) { p.y = platform.y; p.vy = 0; p.grounded = true; this.support = platform.index; if (platform.index > this.checkpoint) return this.land(platform); break; } }
    }
    for (const platform of this.platforms) {
      if (platform.gem && Math.abs(p.z - platform.z) < .65 && Math.abs(p.y - platform.y) < 1.6 && Math.abs(p.x - this.platformX(platform) - platform.gemOffset) < .65) {
        platform.gem = false; this.gems++; this.parts.style += 150; if (this.gems % 3 === 0) this.shield = true;
        this.events.push({ type: 'gem', shield: this.gems % 3 === 0 });
      }
      if (!platform.obstacle || this.invincible > 0 || Math.abs(p.z - platform.z) > .45 || Math.abs(p.y - platform.y) > .65) continue;
      const ox = this.platformX(platform) + Math.sin(this.elapsed * 2 + platform.phase) * platform.width * .23;
      if (Math.abs(p.x - ox) < .48) { if (this.shield) { this.shield = false; this.invincible = 1; this.events.push({ type: 'shield' }); } else return this.miss('obstacle'); }
    }
    const floor = this.platforms[this.checkpoint].y;
    if (p.y < floor - 5 || Math.abs(p.x) > 9) return this.miss('fall');
    this.sampleTime += dt; if (this.sampleTime >= .08) { this.sampleTime = 0; this.frames.push({ time: this.elapsed, x: p.x, y: p.y, z: p.z }); }
    return null;
  }
  land(platform) {
    const error = this.player.x - this.platformX(platform), accuracy = Math.max(0, 1 - Math.abs(error) / (platform.width / 2)), perfect = accuracy >= .85;
    this.checkpoint = platform.index; this.hits++; this.completed++; this.rungHits = this.hits; this.combo++; this.maxCombo = Math.max(this.combo, this.maxCombo); if (perfect) this.perfects++;
    this.rung = this.startRung + this.hits - 1; const p = this.parts; p.base += 100; p.time += Math.round(Math.max(0, 100 - this.targetTime * 20)); p.precision += Math.round(100 * accuracy); p.style += perfect ? 50 : 0; p.sustain += Math.min(100, this.combo * 5);
    const event = { hit: true, perfect, accuracy, error, x: this.player.x, y: this.player.y, z: this.player.z, target: this.platformX(platform), width: platform.width, time: this.elapsed, rung: this.rung, rungComplete: true, score: this.score };
    this.trace.push(event); this.targetTime = 0; if (this.completed >= this.total) { this.over = true; this.won = true; } return event;
  }
  miss(reason) { if (this.over) return null; const p = this.platforms[Math.min(this.checkpoint + 1, this.platforms.length - 1)]; const event = { hit: false, reason, error: this.player.x - this.platformX(p), target: this.platformX(p), width: p.width, x: this.player.x, y: this.player.y, z: this.player.z, time: this.elapsed, rung: this.rung }; this.misses++; this.combo = 0; this.lives--; this.lastMiss = event; this.trace.push(event); if (this.lives <= 0) this.over = true; else this.resetPlayer(); this.targetTime = 0; return event; }
}
