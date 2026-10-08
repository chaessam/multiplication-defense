/* 구구단 디펜스 - 계정(학교 + 닉네임 + 숫자 4자리 비밀번호)과 저장 목록
 * - 로그인 표시(토큰)와 저장은 이 기기에도 두고, 서버에도 올려서 다른 기기에서 불러올 수 있게 함
 * - 서버가 없을 때(파일로 열기)는 로그인 없이 이 기기에만 저장 (개발·시험용)
 * - 예전 버전의 맵별 저장은 처음 로그인한 계정의 저장 목록으로 옮김
 * 2017년 문법(ES2017)만 사용 — 오래된 학교 태블릿 호환
 */
const Account = (() => {
  const SESSION_KEY = 'gugudan-defense-session';
  const RUNS_PREFIX = 'gugudan-defense-runs:';
  const MIGRATED_KEY = 'gugudan-defense-runs-migrated';
  const OLD_SAVE_KEY = 'gugudan-defense-save-v1';
  const OLD_SAVES_KEY = 'gugudan-defense-saves';
  const MAX_RUNS = 20;
  const hasServer = location.protocol === 'http:' || location.protocol === 'https:';

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 저장 불가 */ } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* 무시 */ } }
  function readJson(k) { try { return JSON.parse(lsGet(k)); } catch (e) { return null; } }

  let session = readJson(SESSION_KEY); // { token, account: { id, school, schoolName, sido, nick } }
  if (!session || !session.token || !session.account) session = null;

  // ---------- 서버 요청 ----------
  async function api(method, path, body) {
    const headers = {};
    if (body) headers['content-type'] = 'application/json';
    if (session && session.token) headers.authorization = 'Bearer ' + session.token;
    let res;
    try { res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }); }
    catch (e) { return { ok: false, offline: true, error: '서버에 연결할 수 없어요. 인터넷 연결을 확인하고 다시 해 주세요.' }; }
    let data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    if (res.status === 401 && data.code === 'no_session') { setSession(null); }
    return Object.assign({ ok: res.ok, status: res.status }, data);
  }
  function setSession(s) {
    session = s;
    if (s) lsSet(SESSION_KEY, JSON.stringify(s)); else lsDel(SESSION_KEY);
  }

  // ---------- 학교 목록 ----------
  let schoolIndex = null, schoolLoading = null;
  const baseName = s => String(s || '').replace(/\s+/g, '').replace(/(초등학교|중학교|고등학교|초교|초|중|고)$/, '');
  function loadSchools() {
    if (schoolIndex) return Promise.resolve(schoolIndex);
    if (!schoolLoading) {
      schoolLoading = fetch('data/schools.json').then(r => r.json()).then(d => {
        schoolIndex = d.schools.map(([code, name, sido, addr]) => ({ code: String(code), name, sido: sido || '', addr: addr || '', base: baseName(name) }));
        return schoolIndex;
      }).catch(e => { schoolLoading = null; throw e; });
    }
    return schoolLoading;
  }
  function searchSchools(query, limit) {
    limit = limit || 30;
    const q = baseName(query);
    if (!q || !schoolIndex) return [];
    const exact = [], starts = [], contains = [];
    for (const s of schoolIndex) {
      if (s.base === q) exact.push(s);
      else if (s.base.indexOf(q) === 0) starts.push(s);
      else if (s.base.indexOf(q) >= 0) contains.push(s);
    }
    const byPlace = (a, b) => a.name.localeCompare(b.name, 'ko') || placeOf(a).localeCompare(placeOf(b), 'ko');
    return exact.sort(byPlace).concat(starts.sort(byPlace), contains.sort(byPlace)).slice(0, limit);
  }
  const placeOf = s => [s.sido, s.addr].filter(Boolean).join(' ');
  const shortSchool = name => String(name || '').replace(/초등학교$/, '초').replace(/중학교$/, '중').replace(/고등학교$/, '고');

  // ---------- 닉네임 비속어 (서버와 같은 목록) ----------
  let profanity = null;
  function loadProfanity() {
    if (profanity) return Promise.resolve(profanity);
    return fetch('data/profanity.json').then(r => r.json()).then(d => (profanity = d)).catch(() => (profanity = { banned: [], allowed: [] }));
  }
  function compact(s, keepDigits) {
    let t = String(s == null ? '' : s).toLowerCase();
    if (t.normalize) t = t.normalize('NFC');
    t = t.replace(/[\s_.,!?~@#$%^&*()\-+=[\]{}|\\/:;"'<>`]/g, '');
    return keepDigits ? t : t.replace(/\d/g, '');
  }
  function hasProfanity(text) {
    if (!profanity) return false;
    for (const keep of [false, true]) {
      let t = compact(text, keep);
      for (const w of profanity.allowed) t = t.split(w).join('');
      if (t && profanity.banned.some(w => t.indexOf(w) >= 0)) return true;
    }
    return false;
  }
  const cleanNick = s => String(s == null ? '' : s).replace(/[\u0000-\u001f<>"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 10);

  // ---------- 로그인 ----------
  async function login(school, nick, pin) {
    const r = await api('POST', '/api/login', { school, nick, pin });
    if (r.ok && r.token) { setSession({ token: r.token, account: r.account }); migrateOldSaves(); }
    return r;
  }
  async function register(school, nick, pin) {
    const r = await api('POST', '/api/register', { school, nick, pin });
    if (r.ok && r.token) { setSession({ token: r.token, account: r.account }); migrateOldSaves(); }
    return r;
  }
  async function logout() {
    if (session) await api('POST', '/api/logout');
    setSession(null);
  }
  // 저장된 로그인 표시가 아직 유효한지 (오프라인이면 그대로 둠)
  async function verify() {
    if (!hasServer || !session) return !!session || !hasServer;
    const r = await api('GET', '/api/me');
    if (r.ok && r.account) { setSession({ token: session.token, account: r.account }); return true; }
    if (r.offline) return true;
    return false;
  }

  // ---------- 저장 목록 (게임 한 판 = 저장 하나) ----------
  const owner = () => (session ? 'a' + session.account.id : 'guest');
  const runsKey = () => RUNS_PREFIX + owner();
  function readRuns() {
    const d = readJson(runsKey());
    return d && d.runs ? d : { runs: {}, deleted: [] };
  }
  function writeRuns(d) {
    const list = Object.keys(d.runs).map(k => d.runs[k]).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    if (list.length > MAX_RUNS) list.slice(MAX_RUNS).forEach(r => { delete d.runs[r.id]; });
    lsSet(runsKey(), JSON.stringify(d));
  }
  function newRunId() {
    const b = crypto.getRandomValues(new Uint8Array(8));
    return 'r' + Date.now().toString(36) + '-' + Array.prototype.map.call(b, x => x.toString(16).padStart(2, '0')).join('');
  }
  function listRuns() {
    const d = readRuns();
    return Object.keys(d.runs).map(k => d.runs[k]).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  }
  function getRun(id) { const d = readRuns(); return id && d.runs[id] ? d.runs[id] : null; }
  function strip(run) { const c = Object.assign({}, run); delete c.dirty; return c; }
  function putRun(run) {
    if (!run || !run.id) return;
    const d = readRuns();
    run.savedAt = run.savedAt || Date.now();
    run.dirty = !!(hasServer && session);
    d.runs[run.id] = run;
    writeRuns(d);
    if (run.dirty) pushRun(run);
  }
  async function pushRun(run) {
    const r = await api('PUT', '/api/saves/' + run.id, { data: strip(run) });
    if (r.ok) {
      const d = readRuns();
      if (d.runs[run.id] && d.runs[run.id].savedAt === run.savedAt) { d.runs[run.id].dirty = false; writeRuns(d); }
    }
  }
  function deleteRun(id) {
    const d = readRuns();
    delete d.runs[id];
    if (hasServer && session) d.deleted = (d.deleted || []).concat([id]).slice(-50);
    writeRuns(d);
    if (hasServer && session) api('DELETE', '/api/saves/' + id).then(r => {
      if (r.ok) { const e = readRuns(); e.deleted = (e.deleted || []).filter(x => x !== id); writeRuns(e); }
    });
  }
  // 서버와 맞추기: 더 나중에 저장한 쪽을 남기고, 다른 기기에서 지운 저장은 여기서도 지움
  async function sync() {
    if (!hasServer || !session) return { ok: true, local: true };
    const d = readRuns();
    for (const id of (d.deleted || []).slice()) {
      const r = await api('DELETE', '/api/saves/' + id);
      if (r.ok) d.deleted = d.deleted.filter(x => x !== id);
    }
    const r = await api('GET', '/api/saves');
    if (!r.ok) { writeRuns(d); return r; }
    const server = {};
    (r.saves || []).forEach(s => { if (s && s.id) server[s.id] = s; });
    Object.keys(server).forEach(id => {
      if ((d.deleted || []).indexOf(id) >= 0) return;
      const mine = d.runs[id];
      if (!mine || (mine.savedAt || 0) < (server[id].savedAt || 0)) d.runs[id] = Object.assign({}, server[id], { dirty: false });
    });
    Object.keys(d.runs).forEach(id => { if (!server[id] && !d.runs[id].dirty) delete d.runs[id]; });
    writeRuns(d);
    const dirty = Object.keys(d.runs).map(k => d.runs[k]).filter(x => x.dirty);
    for (const run of dirty) await pushRun(run);
    return { ok: true };
  }
  // 예전 버전 저장(맵마다 1개, 또는 1개뿐인 저장) → 저장 목록으로 (이 기기에서 한 번만)
  function migrateOldSaves() {
    if (lsGet(MIGRATED_KEY)) return;
    const found = [];
    const all = readJson(OLD_SAVES_KEY);
    if (all && all.maps) Object.keys(all.maps).forEach(m => { if (all.maps[m]) found.push(all.maps[m]); });
    const one = readJson(OLD_SAVE_KEY);
    if (one) found.push(one);
    found.forEach(old => {
      if (!old || !(old.wave >= 1)) return;
      const run = Object.assign({}, old, { id: newRunId(), savedAt: old.savedAt || Date.now() });
      putRun(run);
    });
    lsSet(MIGRATED_KEY, '1');
    lsDel(OLD_SAVES_KEY); lsDel(OLD_SAVE_KEY);
  }

  // ---------- 플레이 기록 (열린 맵·영웅·업적·도감) ----------
  // 서버 기록과 합친 뒤, 합친 것을 다시 올림. 서버도 같은 방식으로 합쳐서 기기끼리 기록을 잃지 않음
  let profileBusy = false;
  async function syncProfile() {
    if (!hasServer || !session || profileBusy) return { ok: false, local: true };
    profileBusy = true;
    try {
      const r = await api('GET', '/api/profile');
      if (!r.ok) return r;
      if (r.data) Profile.merge(r.data);
      return await pushProfile(true);
    } finally { profileBusy = false; }
  }
  async function pushProfile(force) {
    if (!hasServer || !session || (!force && !Profile.changed)) return { ok: true };
    const at = Profile.changed;
    Profile.flush();
    const r = await api('PUT', '/api/profile', { data: Profile.data });
    if (r.ok && Profile.changed === at) Profile.clearChanged();
    return r;
  }

  // ---------- 점수·랭킹 ----------
  // 웨이브를 넘길 때마다 이번 판의 점수를 보냄. 서버가 가능한 점수인지 확인하고 난이도별 최고 기록을 남김
  async function submitScore(run) {
    if (!hasServer || !session) return { ok: false, local: true };
    return api('POST', '/api/score', run);
  }
  async function getRank(diff, school) {
    const q = 'diff=' + encodeURIComponent(diff) + (school ? '&school=' + encodeURIComponent(school) : '');
    return api('GET', '/api/rank?' + q);
  }

  return {
    hasServer, submitScore, getRank, syncProfile, pushProfile,
    get owner() { return owner(); },
    get required() { return hasServer; },
    get session() { return session; },
    get account() { return session ? session.account : null; },
    login, register, logout, verify,
    loadSchools, searchSchools, placeOf, shortSchool, loadProfanity, hasProfanity, cleanNick,
    newRunId, listRuns, getRun, putRun, deleteRun, sync, migrateOldSaves,
  };
})();
