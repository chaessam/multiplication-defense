/* 구구단 디펜스 - 이 기기에 저장되는 플레이 기록 (도감, 업적, 맵 기록)
 * 모두 브라우저 localStorage에만 저장되고 서버로 보내지 않는다.
 */
const Profile = (() => {
  const KEY = 'gugudan-defense-profile';
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
  });

  let P = load();
  let saveTimer = 0;
  const listeners = [];

  function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function load() {
    let p;
    try { p = JSON.parse(lsGet(KEY)); } catch (_) { p = null; }
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
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 400);
  }
  function flush() {
    clearTimeout(saveTimer);
    try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (_) { /* 무시 */ }
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
    seeEnemy, kill, correct, wrong, built, towerForm, ult, card, perfectWave, seenHero,
    record, rec, stars, bestStars, unlocked, achProgress, onAchievement, achCount, check, flush,
  };
})();
