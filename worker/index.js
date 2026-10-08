// 구구단 디펜스 Cloudflare 서버
// - 게임 화면 파일(index.html, js, css …)은 Cloudflare가 바로 제공 (assets)
// - /api/* 만 이 Worker가 처리
//   · 참여 통계: 참여 플레이어 수(기기 수)와 누적 판 수
//   · 계정: 학교 + 닉네임 + 숫자 4자리 비밀번호 (10번 틀리면 10분 잠금)
//   · 저장: 계정마다 최대 20개, 다른 기기에서도 불러오기
// - 모든 데이터는 Durable Object(SQLite) 하나에 저장. 무료 플랜에서 쓸 수 있는 방식이에요.
// - 비밀번호는 그대로 저장하지 않고 PBKDF2로 해시해서 저장해요. 로그인 표시(토큰)도 해시로만 저장해요.
import { DurableObject } from 'cloudflare:workers';
import PROFANITY from '../data/profanity.json';

const ID_RE = /^[a-z0-9-]{16,64}$/;
const SAVE_ID_RE = /^[a-z0-9-]{8,64}$/;
const MIN_GAP_MS = 20 * 1000;          // 같은 기기가 너무 자주 보내면 판 수에 넣지 않음 (장난 방지)
const STATS_CACHE_MS = 30 * 1000;
const MAX_FAILS = 10;                  // 비밀번호를 이만큼 틀리면
const LOCK_MS = 10 * 60 * 1000;        // 이 시간 동안 잠금
const MAX_SAVES = 20;                  // 계정마다 저장 개수
const MAX_SAVE_BYTES = 30000;
const PBKDF2_ITER = 60000;
const SESSION_DAYS = 365;
const SCHOOLS_PATH = '/data/schools.json';

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });
}
const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

// ---- 닉네임 규칙 (브라우저 js/account.js와 같은 규칙) ----
function compact(s, keepDigits) {
  const t = String(s == null ? '' : s).toLowerCase().normalize('NFC').replace(/[\s_.,!?~@#$%^&*()\-+=[\]{}|\\/:;"'<>`]/g, '');
  return keepDigits ? t : t.replace(/\d/g, '');
}
function hasProfanity(text) {
  for (const keep of [false, true]) {
    let t = compact(text, keep);
    for (const w of PROFANITY.allowed) t = t.split(w).join('');
    if (t && PROFANITY.banned.some((w) => t.includes(w))) return true;
  }
  return false;
}
function nickError(nick) {
  if (nick.length < 2) return '닉네임은 2글자 이상 적어 주세요.';
  if (hasProfanity(nick)) return '사용할 수 없는 말이 들어 있어요. 다른 닉네임을 적어 주세요.';
  return null;
}
const nickKey = (nick) => nick.toLowerCase().replace(/\s+/g, '');

// ---- 암호화 도우미 ----
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
function randomHex(n) { return hex(crypto.getRandomValues(new Uint8Array(n))); }
async function sha256(text) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))); }
async function hashPin(pin, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: PBKDF2_ITER }, key, 256);
  return hex(bits);
}
function sameText(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// ---- 학교 목록 (data/schools.json) ----
let schoolMap = null;
async function loadSchools(env) {
  if (schoolMap) return schoolMap;
  try {
    const res = await env.ASSETS.fetch(new Request(`https://assets.local${SCHOOLS_PATH}`));
    const data = await res.json();
    schoolMap = new Map(data.schools.map(([code, name, sido, addr]) => [String(code), { code: String(code), name, sido, addr }]));
  } catch (e) {
    schoolMap = new Map();
  }
  return schoolMap;
}

export class Stats extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, games INTEGER NOT NULL DEFAULT 0, first INTEGER, last INTEGER);
      CREATE TABLE IF NOT EXISTS counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        school TEXT NOT NULL, school_name TEXT, sido TEXT, nick TEXT NOT NULL, nick_key TEXT NOT NULL,
        pin_hash TEXT NOT NULL, salt TEXT NOT NULL, fails INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0,
        created INTEGER, last INTEGER, UNIQUE (school, nick_key)
      );
      CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, account_id INTEGER NOT NULL, created INTEGER, last INTEGER);
      CREATE INDEX IF NOT EXISTS sessions_account ON sessions (account_id);
      CREATE TABLE IF NOT EXISTS saves (
        id TEXT NOT NULL, account_id INTEGER NOT NULL, data TEXT NOT NULL,
        map TEXT, diff TEXT, wave INTEGER, saved_at INTEGER, updated INTEGER,
        PRIMARY KEY (account_id, id)
      );
      CREATE TABLE IF NOT EXISTS ip_limits (ip TEXT NOT NULL, kind TEXT NOT NULL, win INTEGER NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (ip, kind, win));
    `);
    this.cache = null;
  }

  // ---------- 참여 통계 ----------
  counter(name) {
    const row = this.sql.exec('SELECT value FROM counters WHERE name = ?', name).toArray()[0];
    return row ? row.value : 0;
  }
  bump(name, by = 1) {
    this.sql.exec('INSERT INTO counters (name, value) VALUES (?, ?) ON CONFLICT (name) DO UPDATE SET value = value + excluded.value', name, by);
  }
  stats() {
    if (this.cache && Date.now() - this.cache.at < STATS_CACHE_MS) return this.cache.data;
    const data = { players: this.counter('players'), games: this.counter('games') };
    this.cache = { at: Date.now(), data };
    return data;
  }
  played(id) {
    const now = Date.now();
    const row = this.sql.exec('SELECT last FROM devices WHERE id = ?', id).toArray()[0];
    if (!row) {
      this.sql.exec('INSERT INTO devices (id, games, first, last) VALUES (?, 1, ?, ?)', id, now, now);
      this.bump('players'); this.bump('games');
    } else if (now - row.last >= MIN_GAP_MS) {
      this.sql.exec('UPDATE devices SET games = games + 1, last = ? WHERE id = ?', now, id);
      this.bump('games');
    }
    this.cache = null;
    return this.stats();
  }

  // ---------- IP별 횟수 제한 (한 교실이 같은 IP를 쓰므로 넉넉하게) ----------
  limited(ip, kind, max, windowMs) {
    const w = Math.floor(Date.now() / windowMs);
    this.sql.exec('INSERT INTO ip_limits (ip, kind, win, count) VALUES (?, ?, ?, 1) ON CONFLICT (ip, kind, win) DO UPDATE SET count = count + 1', ip, kind, w);
    const row = this.sql.exec('SELECT count FROM ip_limits WHERE ip = ? AND kind = ? AND win = ?', ip, kind, w).one();
    if (Math.random() < 0.02) this.sql.exec('DELETE FROM ip_limits WHERE win < ?', w - 2);
    return row.count > max;
  }

  // ---------- 계정 ----------
  publicAccount(a) {
    return { id: a.id, school: a.school, schoolName: a.school_name, sido: a.sido, nick: a.nick };
  }
  async newSession(accountId) {
    const token = randomHex(32);
    const now = Date.now();
    this.sql.exec('INSERT INTO sessions (token_hash, account_id, created, last) VALUES (?, ?, ?, ?)', await sha256(token), accountId, now, now);
    // 계정마다 로그인 표시는 최근 10개만 (여러 기기)
    this.sql.exec(`DELETE FROM sessions WHERE account_id = ? AND token_hash NOT IN
      (SELECT token_hash FROM sessions WHERE account_id = ? ORDER BY last DESC LIMIT 10)`, accountId, accountId);
    return token;
  }
  async accountOf(token) {
    if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
    const th = await sha256(token);
    const s = this.sql.exec('SELECT account_id, last FROM sessions WHERE token_hash = ?', th).toArray()[0];
    if (!s || Date.now() - s.last > SESSION_DAYS * 864e5) return null;
    const a = this.sql.exec('SELECT * FROM accounts WHERE id = ?', s.account_id).toArray()[0];
    if (!a) return null;
    this.sql.exec('UPDATE sessions SET last = ? WHERE token_hash = ?', Date.now(), th);
    return a;
  }
  async register({ school, nick, pin }, ip) {
    if (this.limited(ip, 'register', 300, 864e5)) return { status: 429, error: '오늘 이 곳에서 만든 계정이 너무 많아요. 내일 다시 해 주세요.' };
    const key = nickKey(nick);
    if (this.sql.exec('SELECT 1 FROM accounts WHERE school = ? AND nick_key = ?', school.code, key).toArray().length) {
      return { status: 409, error: '같은 학교에 이미 있는 닉네임이에요. 다른 닉네임을 적어 주세요.', code: 'nick_taken' };
    }
    const salt = randomHex(16);
    const now = Date.now();
    this.sql.exec(`INSERT INTO accounts (school, school_name, sido, nick, nick_key, pin_hash, salt, created, last) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      school.code, school.name, school.sido, nick, key, await hashPin(pin, salt), salt, now, now);
    const a = this.sql.exec('SELECT * FROM accounts WHERE school = ? AND nick_key = ?', school.code, key).one();
    return { status: 200, token: await this.newSession(a.id), account: this.publicAccount(a), created: true };
  }
  async login({ school, nick, pin }, ip) {
    if (this.limited(ip, 'login', 600, 36e5)) return { status: 429, error: '잠시 후 다시 해 주세요.' };
    const a = this.sql.exec('SELECT * FROM accounts WHERE school = ? AND nick_key = ?', school.code, nickKey(nick)).toArray()[0];
    if (!a) return { status: 404, error: '이 학교에 그 닉네임의 계정이 없어요.', code: 'no_account' };
    const now = Date.now();
    if (a.locked_until > now) {
      return { status: 423, error: `비밀번호를 ${MAX_FAILS}번 틀려서 잠겼어요. ${Math.ceil((a.locked_until - now) / 60000)}분 뒤에 다시 해 주세요.`, code: 'locked', until: a.locked_until };
    }
    const ok = sameText(await hashPin(pin, a.salt), a.pin_hash);
    if (!ok) {
      const fails = a.fails + 1;
      if (fails >= MAX_FAILS) {
        this.sql.exec('UPDATE accounts SET fails = 0, locked_until = ? WHERE id = ?', now + LOCK_MS, a.id);
        return { status: 423, error: `비밀번호를 ${MAX_FAILS}번 틀려서 10분 동안 잠겼어요.`, code: 'locked', until: now + LOCK_MS };
      }
      this.sql.exec('UPDATE accounts SET fails = ? WHERE id = ?', fails, a.id);
      return { status: 401, error: `비밀번호가 틀렸어요. (남은 기회 ${MAX_FAILS - fails}번)`, code: 'wrong_pin', left: MAX_FAILS - fails };
    }
    this.sql.exec('UPDATE accounts SET fails = 0, locked_until = 0, last = ? WHERE id = ?', now, a.id);
    return { status: 200, token: await this.newSession(a.id), account: this.publicAccount(a) };
  }
  async logout(token) {
    if (token) this.sql.exec('DELETE FROM sessions WHERE token_hash = ?', await sha256(token));
    return { status: 200, ok: true };
  }

  // ---------- 저장 ----------
  listSaves(accountId) {
    return this.sql.exec('SELECT id, data, saved_at FROM saves WHERE account_id = ? ORDER BY saved_at DESC', accountId).toArray()
      .map((r) => { try { return JSON.parse(r.data); } catch (e) { return null; } }).filter(Boolean);
  }
  putSave(accountId, id, data) {
    const now = Date.now();
    const savedAt = Math.min(Number(data.savedAt) || now, now + 60000);
    const old = this.sql.exec('SELECT saved_at FROM saves WHERE account_id = ? AND id = ?', accountId, id).toArray()[0];
    // 다른 기기에서 더 나중에 저장한 것이 있으면 덮어쓰지 않음
    if (old && old.saved_at > savedAt) return { status: 200, ok: true, kept: 'newer' };
    data.id = id; data.savedAt = savedAt;
    this.sql.exec(`INSERT INTO saves (id, account_id, data, map, diff, wave, saved_at, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (account_id, id) DO UPDATE SET data = excluded.data, map = excluded.map, diff = excluded.diff, wave = excluded.wave, saved_at = excluded.saved_at, updated = excluded.updated`,
      id, accountId, JSON.stringify(data), clean(data.map, 20), clean(data.diff, 20), Number(data.wave) || 0, savedAt, now);
    this.sql.exec(`DELETE FROM saves WHERE account_id = ? AND id NOT IN (SELECT id FROM saves WHERE account_id = ? ORDER BY saved_at DESC LIMIT ${MAX_SAVES})`, accountId, accountId);
    return { status: 200, ok: true };
  }
  deleteSave(accountId, id) {
    this.sql.exec('DELETE FROM saves WHERE account_id = ? AND id = ?', accountId, id);
    return { status: 200, ok: true };
  }

  // ---------- 요청 처리 (Worker가 넘겨 줌) ----------
  async handle(req) {
    const { op, token, body, ip } = req;
    if (op === 'stats') return { status: 200, ...this.stats() };
    if (op === 'played') return { status: 200, ...this.played(body.id) };
    if (op === 'register') return this.register(body, ip);
    if (op === 'login') return this.login(body, ip);
    if (op === 'logout') return this.logout(token);
    const a = await this.accountOf(token);
    if (!a) return { status: 401, error: '다시 로그인해 주세요.', code: 'no_session' };
    if (op === 'me') return { status: 200, account: this.publicAccount(a) };
    if (op === 'saves') return { status: 200, saves: this.listSaves(a.id) };
    if (op === 'putSave') return this.putSave(a.id, body.id, body.data);
    if (op === 'deleteSave') return this.deleteSave(a.id, body.id);
    return { status: 404, error: 'not found' };
  }
}

const statsOf = (env) => env.STATS.get(env.STATS.idFromName('main'));
async function call(env, req) {
  const r = await statsOf(env).handle(req);
  const { status, ...data } = r;
  return json(data, status || 200);
}
async function readJson(request) {
  if (Number(request.headers.get('content-length') || 0) > MAX_SAVE_BYTES + 2000) return null;
  try { return await request.json(); } catch (e) { return null; }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    if (!p.startsWith('/api/')) return env.ASSETS.fetch(request);
    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    const auth = request.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const m = request.method;

    if (p === '/api/stats' && m === 'GET') {
      const r = await statsOf(env).handle({ op: 'stats' });
      const { status, ...data } = r;
      return json(data, 200, { 'cache-control': 'public, max-age=30' });
    }
    if (p === '/api/played' && m === 'POST') {
      const body = (await readJson(request)) || {};
      const id = String(body.id || '');
      if (!ID_RE.test(id)) return json({ error: 'bad id' }, 400);
      return call(env, { op: 'played', body: { id } });
    }
    if ((p === '/api/register' || p === '/api/login') && m === 'POST') {
      const body = (await readJson(request)) || {};
      const schools = await loadSchools(env);
      const school = schools.get(String(body.school || ''));
      if (!school) return json({ error: '학교를 검색해서 골라 주세요.', code: 'bad_school' }, 400);
      const nick = clean(body.nick, 10);
      const pin = String(body.pin || '');
      if (!/^\d{4}$/.test(pin)) return json({ error: '비밀번호는 숫자 4자리예요.', code: 'bad_pin' }, 400);
      if (p === '/api/register') {
        const err = nickError(nick);
        if (err) return json({ error: err, code: 'bad_nick' }, 400);
      } else if (nick.length < 2) return json({ error: '닉네임을 적어 주세요.', code: 'bad_nick' }, 400);
      return call(env, { op: p === '/api/register' ? 'register' : 'login', body: { school, nick, pin }, ip });
    }
    if (p === '/api/logout' && m === 'POST') return call(env, { op: 'logout', token });
    if (p === '/api/me' && m === 'GET') return call(env, { op: 'me', token });
    if (p === '/api/saves' && m === 'GET') return call(env, { op: 'saves', token });
    const sm = p.match(/^\/api\/saves\/([a-z0-9-]+)$/);
    if (sm && SAVE_ID_RE.test(sm[1])) {
      if (m === 'DELETE') return call(env, { op: 'deleteSave', token, body: { id: sm[1] } });
      if (m === 'PUT') {
        const body = await readJson(request);
        if (!body || typeof body.data !== 'object' || !body.data) return json({ error: '저장 내용이 올바르지 않아요.' }, 400);
        if (JSON.stringify(body.data).length > MAX_SAVE_BYTES) return json({ error: '저장 내용이 너무 커요.' }, 413);
        return call(env, { op: 'putSave', token, body: { id: sm[1], data: body.data } });
      }
    }
    return json({ error: 'not found' }, 404);
  },
};
