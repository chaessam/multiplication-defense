/* 구구단 디펜스 - 게임 로직 */
(() => {
  'use strict';

  // ================= 데이터 =================
  const H = 560;
  const COLS = 8;
  const ROWS_Y = [130, 195, 425, 490];
  const REF_LEN = 700;      // 이동 속도 기준 거리(화면 폭이 달라도 도착 시간이 같도록)
  const BASE_SPEED = 30;    // px/s (기준 거리 기준)
  const SAVE_KEY = 'gugudan-defense-save-v1';
  const BEST_KEY = 'gugudan-defense-best';
  const SOUND_KEY = 'gugudan-defense-muted';

  const TOWERS = {
    archer: { name: '궁수탑', cost: 60, range: 190, rate: 1.15, dmg: 14, desc: '빠르게 화살을 쏘는 기본 탑' },
    cannon: { name: '대포', cost: 110, range: 215, rate: 0.42, dmg: 40, splash: 62, desc: '느리지만 폭발로 여러 적을 공격' },
    mage:   { name: '서리 마법탑', cost: 90, range: 175, rate: 0.85, dmg: 9, slow: 0.45, slowT: 2.0, desc: '적을 느리게 만드는 얼음 마법' },
  };

  const ENEMIES = {
    goblin:  { name: '고블린', hp: 22, speed: 1.4, size: 0.85, dmg: 4, gems: 1, probs: 1 },
    soldier: { name: '병사', hp: 40, speed: 1.0, size: 1.0, dmg: 6, gems: 1, probs: 1 },
    knight:  { name: '기사', hp: 95, speed: 0.8, size: 1.1, dmg: 10, gems: 2, probs: 1 },
    ogre:    { name: '오우거', hp: 260, speed: 0.62, size: 1.6, dmg: 16, gems: 4, probs: 2 },
    troll:   { name: '트롤', hp: 380, speed: 0.58, size: 1.75, dmg: 20, gems: 5, probs: 3 },
    orcking: { name: '오크 대족장', hp: 1100, speed: 0.6, size: 2.1, dmg: 40, gems: 20, probs: 5, boss: true },
    dragon:  { name: '붉은 드래곤', hp: 1700, speed: 0.65, size: 1.7, dmg: 55, gems: 30, probs: 6, boss: true, fly: true },
    lich:    { name: '해골 마왕', hp: 2400, speed: 0.58, size: 2.0, dmg: 70, gems: 40, probs: 7, boss: true, float: true },
  };
  const BOSS_ORDER = ['orcking', 'dragon', 'lich'];

  const UPGRADES = {
    castle: { name: '성벽 강화', icon: '🏰', base: 60, growth: 1.4, max: 20, desc: l => `최대 체력 +25 (지금 ${castleMax(l)})` },
    archer: { name: '궁수 공격력', icon: '🏹', base: 70, growth: 1.45, max: 15, desc: l => `궁수탑 피해 +25% (지금 +${l * 25}%)` },
    cannon: { name: '대포 공격력', icon: '💣', base: 90, growth: 1.45, max: 15, desc: l => `대포 피해 +25% (지금 +${l * 25}%)` },
    mage:   { name: '마법 위력', icon: '🔮', base: 80, growth: 1.45, max: 15, desc: l => `마법탑 피해 +25%, 둔화 시간 증가 (지금 +${l * 25}%)` },
    speed:  { name: '공격 속도', icon: '⚡', base: 100, growth: 1.55, max: 10, desc: l => `모든 탑 공격 속도 +10% (지금 +${l * 10}%)` },
    bounty: { name: '현상금', icon: '💰', base: 80, growth: 1.5, max: 10, desc: l => `정답 골드 +15% (지금 +${l * 15}%)` },
  };

  const SKILLS = {
    repair: { name: '성 수리', cost: 8, desc: '성 체력 30% 회복' },
    freeze: { name: '얼음 폭풍', cost: 12, desc: '모든 적 4초 동안 얼림' },
    meteor: { name: '유성 낙하', cost: 20, desc: '모든 적에게 큰 피해' },
  };

  function castleMax(lvl) { return 100 + 25 * lvl; }
  function upCost(key, lvl) { const u = UPGRADES[key]; return Math.round(u.base * Math.pow(u.growth, lvl)); }

  // ================= 상태 =================
  const S = {
    mode: 'title', // title | prep | wave | over
    paused: false,
    wave: 1, gold: 0, gems: 0,
    castleHp: 100,
    up: { castle: 0, archer: 0, cannon: 0, mage: 0, speed: 0, bounty: 0 },
    towers: [],
    enemies: [], projectiles: [], effects: [], particles: [], floaters: [],
    queue: [], spawnT: 0,
    input: '', combo: 0, bestCombo: 0,
    freezeT: 0, shake: 0, castleFlash: 0,
    fast: false,
    stats: { kills: 0, correct: 0, wrong: 0 },
    time: 0,
  };

  // ================= 캔버스 / 레이아웃 =================
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const wrap = document.getElementById('stageWrap');
  const bg = document.createElement('canvas');
  const bgc = bg.getContext('2d');
  const L = { W: 900, H, castleX: 750, roadTop: 245, roadBot: 375, roadMid: 310, startX: -30, slots: [], slotSize: 56 };
  let k = 1; // 논리 좌표 -> 실제 픽셀

  function computeLayout(W) {
    L.W = W; L.castleX = W - 150;
    const left = 45, right = L.castleX - 50;
    const sp = (right - left) / (COLS - 1);
    L.slotSize = Math.min(60, sp - 6);
    L.slots = [];
    ROWS_Y.forEach((y, r) => { for (let c = 0; c < COLS; c++) L.slots.push({ row: r, col: c, x: left + c * sp, y }); });
  }

  function resize() {
    const ww = wrap.clientWidth - 10, wh = wrap.clientHeight - 10;
    if (ww <= 0 || wh <= 0) return;
    const W = Math.round(Math.max(680, Math.min(1000, H * ww / wh)));
    const scale = Math.min(ww / W, wh / H);
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.style.width = Math.floor(W * scale) + 'px';
    canvas.style.height = Math.floor(H * scale) + 'px';
    k = scale * dpr;
    canvas.width = Math.round(W * k); canvas.height = Math.round(H * k);
    bg.width = canvas.width; bg.height = canvas.height;
    computeLayout(W);
    bgc.setTransform(k, 0, 0, k, 0, 0);
    Art.drawBackground(bgc, L);
  }
  window.addEventListener('resize', () => requestAnimationFrame(resize));
  window.addEventListener('orientationchange', () => setTimeout(resize, 250));

  const slotOf = (row, col) => L.slots[row * COLS + col];
  const towerAt = (row, col) => S.towers.find(t => t.row === row && t.col === col);

  // ================= 문제 =================
  function danRange(w) {
    if (w >= 9) return [2, 9];
    const max = Math.min(9, w + 1);
    return [Math.max(2, max - 3), max];
  }
  function makeProblem(isBoss) {
    const [lo, hi] = danRange(S.wave);
    for (let tries = 0; tries < 12; tries++) {
      let a;
      if (isBoss) a = randInt(Math.max(lo, Math.ceil((lo + hi) / 2)), hi);
      else if (S.wave >= 9 && Math.random() < 0.35) a = randInt(6, 9);
      else a = randInt(lo, hi);
      const b = S.wave <= 3 ? randInt(1, 9) : randInt(2, 9);
      const dup = S.enemies.some(e => e.q && e.q.a === a && e.q.b === b);
      if (!dup || tries === 11) return { a, b, ans: a * b };
    }
  }
  const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

  // ================= 웨이브 구성 =================
  function buildWave(w) {
    const list = [];
    const n = Math.min(6 + Math.floor(w * 1.6), 42);
    const weights = {
      goblin: w >= 3 ? 2 : 0,
      soldier: 5,
      knight: w >= 4 ? 1 + w * 0.15 : 0,
      ogre: w >= 6 ? 0.5 + w * 0.05 : 0,
      troll: w >= 9 ? 0.4 + w * 0.04 : 0,
    };
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    for (let i = 0; i < n; i++) {
      let r = Math.random() * total, type = 'soldier';
      for (const [t, wt] of Object.entries(weights)) { if ((r -= wt) < 0) { type = t; break; } }
      list.push(type);
    }
    // 처음 몇 마리는 약한 적
    for (let i = 0; i < Math.min(3, list.length); i++) if (ENEMIES[list[i]].probs > 1) list[i] = 'soldier';
    if (w % 5 === 0) list.push(BOSS_ORDER[(w / 5 - 1) % BOSS_ORDER.length]);
    const interval = Math.max(0.8, 2.5 - w * 0.08);
    return list.map((type, i) => ({ type, delay: i === 0 ? 1.2 : interval + (ENEMIES[type].probs > 1 ? 1.2 : 0) + (ENEMIES[type].boss ? 2.5 : 0) }));
  }

  function wavePreview(w) {
    const q = buildWave(w);
    const counts = {};
    q.forEach(x => { if (!ENEMIES[x.type].boss) counts[x.type] = (counts[x.type] || 0) + 1; });
    const [lo, hi] = danRange(w);
    const dan = lo === hi ? `${lo}단` : `${lo}~${hi}단`;
    const order = ['goblin', 'soldier', 'knight', 'ogre', 'troll'];
    const kinds = order.filter(t => counts[t]).map(t => ENEMIES[t].name).join(' · ');
    const boss = q.find(x => ENEMIES[x.type].boss);
    return { dan, kinds, boss: boss ? ENEMIES[boss.type].name : null, total: q.length };
  }

  // ================= 적 =================
  function hpMul(w) { return 1 + 0.18 * (w - 1) + 0.012 * (w - 1) * (w - 1); }
  function spdMul(w) { return Math.min(2.0, 1 + 0.035 * (w - 1)); }

  function spawnEnemy(type) {
    const def = ENEMIES[type];
    const lane = def.probs > 1 ? (Math.random() < 0.5 ? -0.4 : 0.4) * (def.boss ? 0 : 1) : randInt(-1, 1);
    const maxHp = Math.round(def.hp * hpMul(S.wave));
    const e = {
      type, def,
      t: 0, x: L.startX, y: L.roadMid + lane * 36 + (Math.random() - 0.5) * 8,
      hp: maxHp, maxHp, probsLeft: def.probs,
      speed: BASE_SPEED * def.speed * spdMul(S.wave) * (0.92 + Math.random() * 0.16),
      phase: Math.random() * 6, hitT: 0, slowT: 0, slowMul: 1, frozen: 0,
      q: null,
    };
    e.q = makeProblem(def.boss);
    S.enemies.push(e);
    if (def.boss) {
      showBanner(`⚠ 보스 등장: ${def.name}!`, 'boss', 2600);
      Sound.play('boss');
      Sound.setIntensity(2);
    }
  }

  function enemyCenter(e) {
    const s = e.def.size;
    return { x: e.x, y: e.y - (e.def.fly ? 28 + 10 * s : 20 * s) };
  }

  function syncProbs(e) {
    const per = e.maxHp / e.def.probs;
    e.probsLeft = Math.max(1, Math.ceil(e.hp / per - 1e-6));
  }

  function damage(e, amt) {
    if (e.dead) return;
    e.hp -= amt;
    e.hitT = 0.08;
    if (e.hp <= 0) kill(e);
    else if (e.def.probs > 1) syncProbs(e);
  }

  function kill(e) {
    if (e.dead) return;
    e.dead = true;
    S.gems += e.def.gems;
    S.stats.kills++;
    const c = enemyCenter(e);
    floater(c.x, c.y - 10, `+${e.def.gems}💎`, '#9fe6ff', e.def.boss ? 26 : 18);
    burst(c.x, c.y, e.def.boss ? 40 : 14, ['#d8d0c0', '#8a7f6e', '#f0c050'], e.def.boss ? 4 : 2);
    Sound.play('die');
    setTimeout(() => Sound.play('gem'), 120);
    if (e.def.boss) {
      showBanner(`🏆 ${e.def.name} 처치!`, 'good', 2200);
      S.shake = 10;
      Sound.play('boom');
      Sound.setIntensity(1);
    }
  }

  // ================= 탑 =================
  function towerStats(type) {
    const d = TOWERS[type];
    const lvl = S.up[type];
    return {
      dmg: d.dmg * (1 + 0.25 * lvl),
      rate: d.rate * (1 + 0.1 * S.up.speed),
      range: d.range,
      splash: d.splash,
      slow: d.slow,
      slowT: d.slowT ? d.slowT * (1 + 0.08 * lvl) : 0,
    };
  }
  function towerCost(type) {
    const n = S.towers.filter(t => t.type === type).length;
    return Math.round(TOWERS[type].cost * (1 + 0.2 * n));
  }

  function updateTowers(dt) {
    for (const t of S.towers) {
      const sl = slotOf(t.row, t.col);
      const st = towerStats(t.type);
      t.recoil = Math.max(0, (t.recoil || 0) - dt * 4);
      t.cd -= dt;
      // 사정거리 안에서 성에 가장 가까운 적
      let best = null;
      for (const e of S.enemies) {
        if (e.dead || e.x < 0) continue;
        const c = enemyCenter(e);
        const d = Math.hypot(c.x - sl.x, c.y - sl.y);
        if (d <= st.range && (!best || e.t > best.t)) best = e;
      }
      if (best) {
        const c = enemyCenter(best);
        const oy = t.type === 'cannon' ? -12 : -18;
        const target = Math.atan2(c.y - (sl.y + oy), c.x - sl.x);
        t.aim = target;
        if (t.cd <= 0) {
          t.cd = 1 / st.rate;
          t.recoil = 1;
          fire(t, sl, best, st);
        }
      }
    }
  }

  function fire(t, sl, e, st) {
    const scale = L.slotSize / 60;
    if (t.type === 'archer') {
      S.projectiles.push({ kind: 'arrow', x: sl.x, y: sl.y - 18 * scale, target: e, speed: 560, dmg: st.dmg });
      Sound.play('arrow');
    } else if (t.type === 'cannon') {
      const c = enemyCenter(e);
      // 적이 이동할 위치를 조금 앞서 조준
      const lead = e.frozen > 0 ? 0 : e.speed * (e.slowT > 0 ? e.slowMul : 1) * 0.7 * (L.castleX - L.startX) / REF_LEN;
      const tx = Math.min(c.x + lead, L.castleX - 10);
      S.projectiles.push({ kind: 'ball', sx: sl.x, sy: sl.y - 12 * scale, tx, ty: c.y + 10, t: 0, dur: 0.7, dmg: st.dmg, splash: st.splash });
      Sound.play('cannon');
      burst(sl.x + Math.cos(t.aim) * 24 * scale, sl.y - 12 * scale + Math.sin(t.aim) * 24 * scale, 6, ['#ccc', '#888', '#fa0'], 1.5);
    } else {
      S.projectiles.push({ kind: 'frost', x: sl.x, y: sl.y - 40 * scale, target: e, speed: 400, dmg: st.dmg, slow: st.slow, slowT: st.slowT });
      Sound.play('frost');
    }
  }

  function updateProjectiles(dt) {
    for (const p of S.projectiles) {
      if (p.kind === 'ball') {
        p.t += dt / p.dur;
        if (p.t >= 1) {
          p.done = true;
          explode(p.tx, p.ty, p.splash, p.dmg);
        }
        continue;
      }
      const tgt = p.target;
      if (tgt && !tgt.dead) { const c = enemyCenter(tgt); p.lx = c.x; p.ly = c.y; }
      if (p.lx === undefined) { p.done = true; continue; }
      const dx = p.lx - p.x, dy = p.ly - p.y, d = Math.hypot(dx, dy);
      p.ang = Math.atan2(dy, dx);
      const step = p.speed * dt;
      if (d <= step + 4) {
        p.done = true;
        if (tgt && !tgt.dead) {
          damage(tgt, p.dmg);
          if (p.kind === 'frost' && !tgt.dead) {
            const res = tgt.def.boss ? 0.5 : 1;
            tgt.slowT = Math.max(tgt.slowT, p.slowT * res);
            tgt.slowMul = 1 - p.slow * res;
            burst(p.lx, p.ly, 6, ['#bff', '#8df', '#fff'], 1.2);
          } else {
            burst(p.lx, p.ly, 3, ['#fff', '#ddd'], 1);
            Sound.play('hit');
          }
        }
      } else {
        p.x += dx / d * step; p.y += dy / d * step;
      }
    }
    S.projectiles = S.projectiles.filter(p => !p.done);
  }

  function explode(x, y, r, dmg) {
    S.effects.push({ kind: 'boom', x, y, r, life: 0.4, max: 0.4 });
    burst(x, y, 14, ['#ffb030', '#ff6020', '#555', '#888'], 3);
    Sound.play('boom');
    for (const e of S.enemies) {
      if (e.dead) continue;
      const c = enemyCenter(e);
      const d = Math.hypot(c.x - x, (c.y - y) * 1.3);
      if (d <= r + 12 * e.def.size) damage(e, dmg * (d < r * 0.4 ? 1 : 0.7));
    }
  }

  // ================= 업데이트 =================
  function update(dt) {
    if (S.fast) dt *= 2;
    S.freezeT = Math.max(0, S.freezeT - dt);

    // 소환
    if (S.queue.length) {
      S.spawnT -= dt;
      if (S.spawnT <= 0) {
        const next = S.queue.shift();
        spawnEnemy(next.type);
        S.spawnT = S.queue.length ? S.queue[0].delay : 0;
      }
    }

    // 적 이동
    const pathLen = L.castleX - 10 - L.startX;
    for (const e of S.enemies) {
      if (e.dead) continue;
      e.hitT = Math.max(0, e.hitT - dt);
      e.frozen = Math.max(0, e.frozen - dt);
      if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowMul = 1; }
      let sp = e.speed;
      if (e.frozen > 0) sp = 0;
      else if (e.slowT > 0) sp *= e.slowMul;
      e.t += sp * dt / REF_LEN;
      e.x = L.startX + e.t * pathLen;
      e.phase += sp * dt * 0.28;
      if (e.t >= 1) {
        e.dead = true;
        hitCastle(e);
      }
    }
    S.enemies = S.enemies.filter(e => !e.dead);

    updateTowers(dt);
    updateProjectiles(dt);

    if (S.mode === 'wave' && !S.queue.length && !S.enemies.length && S.castleHp > 0) waveClear();
  }

  function hitCastle(e) {
    S.castleHp = Math.max(0, S.castleHp - e.def.dmg);
    S.shake = Math.min(14, 5 + e.def.dmg * 0.2);
    S.castleFlash = 0.5;
    S.combo = 0;
    floater(L.castleX + 20, L.roadTop - 10, `-${e.def.dmg}`, '#ff5040', 24);
    burst(L.castleX, e.y - 20, 12, ['#a39886', '#7d7466', '#fa0'], 3);
    Sound.play('castleHit');
    if (navigator.vibrate) try { navigator.vibrate(60); } catch (_) { /* 무시 */ }
    if (S.castleHp <= 0) gameOver();
  }

  function updateFx(dt) {
    for (const f of S.effects) f.life -= dt;
    S.effects = S.effects.filter(f => f.life > 0 || (f.kind === 'meteor' && !f.hitDone));
    for (const p of S.particles) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.grav ?? 300) * dt;
    }
    S.particles = S.particles.filter(p => p.life > 0);
    for (const f of S.floaters) { f.life -= dt; f.y -= 34 * dt; }
    S.floaters = S.floaters.filter(f => f.life > 0);
    S.shake = Math.max(0, S.shake - dt * 30);
    S.castleFlash = Math.max(0, S.castleFlash - dt * 1.5);
  }

  function burst(x, y, n, colors, power = 2) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (40 + Math.random() * 80) * power;
      S.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0.4 + Math.random() * 0.4, color: colors[i % colors.length], size: 1.5 + Math.random() * 2.5 });
    }
    if (S.particles.length > 600) S.particles.splice(0, S.particles.length - 600);
  }
  function floater(x, y, text, color, size = 18) {
    S.floaters.push({ x, y, text, color, size, life: 1.1 });
  }

  // ================= 정답 입력 =================
  const answerEl = document.getElementById('answer');
  const answerBox = document.getElementById('answerBox');
  const comboEl = document.getElementById('combo');

  function targetable() { return S.enemies.filter(e => !e.dead && e.x > -14); }

  function pressDigit(d) {
    if (S.mode !== 'wave' || S.paused) return;
    if (S.input.length >= 2) S.input = '';
    S.input += d;
    Sound.play('key');
    renderAnswer();
    const v = S.input;
    const answers = targetable().map(e => String(e.q.ans));
    if (!answers.length) return;
    const exact = answers.includes(v);
    const longer = answers.some(a => a.length > v.length && a.startsWith(v));
    // 두 자리이거나, 더 긴 정답 후보가 없으면 바로 제출
    if (v.length >= 2 || !longer) submit();
  }
  function pressDel() { S.input = S.input.slice(0, -1); renderAnswer(); }

  function submit() {
    if (!S.input || S.mode !== 'wave' || S.paused) return;
    const v = parseInt(S.input, 10);
    const list = targetable();
    if (!list.length) { S.input = ''; renderAnswer(); return; }
    let best = null;
    for (const e of list) if (e.q.ans === v && (!best || e.t > best.t)) best = e;
    if (best) correct(best);
    else wrong();
    S.input = '';
    renderAnswer();
  }

  function correct(e) {
    S.combo++;
    S.bestCombo = Math.max(S.bestCombo, S.combo);
    S.stats.correct++;
    const gold = Math.round((4 + e.q.a) * (1 + 0.15 * S.up.bounty)) + Math.min(10, Math.floor(S.combo / 5) * 2);
    S.gold += gold;
    const c = enemyCenter(e);
    floater(c.x, c.y - 34 * e.def.size, `+${gold}G`, '#ffd34a', 20);
    // 성에서 번개
    const sx = L.castleX + (L.W - L.castleX) * 0.67, sy = 24;
    S.effects.push({ kind: 'bolt', pts: lightning(sx, sy, c.x, c.y), life: 0.28, max: 0.28 });
    burst(c.x, c.y, 10, ['#fff7b0', '#ffe14a', '#9fe6ff'], 2);
    Sound.play('correct', S.combo);
    flashBox('right');
    if (e.def.probs <= 1 || e.probsLeft <= 1) {
      e.hp = 0; kill(e);
    } else {
      const per = e.maxHp / e.def.probs;
      e.probsLeft--;
      e.hp = Math.min(e.hp, e.probsLeft * per);
      e.hitT = 0.15;
      e.q = makeProblem(e.def.boss);
      S.shake = Math.max(S.shake, 3);
    }
    S.enemies = S.enemies.filter(x => !x.dead);
  }

  function wrong() {
    S.combo = 0;
    S.stats.wrong++;
    Sound.play('wrong');
    flashBox('wrong');
  }

  let boxTimer = 0;
  function flashBox(cls) {
    answerBox.classList.remove('wrong', 'right');
    void answerBox.offsetWidth;
    answerBox.classList.add(cls);
    clearTimeout(boxTimer);
    boxTimer = setTimeout(() => answerBox.classList.remove(cls), 350);
  }

  function renderAnswer() {
    answerEl.textContent = S.input;
  }

  function lightning(x1, y1, x2, y2) {
    const pts = [[x1, y1]];
    const n = 9;
    for (let i = 1; i < n; i++) {
      const f = i / n;
      pts.push([x1 + (x2 - x1) * f + (Math.random() - 0.5) * 26, y1 + (y2 - y1) * f + (Math.random() - 0.5) * 26]);
    }
    pts.push([x2, y2]);
    return pts;
  }

  // ================= 스킬 =================
  function useSkill(key) {
    const sk = SKILLS[key];
    if (S.gems < sk.cost) { Sound.play('wrong'); return; }
    if (key === 'repair') {
      const max = castleMax(S.up.castle);
      if (S.castleHp >= max) return;
      S.gems -= sk.cost;
      const heal = Math.round(max * 0.3);
      S.castleHp = Math.min(max, S.castleHp + heal);
      floater(L.castleX + 40, L.roadTop - 30, `+${heal}❤`, '#7dff8a', 22);
      burst(L.castleX + 60, L.roadTop, 20, ['#7dff8a', '#fff', '#c8ffb0'], 2);
      Sound.play('upgrade');
    } else {
      if (S.mode !== 'wave' || !S.enemies.length) return;
      S.gems -= sk.cost;
      Sound.play('skill');
      if (key === 'freeze') {
        S.freezeT = 4;
        for (const e of S.enemies) e.frozen = e.def.boss ? 2 : 4;
        showBanner('❄ 얼음 폭풍!', '', 1200);
      } else {
        showBanner('☄ 유성 낙하!', '', 1200);
        S.enemies.slice().forEach((e, i) => {
          const c = enemyCenter(e);
          S.effects.push({ kind: 'meteor', x: c.x, y: c.y, life: 0.6 + i * 0.05, max: 0.6 + i * 0.05, e });
        });
      }
    }
    if (S.mode === 'prep') save();
    updateHud(true);
  }

  function updateMeteors() {
    for (const f of S.effects) {
      if (f.kind === 'meteor' && !f.hitDone && f.life <= 0.08) {
        f.life = Math.max(f.life, 0.01);
        f.hitDone = true;
        const e = f.e;
        if (!e.dead) {
          explodeVisual(f.x, f.y);
          damage(e, e.maxHp * (e.def.boss ? 0.15 : 0.45));
        }
      }
    }
    S.enemies = S.enemies.filter(e => !e.dead);
  }
  function explodeVisual(x, y) {
    S.effects.push({ kind: 'boom', x, y, r: 40, life: 0.35, max: 0.35 });
    burst(x, y, 12, ['#ffb030', '#ff6020', '#ffe14a'], 3);
    Sound.play('boom');
    S.shake = Math.max(S.shake, 4);
  }

  // ================= 웨이브 흐름 =================
  function enterPrep() {
    S.mode = 'prep';
    S.fast = false;
    S.enemies = []; S.projectiles = []; S.queue = [];
    S.input = ''; renderAnswer();
    Sound.setIntensity(0);
    save();
    updateControls();
    updatePrepInfo();
  }

  function startWave() {
    if (S.mode !== 'prep') return;
    S.mode = 'wave';
    S.queue = buildWave(S.wave);
    S.spawnT = S.queue[0].delay;
    S.combo = 0;
    Sound.play('horn');
    Sound.setIntensity(1);
    showBanner(`⚔ 웨이브 ${S.wave}`, '', 1600);
    updateControls();
    updatePrepInfo();
  }

  function waveClear() {
    const bonus = 25 + 6 * S.wave;
    S.gold += bonus;
    const max = castleMax(S.up.castle);
    const heal = Math.round(max * 0.1);
    S.castleHp = Math.min(max, S.castleHp + heal);
    showBanner(`🎉 웨이브 ${S.wave} 승리! +${bonus}G`, 'good', 2400);
    Sound.play('victory');
    S.wave++;
    const best = +(lsGet(BEST_KEY) || 0);
    try { if (S.wave - 1 > best) localStorage.setItem(BEST_KEY, String(S.wave - 1)); } catch (_) { /* 무시 */ }
    enterPrep();
  }

  function gameOver() {
    if (S.mode === 'over') return;
    S.mode = 'over';
    Sound.setIntensity(0);
    Sound.play('lose');
    updateControls();
    const sv = loadSave();
    document.getElementById('retryWave').textContent = sv ? sv.wave : S.wave;
    document.getElementById('goStats').innerHTML =
      `웨이브 <b>${S.wave}</b>에서 쓰러졌습니다.<br>정답 ${S.stats.correct}개 · 처치 ${S.stats.kills}마리 · 최고 콤보 ${S.bestCombo}`;
    setTimeout(() => show('gameover'), 900);
  }

  // ================= 저장 / 불러오기 =================
  function save() {
    if (S.mode !== 'prep') return;
    const data = {
      v: 1, wave: S.wave, gold: S.gold, gems: S.gems, castleHp: S.castleHp,
      up: S.up, towers: S.towers.map(t => ({ row: t.row, col: t.col, type: t.type, paid: t.paid })),
      stats: S.stats, bestCombo: S.bestCombo, savedAt: Date.now(),
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (_) { /* 저장 불가 환경 */ }
  }
  function lsGet(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
  function loadSave() {
    try {
      const d = JSON.parse(lsGet(SAVE_KEY));
      if (d && d.v === 1 && d.wave >= 1) return d;
    } catch (_) { /* 무시 */ }
    return null;
  }

  function newGame() {
    Object.assign(S, {
      wave: 1, gold: 80, gems: 0, castleHp: castleMax(0),
      up: { castle: 0, archer: 0, cannon: 0, mage: 0, speed: 0, bounty: 0 },
      towers: [], stats: { kills: 0, correct: 0, wrong: 0 }, bestCombo: 0,
    });
    resetField();
    enterPrep();
  }

  function loadGame(d, fullHp) {
    Object.assign(S, {
      wave: d.wave, gold: d.gold, gems: d.gems,
      up: Object.assign({ castle: 0, archer: 0, cannon: 0, mage: 0, speed: 0, bounty: 0 }, d.up),
      towers: (d.towers || []).filter(t => TOWERS[t.type]).map(t => ({ ...t, cd: 0, aim: 0, recoil: 0 })),
      stats: d.stats || { kills: 0, correct: 0, wrong: 0 }, bestCombo: d.bestCombo || 0,
    });
    const max = castleMax(S.up.castle);
    S.castleHp = fullHp ? max : Math.max(1, Math.min(max, d.castleHp || max));
    resetField();
    enterPrep();
  }

  function resetField() {
    S.enemies = []; S.projectiles = []; S.effects = []; S.particles = []; S.floaters = [];
    S.queue = []; S.combo = 0; S.input = ''; S.freezeT = 0; S.paused = false; S.fast = false;
  }

  // ================= 그리기 =================
  const LABEL_FONT = 'bold 21px "Gowun Batang", "Apple SD Gothic Neo", sans-serif';

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bg, 0, 0);
    let sx = 0, sy = 0;
    if (S.shake > 0) { sx = (Math.random() - 0.5) * S.shake; sy = (Math.random() - 0.5) * S.shake; }
    ctx.setTransform(k, 0, 0, k, sx * k, sy * k);
    const t = S.time;

    // 칸 & 탑
    const showPlus = S.mode === 'prep' || S.mode === 'wave';
    for (const sl of L.slots) {
      const tw = towerAt(sl.row, sl.col);
      if (!tw) Art.drawSlot(ctx, sl.x, sl.y, L.slotSize, showPlus && S.mode === 'prep', t);
      else Art.drawSlot(ctx, sl.x, sl.y, L.slotSize, false, t);
    }
    // 위쪽 줄 탑 (적 뒤에 그려짐)
    drawTowers(t, r => r < 2);

    Art.drawCastle(ctx, L, t, S.castleHp / castleMax(S.up.castle), S.castleFlash);

    // 적 (y 순서로)
    const sorted = S.enemies.slice().sort((a, b) => a.y - b.y);
    for (const e of sorted) Art.drawEnemy(ctx, e, t);

    // 아래쪽 줄 탑 (적 앞에 그려짐)
    drawTowers(t, r => r >= 2);

    // 투사체
    for (const p of S.projectiles) drawProjectile(p);

    // 효과
    for (const f of S.effects) drawEffect(f);

    // 파티클
    for (const p of S.particles) {
      ctx.globalAlpha = Math.min(1, p.life * 2.5);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // 문제 말풍선: 성에 가까운 적이 위에 오도록
    const byT = S.enemies.filter(e => e.x > -20).sort((a, b) => a.t - b.t);
    const lead = byT[byT.length - 1];
    // 말풍선이 겹치면 위로 올려서 모두 읽을 수 있게 배치 (앞쪽 적 우선)
    ctx.font = LABEL_FONT;
    const placed = [], lifts = new Map();
    for (let i = byT.length - 1; i >= 0; i--) {
      const e = byT[i];
      const w = ctx.measureText(`${e.q.a} × ${e.q.b}`).width + 18;
      const base = Art.labelTop(e);
      let lift = 0;
      for (let tries = 0; tries < 6; tries++) {
        const y1 = base - lift - 30, y2 = base - lift;
        const hit = placed.find(r => e.x - w / 2 < r.x2 + 2 && e.x + w / 2 > r.x1 - 2 && y1 < r.y2 + 2 && y2 > r.y1 - 2);
        if (!hit) break;
        lift = base - hit.y1 + 4;
      }
      lifts.set(e, lift);
      placed.push({ x1: e.x - w / 2, x2: e.x + w / 2, y1: base - lift - 30 - (e.def.probs > 1 ? 18 : 0) - (e.def.boss ? 26 : 0), y2: base - lift });
    }
    for (const e of byT) Art.drawLabel(ctx, e, LABEL_FONT, e === lead, lifts.get(e));

    // 떠오르는 글자
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of S.floaters) {
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.font = `bold ${f.size}px "Gowun Batang", sans-serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.75)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    // 얼음 효과 화면
    if (S.freezeT > 0) {
      ctx.fillStyle = `rgba(170,220,255,${Math.min(0.25, S.freezeT * 0.1)})`;
      ctx.fillRect(0, 0, L.W, H);
    }
    // 2배속 표시
    if (S.fast && S.mode === 'wave') {
      ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = 'rgba(255,240,200,.9)';
      ctx.textAlign = 'left'; ctx.fillText('⏩ x2', 10, 20);
    }
    // 위험 경고 (성 근처)
    if (lead && lead.t > 0.82 && S.mode === 'wave') {
      ctx.fillStyle = `rgba(255,40,20,${0.12 + Math.sin(t * 10) * 0.08})`;
      ctx.fillRect(L.castleX - 120, 0, 120, H);
    }
  }

  function drawTowers(t, rowFilter) {
    for (const tw of S.towers) {
      if (!rowFilter(tw.row)) continue;
      const sl = slotOf(tw.row, tw.col);
      const lvl = S.up[tw.type];
      Art.drawTower(ctx, tw.type, sl.x, sl.y - 6, L.slotSize, t + tw.col, tw.aim || 0, tw.recoil || 0, lvl >= 3 ? Math.floor(lvl / 3) : 0);
    }
  }

  function drawProjectile(p) {
    ctx.save();
    if (p.kind === 'arrow') {
      ctx.translate(p.x, p.y); ctx.rotate(p.ang || 0);
      ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(4, 0); ctx.stroke();
      ctx.fillStyle = '#ccc'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(3, -3); ctx.lineTo(3, 3); ctx.fill();
      ctx.fillStyle = '#e8e0d0'; ctx.fillRect(-13, -2, 4, 4);
    } else if (p.kind === 'ball') {
      const x = p.sx + (p.tx - p.sx) * p.t;
      const y = p.sy + (p.ty - p.sy) * p.t - Math.sin(p.t * Math.PI) * 70;
      ctx.fillStyle = 'rgba(0,0,0,.2)';
      ctx.beginPath(); ctx.ellipse(x, p.sy + (p.ty - p.sy) * p.t + 8, 6, 2, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill();
      ctx.fillStyle = '#666'; ctx.beginPath(); ctx.arc(x - 2, y - 2, 2, 0, 7); ctx.fill();
    } else if (p.kind === 'frost') {
      const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, 10);
      g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#9fe6ff'); g.addColorStop(1, 'rgba(120,200,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  function drawEffect(f) {
    const a = Math.max(0, f.life / f.max);
    if (f.kind === 'bolt') {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#9fe6ff'; ctx.lineWidth = 7; ctx.lineJoin = 'round';
      ctx.shadowColor = '#bff'; ctx.shadowBlur = 14;
      ctx.beginPath(); f.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.restore();
    } else if (f.kind === 'boom') {
      const r = f.r * (1.15 - a * 0.6);
      ctx.save();
      ctx.globalAlpha = a;
      const g = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, r);
      g.addColorStop(0, '#fff6c0'); g.addColorStop(0.4, '#ffb030'); g.addColorStop(0.8, 'rgba(220,70,20,.6)'); g.addColorStop(1, 'rgba(80,40,20,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 7); ctx.fill();
      ctx.restore();
    } else if (f.kind === 'meteor') {
      const p = 1 - Math.max(0, (f.life - 0.08)) / (f.max - 0.08);
      if (p >= 1) return;
      const mx = f.x - 160 * (1 - p), my = f.y - 360 * (1 - p);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,160,40,.7)'; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx - 40, my - 90); ctx.stroke();
      ctx.fillStyle = '#ffdf70'; ctx.beginPath(); ctx.arc(mx, my, 9, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff7020'; ctx.beginPath(); ctx.arc(mx, my, 6, 0, 7); ctx.fill();
      ctx.restore();
    }
  }

  // ================= HUD / UI =================
  const $ = id => document.getElementById(id);
  const hud = { hpFill: $('hpFill'), hpText: $('hpText'), gold: $('gold'), gems: $('gems'), waveNo: $('waveNo') };
  const btnStart = $('btnStart');
  const skillBtns = [...document.querySelectorAll('.skill')];
  let lastHud = '';

  function updateHud(force) {
    const max = castleMax(S.up.castle);
    const key = `${S.castleHp}|${max}|${S.gold}|${S.gems}|${S.wave}|${S.combo}|${S.mode}|${S.enemies.length > 0}`;
    if (!force && key === lastHud) return;
    lastHud = key;
    const r = S.castleHp / max;
    hud.hpFill.style.width = (r * 100) + '%';
    hud.hpFill.className = r < 0.25 ? 'low' : r < 0.5 ? 'mid' : '';
    hud.hpText.textContent = `${Math.ceil(S.castleHp)}/${max}`;
    hud.gold.textContent = S.gold;
    hud.gems.textContent = S.gems;
    hud.waveNo.textContent = S.wave;
    comboEl.innerHTML = S.combo >= 2 ? `콤보<b>${S.combo}</b>` : '';
    skillBtns.forEach(b => {
      const sk = SKILLS[b.dataset.skill];
      const needWave = b.dataset.skill !== 'repair';
      b.disabled = S.gems < sk.cost || (needWave && (S.mode !== 'wave' || !S.enemies.length)) ||
        (b.dataset.skill === 'repair' && S.castleHp >= max) || S.mode === 'over';
    });
  }

  function updateControls() {
    if (S.mode === 'prep') {
      btnStart.innerHTML = `⚔ 웨이브 ${S.wave} 시작`;
      btnStart.classList.add('pulse');
      btnStart.disabled = false;
    } else if (S.mode === 'wave') {
      btnStart.innerHTML = S.fast ? '▶ 보통 속도' : '⏩ 2배속';
      btnStart.classList.remove('pulse');
      btnStart.disabled = false;
    } else {
      btnStart.disabled = true;
    }
    updateHud(true);
  }

  function updatePrepInfo() {
    const el = $('prepInfo');
    if (S.mode !== 'prep') { el.classList.add('hidden'); return; }
    const p = wavePreview(S.wave);
    let html = `다음 웨이브 <b>${S.wave}</b> · 문제: <b>${p.dan}</b> · ${p.kinds}`;
    if (p.boss) html += ` · ⚠ <b>보스: ${p.boss}</b>`;
    if (S.towers.length === 0) html += '<br>빈 칸(+)을 눌러 탑을 세운 뒤 ⚔ 시작!';
    el.innerHTML = html;
    el.classList.remove('hidden');
  }

  let bannerTimer = 0;
  function showBanner(text, cls, ms) {
    const b = $('banner');
    b.textContent = text;
    b.className = cls || '';
    void b.offsetWidth;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.classList.add('hidden'), ms);
  }

  // ---------- 화면 전환 ----------
  function show(id) { $(id).classList.remove('hidden'); }
  function hide(id) { $(id).classList.add('hidden'); }

  function refreshTitle() {
    const sv = loadSave();
    const btn = $('btnContinue');
    if (sv) {
      btn.classList.remove('hidden');
      $('continueInfo').textContent = `웨이브 ${sv.wave} · 💰${sv.gold} · 💎${sv.gems} · 탑 ${sv.towers.length}개`;
    } else btn.classList.add('hidden');
    const best = +(lsGet(BEST_KEY) || 0);
    $('bestInfo').textContent = best ? `🏆 최고 기록: 웨이브 ${best} 클리어` : '';
  }

  function beginPlay() {
    Sound.init();
    Sound.startMusic();
    hide('title'); hide('gameover');
    requestAnimationFrame(resize);
  }

  // ---------- 모달 ----------
  let modalOpen = false;
  let modalOnClose = null;
  function openModal(title, html, onClose) {
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML = html;
    show('modal');
    modalOpen = true;
    modalOnClose = onClose || null;
    S.paused = true;
  }
  function closeModal() {
    hide('modal');
    modalOpen = false;
    S.paused = false;
    const cb = modalOnClose; modalOnClose = null;
    if (cb) cb();
  }
  $('modalClose').onclick = closeModal;
  $('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

  function towerIcon(type) {
    const c = document.createElement('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = 56 * dpr; c.height = 64 * dpr;
    c.style.width = '56px'; c.style.height = '64px';
    const x = c.getContext('2d');
    x.scale(dpr, dpr);
    Art.drawTower(x, type, 28, 40, 46, 0, 0, 0, 0);
    return c;
  }

  function openBuild(row, col) {
    const html = `<div class="opt-list">${Object.entries(TOWERS).map(([key, d]) => {
      const st = towerStats(key), cost = towerCost(key);
      return `<button class="opt" data-build="${key}" ${S.gold < cost ? 'disabled' : ''}>
        <span class="ic" data-icon="${key}"></span>
        <span class="info"><b>${d.name}</b><small>${d.desc}<br>피해 ${Math.round(st.dmg)} · 초당 ${st.rate.toFixed(2)}회 · 사거리 ${d.range}</small></span>
        <span class="cost">${cost}G</span></button>`;
    }).join('')}</div>`;
    openModal('🔨 탑 건설', html);
    document.querySelectorAll('#modalBody [data-icon]').forEach(sp => sp.replaceWith(towerIcon(sp.dataset.icon)));
    document.querySelectorAll('#modalBody [data-build]').forEach(b => b.onclick = () => {
      const type = b.dataset.build, cost = towerCost(type);
      if (S.gold < cost || towerAt(row, col)) return;
      S.gold -= cost;
      S.towers.push({ row, col, type, cd: 0, aim: 0, recoil: 0, paid: cost });
      const sl = slotOf(row, col);
      burst(sl.x, sl.y, 16, ['#b3a68d', '#8a7f6e', '#f0c050'], 2);
      Sound.play('build');
      closeModal();
      save(); updatePrepInfo(); updateHud(true);
    });
  }

  function openTower(tw) {
    const d = TOWERS[tw.type], st = towerStats(tw.type);
    const refund = Math.round((tw.paid || d.cost) * 0.5);
    const html = `
      <p style="text-align:center;margin:0 0 10px">피해 <b>${Math.round(st.dmg)}</b> · 초당 <b>${st.rate.toFixed(2)}</b>회 · 사거리 <b>${d.range}</b>
      ${st.splash ? ` · 폭발 범위 ${st.splash}` : ''}${st.slow ? ` · 둔화 ${Math.round(st.slow * 100)}%` : ''}</p>
      <div class="opt-list">
        <button class="opt" data-act="upgrade"><span class="icon">⚒</span><span class="info"><b>강화하러 가기</b><small>골드로 같은 종류의 모든 탑을 강하게!</small></span></button>
        <button class="opt danger" data-act="sell"><span class="icon">🪙</span><span class="info"><b>철거하기</b><small>건설 비용의 절반을 돌려받아요</small></span><span class="cost">+${refund}G</span></button>
      </div>`;
    openModal(d.name, html);
    $('modalBody').querySelector('[data-act=upgrade]').onclick = () => { closeModal(); openUpgrades(); };
    $('modalBody').querySelector('[data-act=sell]').onclick = () => {
      S.towers = S.towers.filter(t => t !== tw);
      S.gold += refund;
      Sound.play('coin');
      closeModal(); save(); updatePrepInfo(); updateHud(true);
    };
  }

  function openUpgrades() {
    const render = () => {
      const html = `<p style="text-align:center;margin:0 0 10px">보유 골드 <b>💰 ${S.gold}</b></p><div class="opt-list">${Object.entries(UPGRADES).map(([key, u]) => {
        const lvl = S.up[key], maxed = lvl >= u.max, cost = upCost(key, lvl);
        return `<button class="opt" data-up="${key}" ${maxed || S.gold < cost ? 'disabled' : ''}>
          <span class="icon">${u.icon}</span>
          <span class="info"><b>${u.name}</b> <span class="lvl">Lv.${lvl}${maxed ? ' (MAX)' : ''}</span><small>${u.desc(lvl)}</small></span>
          <span class="cost">${maxed ? '—' : cost + 'G'}</span></button>`;
      }).join('')}</div>`;
      $('modalBody').innerHTML = html;
      document.querySelectorAll('#modalBody [data-up]').forEach(b => b.onclick = () => {
        const key = b.dataset.up, lvl = S.up[key], cost = upCost(key, lvl);
        if (S.gold < cost || lvl >= UPGRADES[key].max) return;
        S.gold -= cost;
        S.up[key]++;
        if (key === 'castle') S.castleHp = Math.min(castleMax(S.up.castle), S.castleHp + 25);
        Sound.play('upgrade');
        save(); updateHud(true);
        render();
      });
    };
    openModal('⚒ 대장간 강화', '');
    render();
  }

  function openHelp() {
    openModal('📜 게임 방법', `<div class="help">
      <h3>🎯 목표</h3>
      <ul><li>왼쪽에서 몰려오는 적들로부터 오른쪽의 성을 지키세요.</li>
      <li>적이 성에 닿으면 성 체력이 줄고, 0이 되면 게임 오버!</li></ul>
      <h3>✖ 구구단 공격</h3>
      <ul><li>적 머리 위의 문제 <b>(예: 7 × 8)</b>의 답을 숫자판이나 키보드로 입력하세요.</li>
      <li>정답이면 성에서 번개가 떨어지고 <b>골드</b>를 얻어요. 연속 정답은 콤보 보너스!</li>
      <li>같은 답을 가진 적이 여럿이면 성에 가장 가까운 적부터 맞아요.</li>
      <li>오우거·트롤·보스는 문제를 여러 번 맞혀야 쓰러져요. (머리 위 ● 개수)</li></ul>
      <h3>🏹 탑 건설</h3>
      <ul><li>길 옆 빈 칸을 눌러 <b>궁수탑 · 대포 · 서리 마법탑</b>을 세워요. 탑은 자동으로 공격해요.</li>
      <li>세운 탑을 누르면 철거할 수 있어요.</li></ul>
      <h3>💎 보석 &amp; 강화</h3>
      <ul><li>적을 쓰러뜨리면 <b>보석</b>을 얻어요. 보석으로 🔧성 수리, ❄얼음 폭풍, ☄유성 낙하를 쓸 수 있어요.</li>
      <li>⚒ 강화 메뉴에서 골드로 성벽, 궁수·대포·마법 공격력, 공격 속도를 올리세요.</li></ul>
      <h3>🗺 웨이브</h3>
      <ul><li>웨이브가 오를수록 적이 많아지고 빨라지며, 2단부터 점점 어려운 단이 나와요.</li>
      <li>5웨이브마다 강력한 <b>보스</b>가 등장해요!</li>
      <li>웨이브 시작 전 상태가 이 기기에 자동 저장되어 <b>이어하기</b>가 가능해요.</li></ul>
      <h3>⌨ PC 단축키</h3>
      <ul><li>숫자 입력 · Enter 확인 · Backspace 지우기 · Space 웨이브 시작/2배속 · Esc 일시정지</li></ul>
    </div>`);
  }

  function openPause() {
    if (modalOpen || S.mode === 'title' || S.mode === 'over') return;
    openModal('⏸ 일시정지', `<div class="pause-menu">
      <button class="big-btn" data-p="resume">▶ 계속하기</button>
      <button class="big-btn alt" data-p="help">📜 게임 방법</button>
      <button class="big-btn alt" data-p="title">🏰 처음 화면으로</button>
      <p style="font-size:13px;text-align:center;margin:4px 0 0;color:#6b4a24">진행 상황은 웨이브 시작 전 상태로 저장돼요.</p>
    </div>`);
    $('modalBody').querySelector('[data-p=resume]').onclick = closeModal;
    $('modalBody').querySelector('[data-p=help]').onclick = () => { closeModal(); openHelp(); };
    $('modalBody').querySelector('[data-p=title]').onclick = () => {
      closeModal();
      S.mode = 'title';
      resetField();
      Sound.setIntensity(0);
      refreshTitle();
      show('title');
    };
  }

  // ================= 입력 =================
  canvas.addEventListener('pointerdown', ev => {
    if (S.mode !== 'prep' && S.mode !== 'wave') return;
    if (modalOpen) return;
    const rect = canvas.getBoundingClientRect();
    const bw = canvas.clientLeft;
    const x = (ev.clientX - rect.left - bw) / (rect.width - bw * 2) * L.W;
    const y = (ev.clientY - rect.top - bw) / (rect.height - bw * 2) * H;
    const half = L.slotSize / 2 + 4;
    const sl = L.slots.find(s => Math.abs(s.x - x) <= half && Math.abs(s.y - y) <= half);
    if (!sl) return;
    Sound.init();
    const tw = towerAt(sl.row, sl.col);
    if (tw) openTower(tw); else openBuild(sl.row, sl.col);
  });

  document.querySelectorAll('#keypad button').forEach(b => {
    b.addEventListener('pointerdown', ev => {
      ev.preventDefault();
      Sound.init();
      const kk = b.dataset.k;
      if (kk === 'del') pressDel();
      else if (kk === 'ok') submit();
      else pressDigit(kk);
    });
  });

  btnStart.onclick = () => {
    Sound.init();
    if (S.mode === 'prep') startWave();
    else if (S.mode === 'wave') { S.fast = !S.fast; updateControls(); }
  };
  $('btnUpgrade').onclick = () => { if (S.mode === 'prep' || S.mode === 'wave') openUpgrades(); };
  skillBtns.forEach(b => b.onclick = () => useSkill(b.dataset.skill));
  $('btnPause').onclick = openPause;
  $('btnSound').onclick = () => {
    Sound.init();
    Sound.setMuted(!Sound.muted);
    try { localStorage.setItem(SOUND_KEY, Sound.muted ? '1' : '0'); } catch (_) { /* 무시 */ }
    $('btnSound').textContent = Sound.muted ? '🔇' : '🔊';
  };

  window.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') {
      if (modalOpen) closeModal(); else openPause();
      return;
    }
    if (modalOpen || S.mode === 'title' || S.mode === 'over') return;
    if (/^[0-9]$/.test(ev.key)) { pressDigit(ev.key); pressedFx(ev.key); ev.preventDefault(); }
    else if (ev.key === 'Backspace') { pressDel(); pressedFx('del'); ev.preventDefault(); }
    else if (ev.key === 'Enter') { submit(); pressedFx('ok'); ev.preventDefault(); }
    else if (ev.key === ' ') { btnStart.click(); ev.preventDefault(); }
  });
  function pressedFx(k2) {
    const b = document.querySelector(`#keypad [data-k="${k2}"]`);
    if (!b) return;
    b.classList.add('pressed');
    setTimeout(() => b.classList.remove('pressed'), 90);
  }

  // 타이틀 버튼
  $('btnNew').onclick = () => {
    if (loadSave() && !confirm('저장된 게임이 있어요. 새 게임을 시작하면 지워집니다. 계속할까요?')) return;
    beginPlay();
    newGame();
  };
  $('btnContinue').onclick = () => {
    const sv = loadSave();
    if (!sv) return;
    beginPlay();
    loadGame(sv, false);
    showBanner(`웨이브 ${S.wave}부터 이어하기`, 'good', 1800);
  };
  $('btnHelp').onclick = () => { openHelp(); };
  $('btnRetry').onclick = () => {
    const sv = loadSave();
    beginPlay();
    if (sv) loadGame(sv, true); else newGame();
  };
  $('btnGoNew').onclick = () => { beginPlay(); newGame(); };

  // 화면을 떠나면 자동 일시정지
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      Sound.suspend();
      if (S.mode === 'wave' && !modalOpen) openPause();
    } else Sound.resume();
  });

  // ================= 메인 루프 =================
  let last = performance.now();
  function frame(now) {
    let dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!S.paused) {
      S.time += dt;
      if (S.mode === 'wave') { update(dt); updateMeteors(); }
      updateFx(S.fast && S.mode === 'wave' ? dt * 2 : dt);
    }
    render();
    updateHud(false);
    requestAnimationFrame(frame);
  }

  // ================= 시작 =================
  try { if (localStorage.getItem(SOUND_KEY) === '1') { Sound.setMuted(true); $('btnSound').textContent = '🔇'; } } catch (_) { /* 무시 */ }
  resize();
  refreshTitle();
  updateControls();
  requestAnimationFrame(frame);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => resize());

  // 디버그/테스트용
  window.__game = { S, L, startWave, newGame, submit, pressDigit, useSkill, buildWave };
})();
