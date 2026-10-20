export const TAU = Math.PI * 2;
export const MODES = [
  { id: 'attack', en: 'SCORE ATTACK', name: '得分突击', desc: '一阶，无限重试。唯一敌人是你上一次的分数。', action: '打破最佳', tag: 'PERSONAL BEST' },
  { id: 'trial', en: 'TEN-RUNG TRIAL', name: '闯关试炼', desc: '十阶连攀。共享生命。登上去，或崩盘。', action: '进入试炼', tag: '10 RUNGS' },
  { id: 'life', en: 'ONE LIFE', name: '一命模式', desc: '一次失误即结束。活下来，分数会爆炸。', action: '押上一切', tag: 'NO SECOND CHANCE' },
  { id: 'weekly', en: 'WEEKLY LADDER', name: '每周天梯', desc: '每周一刷新种子。规则相同。打破本机周榜。', action: '夺取排名', tag: 'FIXED SEED' },
  { id: 'ghost', en: 'GHOST DUEL', name: '残影对决', desc: '与个人纪录残影竞速。过去追不上你。', action: '甩开过去', tag: 'BEAT YOURSELF' },
  { id: 'iron', en: 'IRON SEED', name: '钢铁种子', desc: '每天一次固定种子局。提交或放弃。没有仁慈。', action: '接受钢铁局', tag: 'DAILY · ONE SHOT' }
];
export const CONFIG = Object.freeze({ hitsPerRung: 6, attackHits: 8, trialRungs: 10, baseSpeed: 1.45, maxSpeed: 4.5, baseWindow: .52, minWindow: .145, timeout: 5, maxRung: 120 });
export function dateKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function weekKey(date = new Date()) { const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return dateKey(d); }
export function hash(text) { let h = 2166136261; for (const c of String(text)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function seeded(seed) { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = Math.imul(a ^ a >>> 15, a | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function angleDiff(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
export function tier(rung) { return rung <= 10 ? '地基' : rung <= 25 ? '高压' : rung <= 50 ? '碎裂' : rung <= 75 ? '眩晕' : rung <= 100 ? '顶点' : '彼岸'; }
export function recordKey(mode, rung, risk, week = weekKey()) { return `${mode === 'ghost' ? 'attack' : mode}:${mode === 'attack' || mode === 'ghost' ? rung : 1}:${risk}:${mode === 'weekly' ? week : 'all'}`; }
export class Run {
  constructor({ mode = 'attack', rung = 1, risk = 1, seed, date = dateKey(), week = weekKey() } = {}) {
    if (!MODES.some(m => m.id === mode)) throw new Error('Unknown mode');
    this.mode = mode; this.risk = [1, 2, 3].includes(risk) ? risk : 1; this.date = date; this.week = week;
    this.startRung = ['attack', 'ghost'].includes(mode) ? Math.max(1, Math.min(CONFIG.maxRung, Math.floor(rung))) : 1;
    this.rung = this.startRung; this.seed = mode === 'weekly' ? hash('week:' + week) : mode === 'iron' ? hash('iron:' + date) : seed ?? hash(`rung:${this.startRung}`);
    this.random = seeded(this.seed); this.angle = -Math.PI / 2; this.target = 0; this.direction = 1;
    this.elapsed = 0; this.targetTime = 0; this.hits = 0; this.rungHits = 0; this.perfects = 0; this.misses = 0; this.combo = 0; this.maxCombo = 0; this.completed = 0; this.lives = ['life', 'iron'].includes(mode) ? 1 : 3;
    this.parts = { base: 0, time: 0, precision: 0, style: 0, sustain: 0 }; this.events = []; this.trace = []; this.over = false; this.won = false; this.lastMiss = null; this.newTarget();
  }
  get width() { return Math.max(CONFIG.minWindow, CONFIG.baseWindow - (this.rung - 1) * .0038) / Math.sqrt(this.risk); }
  get speed() { return Math.min(CONFIG.maxSpeed, CONFIG.baseSpeed + (this.rung - 1) * .035) * (1 + (this.risk - 1) * .12); }
  get score() { const p = this.parts; return Math.round((p.base + p.time + p.precision) * this.risk + p.style + p.sustain); }
  get accuracy() { return this.hits ? this.trace.filter(e => e.hit).reduce((a, e) => a + e.accuracy, 0) / this.hits : 0; }
  get perfect() { return this.won && this.misses === 0 && this.perfects === this.hits; }
  get grade() { if (!this.hits) return 'D'; const a = this.accuracy; return this.perfect && this.rung >= 76 ? 'V' : a >= .94 && !this.misses ? 'SSS' : a >= .85 && !this.misses ? 'SS' : a >= .72 && this.misses <= 1 ? 'S' : a >= .6 && this.misses <= 2 ? 'A' : a >= .4 ? 'B' : a >= .2 ? 'C' : 'D'; }
  newTarget() { this.target = (this.angle + this.direction * (.8 + this.random() * 3.3) + TAU * 2) % TAU; this.targetTime = 0; }
  tick(dt) {
    if (this.over) return null;
    const step = Math.max(0, Math.min(dt, .1)); this.elapsed += step; this.targetTime += step; this.angle = (this.angle + this.direction * this.speed * step + TAU) % TAU;
    if (this.targetTime >= CONFIG.timeout) return this.miss('timeout');
    return null;
  }
  strike() {
    if (this.over) return null;
    const error = angleDiff(this.angle, this.target), half = this.width / 2;
    if (Math.abs(error) > half + 1e-9) return this.miss(error * this.direction < 0 ? 'early' : 'late');
    const accuracy = Math.max(0, 1 - Math.abs(error) / half), perfect = accuracy >= .85;
    this.hits++; this.rungHits++; this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo); if (perfect) this.perfects++;
    const p = this.parts; p.base += 100; p.time += Math.round(50 * Math.max(0, 1 - this.targetTime / CONFIG.timeout)); p.precision += Math.round(100 * accuracy); p.style += perfect ? 50 : 0; p.sustain += Math.min(100, this.combo * 5);
    const event = { hit: true, perfect, accuracy, error, angle: this.angle, target: this.target, width: this.width, time: this.elapsed, rung: this.rung, score: this.score }; this.trace.push(event);
    const quota = ['attack', 'ghost'].includes(this.mode) ? CONFIG.attackHits : CONFIG.hitsPerRung;
    if (this.rungHits >= quota) {
      this.completed++; event.rungComplete = true;
      if (['attack', 'ghost'].includes(this.mode) || this.mode === 'trial' && this.completed >= CONFIG.trialRungs || this.rung >= CONFIG.maxRung) { this.over = true; this.won = true; }
      else { this.rung++; this.rungHits = 0; if (this.rung % 3 === 0) this.direction *= -1; }
    }
    if (!this.over) this.newTarget(); this.events.push(event); return event;
  }
  miss(reason) {
    if (this.over) return null;
    const event = { hit: false, reason, error: angleDiff(this.angle, this.target), angle: this.angle, target: this.target, width: this.width, direction: this.direction, speed: this.speed, time: this.elapsed, rung: this.rung };
    this.misses++; this.combo = 0; this.lives--; this.lastMiss = event; this.trace.push(event); if (this.lives <= 0) this.over = true; else this.newTarget(); this.events.push(event); return event;
  }
}