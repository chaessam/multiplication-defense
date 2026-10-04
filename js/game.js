/* 구구단 디펜스 - 게임 로직 + UI (그래픽은 world.js) */
(() => {
  'use strict';

  // ================= 데이터 =================
  const SAVE_KEY = 'gugudan-defense-save-v1';
  const BEST_KEY = 'gugudan-defense-best';
  const RECORD_KEY = 'gugudan-defense-records';
  const SOUND_KEY = 'gugudan-defense-muted';
  const CROSS_TIME = 24; // 1웨이브 병사가 길 끝까지 가는 시간(초)

  const TOWERS = {
    archer: { name: '궁수탑', cost: 60, range: 7.5, rate: 1.15, dmg: 14, desc: '빠르게 화살을 쏘는 기본 탑' },
    cannon: { name: '대포', cost: 110, range: 8.2, rate: 0.42, dmg: 40, splash: 2.4, desc: '느리지만 폭발로 여러 적을 공격' },
    mage:   { name: '서리 마법탑', cost: 90, range: 6.8, rate: 0.85, dmg: 9, slow: 0.45, slowT: 2.0, desc: '적을 느리게 만드는 얼음 마법' },
  };

  const ENEMIES = {
    goblin:  { name: '고블린', hp: 22, speed: 1.4, size: 0.85, dmg: 4, gems: 1, probs: 1 },
    soldier: { name: '병사', hp: 40, speed: 1.0, size: 1.0, dmg: 6, gems: 1, probs: 1 },
    knight:  { name: '기사', hp: 95, speed: 0.8, size: 1.1, dmg: 10, gems: 2, probs: 1 },
    ogre:    { name: '오우거', hp: 260, speed: 0.62, size: 1.5, dmg: 16, gems: 4, probs: 2 },
    troll:   { name: '트롤', hp: 380, speed: 0.58, size: 1.65, dmg: 20, gems: 5, probs: 3 },
    orcking: { name: '오크 대족장', hp: 1100, speed: 0.6, size: 2.0, dmg: 40, gems: 20, probs: 5, boss: true },
    dragon:  { name: '붉은 드래곤', hp: 1700, speed: 0.65, size: 0.85, dmg: 55, gems: 30, probs: 6, boss: true, fly: true },
    lich:    { name: '해골 마왕', hp: 2400, speed: 0.58, size: 1.9, dmg: 70, gems: 40, probs: 7, boss: true, float: true },
    demonking: { name: '마왕', hp: 3500, speed: 0.42, size: 2.3, dmg: 120, gems: 100, probs: 12, boss: true, final: true },
  };
  const BOSS_ORDER = ['orcking', 'dragon', 'lich'];
  const FINAL_WAVE = 30;

  // 난이도
  const DIFFS = {
    easy: {
      name: '쉬움', icon: '🌱', desc: '구구단 연습 중인 친구에게! 적이 느리고, 단이 천천히 늘어나요. 틀리면 힌트가 나와요.',
      speed: 0.7, hp: 0.6, count: 0.75, interval: 1.3, gold: 1.25, castle: 150, startGold: 120, hint: true,
    },
    normal: {
      name: '보통', icon: '⚔️', desc: '기본 난이도. 2단부터 시작해서 점점 어려운 단이 나와요.',
      speed: 1, hp: 1, count: 1, interval: 1, gold: 1, castle: 100, startGold: 80,
    },
    hard: {
      name: '어려움', icon: '🔥', desc: '구구단 고수 도전! 처음부터 2~9단이 모두 나오고, 적이 빠르고 튼튼해요.',
      speed: 1.2, hp: 1.35, count: 1.2, interval: 0.85, gold: 0.9, castle: 100, startGold: 80, allDan: true,
    },
  };
  const D = () => DIFFS[S.diff] || DIFFS.normal;

  const UPGRADES = {
    castle: { name: '성벽 강화', icon: '🏰', base: 60, growth: 1.4, max: 20, desc: l => `최대 체력 +25 (지금 ${castleMax(l)})` },
    archer: { name: '궁수 공격력', icon: '🏹', base: 70, growth: 1.45, max: 15, desc: l => `궁수탑 피해 +25% (지금 +${l * 25}%)` },
    cannon: { name: '대포 공격력', icon: '💣', base: 90, growth: 1.45, max: 15, desc: l => `대포 피해 +25% (지금 +${l * 25}%)` },
    mage:   { name: '마법 위력', icon: '🔮', base: 80, growth: 1.45, max: 15, desc: l => `마법탑 피해 +25%, 둔화 시간 증가 (지금 +${l * 25}%)` },
    speed:  { name: '공격 속도', icon: '⚡', base: 100, growth: 1.55, max: 10, desc: l => `모든 탑 공격 속도 +10% (지금 +${l * 10}%)` },
    bounty: { name: '현상금', icon: '💰', base: 80, growth: 1.5, max: 10, desc: l => `정답 골드 +15% (지금 +${l * 15}%)` },
  };

  const SKILLS = {
    repair: { name: '성 수리', cost: 8 },
    freeze: { name: '얼음 폭풍', cost: 12 },
    meteor: { name: '유성 낙하', cost: 20 },
  };

  function castleMax(lvl) { return D().castle + 25 * lvl; }
  function upCost(key, lvl) { const u = UPGRADES[key]; return Math.round(u.base * Math.pow(u.growth, lvl)); }
  const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const emptyUp = () => ({ castle: 0, archer: 0, cannon: 0, mage: 0, speed: 0, bounty: 0 });

  // ================= 상태 =================
  const S = {
    mode: 'title', // title | prep | wave | over
    paused: false,
    diff: 'normal', cleared: false,
    wave: 1, gold: 0, gems: 0,
    castleHp: 100, castleMax: 100,
    up: emptyUp(),
    towers: [],
    enemies: [], projectiles: [], bolts: [], floaters: [],
    queue: [], spawnT: 0,
    input: '', combo: 0, bestCombo: 0,
    freezeT: 0, shake: 0, castleFlash: 0,
    fast: false,
    stats: { kills: 0, correct: 0, wrong: 0 },
    time: 0,
  };

  // ================= 화면 =================
  const $ = id => document.getElementById(id);
  const wrap = $('stageWrap');
  const glCanvas = $('game');
  const overlay = $('overlay');
  const octx = overlay.getContext('2d');
  let VW = 1, VH = 1, dpr = 1;

  World.init(glCanvas);

  function resize() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (w <= 0 || h <= 0) return;
    VW = w; VH = h;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    overlay.width = Math.round(w * dpr); overlay.height = Math.round(h * dpr);
    World.resize(w, h);
  }
  window.addEventListener('resize', () => requestAnimationFrame(resize));
  window.addEventListener('orientationchange', () => setTimeout(resize, 250));

  const towerAt = slot => S.towers.find(t => t.slot === slot);

  // ================= 문제 =================
  function danRange(w) {
    if (D().allDan) return [2, 9];
    if (S.diff === 'easy') {
      // 쉬움: 2웨이브마다 새 단이 하나씩 열리고, 15웨이브부터 전체
      if (w >= 15) return [2, 9];
      const max = Math.min(9, 2 + Math.floor((w - 1) / 2));
      return [Math.max(2, max - 3), max];
    }
    if (w >= 9) return [2, 9];
    const max = Math.min(9, w + 1);
    return [Math.max(2, max - 3), max];
  }
  function makeProblem(isBoss) {
    const [lo, hi] = danRange(S.wave);
    for (let tries = 0; tries < 12; tries++) {
      let a;
      if (isBoss) a = randInt(Math.max(lo, Math.ceil((lo + hi) / 2)), hi);
      else if (lo === 2 && hi === 9 && S.diff !== 'easy' && Math.random() < 0.35) a = randInt(6, 9);
      else a = randInt(lo, hi);
      const b = S.diff === 'easy' || (S.diff === 'normal' && S.wave <= 3) ? randInt(1, 9) : randInt(2, 9);
      const dup = S.enemies.some(e => e.q && e.q.a === a && e.q.b === b);
      if (!dup || tries === 11) return { a, b, ans: a * b };
    }
  }

  // ================= 웨이브 구성 =================
  function buildWave(w) {
    const list = [];
    const n = Math.max(4, Math.round(Math.min(6 + Math.floor(w * 1.6), 42) * D().count));
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
    for (let i = 0; i < Math.min(3, list.length); i++) if (ENEMIES[list[i]].probs > 1) list[i] = 'soldier';
    if (w === FINAL_WAVE) list.push('demonking');
    else if (w % 5 === 0) list.push(BOSS_ORDER[(w / 5 - 1) % BOSS_ORDER.length]);
    const interval = Math.max(0.8, 2.5 - w * 0.08) * D().interval;
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
    return { dan, kinds, boss: boss ? ENEMIES[boss.type].name : null };
  }

  // ================= 적 =================
  function hpMul(w) { return 1 + 0.18 * (w - 1) + 0.012 * (w - 1) * (w - 1); }
  function spdMul(w) { return Math.min(2.0, 1 + 0.035 * (w - 1)); }

  function setEnemyPos(e) {
    const p = World.pathAt(e.t, e.lane);
    e.x = p.x; e.z = p.z; e.dx = p.dx; e.dz = p.dz;
  }

  function spawnEnemy(type) {
    const def = ENEMIES[type];
    const lane = def.boss ? 0 : def.probs > 1 ? (Math.random() < 0.5 ? -0.35 : 0.35) : (Math.random() - 0.5) * 1.5;
    const maxHp = Math.round(def.hp * hpMul(S.wave) * D().hp);
    const e = {
      type, def, lane,
      t: 0, x: 0, z: 0, dx: 1, dz: 0,
      hp: maxHp, maxHp, probsLeft: def.probs,
      speed: World.pathLength / CROSS_TIME * def.speed * spdMul(S.wave) * D().speed * (0.92 + Math.random() * 0.16),
      phase: Math.random() * 6, hitT: 0, slowT: 0, slowMul: 1, frozen: 0,
      q: null,
    };
    setEnemyPos(e);
    e.q = makeProblem(def.boss);
    S.enemies.push(e);
    World.addEnemy(e);
    if (def.final) {
      showBanner(`👑 최종 보스: ${def.name} 등장!`, 'boss', 3200);
      Sound.play('boss');
      Sound.setIntensity(2);
      S.shake = 12;
    } else if (def.boss) {
      showBanner(`⚠ 보스 등장: ${def.name}!`, 'boss', 2600);
      Sound.play('boss');
      Sound.setIntensity(2);
      S.shake = 6;
    }
  }

  function enemyCenter(e) { return { x: e.x, y: World.enemyCenterY(e), z: e.z }; }

  function syncProbs(e) {
    const per = e.maxHp / e.def.probs;
    e.probsLeft = Math.max(1, Math.ceil(e.hp / per - 1e-6));
  }

  function damage(e, amt) {
    if (e.dead) return;
    e.hp -= amt;
    e.hitT = 0.1;
    if (e.hp <= 0) kill(e);
    else if (e.def.probs > 1) syncProbs(e);
  }

  function kill(e) {
    if (e.dead) return;
    e.dead = true;
    S.gems += e.def.gems;
    S.stats.kills++;
    const c = enemyCenter(e);
    floater(c.x, c.y + 0.6, c.z, `+${e.def.gems}💎`, '#9fe6ff', e.def.boss ? 28 : 20);
    World.burst(c.x, c.y, c.z, e.def.boss ? 50 : 16, ['#ffffff', '#d8433a', '#f4c247', '#8fe0ff'], e.def.boss ? 1.6 : 1);
    World.removeEnemy(e);
    Sound.play('die');
    setTimeout(() => Sound.play('gem'), 120);
    if (e.def.boss) {
      showBanner(`🏆 ${e.def.name} 처치!`, 'good', 2200);
      S.shake = 12;
      World.explosion(c.x, c.y, c.z, 3.5);
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
      const sl = World.slots[t.slot];
      const st = towerStats(t.type);
      t.recoil = Math.max(0, (t.recoil || 0) - dt * 4);
      t.cd -= dt;
      let best = null;
      for (const e of S.enemies) {
        if (e.dead || e.t <= 0.005) continue;
        const d = Math.hypot(e.x - sl.x, e.z - sl.z);
        if (d <= st.range && (!best || e.t > best.t)) best = e;
      }
      if (best) {
        t.aim = Math.atan2(-(best.z - sl.z), best.x - sl.x);
        if (t.cd <= 0) {
          t.cd = 1 / st.rate;
          t.recoil = 1;
          fire(t, best, st);
        }
      }
    }
  }

  function addProj(p) { S.projectiles.push(p); World.addProjectile(p); }

  function fire(t, e, st) {
    const m = World.muzzle(t);
    if (t.type === 'archer') {
      addProj({ kind: 'arrow', x: m.x, y: m.y, z: m.z, target: e, speed: 24, dmg: st.dmg });
      Sound.play('arrow');
    } else if (t.type === 'cannon') {
      const c = enemyCenter(e);
      // 날아가는 동안 적이 움직일 거리만큼 앞을 조준
      const dur = 0.75;
      const ahead = e.frozen > 0 ? 0 : e.speed * (e.slowT > 0 ? e.slowMul : 1) * dur / World.pathLength;
      const p = World.pathAt(Math.min(1, e.t + ahead), e.lane);
      addProj({ kind: 'ball', sx: m.x, sy: m.y, sz: m.z, tx: p.x, ty: e.def.fly ? c.y : 0.3, tz: p.z, t: 0, dur, dmg: st.dmg, splash: st.splash, x: m.x, y: m.y, z: m.z });
      Sound.play('cannon');
      World.burst(m.x + Math.cos(t.aim) * 1.2, m.y, m.z - Math.sin(t.aim) * 1.2, 6, ['#dddddd', '#999999', '#ffb030'], 0.5, { grav: 2 });
    } else {
      addProj({ kind: 'frost', x: m.x, y: m.y, z: m.z, target: e, speed: 16, dmg: st.dmg, slow: st.slow, slowT: st.slowT });
      Sound.play('frost');
    }
  }

  function updateProjectiles(dt) {
    for (const p of S.projectiles) {
      if (p.kind === 'ball') {
        p.t += dt / p.dur;
        const k = Math.min(1, p.t);
        p.x = p.sx + (p.tx - p.sx) * k;
        p.z = p.sz + (p.tz - p.sz) * k;
        p.y = p.sy + (p.ty - p.sy) * k + Math.sin(k * Math.PI) * 3.5;
        if (p.t >= 1) { p.done = true; explode(p.tx, p.ty, p.tz, p.splash, p.dmg); }
        continue;
      }
      const tgt = p.target;
      if (tgt && !tgt.dead) { const c = enemyCenter(tgt); p.lx = c.x; p.ly = c.y; p.lz = c.z; }
      if (p.lx === undefined) { p.done = true; continue; }
      const dx = p.lx - p.x, dy = p.ly - p.y, dz = p.lz - p.z, d = Math.hypot(dx, dy, dz);
      const step = p.speed * dt;
      p.vx = dx; p.vy = dy; p.vz = dz;
      if (d <= step + 0.2) {
        p.done = true;
        if (tgt && !tgt.dead) {
          damage(tgt, p.dmg);
          if (p.kind === 'frost') {
            if (!tgt.dead) {
              const res = tgt.def.boss ? 0.5 : 1;
              tgt.slowT = Math.max(tgt.slowT, p.slowT * res);
              tgt.slowMul = 1 - p.slow * res;
            }
            World.burst(p.lx, p.ly, p.lz, 8, ['#bff4ff', '#7fd8ff', '#ffffff'], 0.6);
          } else {
            World.burst(p.lx, p.ly, p.lz, 3, ['#ffffff', '#e8d2a0'], 0.4);
            Sound.play('hit');
          }
        }
      } else {
        p.x += dx / d * step; p.y += dy / d * step; p.z += dz / d * step;
      }
    }
    S.projectiles = S.projectiles.filter(p => { if (p.done) World.removeProjectile(p); return !p.done; });
  }

  function explode(x, y, z, r, dmg) {
    World.explosion(x, y + 0.3, z, r * 0.75);
    Sound.play('boom');
    S.shake = Math.max(S.shake, 2);
    for (const e of S.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.z - z);
      if (d <= r + 0.4 * e.def.size) damage(e, dmg * (d < r * 0.4 ? 1 : 0.7));
    }
  }

  // ================= 업데이트 =================
  function update(dt) {
    if (S.fast) dt *= 2;
    S.freezeT = Math.max(0, S.freezeT - dt);

    if (S.queue.length) {
      S.spawnT -= dt;
      if (S.spawnT <= 0) {
        const next = S.queue.shift();
        spawnEnemy(next.type);
        S.spawnT = S.queue.length ? S.queue[0].delay : 0;
      }
    }

    for (const e of S.enemies) {
      if (e.dead) continue;
      e.hitT = Math.max(0, e.hitT - dt);
      e.frozen = Math.max(0, e.frozen - dt);
      if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowMul = 1; }
      let sp = e.speed;
      if (e.frozen > 0) sp = 0;
      else if (e.slowT > 0) sp *= e.slowMul;
      e.t += sp * dt / World.pathLength;
      setEnemyPos(e);
      e.phase += sp * dt * 3.2 / Math.max(0.8, e.def.size);
      if (e.t >= 1) { e.dead = true; World.removeEnemy(e); hitCastle(e); }
    }
    S.enemies = S.enemies.filter(e => !e.dead);

    updateTowers(dt);
    updateProjectiles(dt);

    if (S.mode === 'wave' && !S.queue.length && !S.enemies.length && S.castleHp > 0) waveClear();
  }

  function hitCastle(e) {
    S.castleHp = Math.max(0, S.castleHp - e.def.dmg);
    S.shake = Math.min(16, 6 + e.def.dmg * 0.25);
    S.castleFlash = 0.5;
    S.combo = 0;
    const C = World.CASTLE;
    floater(C.x - 1, 5, C.z, `-${e.def.dmg}`, '#ff5040', 26);
    World.burst(C.x - 2.2, 1.5, C.z, 16, ['#d3cbbd', '#a69f92', '#ffb030'], 1.2);
    Sound.play('castleHit');
    if (navigator.vibrate) try { navigator.vibrate(60); } catch (_) { /* 무시 */ }
    if (S.castleHp <= 0) gameOver();
  }

  function updateOverlayFx(dt) {
    for (const b of S.bolts) b.life -= dt;
    S.bolts = S.bolts.filter(b => b.life > 0);
    for (const f of S.floaters) { f.life -= dt; f.rise += dt * 40; }
    S.floaters = S.floaters.filter(f => f.life > 0);
    S.shake = Math.max(0, S.shake - dt * 30);
    S.castleFlash = Math.max(0, S.castleFlash - dt * 1.5);
  }

  function floater(x, y, z, text, color, size = 20) {
    S.floaters.push({ x, y, z, text, color, size, life: 1.15, rise: 0 });
  }

  // ================= 정답 입력 =================
  const answerEl = $('answer');
  const answerBox = $('answerBox');
  const comboEl = $('combo');

  function targetable() { return S.enemies.filter(e => !e.dead && e.t > 0.01); }

  function pressDigit(d) {
    if (S.mode !== 'wave' || S.paused) return;
    if (S.input.length >= 2) S.input = '';
    S.input += d;
    Sound.play('key');
    renderAnswer();
    const v = S.input;
    const answers = targetable().map(e => String(e.q.ans));
    if (!answers.length) return;
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
    if (best) correct(best); else wrong();
    S.input = '';
    renderAnswer();
  }

  function correct(e) {
    S.combo++;
    S.bestCombo = Math.max(S.bestCombo, S.combo);
    S.stats.correct++;
    const gold = Math.round((4 + e.q.a) * (1 + 0.15 * S.up.bounty) * D().gold) + Math.min(10, Math.floor(S.combo / 5) * 2);
    S.gold += gold;
    const c = enemyCenter(e);
    floater(c.x, World.enemyHeadY(e) + 0.4, c.z, `+${gold}`, '#ffd34a', 24);
    // 성 꼭대기에서 번개
    const top = World.castleTop;
    S.bolts.push({ from: { x: top.x, y: top.y, z: top.z }, to: c, life: 0.3, max: 0.3, jit: Array.from({ length: 10 }, () => [Math.random() - 0.5, Math.random() - 0.5]) });
    World.burst(c.x, c.y, c.z, 12, ['#fff7b0', '#ffe14a', '#9fe6ff'], 0.9);
    World.ring(e.x, e.z, 1.6, '#ffe14a');
    Sound.play('correct', S.combo);
    flashBox('right');
    if (e.def.probs <= 1 || e.probsLeft <= 1) {
      e.hp = 0; kill(e);
    } else {
      const per = e.maxHp / e.def.probs;
      e.probsLeft--;
      e.hp = Math.min(e.hp, e.probsLeft * per);
      e.hitT = 0.18;
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
    // 쉬움: 성에 가장 가까운 적에게 건너뛰며 세기 힌트 표시
    if (D().hint) {
      const lead = targetable().sort((a, b) => b.t - a.t)[0];
      if (lead) lead.hint = true;
    }
  }

  let boxTimer = 0;
  function flashBox(cls) {
    answerBox.classList.remove('wrong', 'right');
    void answerBox.offsetWidth;
    answerBox.classList.add(cls);
    clearTimeout(boxTimer);
    boxTimer = setTimeout(() => answerBox.classList.remove(cls), 350);
  }
  function renderAnswer() { answerEl.textContent = S.input; }

  // ================= 스킬 =================
  function useSkill(key) {
    const sk = SKILLS[key];
    if (S.gems < sk.cost) { Sound.play('wrong'); return; }
    const C = World.CASTLE;
    if (key === 'repair') {
      const max = castleMax(S.up.castle);
      if (S.castleHp >= max) return;
      S.gems -= sk.cost;
      const heal = Math.round(max * 0.3);
      S.castleHp = Math.min(max, S.castleHp + heal);
      floater(C.x, 6, C.z, `+${heal}❤`, '#7dff8a', 26);
      World.burst(C.x, 3, C.z, 30, ['#7dff8a', '#ffffff', '#c8ffb0'], 1, { grav: -4 });
      Sound.play('upgrade');
    } else {
      if (S.mode !== 'wave' || !S.enemies.length) return;
      S.gems -= sk.cost;
      Sound.play('skill');
      if (key === 'freeze') {
        S.freezeT = 4;
        for (const e of S.enemies) {
          e.frozen = e.def.boss ? 2 : 4;
          World.burst(e.x, 1, e.z, 6, ['#ffffff', '#bff4ff'], 0.6);
        }
        showBanner('❄ 얼음 폭풍!', '', 1200);
      } else {
        showBanner('☄ 유성 낙하!', '', 1200);
        S.enemies.slice().forEach((e, i) => {
          const p = World.pathAt(Math.min(1, e.t + (e.frozen > 0 ? 0 : e.speed * 0.7 / World.pathLength)), e.lane);
          World.meteor(p.x, p.z, i * 0.06, () => {
            World.explosion(p.x, 0.5, p.z, 2.2);
            Sound.play('boom');
            S.shake = Math.max(S.shake, 5);
            if (!e.dead) damage(e, e.maxHp * (e.def.boss ? 0.15 : 0.45));
            S.enemies = S.enemies.filter(x => !x.dead);
          });
        });
      }
    }
    if (S.mode === 'prep') save();
    updateHud(true);
  }

  // ================= 웨이브 흐름 =================
  function enterPrep() {
    S.mode = 'prep';
    S.fast = false;
    clearField(false);
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
    S.castleHp = Math.min(max, S.castleHp + Math.round(max * 0.1));
    showBanner(`🎉 웨이브 ${S.wave} 승리! +${bonus}G`, 'good', 2400);
    Sound.play('victory');
    const clearedNow = S.wave === FINAL_WAVE && !S.cleared;
    if (clearedNow) S.cleared = true;
    S.wave++;
    updateRecord(S.wave - 1, clearedNow);
    enterPrep();
    if (clearedNow) showClear();
  }

  // ================= 기록 (난이도별 최고 웨이브, 클리어 여부) =================
  function loadRecords() {
    let r = {};
    try { r = JSON.parse(lsGet(RECORD_KEY)) || {}; } catch (_) { r = {}; }
    const old = +(lsGet(BEST_KEY) || 0); // 예전 버전 기록은 보통 난이도로
    if (old && !(r.normal && r.normal.best >= old)) r.normal = Object.assign({ best: 0 }, r.normal, { best: old });
    return r;
  }
  function updateRecord(wave, cleared) {
    const r = loadRecords();
    const cur = r[S.diff] || { best: 0, cleared: false };
    cur.best = Math.max(cur.best || 0, wave);
    if (cleared) cur.cleared = true;
    r[S.diff] = cur;
    try { localStorage.setItem(RECORD_KEY, JSON.stringify(r)); } catch (_) { /* 무시 */ }
  }

  function showClear() {
    Sound.play('victory');
    setTimeout(() => Sound.play('upgrade'), 600);
    $('clearStats').innerHTML =
      `난이도 <b>${D().icon} ${D().name}</b>에서 마왕을 물리쳤어요!<br>` +
      `정답 ${S.stats.correct}개 · 처치 ${S.stats.kills}마리 · 최고 콤보 ${S.bestCombo}`;
    S.paused = true;
    setTimeout(() => show('clear'), 1200);
  }

  function gameOver() {
    if (S.mode === 'over') return;
    S.mode = 'over';
    Sound.setIntensity(0);
    Sound.play('lose');
    updateControls();
    const sv = loadSave();
    $('retryWave').textContent = sv ? sv.wave : S.wave;
    $('goStats').innerHTML =
      `${D().icon} ${D().name} · 웨이브 <b>${S.wave}</b>에서 쓰러졌습니다.<br>정답 ${S.stats.correct}개 · 처치 ${S.stats.kills}마리 · 최고 콤보 ${S.bestCombo}`;
    setTimeout(() => show('gameover'), 900);
  }

  // ================= 저장 / 불러오기 =================
  function lsGet(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
  function save() {
    if (S.mode !== 'prep') return;
    const data = {
      v: 2, diff: S.diff, cleared: S.cleared, wave: S.wave, gold: S.gold, gems: S.gems, castleHp: S.castleHp,
      up: S.up, towers: S.towers.map(t => ({ slot: t.slot, type: t.type, paid: t.paid })),
      stats: S.stats, bestCombo: S.bestCombo, savedAt: Date.now(),
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (_) { /* 저장 불가 환경 */ }
  }
  function loadSave() {
    try {
      const d = JSON.parse(lsGet(SAVE_KEY));
      if (!d || !(d.wave >= 1)) return null;
      if (d.v === 1) {
        // 예전(2D) 버전 저장: 탑 위치가 달라졌으므로 탑 비용을 골드로 돌려준다
        d.gold += (d.towers || []).reduce((s, t) => s + (TOWERS[t.type] ? TOWERS[t.type].cost : 0), 0);
        d.towers = []; d.v = 2;
      }
      if (d.v === 2) return d;
    } catch (_) { /* 무시 */ }
    return null;
  }

  function newGame(diff) {
    clearField(true);
    S.diff = DIFFS[diff] ? diff : 'normal';
    S.cleared = false;
    Object.assign(S, {
      wave: 1, gold: D().startGold, gems: 0, castleHp: castleMax(0), up: emptyUp(),
      towers: [], stats: { kills: 0, correct: 0, wrong: 0 }, bestCombo: 0,
    });
    enterPrep();
  }

  function loadGame(d, fullHp) {
    clearField(true);
    S.diff = DIFFS[d.diff] ? d.diff : 'normal';
    S.cleared = !!d.cleared;
    Object.assign(S, {
      wave: d.wave, gold: d.gold, gems: d.gems,
      up: Object.assign(emptyUp(), d.up),
      towers: [], stats: d.stats || { kills: 0, correct: 0, wrong: 0 }, bestCombo: d.bestCombo || 0,
    });
    (d.towers || []).forEach(t => {
      if (!TOWERS[t.type] || !World.slots[t.slot] || towerAt(t.slot)) return;
      const tw = { slot: t.slot, type: t.type, paid: t.paid || TOWERS[t.type].cost, cd: 0, recoil: 0 };
      S.towers.push(tw); World.addTower(tw);
    });
    const max = castleMax(S.up.castle);
    S.castleHp = fullHp ? max : Math.max(1, Math.min(max, d.castleHp || max));
    enterPrep();
  }

  // 전장 정리 (towersToo=true면 탑도 제거)
  function clearField(towersToo) {
    World.clearEnemies(); World.clearProjectiles(); World.clearFx();
    if (towersToo) { World.clearTowers(); S.towers = []; }
    S.enemies = []; S.projectiles = []; S.bolts = []; S.floaters = [];
    S.queue = []; S.combo = 0; S.input = ''; S.freezeT = 0; S.paused = false; S.fast = false;
    renderAnswer();
  }

  // ================= 오버레이 (문제 말풍선, 글자, 번개) =================
  const LABEL_FONT = '22px "Jua", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

  function rrect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  function drawOverlay(sx, sy) {
    const c = octx;
    c.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr);
    c.clearRect(-50, -50, VW + 100, VH + 100);
    const t = S.time;

    // 번개
    for (const b of S.bolts) {
      const a = World.project(b.from.x, b.from.y, b.from.z), z = World.project(b.to.x, b.to.y, b.to.z);
      const len = Math.hypot(z.x - a.x, z.y - a.y), nx = -(z.y - a.y) / len, ny = (z.x - a.x) / len;
      c.save();
      c.globalAlpha = Math.max(0, b.life / b.max);
      c.lineJoin = 'round'; c.lineCap = 'round';
      c.beginPath(); c.moveTo(a.x, a.y);
      b.jit.forEach(([j], i) => {
        const f = (i + 1) / (b.jit.length + 1);
        c.lineTo(a.x + (z.x - a.x) * f + nx * j * 28, a.y + (z.y - a.y) * f + ny * j * 28);
      });
      c.lineTo(z.x, z.y);
      c.shadowColor = '#9fe6ff'; c.shadowBlur = 16;
      c.strokeStyle = 'rgba(140,220,255,.9)'; c.lineWidth = 8; c.stroke();
      c.shadowBlur = 0; c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.stroke();
      c.restore();
    }

    // 문제 말풍선: 성에 가까운 적이 위에 오도록, 겹치면 위로 올림
    const list = S.enemies.filter(e => !e.dead && e.t > 0.004).sort((a, b) => a.t - b.t);
    const lead = list[list.length - 1];
    c.font = LABEL_FONT;
    const placed = [], items = [];
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      const p = World.project(e.x, World.enemyHeadY(e), e.z);
      const text = `${e.q.a} × ${e.q.b}`;
      const w = c.measureText(text).width + 22, h = 32;
      const extra = (e.def.probs > 1 ? 12 : 0) + (e.hp < e.maxHp || e.def.boss ? 9 : 0) + (e.def.boss ? 18 : 0) + (e.hint ? 26 : 0);
      const cx = Math.max(w / 2 + 4, Math.min(VW - w / 2 - 4, p.x));
      const minY = h + extra + 4;
      const collide = y2 => placed.find(r => cx - w / 2 < r.x2 + 3 && cx + w / 2 > r.x1 - 3 && y2 - h - extra < r.y2 + 3 && y2 > r.y1 - 3);
      // 머리 위에 놓고, 겹치면 위로 밀기
      let y2 = p.y - 8;
      for (let k = 0; k < 10; k++) { const hit = collide(y2); if (!hit) break; y2 = hit.y1 - 4; }
      // 화면 위로 넘치면 발밑 쪽으로 내려서 배치
      if (y2 < minY) {
        const foot = World.project(e.x, 0, e.z);
        y2 = Math.max(minY, foot.y + h + extra + 10);
        for (let k = 0; k < 10; k++) { const hit = collide(y2); if (!hit) break; y2 = hit.y2 + h + extra + 4; }
      }
      placed.push({ x1: cx - Math.max(w, e.hint ? 150 : 0) / 2, x2: cx + Math.max(w, e.hint ? 150 : 0) / 2, y1: y2 - h - extra, y2 });
      items.push({ e, cx, y2, w, h, text, anchor: p });
    }
    items.reverse().forEach(it => drawLabel(c, it, it.e === lead));

    // 떠오르는 글자
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const f of S.floaters) {
      const p = World.project(f.x, f.y, f.z);
      c.globalAlpha = Math.min(1, f.life * 2);
      c.font = `${f.size}px "Jua", sans-serif`;
      c.lineWidth = 5; c.strokeStyle = 'rgba(30,20,10,.85)'; c.lineJoin = 'round';
      c.strokeText(f.text, p.x, p.y - f.rise);
      c.fillStyle = f.color; c.fillText(f.text, p.x, p.y - f.rise);
    }
    c.globalAlpha = 1;

    // 얼음 효과
    if (S.freezeT > 0) {
      c.fillStyle = `rgba(170,225,255,${Math.min(0.22, S.freezeT * 0.08)})`;
      c.fillRect(-20, -20, VW + 40, VH + 40);
    }
    // 성 피격 / 위험 경고 (화면 가장자리 붉은빛)
    const danger = (lead && lead.t > 0.86 && S.mode === 'wave') ? 0.35 + Math.sin(t * 10) * 0.15 : 0;
    const red = Math.max(danger, S.castleFlash);
    if (red > 0) {
      const g = c.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.35, VW / 2, VH / 2, Math.max(VW, VH) * 0.75);
      g.addColorStop(0, 'rgba(255,30,20,0)'); g.addColorStop(1, `rgba(255,30,20,${red * 0.6})`);
      c.fillStyle = g; c.fillRect(-20, -20, VW + 40, VH + 40);
    }
    if (S.fast && S.mode === 'wave') {
      c.font = '18px "Jua", sans-serif'; c.textAlign = 'left';
      c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.6)';
      c.strokeText('⏩ x2', 10, 22); c.fillStyle = '#fff'; c.fillText('⏩ x2', 10, 22);
    }
  }

  function drawLabel(c, it, highlight) {
    const { e, cx, y2, w, h, text, anchor } = it;
    const boss = e.def.boss;
    const x = cx - w / 2, y = y2 - h;
    // 연결선 (말풍선이 위로 밀려났을 때)
    if (anchor.y - 8 - y2 > 6) {
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(cx, y2); c.lineTo(anchor.x, anchor.y - 6); c.stroke();
    }
    c.fillStyle = 'rgba(0,0,0,.28)'; rrect(c, x + 1, y + 3, w, h, 11); c.fill();
    c.fillStyle = boss ? '#5b2a86' : highlight ? '#fff3b0' : '#ffffff';
    rrect(c, x, y, w, h, 11); c.fill();
    c.lineWidth = highlight ? 3.5 : 2.5;
    c.strokeStyle = boss ? '#e7b6ff' : highlight ? '#f0a020' : '#2b3a4a';
    c.stroke();
    // 꼬리
    c.fillStyle = boss ? '#5b2a86' : highlight ? '#fff3b0' : '#ffffff';
    c.beginPath(); c.moveTo(cx - 6, y2 - 1); c.lineTo(cx, y2 + 6); c.lineTo(cx + 6, y2 - 1); c.fill();
    c.font = LABEL_FONT;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = boss ? '#ffffff' : '#1f2a36';
    c.fillText(text, cx, y + h / 2 + 1);
    let by = y - 6;
    if (e.def.probs > 1) {
      const n = e.def.probs, gap = 11, sx = cx - ((n - 1) * gap) / 2;
      for (let i = 0; i < n; i++) {
        c.beginPath(); c.arc(sx + i * gap, by, 4.2, 0, 7);
        c.fillStyle = i < e.probsLeft ? '#ffd23f' : 'rgba(40,40,40,.55)'; c.fill();
        c.lineWidth = 1.5; c.strokeStyle = 'rgba(0,0,0,.6)'; c.stroke();
      }
      by -= 12;
    }
    if (e.hp < e.maxHp || boss) {
      const bw = Math.max(44, w * 0.9), bx = cx - bw / 2;
      c.fillStyle = 'rgba(20,20,20,.75)'; rrect(c, bx - 1.5, by - 4, bw + 3, 7, 3); c.fill();
      c.fillStyle = boss ? '#c66bff' : '#ff4d3d';
      rrect(c, bx, by - 2.5, Math.max(0, bw * e.hp / e.maxHp), 4, 2); c.fill();
      by -= 9;
    }
    if (boss) {
      c.font = '15px "Jua", sans-serif';
      c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.8)';
      c.strokeText(e.def.name, cx, by - 4);
      c.fillStyle = e.def.final ? '#ff8a7a' : '#ffe9a8'; c.fillText(e.def.name, cx, by - 4);
      by -= 18;
    }
    // 쉬움 힌트: 건너뛰며 세기 (예: 7 × 4 → 7, 14, 21, ?)
    if (e.hint) {
      const { a, b } = e.q;
      const seq = b === 1 ? `${a} × 1 은 그대로 ${a}!` : '💡 ' + Array.from({ length: b - 1 }, (_, i) => a * (i + 1)).join(', ') + ', ?';
      c.font = '15px "Jua", sans-serif';
      const tw = c.measureText(seq).width + 16;
      const hx = Math.max(4, Math.min(VW - tw - 4, cx - tw / 2));
      c.fillStyle = '#fff7c2'; rrect(c, hx, by - 22, tw, 22, 8); c.fill();
      c.lineWidth = 2; c.strokeStyle = '#e09a10'; c.stroke();
      c.fillStyle = '#7a4a00'; c.textAlign = 'left';
      c.fillText(seq, hx + 8, by - 10.5);
      c.textAlign = 'center';
    }
  }

  // ================= HUD / UI =================
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
    let html = `${D().icon} ${D().name} · 다음 웨이브 <b>${S.wave}</b>${S.wave > FINAL_WAVE ? ' (♾ 무한)' : ` / ${FINAL_WAVE}`} · 문제 <b>${p.dan}</b> · ${p.kinds}`;
    if (S.wave === FINAL_WAVE) html += ` · 👑 <b>최종 보스: ${p.boss}</b>`;
    else if (p.boss) html += ` · ⚠ <b>보스: ${p.boss}</b>`;
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

  function show(id) { $(id).classList.remove('hidden'); }
  function hide(id) { $(id).classList.add('hidden'); }

  function refreshTitle() {
    const sv = loadSave();
    const btn = $('btnContinue');
    if (sv) {
      btn.classList.remove('hidden');
      const dd = DIFFS[sv.diff] || DIFFS.normal;
      $('continueInfo').textContent = `${dd.icon} ${dd.name} · 웨이브 ${sv.wave} · 💰${sv.gold} · 💎${sv.gems} · 탑 ${sv.towers.length}개`;
    } else btn.classList.add('hidden');
    const r = loadRecords();
    const parts = Object.keys(DIFFS).filter(k => r[k] && r[k].best).map(k =>
      `${DIFFS[k].icon} ${DIFFS[k].name} ${r[k].cleared ? '👑클리어' : `웨이브 ${r[k].best}`}`);
    $('bestInfo').textContent = parts.length ? `🏆 최고 기록 · ${parts.join(' · ')}` : '';
  }

  // 새 게임: 난이도 고르기
  function openDifficulty() {
    const r = loadRecords();
    hide('title');
    openModal('난이도 선택', `<div class="opt-list">${Object.entries(DIFFS).map(([k, d]) => `
      <button class="opt diff-${k}" data-diff="${k}">
        <span class="icon">${d.icon}</span>
        <span class="info"><b>${d.name}</b>${r[k] && r[k].cleared ? ' <span class="lvl">👑 클리어</span>' : ''}<small>${d.desc}</small></span>
      </button>`).join('')}</div>`);
    document.querySelectorAll('#modalBody [data-diff]').forEach(b => b.onclick = () => {
      if (loadSave() && !confirm('저장된 게임이 있어요. 새 게임을 시작하면 지워집니다. 계속할까요?')) return;
      closeModal();
      beginPlay();
      newGame(b.dataset.diff);
      showBanner(`${D().icon} ${D().name} 난이도로 시작!`, 'good', 1600);
    });
  }

  function beginPlay() {
    Sound.init();
    Sound.startMusic();
    hide('title'); hide('gameover');
    requestAnimationFrame(resize);
  }

  // ---------- 모달 ----------
  let modalOpen = false;
  function openModal(title, html) {
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML = html;
    show('modal');
    modalOpen = true;
    S.paused = true;
  }
  function closeModal() {
    hide('modal');
    modalOpen = false;
    S.paused = false;
    if (S.mode === 'title') show('title');
  }
  $('modalClose').onclick = closeModal;
  $('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

  const TOWER_ICON = { archer: '🏹', cannon: '💣', mage: '🔮' };

  function openBuild(slot) {
    const html = `<div class="opt-list">${Object.entries(TOWERS).map(([key, d]) => {
      const st = towerStats(key), cost = towerCost(key);
      return `<button class="opt" data-build="${key}" ${S.gold < cost ? 'disabled' : ''}>
        <span class="icon">${TOWER_ICON[key]}</span>
        <span class="info"><b>${d.name}</b><small>${d.desc}<br>피해 ${Math.round(st.dmg)} · 초당 ${st.rate.toFixed(2)}회</small></span>
        <span class="cost">${cost}<i class="coin"></i></span></button>`;
    }).join('')}</div>`;
    openModal('🔨 탑 건설', html);
    document.querySelectorAll('#modalBody [data-build]').forEach(b => b.onclick = () => {
      const type = b.dataset.build, cost = towerCost(type);
      if (S.gold < cost || towerAt(slot)) return;
      S.gold -= cost;
      const tw = { slot, type, cd: 0, recoil: 0, paid: cost };
      S.towers.push(tw);
      World.addTower(tw);
      const s = World.slots[slot];
      World.burst(s.x, 0.5, s.z, 22, ['#d3cbbd', '#9a6638', '#f4c247', '#ffffff'], 0.9);
      World.ring(s.x, s.z, 1.8, '#ffe27a');
      Sound.play('build');
      closeModal();
      save(); updatePrepInfo(); updateHud(true);
    });
  }

  function openTower(tw) {
    const d = TOWERS[tw.type], st = towerStats(tw.type);
    const refund = Math.round((tw.paid || d.cost) * 0.5);
    const html = `
      <p class="stat-line">피해 <b>${Math.round(st.dmg)}</b> · 초당 <b>${st.rate.toFixed(2)}</b>회
      ${st.splash ? ' · 폭발 공격' : ''}${st.slow ? ` · 둔화 ${Math.round(st.slow * 100)}%` : ''}</p>
      <div class="opt-list">
        <button class="opt" data-act="upgrade"><span class="icon">⚒</span><span class="info"><b>강화하러 가기</b><small>골드로 같은 종류의 모든 탑을 강하게!</small></span></button>
        <button class="opt danger" data-act="sell"><span class="icon">🪙</span><span class="info"><b>철거하기</b><small>건설 비용의 절반을 돌려받아요</small></span><span class="cost">+${refund}<i class="coin"></i></span></button>
      </div>`;
    openModal(`${TOWER_ICON[tw.type]} ${d.name}`, html);
    World.ring(World.slots[tw.slot].x, World.slots[tw.slot].z, d.range, '#ffffff');
    $('modalBody').querySelector('[data-act=upgrade]').onclick = () => { closeModal(); openUpgrades(); };
    $('modalBody').querySelector('[data-act=sell]').onclick = () => {
      S.towers = S.towers.filter(t => t !== tw);
      const s = World.slots[tw.slot];
      World.burst(s.x, 0.8, s.z, 20, ['#d3cbbd', '#9a6638', '#777'], 0.9);
      World.removeTower(tw);
      S.gold += refund;
      Sound.play('coin');
      closeModal(); save(); updatePrepInfo(); updateHud(true);
    };
  }

  function openUpgrades() {
    const render = () => {
      const html = `<p class="stat-line">보유 골드 <b>${S.gold}</b><i class="coin"></i></p><div class="opt-list">${Object.entries(UPGRADES).map(([key, u]) => {
        const lvl = S.up[key], maxed = lvl >= u.max, cost = upCost(key, lvl);
        return `<button class="opt" data-up="${key}" ${maxed || S.gold < cost ? 'disabled' : ''}>
          <span class="icon">${u.icon}</span>
          <span class="info"><b>${u.name}</b> <span class="lvl">Lv.${lvl}${maxed ? ' (MAX)' : ''}</span><small>${u.desc(lvl)}</small></span>
          <span class="cost">${maxed ? '—' : cost + '<i class="coin"></i>'}</span></button>`;
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
      <ul><li>길을 따라 몰려오는 적들로부터 성을 지키세요.</li>
      <li>적이 성에 닿으면 성 체력이 줄고, 0이 되면 게임 오버!</li></ul>
      <h3>✖ 구구단 공격</h3>
      <ul><li>적 머리 위의 문제 <b>(예: 7 × 8)</b>의 답을 숫자판이나 키보드로 입력하세요.</li>
      <li>정답이면 성에서 번개가 떨어지고 <b>골드</b>를 얻어요. 연속 정답은 콤보 보너스!</li>
      <li>같은 답을 가진 적이 여럿이면 성에 가장 가까운 적부터 맞아요. (노란 말풍선)</li>
      <li>오우거·트롤·보스는 문제를 여러 번 맞혀야 쓰러져요. (말풍선 위 ● 개수)</li></ul>
      <h3>🏹 탑 건설</h3>
      <ul><li>길 옆 빈 칸(+)을 눌러 <b>궁수탑 · 대포 · 서리 마법탑</b>을 세워요. 탑은 자동으로 공격해요.</li>
      <li>세운 탑을 누르면 사거리를 보거나 철거할 수 있어요.</li></ul>
      <h3>💎 보석 &amp; 강화</h3>
      <ul><li>적을 쓰러뜨리면 <b>보석</b>을 얻어요. 보석으로 🔧성 수리, ❄얼음 폭풍, ☄유성 낙하를 쓸 수 있어요.</li>
      <li>⚒ 강화 메뉴에서 골드로 성벽, 궁수·대포·마법 공격력, 공격 속도를 올리세요.</li></ul>
      <h3>🗺 웨이브</h3>
      <ul><li>웨이브가 오를수록 적이 많아지고 빨라지며, 2단부터 점점 어려운 단이 나와요.</li>
      <li>5웨이브마다 강력한 <b>보스</b>가 등장해요!</li>
      <li><b>30웨이브</b>의 최종 보스 <b>마왕</b>을 물리치면 클리어! 그 뒤로는 무한 모드로 계속 도전할 수 있어요.</li>
      <li>난이도 <b>🌱쉬움</b>은 적이 느리고, 틀리면 💡 힌트(건너뛰며 세기)가 나와요.</li>
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
      <p class="note">진행 상황은 웨이브 시작 전 상태로 저장돼요.</p>
    </div>`);
    $('modalBody').querySelector('[data-p=resume]').onclick = closeModal;
    $('modalBody').querySelector('[data-p=help]').onclick = () => { closeModal(); openHelp(); };
    $('modalBody').querySelector('[data-p=title]').onclick = () => {
      closeModal();
      S.mode = 'title';
      clearField(true);
      Sound.setIntensity(0);
      refreshTitle();
      show('title');
    };
  }

  // ================= 입력 =================
  overlay.addEventListener('pointerdown', ev => {
    if (S.mode !== 'prep' && S.mode !== 'wave') return;
    if (modalOpen) return;
    const rect = overlay.getBoundingClientRect();
    const slot = World.pickSlot(ev.clientX - rect.left, ev.clientY - rect.top);
    if (slot < 0) return;
    Sound.init();
    const tw = towerAt(slot);
    if (tw) openTower(tw); else openBuild(slot);
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
    if (!$('clear').classList.contains('hidden')) return;
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

  $('btnNew').onclick = () => { Sound.init(); openDifficulty(); };
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
    if (sv) loadGame(sv, true); else newGame(S.diff);
  };
  $('btnGoNew').onclick = () => { hide('gameover'); refreshTitle(); show('title'); S.mode = 'title'; openDifficulty(); };
  $('btnEndless').onclick = () => { hide('clear'); S.paused = false; showBanner('♾ 무한 모드! 어디까지 갈 수 있을까?', 'boss', 2200); };
  $('btnClearTitle').onclick = () => {
    hide('clear');
    S.mode = 'title';
    clearField(true);
    Sound.setIntensity(0);
    refreshTitle();
    show('title');
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      Sound.suspend();
      if (S.mode === 'wave' && !modalOpen) openPause();
    } else Sound.resume();
  });

  // ================= 메인 루프 =================
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const run = !S.paused;
    const vdt = run ? (S.fast && S.mode === 'wave' ? dt * 2 : dt) : 0;
    if (run) {
      S.time += dt;
      if (S.mode === 'wave') update(dt);
      updateOverlayFx(vdt);
    }
    S.castleMax = castleMax(S.up.castle);
    World.sync(S, vdt, S.time);
    let sx = 0, sy = 0;
    if (S.shake > 0) { sx = (Math.random() - 0.5) * S.shake; sy = (Math.random() - 0.5) * S.shake; }
    glCanvas.style.transform = S.shake > 0.3 ? `translate(${sx}px,${sy}px)` : '';
    World.render();
    drawOverlay(sx, sy);
    updateHud(false);
    requestAnimationFrame(frame);
  }

  // ================= 시작 =================
  try { if (lsGet(SOUND_KEY) === '1') { Sound.setMuted(true); $('btnSound').textContent = '🔇'; } } catch (_) { /* 무시 */ }
  resize();
  refreshTitle();
  updateControls();
  requestAnimationFrame(frame);
  if (window.ResizeObserver) new ResizeObserver(() => resize()).observe(wrap);

  // 디버그/테스트용
  window.__game = { S, World, startWave, newGame, submit, pressDigit, useSkill, buildWave, openBuild };
})();
