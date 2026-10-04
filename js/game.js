/* 구구단 디펜스 - 게임 로직 + UI
 * 데이터: data.js / 기록: profile.js / 3D: world.js, models.js / 소리: audio.js / 아이콘: icons.js
 */
(() => {
  'use strict';
  Icons.mount();
  const I = Icons.html;
  const { TOWERS, LV_DMG, LV_RATE, LV_RANGE, ENEMIES, BOSS_ORDER, FINAL_WAVE, HERO, DIFFS, MAPS, MAP_ORDER, CARDS, RARITY, ACH, TIERS, UPGRADES } = GD;

  const SAVE_KEY = 'gugudan-defense-save-v1';
  const SOUND_KEY = 'gugudan-defense-muted';
  const CROSS_TIME = 24;          // 첫 맵 기준, 1웨이브 병사가 길 끝까지 가는 시간(초)
  const BASE_SPEED = 59.6 / CROSS_TIME; // 월드 단위/초
  const TOD = ['day', 'day', 'sunset', 'night'];
  const TOD_ICON = { day: 'sun', sunset: 'sunset', night: 'moon' };

  const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const emptyUp = () => ({ castle: 0, archer: 0, cannon: 0, mage: 0, speed: 0, hero: 0, bounty: 0 });

  // ================= 상태 =================
  const S = {
    mode: 'title', // title | prep | wave | over
    paused: false,
    diff: 'normal', map: 'forest', cleared: false,
    wave: 1, gold: 0, gems: 0,
    castleHp: 100, castleMax: 100,
    up: emptyUp(),
    towers: [], cards: [], pendingCards: null,
    enemies: [], projectiles: [], bolts: [], floaters: [], timers: [],
    queue: [], spawnT: 0,
    input: '', combo: 0, bestCombo: 0,
    heroGauge: 0, heroCd: 0,
    freezeT: 0, shake: 0, castleFlash: 0, white: 0, slowmo: 0, hitStop: 0,
    fast: false,
    stats: { kills: 0, correct: 0, wrong: 0 },
    ws: null,
    time: 0,
  };
  const D = () => DIFFS[S.diff] || DIFFS.normal;
  const MAPD = () => MAPS[S.map] || MAPS.forest;

  // ================= 화면 =================
  const $ = id => document.getElementById(id);
  const wrap = $('stageWrap'), glCanvas = $('game'), overlay = $('overlay');
  const octx = overlay.getContext('2d');
  let VW = 1, VH = 1, dpr = 1;
  World.init(glCanvas);
  Icons.hydrate();

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

  // ================= 카드 효과 =================
  let MOD = {};
  function computeMods() {
    const m = { archerRate: 0, cannonDmg: 0, cannonSplash: 0, frostSlow: 0, frostT: 0, towerDmg: 0, castleMax: 0, danGold: {},
      comboX: 1, comboCap: 10, gemMul: 1, discount: 0, mud: 0, heroCharge: 0, heroDmg: 0, ultPow: 0, chain: 0, crit: 0, bossGem: 1, waveGold: 1 };
    for (const c of S.cards) {
      const [id, param] = c.split(':');
      switch (id) {
        case 'archer_rate': m.archerRate += 0.2; break;
        case 'cannon_power': m.cannonDmg += 0.2; m.cannonSplash += 0.15; break;
        case 'frost_deep': m.frostSlow += 0.1; m.frostT += 0.6; break;
        case 'thick_wall': m.castleMax += 40; break;
        case 'dan_treasure': m.danGold[param] = true; break;
        case 'combo_master': m.comboX *= 2; m.comboCap += 10; break;
        case 'gem_mine': m.gemMul += 0.5; break;
        case 'sharp': m.towerDmg += 0.15; break;
        case 'guild': m.discount += 0.15; break;
        case 'mud': m.mud += 0.07; break;
        case 'hero_spirit': m.heroCharge += 0.35; break;
        case 'hero_blade': m.heroDmg += 0.4; m.ultPow += 0.2; break;
        case 'chain': m.chain = 0.4; break;
        case 'crit': m.crit += 0.15; break;
        case 'double_gem': m.bossGem = 2; m.waveGold = 1.5; break;
      }
    }
    MOD = m;
  }
  computeMods();
  function cardCount(id) { return S.cards.filter(c => c.split(':')[0] === id).length; }
  function cardInfo(full) {
    const [id, param] = full.split(':');
    const c = CARDS.find(x => x.id === id);
    if (!c) return null;
    return Object.assign({}, c, {
      full, name: c.param === 'dan' ? `${param}단 보물` : c.name,
      desc: c.desc.replace('{dan}', param).replace('(100 + 웨이브×10)', `${100 + S.wave * 10}`),
    });
  }
  function genOffer() {
    const pool = CARDS.filter(c => !c.max || cardCount(c.id) < c.max);
    const picks = [];
    let guard = 0;
    while (picks.length < 3 && pool.length && guard++ < 50) {
      const total = pool.reduce((s, c) => s + RARITY[c.rarity].weight, 0);
      let r = Math.random() * total, c = pool[0];
      for (const x of pool) { if ((r -= RARITY[x.rarity].weight) < 0) { c = x; break; } }
      pool.splice(pool.indexOf(c), 1);
      if (c.param === 'dan') {
        const [lo, hi] = danRange(S.wave);
        const opts = [];
        for (let d = lo; d <= hi; d++) if (!S.cards.includes(`dan_treasure:${d}`)) opts.push(d);
        if (!opts.length) continue;
        picks.push(`dan_treasure:${opts[randInt(0, opts.length - 1)]}`);
      } else picks.push(c.id);
    }
    return picks;
  }

  // ================= 문제 =================
  function danRange(w) {
    if (D().allDan) return [2, 9];
    if (S.diff === 'easy') {
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
      goblin: w >= 3 ? 2 : 0, soldier: 5,
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
    const kinds = ['goblin', 'soldier', 'knight', 'ogre', 'troll'].filter(t => counts[t]).map(t => ENEMIES[t].name).join(' · ');
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
    const maxHp = Math.round(def.hp * hpMul(S.wave) * D().hp * MAPD().hp);
    const e = {
      type, def, lane, t: 0, x: 0, z: 0, dx: 1, dz: 0,
      hp: maxHp, maxHp, probsLeft: def.probs,
      speed: BASE_SPEED * def.speed * spdMul(S.wave) * D().speed * MAPD().speed * (0.92 + Math.random() * 0.16),
      phase: Math.random() * 6, hitT: 0, slowT: 0, slowMul: 1, frozen: 0, stun: 0, burnT: 0, burnDps: 0,
      q: null,
    };
    setEnemyPos(e);
    e.q = makeProblem(def.boss);
    S.enemies.push(e);
    World.addEnemy(e);
    Profile.seeEnemy(type);
    if (def.boss) bossIntro(e);
  }
  function enemyCenter(e) { return { x: e.x, y: World.enemyCenterY(e), z: e.z }; }
  function syncProbs(e) {
    const per = e.maxHp / e.def.probs;
    e.probsLeft = Math.max(1, Math.ceil(e.hp / per - 1e-6));
  }
  function damage(e, amt, opts = {}) {
    if (e.dead) return;
    e.hp -= amt;
    if (!opts.silent) e.hitT = Math.max(e.hitT, 0.1);
    if (e.hp <= 0) kill(e);
    else if (e.def.probs > 1) syncProbs(e);
  }
  function kill(e) {
    if (e.dead) return;
    e.dead = true;
    const gems = Math.max(1, Math.round(e.def.gems * MOD.gemMul * (e.def.boss ? MOD.bossGem : 1)));
    S.gems += gems;
    S.stats.kills++;
    if (S.ws) S.ws.kills++;
    Profile.kill(e.type);
    const c = enemyCenter(e);
    floater(c.x, c.y + 0.6, c.z, `+${gems}`, '#9fe6ff', e.def.boss ? 28 : 20, 'gem');
    World.burst(c.x, c.y, c.z, e.def.boss ? 60 : 18, ['#ffffff', '#d8433a', '#f4c247', '#8fe0ff'], e.def.boss ? 1.7 : 1.1);
    World.removeEnemy(e);
    Sound.play('die');
    setTimeout(() => Sound.play('gem'), 120);
    if (e.def.boss) {
      showBanner(`${I('crown')} ${e.def.name} 처치!`, 'good', 2200);
      S.shake = 14; S.white = 0.5; S.hitStop = 0.25;
      World.explosion(c.x, c.y, c.z, 4);
      World.ring(e.x, e.z, 6, '#ffe14a', 0.8);
      Sound.play('boom');
      Sound.setMode('battle');
    }
  }

  // ================= 탑 =================
  function towerStats(type, lvl = 1) {
    const d = TOWERS[type], L = lvl - 1;
    return {
      dmg: d.dmg * LV_DMG[L] * (1 + 0.25 * S.up[type]) * (1 + MOD.towerDmg) * (type === 'cannon' ? 1 + MOD.cannonDmg : 1),
      rate: d.rate * LV_RATE[L] * (1 + 0.1 * S.up.speed) * (type === 'archer' ? 1 + MOD.archerRate : 1),
      range: d.range * LV_RANGE[L],
      splash: d.splash ? d.splash * (lvl === 3 ? 1.5 : 1) * (1 + MOD.cannonSplash) : 0,
      slow: d.slow ? Math.min(0.8, d.slow + MOD.frostSlow + (lvl >= 2 ? 0.05 : 0)) : 0,
      slowT: d.slowT ? d.slowT * (1 + 0.08 * S.up.mage) * (1 + 0.25 * L) + MOD.frostT : 0,
    };
  }
  function buildCost(type) {
    const n = S.towers.filter(t => t.type === type).length;
    return Math.round(TOWERS[type].cost * (1 + 0.2 * n) * (1 - MOD.discount));
  }
  function levelCost(tw) {
    const next = TOWERS[tw.type].levels[tw.lvl];
    return next ? Math.round(next.cost * (1 - MOD.discount)) : 0;
  }
  function targetsInRange(x, z, range, n) {
    const list = [];
    for (const e of S.enemies) {
      if (e.dead || e.t <= 0.005) continue;
      if (Math.hypot(e.x - x, e.z - z) <= range) list.push(e);
    }
    list.sort((a, b) => b.t - a.t);
    return list.slice(0, n);
  }
  function updateTowers(dt) {
    for (const t of S.towers) {
      const sl = World.slots[t.slot];
      const st = towerStats(t.type, t.lvl);
      t.recoil = Math.max(0, (t.recoil || 0) - dt * 4);
      t.cd -= dt;
      const multi = t.lvl === 3 && (t.type === 'archer' || t.type === 'mage') ? 2 : 1;
      const targets = targetsInRange(sl.x, sl.z, st.range, multi);
      if (!targets.length) continue;
      t.aim = Math.atan2(-(targets[0].z - sl.z), targets[0].x - sl.x);
      if (t.cd <= 0) {
        t.cd = 1 / st.rate;
        t.recoil = 1;
        if (t.type === 'archer' && t.lvl === 3) {
          // 엘프 2연발: 두 적에게, 적이 하나면 같은 적에게 두 발
          fire(t, targets[0], st, -0.35);
          fire(t, targets[1] || targets[0], st, 0.35);
        } else targets.forEach(e => fire(t, e, st, 0));
      }
    }
  }
  function addProj(p) { S.projectiles.push(p); World.addProjectile(p); }
  function critRoll(dmg) { return Math.random() < MOD.crit ? [dmg * 2, true] : [dmg, false]; }
  function fire(t, e, st, side) {
    const m = World.muzzle(t);
    const [dmg, crit] = critRoll(st.dmg);
    if (t.type === 'archer') {
      addProj({ kind: 'arrow', x: m.x, y: m.y, z: m.z + side, target: e, speed: 24, dmg, crit, elf: t.lvl === 3 });
      Sound.play('arrow');
    } else if (t.type === 'cannon') {
      const c = enemyCenter(e);
      const dur = 0.75;
      const ahead = e.frozen > 0 || e.stun > 0 ? 0 : e.speed * (e.slowT > 0 ? e.slowMul : 1) * dur / World.pathLength;
      const p = World.pathAt(Math.min(1, e.t + ahead), e.lane);
      addProj({ kind: 'ball', sx: m.x, sy: m.y, sz: m.z, tx: p.x, ty: e.def.fly ? c.y : 0.3, tz: p.z, t: 0, dur, dmg, crit, splash: st.splash, fire: t.lvl === 3, x: m.x, y: m.y, z: m.z });
      Sound.play('cannon');
      World.burst(m.x + Math.cos(t.aim) * 1.2, m.y, m.z - Math.sin(t.aim) * 1.2, 6, t.lvl === 3 ? ['#ff7a2a', '#ffb030', '#555'] : ['#dddddd', '#999999', '#ffb030'], 0.5, { grav: 2 });
    } else {
      addProj({ kind: 'frost', x: m.x, y: m.y, z: m.z, target: e, speed: 16, dmg, crit, slow: st.slow, slowT: st.slowT, arcane: t.lvl === 3 });
      Sound.play('frost');
    }
  }
  function updateProjectiles(dt) {
    for (const p of S.projectiles) {
      if (p.kind === 'ball') {
        p.t += dt / p.dur;
        const k = Math.min(1, p.t);
        p.x = p.sx + (p.tx - p.sx) * k; p.z = p.sz + (p.tz - p.sz) * k;
        p.y = p.sy + (p.ty - p.sy) * k + Math.sin(k * Math.PI) * 3.5;
        if (p.t >= 1) { p.done = true; explode(p); }
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
          if (p.crit) floater(p.lx, p.ly + 0.8, p.lz, '치명!', '#ffe14a', 16);
          if (p.kind === 'frost') {
            if (!tgt.dead) {
              const res = tgt.def.boss ? 0.5 : 1;
              tgt.slowT = Math.max(tgt.slowT, p.slowT * res);
              tgt.slowMul = 1 - p.slow * res;
            }
            World.burst(p.lx, p.ly, p.lz, 8, p.arcane ? ['#e6d4ff', '#a66bff', '#ffffff'] : ['#bff4ff', '#7fd8ff', '#ffffff'], 0.6);
          } else {
            World.burst(p.lx, p.ly, p.lz, 3, p.kind === 'bolt' ? ['#ffe14a', '#ffffff'] : ['#ffffff', '#e8d2a0'], 0.4);
            Sound.play('hit');
          }
        }
      } else {
        p.x += dx / d * step; p.y += dy / d * step; p.z += dz / d * step;
      }
    }
    S.projectiles = S.projectiles.filter(p => { if (p.done) World.removeProjectile(p); return !p.done; });
  }
  function explode(p) {
    World.explosion(p.tx, p.ty + 0.3, p.tz, p.splash * 0.75, p.fire ? '#ff6a1a' : '#ffb030');
    Sound.play('boom');
    S.shake = Math.max(S.shake, p.fire ? 4 : 2);
    if (p.crit) floater(p.tx, 2, p.tz, '치명!', '#ffe14a', 18);
    for (const e of S.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - p.tx, e.z - p.tz);
      if (d <= p.splash + 0.4 * e.def.size) {
        damage(e, p.dmg * (d < p.splash * 0.4 ? 1 : 0.7));
        if (!e.dead && !e.def.boss) knock(e, 0.25);
        if (p.fire && !e.dead) { e.burnT = 3; e.burnDps = p.dmg * 0.15; }
      }
    }
  }
  function knock(e, units) { e.t = Math.max(0, e.t - units / World.pathLength); }

  // ================= 영웅 =================
  function heroDmg() { return HERO.dmg * (1 + 0.3 * S.up.hero) * (1 + MOD.heroDmg) * (1 + 0.1 * (S.wave - 1)); }
  function updateHero(dt) {
    S.heroCd -= dt;
    if (S.heroCd > 0) return;
    const hs = World.heroSpot;
    const tg = targetsInRange(hs.x, hs.z, HERO.range, 1)[0];
    if (!tg) return;
    S.heroCd = 1 / HERO.rate;
    World.heroShoot(tg.x, tg.z);
    const m = World.heroMuzzle();
    addProj({ kind: 'bolt', x: m.x, y: m.y, z: m.z, target: tg, speed: 28, dmg: heroDmg() });
    Sound.play('bolt');
  }
  function addGauge(k) {
    const before = S.heroGauge;
    S.heroGauge = Math.min(1, S.heroGauge + k);
    if (before < 1 && S.heroGauge >= 1) {
      showBanner(`${I('hero')} 필살기 준비 완료!`, 'good', 1300);
      Sound.play('upgrade');
    }
  }
  function useUlt() {
    if (S.heroGauge < 1 || S.mode !== 'wave' || S.paused || !S.enemies.length) return;
    S.heroGauge = 0;
    Profile.ult();
    World.heroUlt();
    Sound.play('ult');
    showBanner(`${I('swords')} 용사의 심판!`, 'good', 1500);
    S.enemies.forEach(e => { e.stun = Math.max(e.stun, 1.6); });
    S.timers.push({ t: 0.7, fn: ultImpact });
  }
  function ultImpact() {
    const hs = World.heroSpot;
    S.white = 0.7; S.shake = 16; S.hitStop = 0.12;
    World.ring(hs.x, hs.z, 14, '#ffe14a', 0.9);
    World.ring(hs.x, hs.z, 9, '#ffffff', 0.7);
    World.burst(hs.x, 1, hs.z, 40, ['#ffe14a', '#ffffff', '#ffb030'], 1.8);
    const pow = 1 + MOD.ultPow;
    S.enemies.slice().sort((a, b) => b.t - a.t).forEach((e, i) => {
      World.meteor(e.x, e.z, i * 0.05, () => {
        World.explosion(e.x, 0.6, e.z, 1.8, '#ffe14a');
        Sound.play('hit');
        if (e.dead) return;
        if (e.def.boss) {
          const per = e.maxHp / e.def.probs;
          damage(e, per * 2 * pow);
        } else damage(e, e.maxHp * 0.6 * pow);
        S.enemies = S.enemies.filter(x => !x.dead);
      }, 'blade');
    });
  }

  // ================= 업데이트 =================
  function update(dt) {
    S.freezeT = Math.max(0, S.freezeT - dt);
    for (const tm of S.timers) { tm.t -= dt; if (tm.t <= 0 && !tm.done) { tm.done = true; tm.fn(); } }
    S.timers = S.timers.filter(t => !t.done);
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
      e.stun = Math.max(0, e.stun - dt);
      if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowMul = 1; }
      if (e.burnT > 0) { e.burnT -= dt; damage(e, e.burnDps * dt, { silent: true }); if (e.dead) continue; }
      let sp = e.speed * (1 - MOD.mud);
      if (e.frozen > 0 || e.stun > 0) sp = 0;
      else if (e.slowT > 0) sp *= e.slowMul;
      e.t += sp * dt / World.pathLength;
      setEnemyPos(e);
      e.phase += sp * dt * 3.2 / Math.max(0.8, e.def.size);
      if (e.t >= 1) { e.dead = true; World.removeEnemy(e); hitCastle(e); }
    }
    S.enemies = S.enemies.filter(e => !e.dead);
    updateTowers(dt);
    updateHero(dt);
    updateProjectiles(dt);
    if (S.mode === 'wave' && !S.queue.length && !S.enemies.length && S.castleHp > 0 && !S.timers.length) waveClear();
  }
  function hitCastle(e) {
    S.castleHp = Math.max(0, S.castleHp - e.def.dmg);
    if (S.ws) S.ws.dmg += e.def.dmg;
    S.shake = Math.min(16, 6 + e.def.dmg * 0.25);
    S.castleFlash = 0.5;
    S.combo = 0;
    const C = World.CASTLE;
    floater(C.x - 1, 5, C.z, `-${e.def.dmg}`, '#ff5040', 26, 'heart');
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
    S.white = Math.max(0, S.white - dt * 1.8);
  }
  function floater(x, y, z, text, color, size = 20, icon = null) {
    S.floaters.push({ x, y, z, text, color, size, icon, life: 1.15, rise: 0 });
  }

  // ================= 정답 입력 =================
  const answerEl = $('answer'), answerBox = $('answerBox'), comboEl = $('combo');
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
  function lightningBolt(from, to) {
    S.bolts.push({ from, to, life: 0.3, max: 0.3, jit: Array.from({ length: 10 }, () => [Math.random() - 0.5, Math.random() - 0.5]) });
  }
  function correct(e) {
    S.combo++;
    S.bestCombo = Math.max(S.bestCombo, S.combo);
    S.stats.correct++;
    if (S.ws) { S.ws.correct++; S.ws.combo = Math.max(S.ws.combo, S.combo); }
    Profile.correct(e.q.a, S.combo);
    const comboBonus = Math.min(MOD.comboCap, Math.floor(S.combo / 5) * 2 * MOD.comboX);
    const gold = Math.round((4 + e.q.a) * (1 + 0.15 * S.up.bounty) * D().gold * (MOD.danGold[e.q.a] ? 2 : 1)) + comboBonus;
    S.gold += gold;
    if (S.ws) S.ws.gold += gold;
    const c = enemyCenter(e);
    floater(c.x, World.enemyHeadY(e) + 0.4, c.z, `+${gold}`, '#ffd34a', 24, 'coin');
    // 영웅이 석궁으로 번개를 쏨
    World.heroCast(e.x, e.z);
    lightningBolt(World.heroMuzzle(), c);
    World.burst(c.x, c.y, c.z, 14, ['#fff7b0', '#ffe14a', '#9fe6ff'], 1);
    World.ring(e.x, e.z, 1.6, '#ffe14a');
    Sound.play('correct', S.combo);
    flashBox('right');
    addGauge(0.12 * (1 + 0.05 * S.up.hero) * (1 + MOD.heroCharge));
    if (e.def.probs <= 1 || e.probsLeft <= 1) {
      e.hp = 0; kill(e);
      S.hitStop = Math.max(S.hitStop, 0.05);
    } else {
      const per = e.maxHp / e.def.probs;
      e.probsLeft--;
      e.hp = Math.min(e.hp, e.probsLeft * per);
      e.hitT = 0.2;
      e.q = makeProblem(e.def.boss);
      e.hint = false;
      knock(e, e.def.boss ? 0.4 : 1.0);
      S.shake = Math.max(S.shake, e.def.boss ? 6 : 3);
      S.hitStop = Math.max(S.hitStop, e.def.boss ? 0.1 : 0.06);
    }
    // 연쇄 번개 카드
    if (MOD.chain && Math.random() < MOD.chain) {
      const other = S.enemies.filter(x => x !== e && !x.dead && x.t > 0.01).sort((a, b) => Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(b.x - e.x, b.z - e.z))[0];
      if (other && Math.hypot(other.x - e.x, other.z - e.z) < 7) {
        lightningBolt(c, enemyCenter(other));
        damage(other, other.maxHp * (other.def.boss ? 0.08 : 0.5));
        floater(other.x, World.enemyHeadY(other), other.z, '연쇄!', '#9fe6ff', 16);
      }
    }
    S.enemies = S.enemies.filter(x => !x.dead);
  }
  function wrong() {
    S.combo = 0;
    S.stats.wrong++;
    if (S.ws) S.ws.wrong++;
    Profile.wrong();
    Sound.play('wrong');
    flashBox('wrong');
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

  // ================= 보석 스킬 =================
  const SKILLS = { repair: 8, freeze: 12, meteor: 20 };
  function useSkill(key) {
    const cost = SKILLS[key];
    if (S.gems < cost) { Sound.play('wrong'); return; }
    const C = World.CASTLE;
    if (key === 'repair') {
      const max = castleMax();
      if (S.castleHp >= max) return;
      S.gems -= cost;
      const heal = Math.round(max * 0.3);
      S.castleHp = Math.min(max, S.castleHp + heal);
      floater(C.x, 6, C.z, `+${heal}`, '#7dff8a', 26, 'heart');
      World.burst(C.x, 3, C.z, 30, ['#7dff8a', '#ffffff', '#c8ffb0'], 1, { grav: -4 });
      Sound.play('upgrade');
    } else {
      if (S.mode !== 'wave' || !S.enemies.length) return;
      S.gems -= cost;
      Sound.play('skill');
      if (key === 'freeze') {
        S.freezeT = 4;
        for (const e of S.enemies) { e.frozen = e.def.boss ? 2 : 4; World.burst(e.x, 1, e.z, 6, ['#ffffff', '#bff4ff'], 0.6); }
        showBanner(`${I('snow')} 얼음 폭풍!`, '', 1200);
      } else {
        showBanner(`${I('meteor')} 유성 낙하!`, '', 1200);
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
  function castleMax(lvl = S.up.castle) { return D().castle + 25 * lvl + (MOD.castleMax || 0); }

  // ================= 보스 / 카메라 연출 =================
  function bossIntro(e) {
    const def = e.def;
    const p = World.pathAt(0.08, 0);
    World.focusOn(p.x, 2.5, p.z, 1.3, def.final ? 24 : 20);
    S.slowmo = 2.0;
    const cut = $('bossCut');
    $('bossCutSub').textContent = def.final ? 'FINAL BOSS · 최종 보스' : 'BOSS';
    $('bossCutName').textContent = def.name;
    cut.classList.toggle('final', !!def.final);
    cut.classList.remove('hidden');
    cut.querySelectorAll('.slash, .txt').forEach(el => { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; });
    clearTimeout(bossIntro.t);
    bossIntro.t = setTimeout(() => cut.classList.add('hidden'), 2400);
    Sound.play('cut');
    setTimeout(() => Sound.play('boss'), 300);
    Sound.setMode('boss');
    S.shake = 10;
  }

  // ================= 웨이브 흐름 =================
  function enterPrep() {
    S.mode = 'prep';
    S.fast = false;
    clearField(false);
    const tod = TOD[(S.wave - 1) % TOD.length];
    World.setTime(tod);
    Sound.setNight(tod === 'night' ? 1 : 0);
    Sound.setMode('prep');
    save();
    updateControls();
    updatePrepInfo();
  }
  function startWave() {
    if (S.mode !== 'prep' || S.pendingCards) return;
    S.mode = 'wave';
    S.queue = buildWave(S.wave);
    S.spawnT = S.queue[0].delay;
    S.combo = 0;
    S.ws = { correct: 0, wrong: 0, kills: 0, gold: 0, dmg: 0, combo: 0 };
    Sound.play('horn');
    Sound.setMode('battle');
    showBanner(`${I('swords')} 웨이브 ${S.wave}`, '', 1600);
    updateControls();
    updatePrepInfo();
  }
  function waveClear() {
    const ws = S.ws || { correct: 0, wrong: 0, kills: 0, gold: 0, dmg: 0, combo: 0 };
    const bonus = Math.round((25 + 6 * S.wave) * MOD.waveGold);
    S.gold += bonus;
    const max = castleMax();
    S.castleHp = Math.min(max, S.castleHp + Math.round(max * 0.1));
    const stars = ws.dmg === 0 ? 3 : ws.dmg <= max * 0.15 ? 2 : 1;
    if (stars === 3) Profile.perfectWave();
    Sound.play('victory');
    const clearedWave = S.wave;
    const clearedNow = S.wave === FINAL_WAVE && !S.cleared;
    if (clearedNow) S.cleared = true;
    S.wave++;
    Profile.record(S.map, S.diff, clearedWave, clearedNow);
    S.pendingCards = genOffer();
    S.ws = null;
    enterPrep();
    if (clearedNow) showClear();
    else showResults({ wave: clearedWave, stars, bonus, ws });
  }
  function gameOver() {
    if (S.mode === 'over') return;
    S.mode = 'over';
    Sound.setMode('prep');
    Sound.play('lose');
    updateControls();
    Profile.record(S.map, S.diff, S.wave - 1, false);
    const sv = loadSave();
    $('retryWave').textContent = sv ? sv.wave : S.wave;
    $('goStats').innerHTML =
      `${MAPD().name} · ${D().name} · 웨이브 <b>${S.wave}</b>에서 쓰러졌습니다.<br>정답 ${S.stats.correct}개 · 처치 ${S.stats.kills}마리 · 최고 콤보 ${S.bestCombo}`;
    setTimeout(() => show('gameover'), 900);
  }
  function showClear() {
    Sound.play('victory');
    setTimeout(() => Sound.play('achieve'), 700);
    World.focusOn(World.CASTLE.x, 4, World.CASTLE.z, 3.5, 26);
    for (let i = 0; i < 6; i++) setTimeout(() => World.burst(World.CASTLE.x + (Math.random() - 0.5) * 6, 8 + Math.random() * 3, World.CASTLE.z + (Math.random() - 0.5) * 6, 30, ['#ffd23f', '#ff5a6a', '#5fd3ff', '#7dff8a', '#ffffff'], 1.5, { grav: -6 }), i * 350);
    $('clearStars').innerHTML = [0, 1, 2].map(() => `<span class="on">${I('star')}</span>`).join('');
    $('clearStats').innerHTML =
      `${I(MAPD().icon)} ${MAPD().name} · ${I(D().icon)} ${D().name}에서 마왕을 물리쳤어요!<br>` +
      `정답 ${S.stats.correct}개 · 처치 ${S.stats.kills}마리 · 최고 콤보 ${S.bestCombo}`;
    setTimeout(() => show('clear'), 1500);
  }

  // ================= 저장 / 불러오기 =================
  function lsGet(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
  function save() {
    if (S.mode !== 'prep') return;
    const data = {
      v: 3, map: S.map, diff: S.diff, cleared: S.cleared, wave: S.wave, gold: S.gold, gems: S.gems, castleHp: S.castleHp,
      up: S.up, towers: S.towers.map(t => ({ slot: t.slot, type: t.type, lvl: t.lvl, paid: t.paid })),
      cards: S.cards, pendingCards: S.pendingCards, heroGauge: S.heroGauge,
      stats: S.stats, bestCombo: S.bestCombo, savedAt: Date.now(),
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (_) { /* 저장 불가 */ }
  }
  function loadSave() {
    try {
      const d = JSON.parse(lsGet(SAVE_KEY));
      if (!d || !(d.wave >= 1)) return null;
      if (d.v === 1) {
        d.gold += (d.towers || []).reduce((s, t) => s + (TOWERS[t.type] ? TOWERS[t.type].cost : 0), 0);
        d.towers = []; d.v = 2;
      }
      if (d.v === 2) { d.map = 'forest'; (d.towers || []).forEach(t => { t.lvl = 1; }); d.cards = []; d.v = 3; }
      if (d.v === 3) return d;
    } catch (_) { /* 무시 */ }
    return null;
  }
  function useMap(id) {
    if (World.mapId !== id) World.loadMap(id);
    S.map = id;
  }
  function newGame(diff, map) {
    clearField(true);
    S.diff = DIFFS[diff] ? diff : 'normal';
    useMap(MAPS[map] ? map : 'forest');
    Object.assign(S, {
      cleared: false, wave: 1, gems: 0, up: emptyUp(), towers: [], cards: [], pendingCards: null,
      heroGauge: 0, stats: { kills: 0, correct: 0, wrong: 0 }, bestCombo: 0,
    });
    computeMods();
    S.gold = D().startGold;
    S.castleHp = castleMax();
    Profile.seenHero();
    enterPrep();
  }
  function loadGame(d, fullHp) {
    clearField(true);
    S.diff = DIFFS[d.diff] ? d.diff : 'normal';
    useMap(MAPS[d.map] ? d.map : 'forest');
    Object.assign(S, {
      cleared: !!d.cleared, wave: d.wave, gold: d.gold, gems: d.gems,
      up: Object.assign(emptyUp(), d.up), towers: [], cards: d.cards || [], pendingCards: d.pendingCards || null,
      heroGauge: d.heroGauge || 0, stats: d.stats || { kills: 0, correct: 0, wrong: 0 }, bestCombo: d.bestCombo || 0,
    });
    computeMods();
    (d.towers || []).forEach(t => {
      if (!TOWERS[t.type] || !World.slots[t.slot] || towerAt(t.slot)) return;
      const tw = { slot: t.slot, type: t.type, lvl: Math.min(3, Math.max(1, t.lvl || 1)), paid: t.paid || TOWERS[t.type].cost, cd: 0, recoil: 0 };
      S.towers.push(tw); World.addTower(tw);
    });
    const max = castleMax();
    S.castleHp = fullHp ? max : Math.max(1, Math.min(max, d.castleHp || max));
    Profile.seenHero();
    enterPrep();
    if (S.pendingCards) setTimeout(openCards, 400);
  }
  function clearField(towersToo) {
    World.clearEnemies(); World.clearProjectiles(); World.clearFx();
    if (towersToo) { World.clearTowers(); S.towers = []; }
    S.enemies = []; S.projectiles = []; S.bolts = []; S.floaters = []; S.timers = [];
    S.queue = []; S.combo = 0; S.input = ''; S.freezeT = 0; S.paused = false; S.fast = false;
    renderAnswer();
  }

  // ================= 오버레이 (말풍선, 글자, 번개) =================
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
    for (const b of S.bolts) {
      const a = World.project(b.from.x, b.from.y, b.from.z), z = World.project(b.to.x, b.to.y, b.to.z);
      const len = Math.hypot(z.x - a.x, z.y - a.y) || 1, nx = -(z.y - a.y) / len, ny = (z.x - a.x) / len;
      c.save();
      c.globalAlpha = Math.max(0, b.life / b.max);
      c.lineJoin = 'round'; c.lineCap = 'round';
      c.beginPath(); c.moveTo(a.x, a.y);
      b.jit.forEach(([j], i) => {
        const f = (i + 1) / (b.jit.length + 1);
        c.lineTo(a.x + (z.x - a.x) * f + nx * j * 26, a.y + (z.y - a.y) * f + ny * j * 26);
      });
      c.lineTo(z.x, z.y);
      c.shadowColor = '#ffe14a'; c.shadowBlur = 16;
      c.strokeStyle = 'rgba(255,230,120,.9)'; c.lineWidth = 8; c.stroke();
      c.shadowBlur = 0; c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.stroke();
      c.restore();
    }
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
      let y2 = p.y - 8;
      for (let k = 0; k < 10; k++) { const hit = collide(y2); if (!hit) break; y2 = hit.y1 - 4; }
      if (y2 < minY) {
        const foot = World.project(e.x, 0, e.z);
        y2 = Math.max(minY, foot.y + h + extra + 10);
        for (let k = 0; k < 10; k++) { const hit = collide(y2); if (!hit) break; y2 = hit.y2 + h + extra + 4; }
      }
      const pw = Math.max(w, e.hint ? 150 : 0);
      placed.push({ x1: cx - pw / 2, x2: cx + pw / 2, y1: y2 - h - extra, y2 });
      items.push({ e, cx, y2, w, h, text, anchor: p });
    }
    items.reverse().forEach(it => drawLabel(c, it, it.e === lead));
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const f of S.floaters) {
      const p = World.project(f.x, f.y, f.z);
      c.globalAlpha = Math.min(1, f.life * 2);
      c.font = `${f.size}px "Jua", sans-serif`;
      let x = p.x;
      if (f.icon) {
        const tw = c.measureText(f.text).width, is = f.size * 1.05;
        x = p.x + is / 2 + 2;
        const im = Icons.img(f.icon);
        if (im.complete) c.drawImage(im, x - tw / 2 - is - 3, p.y - f.rise - is / 2, is, is);
      }
      c.lineWidth = 5; c.strokeStyle = 'rgba(30,20,10,.85)'; c.lineJoin = 'round';
      c.strokeText(f.text, x, p.y - f.rise);
      c.fillStyle = f.color; c.fillText(f.text, x, p.y - f.rise);
    }
    c.globalAlpha = 1;
    if (S.freezeT > 0) {
      c.fillStyle = `rgba(170,225,255,${Math.min(0.22, S.freezeT * 0.08)})`;
      c.fillRect(-20, -20, VW + 40, VH + 40);
    }
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
      c.strokeText('x2', 12, 22); c.fillStyle = '#fff'; c.fillText('x2', 12, 22);
    }
    $('flash').style.opacity = Math.min(0.85, S.white);
  }
  function drawLabel(c, it, highlight) {
    const { e, cx, y2, w, h, text, anchor } = it;
    const boss = e.def.boss;
    const x = cx - w / 2, y = y2 - h;
    if (anchor.y - 8 - y2 > 6) {
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(cx, y2); c.lineTo(anchor.x, anchor.y - 6); c.stroke();
    }
    c.fillStyle = 'rgba(0,0,0,.28)'; rrect(c, x + 1, y + 3, w, h, 11); c.fill();
    const bg = e.def.final ? '#7a1020' : boss ? '#5b2a86' : highlight ? '#fff3b0' : '#ffffff';
    c.fillStyle = bg; rrect(c, x, y, w, h, 11); c.fill();
    c.lineWidth = highlight ? 3.5 : 2.5;
    c.strokeStyle = e.def.final ? '#ffb0a0' : boss ? '#e7b6ff' : highlight ? '#f0a020' : '#2b3a4a';
    c.stroke();
    c.fillStyle = bg;
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
    if (e.hint) {
      const { a, b } = e.q;
      const seq = b === 1 ? `${a} × 1 은 그대로 ${a}!` : Array.from({ length: b - 1 }, (_, i) => a * (i + 1)).join(', ') + ', ?';
      c.font = '15px "Jua", sans-serif';
      const tw = c.measureText(seq).width + 34;
      const hx = Math.max(4, Math.min(VW - tw - 4, cx - tw / 2));
      c.fillStyle = '#fff7c2'; rrect(c, hx, by - 22, tw, 22, 8); c.fill();
      c.lineWidth = 2; c.strokeStyle = '#e09a10'; c.stroke();
      const im = Icons.img('bolt');
      if (im.complete) c.drawImage(im, hx + 5, by - 20, 18, 18);
      c.fillStyle = '#7a4a00'; c.textAlign = 'left';
      c.fillText(seq, hx + 26, by - 10.5);
      c.textAlign = 'center';
    }
  }

  // ================= HUD / UI =================
  const hud = { hpFill: $('hpFill'), hpText: $('hpText'), gold: $('gold'), gems: $('gems'), waveNo: $('waveNo') };
  const btnStart = $('btnStart'), heroBtn = $('heroBtn');
  const skillBtns = [...document.querySelectorAll('.skill')];
  let lastHud = '';
  function updateHud(force) {
    const max = castleMax();
    const g = Math.round(S.heroGauge * 100);
    const key = `${S.castleHp}|${max}|${S.gold}|${S.gems}|${S.wave}|${S.combo}|${S.mode}|${S.enemies.length > 0}|${g}`;
    if (!force && key === lastHud) return;
    lastHud = key;
    const r = S.castleHp / max;
    hud.hpFill.style.width = (r * 100) + '%';
    hud.hpFill.className = r < 0.25 ? 'low' : r < 0.5 ? 'mid' : '';
    hud.hpText.textContent = `${Math.ceil(S.castleHp)}/${max}`;
    hud.gold.textContent = S.gold;
    hud.gems.textContent = S.gems;
    hud.waveNo.textContent = S.wave;
    $('waveMax').textContent = S.wave > FINAL_WAVE ? '' : `/${FINAL_WAVE}`;
    comboEl.innerHTML = S.combo >= 2 ? `콤보<b>${S.combo}</b>` : '';
    skillBtns.forEach(b => {
      const k = b.dataset.skill;
      b.disabled = S.gems < SKILLS[k] || (k !== 'repair' && (S.mode !== 'wave' || !S.enemies.length)) ||
        (k === 'repair' && S.castleHp >= max) || S.mode === 'over' || S.mode === 'title';
    });
    heroBtn.classList.toggle('hidden', S.mode !== 'wave' && S.mode !== 'prep');
    heroBtn.style.setProperty('--g', S.heroGauge);
    const ready = S.heroGauge >= 1 && S.mode === 'wave';
    heroBtn.classList.toggle('ready', ready);
    heroBtn.querySelector('.lbl').textContent = ready ? '필살기!' : `${g}%`;
  }
  function updateControls() {
    if (S.mode === 'prep') {
      btnStart.innerHTML = `${I('swords')} 웨이브 ${S.wave} 시작`;
      btnStart.classList.add('pulse');
      btnStart.disabled = false;
    } else if (S.mode === 'wave') {
      btnStart.innerHTML = S.fast ? `${I('play')} 보통 속도` : `${I('fast')} 2배속`;
      btnStart.classList.remove('pulse');
      btnStart.disabled = false;
    } else btnStart.disabled = true;
    const tod = TOD[(S.wave - 1) % TOD.length];
    $('todIcon').innerHTML = I(TOD_ICON[tod]);
    updateHud(true);
  }
  function updatePrepInfo() {
    const el = $('prepInfo');
    if (S.mode !== 'prep') { el.classList.add('hidden'); return; }
    const p = wavePreview(S.wave);
    let html = `${I(MAPD().icon)} ${MAPD().name} · ${I(D().icon)} ${D().name}<br>웨이브 <b>${S.wave}</b>${S.wave > FINAL_WAVE ? ' (무한)' : ` / ${FINAL_WAVE}`} · 문제 <b>${p.dan}</b> · ${p.kinds}`;
    if (S.wave === FINAL_WAVE) html += ` · ${I('crown')} <b>최종 보스: ${p.boss}</b>`;
    else if (p.boss) html += ` · ${I('skull')} <b>보스: ${p.boss}</b>`;
    if (S.towers.length === 0) html += '<br>빈 칸(+)을 눌러 탑을 세운 뒤 시작!';
    el.innerHTML = html;
    el.classList.remove('hidden');
  }
  let bannerTimer = 0;
  function showBanner(html, cls, ms) {
    const b = $('banner');
    b.innerHTML = html;
    b.className = cls || '';
    void b.offsetWidth;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.classList.add('hidden'), ms);
  }
  function show(id) { $(id).classList.remove('hidden'); }
  function hide(id) { $(id).classList.add('hidden'); }
  function starsHtml(n, cls = '') {
    return `<div class="stars ${cls}">${[0, 1, 2].map(i => `<span class="${i < n ? 'on' : ''}">${I(i < n ? 'star' : 'starEmpty')}</span>`).join('')}</div>`;
  }

  // 업적 알림
  Profile.onAchievement(a => {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<div class="medal" style="background:${TIERS[a.tier].color}">${I(a.icon)}</div><div><small>업적 달성! · ${TIERS[a.tier].name}</small><b>${a.name}</b></div>`;
    $('toasts').appendChild(t);
    Sound.play('achieve');
    setTimeout(() => t.remove(), 4000);
  });

  function refreshTitle() {
    const sv = loadSave();
    const btn = $('btnContinue');
    if (sv) {
      btn.classList.remove('hidden');
      const dd = DIFFS[sv.diff] || DIFFS.normal, mm = MAPS[sv.map] || MAPS.forest;
      $('continueInfo').textContent = `${mm.name} · ${dd.name} · 웨이브 ${sv.wave}`;
    } else btn.classList.add('hidden');
    const stars = MAP_ORDER.reduce((s, m) => s + Profile.bestStars(m), 0);
    $('bestInfo').innerHTML = `${I('star')} 별 ${stars}/12 · ${I('trophy')} 업적 ${Profile.achCount()}/${ACH.length}`;
    $('achCount').textContent = `${Profile.achCount()}/${ACH.length}`;
  }
  function beginPlay() {
    Sound.init();
    Sound.startMusic();
    hide('title'); hide('gameover'); hide('clear');
    requestAnimationFrame(resize);
  }
  function goTitle() {
    S.mode = 'title';
    clearField(true);
    Sound.setMode('title');
    World.setTime('day');
    refreshTitle();
    show('title');
    updateHud(true);
  }

  // ---------- 모달 ----------
  let modalOpen = false;
  function openModal(title, html, opts = {}) {
    $('modalTitle').innerHTML = title;
    $('modalBody').innerHTML = html;
    $('modalClose').classList.toggle('hidden', !!opts.noClose);
    show('modal');
    modalOpen = true;
    S.paused = true;
    $('modal').querySelector('.sheet').scrollTop = 0;
  }
  function closeModal() {
    hide('modal');
    modalOpen = false;
    S.paused = false;
    if (S.mode === 'title') show('title');
  }
  const closable = () => !$('modalClose').classList.contains('hidden');
  $('modalClose').onclick = () => { if (closable()) closeModal(); };
  $('modal').addEventListener('click', e => { if (e.target.id === 'modal' && closable()) closeModal(); });
  const mb = sel => $('modalBody').querySelector(sel);
  const mball = sel => [...$('modalBody').querySelectorAll(sel)];

  // 탑 건설
  function openBuild(slot) {
    const html = `<div class="opt-list">${Object.entries(TOWERS).map(([key, d]) => {
      const st = towerStats(key, 1), cost = buildCost(key);
      return `<button class="opt" data-build="${key}" ${S.gold < cost ? 'disabled' : ''}>
        <span class="icon">${I(d.icon)}</span>
        <span class="info"><b>${d.name}</b><small>${d.desc}<br>피해 ${Math.round(st.dmg)} · 초당 ${st.rate.toFixed(2)}회 · 3레벨 진화: ${d.levels[2].name}</small></span>
        <span class="cost coin-ic">${cost}${I('coin')}</span></button>`;
    }).join('')}</div>`;
    openModal(`${I('hammer')} 탑 건설`, html);
    mball('[data-build]').forEach(b => b.onclick = () => {
      const type = b.dataset.build, cost = buildCost(type);
      if (S.gold < cost || towerAt(slot)) return;
      S.gold -= cost;
      const tw = { slot, type, lvl: 1, cd: 0, recoil: 0, paid: cost };
      S.towers.push(tw);
      World.addTower(tw);
      Profile.built(); Profile.towerForm(type, 1);
      const s = World.slots[slot];
      World.burst(s.x, 0.5, s.z, 22, ['#d3cbbd', '#9a6638', '#f4c247', '#ffffff'], 0.9);
      World.ring(s.x, s.z, 1.8, '#ffe27a');
      Sound.play('build');
      closeModal();
      save(); updatePrepInfo(); updateHud(true);
    });
  }

  // 탑 정보 / 레벨업 / 진화 / 철거
  function openTower(tw) {
    const d = TOWERS[tw.type], L = d.levels[tw.lvl - 1], st = towerStats(tw.type, tw.lvl);
    const refund = Math.round((tw.paid || d.cost) * 0.5);
    const next = d.levels[tw.lvl];
    const cost = levelCost(tw);
    let evoHtml = '';
    if (next) {
      const nst = towerStats(tw.type, tw.lvl + 1);
      const evo = tw.lvl + 1 === 3;
      evoHtml = `
        <div class="evo">
          <div><img src="${World.portraitOf('tower', tw.type, { lvl: tw.lvl })}" alt=""><div class="cap">Lv.${tw.lvl}</div></div>
          <div class="arrow">▶</div>
          <div><img src="${World.portraitOf('tower', tw.type, { lvl: tw.lvl + 1 })}" alt=""><div class="cap">Lv.${tw.lvl + 1}${evo ? ' 진화' : ''}</div></div>
        </div>
        <button class="opt ${evo ? 'evolve' : ''}" data-act="level" ${S.gold < cost ? 'disabled' : ''}>
          <span class="icon">${I(evo ? 'star' : 'hammer')}</span>
          <span class="info"><b>${evo ? '진화' : '레벨업'}: ${next.name}</b><small>${next.desc}<br>피해 ${Math.round(st.dmg)} → <b>${Math.round(nst.dmg)}</b>${next.special ? ` · 특수: ${next.special}` : ''}</small></span>
          <span class="cost coin-ic">${cost}${I('coin')}</span>
        </button>`;
    }
    const html = `
      <p class="stat-line">${L.desc}</p>
      <p class="stat-line">피해 <b>${Math.round(st.dmg)}</b> · 초당 <b>${st.rate.toFixed(2)}</b>회 · 사거리 <b>${st.range.toFixed(1)}</b>
      ${st.splash ? ` · 폭발 ${st.splash.toFixed(1)}` : ''}${st.slow ? ` · 둔화 ${Math.round(st.slow * 100)}%` : ''}${L.special ? ` · <b>${L.special}</b>` : ''}</p>
      <div class="opt-list">
        ${evoHtml}
        <button class="opt" data-act="upgrade"><span class="icon">${I('anvil')}</span><span class="info"><b>대장간 강화</b><small>같은 종류의 모든 탑을 한꺼번에 강하게!</small></span></button>
        <button class="opt danger" data-act="sell"><span class="icon">${I('coin')}</span><span class="info"><b>철거하기</b><small>쓴 비용의 절반을 돌려받아요</small></span><span class="cost coin-ic">+${refund}${I('coin')}</span></button>
      </div>`;
    openModal(`${I(d.icon)} ${L.name} <span class="lv-tag">Lv.${tw.lvl}</span>`, html);
    const s = World.slots[tw.slot];
    World.ring(s.x, s.z, st.range, '#ffffff', 1.2);
    const lv = mb('[data-act=level]');
    if (lv) lv.onclick = () => {
      const c = levelCost(tw);
      if (S.gold < c || tw.lvl >= 3) return;
      S.gold -= c; tw.paid += c; tw.lvl++;
      World.upgradeTower(tw);
      Profile.towerForm(tw.type, tw.lvl);
      if (tw.lvl === 3) {
        Sound.play('evolve');
        showBanner(`${I('star')} 진화! ${d.levels[2].name}`, 'good', 2000);
        S.white = 0.35; S.shake = 6;
      } else Sound.play('upgrade');
      closeModal(); save(); updateHud(true);
    };
    mb('[data-act=upgrade]').onclick = () => { closeModal(); openUpgrades(); };
    mb('[data-act=sell]').onclick = () => {
      S.towers = S.towers.filter(t => t !== tw);
      World.burst(s.x, 0.8, s.z, 20, ['#d3cbbd', '#9a6638', '#777'], 0.9);
      World.removeTower(tw);
      S.gold += refund;
      Sound.play('coin');
      closeModal(); save(); updatePrepInfo(); updateHud(true);
    };
  }

  // 대장간 강화
  function upCost(key, lvl) { const u = UPGRADES[key]; return Math.round(u.base * Math.pow(u.growth, lvl)); }
  function openUpgrades() {
    const render = () => {
      $('modalBody').innerHTML = `<p class="stat-line">보유 골드 <b>${S.gold}</b> ${I('coin')}</p><div class="opt-list">${Object.entries(UPGRADES).map(([key, u]) => {
        const lvl = S.up[key], maxed = lvl >= u.max, cost = upCost(key, lvl);
        return `<button class="opt" data-up="${key}" ${maxed || S.gold < cost ? 'disabled' : ''}>
          <span class="icon">${I(u.icon)}</span>
          <span class="info"><b>${u.name}</b> <span class="lvl">Lv.${lvl}${maxed ? ' (MAX)' : ''}</span><small>${u.desc(lvl)}</small></span>
          <span class="cost coin-ic">${maxed ? '—' : cost + I('coin')}</span></button>`;
      }).join('')}</div>`;
      mball('[data-up]').forEach(b => b.onclick = () => {
        const key = b.dataset.up, lvl = S.up[key], cost = upCost(key, lvl);
        if (S.gold < cost || lvl >= UPGRADES[key].max) return;
        S.gold -= cost;
        S.up[key]++;
        if (key === 'castle') S.castleHp = Math.min(castleMax(), S.castleHp + 25);
        Sound.play('upgrade');
        save(); updateHud(true);
        render();
      });
    };
    openModal(`${I('anvil')} 대장간 강화`, '');
    render();
  }

  // 웨이브 결과
  function showResults(r) {
    const acc = r.ws.correct + r.ws.wrong ? Math.round(r.ws.correct / (r.ws.correct + r.ws.wrong) * 100) : 100;
    const html = `
      ${starsHtml(r.stars, 'big')}
      <p class="result-title">${r.stars === 3 ? '완벽한 방어! 성이 다치지 않았어요' : r.stars === 2 ? '훌륭해요!' : '승리! 다음엔 성을 더 지켜봐요'}</p>
      <div class="result-rows">
        <span>${I('check')} 정답</span><b>${r.ws.correct}개 <small>(정확도 ${acc}%)</small></b>
        <span>${I('swords')} 처치</span><b>${r.ws.kills}마리</b>
        <span>${I('bolt')} 최고 콤보</span><b>${r.ws.combo}</b>
        <span>${I('heart')} 성 피해</span><b>${r.ws.dmg}</b>
        <span>${I('coin')} 정답 골드</span><b class="gold">+${r.ws.gold}</b>
        <span>${I('crown')} 승리 보너스</span><b class="gold">+${r.bonus}</b>
      </div>
      <button class="big-btn" id="toCards">${I('card')} 보상 카드 고르기</button>`;
    openModal(`웨이브 ${r.wave} 승리!`, html, { noClose: true });
    for (let i = 0; i < r.stars; i++) setTimeout(() => Sound.play('star', i), 300 + i * 250);
    mb('#toCards').onclick = () => { closeModal(); openCards(); };
  }

  // 보상 카드
  function openCards() {
    if (!S.pendingCards || !S.pendingCards.length) { S.pendingCards = null; save(); updatePrepInfo(); return; }
    const offer = S.pendingCards.map(cardInfo).filter(Boolean);
    const owned = S.cards.map(cardInfo).filter(Boolean);
    const html = `
      <div class="cards">${offer.map((c, i) => `
        <button class="rcard ${c.rarity}" data-card="${i}" style="--rc:${RARITY[c.rarity].color}">
          <span class="rar">${RARITY[c.rarity].name}</span>
          <span class="big">${I(c.icon)}</span>
          <span class="txt"><b>${c.name}</b><p>${c.desc}</p></span>
          ${c.max && cardCount(c.id) ? `<span class="own">보유 ${cardCount(c.id)}/${c.max}</span>` : ''}
        </button>`).join('')}</div>
      ${owned.length ? `<div class="owned-cards">${owned.map(c => `<span>${c.name}</span>`).join('')}</div>` : ''}`;
    openModal(`${I('card')} 보상 카드를 하나 고르세요`, html, { noClose: true });
    Sound.play('card');
    mball('[data-card]').forEach(b => b.onclick = () => {
      const c = offer[+b.dataset.card];
      b.classList.add('picked');
      mball('[data-card]').forEach(x => { x.disabled = true; });
      Sound.play('pick');
      applyCard(c);
      setTimeout(() => {
        closeModal();
        showBanner(`${I(c.icon)} ${c.name}!`, 'good', 1400);
        updatePrepInfo(); updateHud(true);
      }, 600);
    });
  }
  function applyCard(c) {
    const before = castleMax();
    if (c.id === 'gold_bag') S.gold += 100 + S.wave * 10;
    else if (c.id === 'repair') S.castleHp = Math.min(castleMax(), S.castleHp + Math.round(castleMax() * 0.5));
    else S.cards.push(c.full);
    computeMods();
    if (castleMax() > before) S.castleHp += castleMax() - before;
    Profile.card(c.rarity);
    S.pendingCards = null;
    save();
  }

  // 난이도 → 맵 선택
  function openDifficulty() {
    hide('title');
    openModal('난이도 선택', `<div class="opt-list">${Object.entries(DIFFS).map(([k, d]) => `
      <button class="opt diff-${k}" data-diff="${k}">
        <span class="icon">${I(d.icon)}</span>
        <span class="info"><b>${d.name}</b><small>${d.desc}</small></span>
      </button>`).join('')}</div>`);
    mball('[data-diff]').forEach(b => b.onclick = () => openMapSelect(b.dataset.diff));
  }
  function drawMapPreview(cv, id) {
    const m = MAPS[id], th = m.theme, x = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    x.fillStyle = th.ground[1]; x.fillRect(0, 0, W, H);
    const sx = v => (v + 23) / 48 * W, sz = v => (v + 10.5) / 21 * H;
    let seed = id.length * 77;
    const R = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 40; i++) {
      x.fillStyle = th.treeCols[i % 4];
      x.beginPath(); x.arc(R() * W, R() * H, 3 + R() * 3, 0, 7); x.fill();
    }
    if (th.lava) { x.fillStyle = '#ff6a1a'; for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(R() * W, R() * H, 6, 0, 7); x.fill(); } }
    x.lineCap = 'round'; x.lineJoin = 'round';
    [[th.path[0], 13], [th.path[1], 9]].forEach(([col, w]) => {
      x.strokeStyle = col; x.lineWidth = w;
      x.beginPath();
      m.path.forEach(([px, pz], i) => i ? x.lineTo(sx(px), sz(pz)) : x.moveTo(sx(px), sz(pz)));
      x.stroke();
    });
    const cx = sx(19.5), cy = sz(-2.4);
    x.fillStyle = '#d3cbbd'; x.fillRect(cx, cy, 16, 26);
    x.fillStyle = '#d9493c'; x.beginPath(); x.moveTo(cx - 3, cy); x.lineTo(cx + 8, cy - 12); x.lineTo(cx + 19, cy); x.fill();
  }
  function openMapSelect(diff) {
    const html = `<div class="maps">${MAP_ORDER.map(id => {
      const m = MAPS[id], ok = Profile.unlocked(id), rec = Profile.rec(id, diff);
      return `<button class="mapc ${ok ? '' : 'locked'}" data-map="${id}" ${ok ? '' : 'disabled'}>
        <canvas width="240" height="120" data-prev="${id}"></canvas>
        <div class="info"><b>${I(m.icon)} ${m.name}</b><small>${m.desc}</small>
          ${starsHtml(Profile.stars(id, diff))}<small>${rec.cleared ? '클리어!' : rec.best ? `최고 웨이브 ${rec.best}` : '도전 전'}</small></div>
        ${ok ? '' : `<div class="lockv">${I('lock')}<b>${m.name}</b>${MAPS[m.unlock].name}에서<br>10웨이브를 넘기면 열려요</div>`}
      </button>`;
    }).join('')}</div>
    <p class="stat-line" style="margin-top:10px;font-size:13px;color:#6b7a88">별 1개: 10웨이브 · 별 2개: 20웨이브 · 별 3개: 마왕 처치(클리어)</p>`;
    openModal(`${I('map')} 맵 선택 · ${DIFFS[diff].name}`, html);
    mball('canvas[data-prev]').forEach(cv => drawMapPreview(cv, cv.dataset.prev));
    mball('[data-map]').forEach(b => b.onclick = () => {
      if (b.disabled) return;
      if (loadSave() && !confirm('저장된 게임이 있어요. 새 게임을 시작하면 지워집니다. 계속할까요?')) return;
      closeModal();
      beginPlay();
      newGame(diff, b.dataset.map);
      showBanner(`${I(MAPD().icon)} ${MAPD().name} · ${D().name}`, 'good', 1800);
    });
  }

  // 도감
  const DEX_ENEMIES = ['soldier', 'goblin', 'knight', 'ogre', 'troll', 'orcking', 'dragon', 'lich', 'demonking'];
  function speedWord(s) { return s >= 1.3 ? '매우 빠름' : s >= 0.95 ? '보통' : s >= 0.6 ? '느림' : '매우 느림'; }
  function openBook(tab = 'enemy') {
    const P = Profile.data;
    let grid = '';
    if (tab === 'enemy') {
      grid = DEX_ENEMIES.map(t => {
        const seen = !!P.seen[t], d = ENEMIES[t];
        return `<button class="dexc ${d.boss ? 'boss' : ''} ${seen ? '' : 'lock'}" data-dex="enemy:${t}">
          ${d.boss ? `<span class="badge">${d.final ? '최종' : '보스'}</span>` : ''}
          <img src="${World.portraitOf('enemy', t, { dark: !seen })}" alt=""><b>${seen ? d.name : '???'}</b><small>${seen ? `처치 ${P.kills[t] || 0}` : '미발견'}</small></button>`;
      }).join('');
    } else if (tab === 'tower') {
      grid = Object.keys(TOWERS).flatMap(t => [1, 2, 3].map(l => {
        const seen = !!P.towerForms[`${t}${l}`], L = TOWERS[t].levels[l - 1];
        return `<button class="dexc ${seen ? '' : 'lock'}" data-dex="tower:${t}:${l}">
          ${l === 3 ? '<span class="badge">진화</span>' : ''}
          <img src="${World.portraitOf('tower', t, { lvl: l, dark: !seen })}" alt=""><b>${seen ? L.name : '???'}</b><small>Lv.${l}</small></button>`;
      })).join('');
    } else {
      grid = `<button class="dexc" data-dex="hero"><img src="${World.portraitOf('hero', 'hero')}" alt=""><b>${HERO.name}</b><small>필살기 ${P.ults}회</small></button>`;
    }
    const total = DEX_ENEMIES.length + 9 + 1;
    const found = DEX_ENEMIES.filter(t => P.seen[t]).length + Object.keys(P.towerForms).length + (P.seen.hero ? 1 : 0);
    const html = `
      <div class="tabs">${[['enemy', '몬스터'], ['tower', '탑'], ['hero', '영웅']].map(([k, n]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${n}</button>`).join('')}</div>
      <p class="stat-line" style="font-size:13px;color:#6b7a88">수집 ${found} / ${total}</p>
      <div class="dex">${grid}</div>`;
    openModal(`${I('book')} 도감`, html);
    mball('[data-tab]').forEach(b => b.onclick = () => openBook(b.dataset.tab));
    mball('[data-dex]').forEach(b => b.onclick = () => openDexDetail(b.dataset.dex, tab));
  }
  function openDexDetail(key, tab) {
    const P = Profile.data;
    const [kind, id, lvl] = key.split(':');
    let html = `<button class="back-link" id="dexBack">◀ 도감으로</button><div class="dex-detail">`;
    if (kind === 'enemy') {
      const d = ENEMIES[id], seen = !!P.seen[id];
      html += `<img src="${World.portraitOf('enemy', id, { dark: !seen })}" alt="">
        <div><h3>${seen ? d.name : '???'}</h3><p>${seen ? d.lore : '아직 만나지 못한 적이에요. 웨이브를 진행하면 나타나요!'}</p>
        ${seen ? `<div class="dex-stats">
          <span>체력</span><b>${d.hp}${d.boss ? ' (보스)' : ''}</b>
          <span>이동 속도</span><b>${speedWord(d.speed)}</b>
          <span>성 피해</span><b>${d.dmg}</b>
          <span>필요한 정답</span><b>${d.probs}번</b>
          <span>처치 보석</span><b>${d.gems}</b>
          <span>처치한 수</span><b>${P.kills[id] || 0}마리</b>
          <span>처음 만난 날</span><b>${new Date(P.seen[id]).toLocaleDateString('ko-KR')}</b>
        </div>` : ''}</div>`;
    } else if (kind === 'tower') {
      const t = TOWERS[id], l = +lvl, L = t.levels[l - 1], seen = !!P.towerForms[`${id}${l}`];
      const b = { dmg: t.dmg * LV_DMG[l - 1], rate: t.rate * LV_RATE[l - 1], range: t.range * LV_RANGE[l - 1] };
      html += `<img src="${World.portraitOf('tower', id, { lvl: l, dark: !seen })}" alt="">
        <div><h3>${seen ? L.name : '???'} <span class="lv-tag">Lv.${l}</span></h3><p>${seen ? L.desc : '이 탑을 세우거나 레벨업하면 기록돼요.'}</p>
        ${seen ? `<div class="dex-stats">
          <span>기본 피해</span><b>${Math.round(b.dmg)}</b>
          <span>초당 공격</span><b>${b.rate.toFixed(2)}회</b>
          <span>사거리</span><b>${b.range.toFixed(1)}</b>
          <span>${l === 1 ? '건설 비용' : '레벨업 비용'}</span><b>${l === 1 ? t.cost : L.cost} 골드</b>
          ${L.special ? `<span>특수 능력</span><b>${L.special}</b>` : ''}
        </div>` : ''}</div>`;
    } else {
      html += `<img src="${World.portraitOf('hero', 'hero')}" alt="">
        <div><h3>${HERO.name}</h3><p>${HERO.lore}</p><div class="dex-stats">
          <span>기본 공격</span><b>황금 석궁 (피해 ${HERO.dmg})</b>
          <span>필살기</span><b>용사의 심판 — 모든 적에게 황금 검을 내리꽂고 잠시 기절시켜요</b>
          <span>게이지</span><b>정답 1개에 12%씩 충전</b>
          <span>필살기 사용</span><b>${P.ults}회</b>
        </div></div>`;
    }
    html += '</div>';
    openModal(`${I('book')} 도감`, html);
    mb('#dexBack').onclick = () => openBook(tab);
  }

  // 업적
  function openAchievements() {
    const done = Profile.achCount();
    const list = ACH.map(a => {
      const pr = Profile.achProgress(a), tier = TIERS[a.tier];
      const when = Profile.data.achievements[a.id];
      return `<div class="ach ${pr.done ? 'done' : ''}">
        <div class="medal" style="background:${tier.color}">${I(a.icon)}</div>
        <div class="info"><b>${a.name}</b><span class="tier" style="background:${tier.color}">${tier.name}</span><small>${a.desc}</small>
          ${pr.done ? '' : `<div class="prog"><i style="width:${Math.round(pr.cur / pr.goal * 100)}%"></i></div><small>${pr.cur.toLocaleString()} / ${pr.goal.toLocaleString()}</small>`}</div>
        ${when ? `<div class="when">${new Date(when).toLocaleDateString('ko-KR')}</div>` : ''}
      </div>`;
    });
    openModal(`${I('trophy')} 업적`, `<div class="ach-head">${I('medal')} 달성 ${done} / ${ACH.length}</div><div class="ach-list">${list.join('')}</div>`);
  }

  function openHelp() {
    openModal(`${I('scroll')} 게임 방법`, `<div class="help">
      <h3>${I('castle')} 목표</h3>
      <ul><li>길을 따라 몰려오는 적들로부터 성을 지키세요. 30웨이브의 최종 보스 <b>마왕</b>을 쓰러뜨리면 클리어!</li></ul>
      <h3>${I('hero')} 구구단 + 영웅</h3>
      <ul><li>적 머리 위 문제(예: <b>7 × 8</b>)의 답을 입력하면 영웅이 번개를 쏴서 적을 쓰러뜨리고 <b>골드</b>를 얻어요.</li>
      <li>정답을 맞힐수록 영웅 게이지가 차요. 가득 차면 오른쪽 아래 버튼(또는 Q키)으로 필살기 <b>용사의 심판</b>!</li>
      <li>같은 답의 적이 여럿이면 성에 가장 가까운 적(노란 말풍선)부터 맞아요. 큰 적은 여러 번 맞혀야 해요(● 개수).</li></ul>
      <h3>${I('bow')} 탑 · 레벨업 · 진화</h3>
      <ul><li>빈 칸(+)을 눌러 궁수탑 · 대포 · 서리 마법탑을 세워요. 세운 탑을 누르면 레벨업할 수 있어요.</li>
      <li>3레벨이 되면 <b>진화</b>! 엘프 궁수 요새(2연발), 용의 거포(화염 폭발), 대마법사의 탑(2명 동시 공격).</li></ul>
      <h3>${I('card')} 보상 카드</h3>
      <ul><li>웨이브를 이기면 결과와 별점이 나오고, 카드 3장 중 1장을 골라 이번 판을 강하게 만들어요.</li></ul>
      <h3>${I('gem')} 보석 &amp; 강화</h3>
      <ul><li>적을 쓰러뜨리면 보석! 성 수리 · 얼음 폭풍 · 유성 낙하에 써요. 골드로는 대장간에서 영구 강화를 해요.</li></ul>
      <h3>${I('map')} 맵 · 난이도 · 별</h3>
      <ul><li>숲 → 사막 → 설원 → 화산. 앞 맵에서 10웨이브를 넘기면 다음 맵이 열려요.</li>
      <li>별: 10웨이브 ★, 20웨이브 ★★, 클리어 ★★★. 쉬움은 틀리면 건너뛰며 세기 힌트가 나와요.</li></ul>
      <h3>${I('book')} 도감 &amp; 업적</h3>
      <ul><li>만난 적과 세운 탑이 도감에 모이고, 업적을 달성하면 메달을 받아요. (이 기기에만 저장돼요)</li></ul>
      <h3>⌨ PC 단축키</h3>
      <ul><li>숫자 · Enter 확인 · Backspace 지우기 · Space 시작/2배속 · Q 필살기 · Esc 일시정지</li></ul>
    </div>`);
  }
  function openPause() {
    if (modalOpen || S.mode === 'title' || S.mode === 'over') return;
    openModal(`${I('pause')} 일시정지`, `<div class="pause-menu">
      <button class="big-btn" data-p="resume">${I('play')} 계속하기</button>
      <div class="menu-row">
        <button class="mini-btn" data-p="book">${I('book')}도감</button>
        <button class="mini-btn" data-p="ach">${I('trophy')}업적</button>
        <button class="mini-btn" data-p="help">${I('scroll')}방법</button>
      </div>
      <button class="big-btn alt" data-p="title">${I('home')} 처음 화면으로</button>
      <p class="note">진행 상황은 웨이브 시작 전 상태로 저장돼요.</p>
    </div>`);
    mb('[data-p=resume]').onclick = closeModal;
    mb('[data-p=book]').onclick = () => openBook();
    mb('[data-p=ach]').onclick = openAchievements;
    mb('[data-p=help]').onclick = openHelp;
    mb('[data-p=title]').onclick = () => { closeModal(); goTitle(); };
  }

  // ================= 입력 =================
  overlay.addEventListener('pointerdown', ev => {
    if ((S.mode !== 'prep' && S.mode !== 'wave') || modalOpen) return;
    const rect = overlay.getBoundingClientRect();
    const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    Sound.init();
    if (World.pickHero(x, y)) { if (S.heroGauge >= 1) useUlt(); return; }
    const slot = World.pickSlot(x, y);
    if (slot < 0) return;
    if (S.pendingCards) { openCards(); return; }
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
    if (S.mode === 'prep') { if (S.pendingCards) openCards(); else startWave(); }
    else if (S.mode === 'wave') { S.fast = !S.fast; updateControls(); }
  };
  heroBtn.onclick = () => { Sound.init(); useUlt(); };
  $('btnUpgrade').onclick = () => { if (S.mode === 'prep' || S.mode === 'wave') openUpgrades(); };
  skillBtns.forEach(b => b.onclick = () => useSkill(b.dataset.skill));
  $('btnPause').onclick = openPause;
  function soundIcon() { $('btnSound').innerHTML = I(Sound.muted ? 'mute' : 'sound'); }
  $('btnSound').onclick = () => {
    Sound.init();
    Sound.setMuted(!Sound.muted);
    try { localStorage.setItem(SOUND_KEY, Sound.muted ? '1' : '0'); } catch (_) { /* 무시 */ }
    soundIcon();
  };
  window.addEventListener('keydown', ev => {
    if (!$('clear').classList.contains('hidden')) return;
    if (ev.key === 'Escape') {
      if (modalOpen) { if (closable()) closeModal(); } else openPause();
      return;
    }
    if (modalOpen || S.mode === 'title' || S.mode === 'over') return;
    if (/^[0-9]$/.test(ev.key)) { pressDigit(ev.key); pressedFx(ev.key); ev.preventDefault(); }
    else if (ev.key === 'Backspace') { pressDel(); pressedFx('del'); ev.preventDefault(); }
    else if (ev.key === 'Enter') { submit(); pressedFx('ok'); ev.preventDefault(); }
    else if (ev.key === ' ') { btnStart.click(); ev.preventDefault(); }
    else if (ev.key === 'q' || ev.key === 'Q' || ev.key === 'ㅂ') { useUlt(); ev.preventDefault(); }
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
    showBanner(`${I('play')} 웨이브 ${S.wave}부터 이어하기`, 'good', 1800);
  };
  $('btnHelp').onclick = openHelp;
  $('btnBook').onclick = () => openBook();
  $('btnAch').onclick = openAchievements;
  $('btnRetry').onclick = () => {
    const sv = loadSave();
    beginPlay();
    if (sv) loadGame(sv, true); else newGame(S.diff, S.map);
  };
  $('btnGoNew').onclick = () => { hide('gameover'); goTitle(); };
  $('btnEndless').onclick = () => {
    hide('clear');
    showResults({ wave: FINAL_WAVE, stars: 3, bonus: 0, ws: { correct: S.stats.correct, wrong: S.stats.wrong, kills: S.stats.kills, gold: 0, dmg: 0, combo: S.bestCombo } });
  };
  $('btnClearTitle').onclick = () => { hide('clear'); goTitle(); };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { Sound.suspend(); if (S.mode === 'wave' && !modalOpen) openPause(); }
    else Sound.resume();
  });

  // ================= 메인 루프 =================
  let last = performance.now();
  function frame(now) {
    const realDt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let gdt = 0;
    if (!S.paused) {
      gdt = realDt * (S.fast && S.mode === 'wave' ? 2 : 1);
      if (S.slowmo > 0) { S.slowmo -= realDt; gdt *= 0.2; }
      if (S.hitStop > 0) { S.hitStop -= realDt; gdt = 0; }
      S.time += gdt;
      if (S.mode === 'wave') update(gdt);
      updateOverlayFx(gdt || realDt);
    }
    S.castleMax = castleMax();
    World.sync(S, gdt, S.time, S.paused ? 0 : realDt);
    let sx = 0, sy = 0;
    if (S.shake > 0) { sx = (Math.random() - 0.5) * S.shake; sy = (Math.random() - 0.5) * S.shake; }
    glCanvas.style.transform = S.shake > 0.3 ? `translate(${sx}px,${sy}px)` : '';
    World.render();
    drawOverlay(sx, sy);
    updateHud(false);
    requestAnimationFrame(frame);
  }

  // ================= 시작 =================
  try { if (lsGet(SOUND_KEY) === '1') Sound.setMuted(true); } catch (_) { /* 무시 */ }
  soundIcon();
  const sv0 = loadSave();
  World.loadMap(sv0 && MAPS[sv0.map] ? sv0.map : 'forest');
  S.map = World.mapId;
  resize();
  refreshTitle();
  updateControls();
  requestAnimationFrame(frame);
  if (window.ResizeObserver) new ResizeObserver(() => resize()).observe(wrap);

  // 디버그/테스트용
  window.__game = { S, World, Profile, startWave, newGame, submit, pressDigit, useSkill, useUlt, buildWave, openBuild, openTower, openCards, openBook, openAchievements, openMapSelect, waveClear, spawnEnemy, computeMods };
})();
