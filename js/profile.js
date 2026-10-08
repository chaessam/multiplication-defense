/* 구구단 디펜스 - 플레이 기록 (도감, 업적, 맵 기록, 영웅)
 * 계정마다 따로 이 기기(localStorage)에 두고, 로그인하면 서버의 계정 기록과 합쳐서
 * 다른 기기에서도 열린 맵·영웅·업적이 그대로 이어짐 (js/account.js의 syncProfile)
 * 서버 없이 파일로 열면 이 기기에만 저장
 */
const Profile = (() => {
  const KEY = 'gugudan-defense-profile';      // 예전(계정 없던 때) 기록, 파일로 열 때의 기록
  const OWNER_KEY = KEY + ':';                 // + 'a{계정번호}'
  const MIGRATED = KEY + '-migrated';
  const OLD_RECORDS = 'gugudan-defense-records';
  const OLD_BEST = 'gugudan-defense-best';

  const blank = () => ({
    v: 1,
    kills: {}, seen: {}, totalKills: 0,
    correct: 0, wrong: 0, dan: {}, bestCombo: 0,
    built: 0, evolved: 0, evolvedTypes: {}, towerForms: {},
    ults: 0, cards: 0, epicCards: 0, perfectWaves: 0,
    clears: {}, mapClears: {}, records: {}, totalStars: 0,
    achievements: {},
    hero: 'arin', heroSeen: {},
  });

  let key = KEY;
  let P = load();
  let changed = 0; // 마지막으로 서버에 올린 뒤 바뀐 적이 있으면 시각
  let saveTimer = 0;
  const listeners = [];

  function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function load() {
    let p;
    try { p = JSON.parse(lsGet(key)); } catch (_) { p = null; }
    p = Object.assign(blank(), p || {});
    // 예전 버전 기록 옮기기 (보통/쉬움/어려움 기록 → 첫 번째 맵)
    if (!p.migrated) {
      try {
        const r = JSON.parse(lsGet(OLD_RECORDS)) || {};
        const old = +(lsGet(OLD_BEST) || 0);
        if (old && !(r.normal && r.normal.best >= old)) r.normal = Object.assign({ best: 0 }, r.normal, { best: old });
        Object.entries(r).forEach(([diff, rec]) => {
          p.records.forest = p.records.forest || {};
          p.records.forest[diff] = { best: rec.best || 0, cleared: !!rec.cleared };
          if (rec.cleared) { p.clears[diff] = (p.clears[diff] || 0) + 1; p.mapClears.forest = 1; }
        });
      } catch (_) { /* 무시 */ }
      p.migrated = true;
    }
    return p;
  }
  function save() {
    changed = changed || Date.now();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 400);
  }
  function flush() {
    clearTimeout(saveTimer);
    try { localStorage.setItem(key, JSON.stringify(P)); } catch (_) { /* 무시 */ }
  }

  // ---------- 계정마다 따로 ----------
  // owner: 'a12'(계정) 또는 'guest'(서버 없음). 이 기기에서 처음 로그인한 계정은 예전 기록을 이어받음
  function useOwner(owner) {
    flush();
    const k = owner && owner !== 'guest' ? OWNER_KEY + owner : KEY;
    if (k === key) return;
    key = k;
    if (k !== KEY && !lsGet(k) && !lsGet(MIGRATED) && lsGet(KEY)) {
      try { localStorage.setItem(k, lsGet(KEY)); localStorage.setItem(MIGRATED, '1'); } catch (_) { /* 무시 */ }
    }
    P = load();
    changed = 0;
  }
  // 두 기록 합치기: 숫자는 큰 쪽, 참/거짓은 하나라도 참, 묶음은 안쪽까지, 글자는 이 기기 것
  function mergeInto(a, b) {
    Object.keys(b || {}).forEach(k => {
      const x = a[k], y = b[k];
      if (y && typeof y === 'object' && !Array.isArray(y)) a[k] = mergeInto(x && typeof x === 'object' ? x : {}, y);
      else if (typeof y === 'number') a[k] = typeof x === 'number' ? Math.max(x, y) : y;
      else if (typeof y === 'boolean') a[k] = !!x || y;
      else if (x === undefined) a[k] = y;
    });
    return a;
  }
  function merge(remote) {
    if (!remote || typeof remote !== 'object') return;
    mergeInto(P, remote);
    P.totalStars = GD.MAP_ORDER.reduce((s, m) => s + bestStars(m), 0);
    check();
    flush();
  }

  // ---------- 기록 ----------
  function seeEnemy(type) { if (!P.seen[type]) { P.seen[type] = Date.now(); save(); } }
  function kill(type) {
    P.kills[type] = (P.kills[type] || 0) + 1;
    P.totalKills++;
    seeEnemy(type);
    check();
  }
  function correct(dan, combo) {
    P.correct++;
    P.dan[dan] = (P.dan[dan] || 0) + 1;
    P.bestCombo = Math.max(P.bestCombo, combo);
    check();
  }
  function wrong() { P.wrong++; save(); }
  function built() { P.built++; check(); }
  function towerForm(type, lvl) {
    P.towerForms[`${type}${lvl}`] = 1;
    if (lvl === 3) { P.evolved++; P.evolvedTypes[type] = 1; }
    check();
  }
  function ult() { P.ults++; check(); }
  function card(rarity) { P.cards++; if (rarity === 'epic') P.epicCards = (P.epicCards || 0) + 1; check(); }
  function perfectWave() { P.perfectWaves++; check(); }
  function seenHero() { if (!P.seen.hero) { P.seen.hero = Date.now(); save(); } }

  // 맵·난이도 최고 기록
  function record(map, diff, wave, cleared) {
    P.records[map] = P.records[map] || {};
    const r = P.records[map][diff] || { best: 0, cleared: false };
    r.best = Math.max(r.best, wave);
    if (cleared && !r.cleared) {
      r.cleared = true;
      P.clears[diff] = (P.clears[diff] || 0) + 1;
      P.mapClears[map] = 1;
    }
    P.records[map][diff] = r;
    P.totalStars = GD.MAP_ORDER.reduce((s, m) => s + bestStars(m), 0);
    check();
  }
  function rec(map, diff) { return (P.records[map] && P.records[map][diff]) || { best: 0, cleared: false }; }
  function starsOf(r) { return r.cleared ? 3 : r.best >= 20 ? 2 : r.best >= 10 ? 1 : 0; }
  function stars(map, diff) { return starsOf(rec(map, diff)); }
  function bestStars(map) { return Math.max(0, ...Object.keys(GD.DIFFS).map(d => stars(map, d))); }
  function unlocked(map) {
    const need = GD.MAPS[map].unlock;
    if (!need) return true;
    return Object.keys(GD.DIFFS).some(d => rec(need, d).best >= 10);
  }

  // ---------- 영웅 ----------
  // 맵이 열리면 그 맵의 영웅도 함께 열림
  function heroUnlocked(id) {
    const h = GD.HEROES[id];
    return !!h && (!h.map || unlocked(h.map));
  }
  function hero() { return heroUnlocked(P.hero) ? P.hero : 'arin'; }
  function setHero(id) { if (heroUnlocked(id)) { P.hero = id; save(); } }
  // 새로 열렸는데 아직 소개하지 않은 영웅들
  function newHeroes() { return GD.HERO_ORDER.filter(id => GD.HEROES[id].map && heroUnlocked(id) && !(P.heroSeen || {})[id]); }
  function markHeroSeen(id) { P.heroSeen = P.heroSeen || {}; P.heroSeen[id] = 1; save(); }

  // ---------- 업적 ----------
  function achProgress(a) {
    const [cur, goal] = a.check(P);
    return { cur: Math.min(cur, goal), goal, done: !!P.achievements[a.id] };
  }
  function check() {
    for (const a of GD.ACH) {
      if (P.achievements[a.id]) continue;
      const [cur, goal] = a.check(P);
      if (cur >= goal) {
        P.achievements[a.id] = Date.now();
        listeners.forEach(fn => fn(a));
      }
    }
    save();
  }
  function onAchievement(fn) { listeners.push(fn); }
  function achCount() { return Object.keys(P.achievements).length; }

  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

  return {
    get data() { return P; },
    get changed() { return changed; }, clearChanged() { changed = 0; },
    useOwner, merge, heroUnlocked, hero, setHero, newHeroes, markHeroSeen,
    seeEnemy, kill, correct, wrong, built, towerForm, ult, card, perfectWave, seenHero,
    record, rec, stars, bestStars, unlocked, achProgress, onAchievement, achCount, check, flush,
  };
})();
