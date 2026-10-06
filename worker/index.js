// 구구단 디펜스 Cloudflare 서버
// - 게임 화면 파일(index.html, js, css …)은 Cloudflare가 바로 제공 (assets)
// - /api/* 만 이 Worker가 처리: 참여 플레이어 수와 누적 판 수를 세는 작은 통계
// - 통계는 Durable Object(SQLite) 하나에 저장. 무료 플랜에서 쓸 수 있는 방식이에요.
// - 개인정보는 받지 않아요. 기기마다 브라우저가 만든 임의의 번호(기기 번호)만 보내요.
import { DurableObject } from 'cloudflare:workers';

const ID_RE = /^[a-z0-9-]{16,64}$/;
const MIN_GAP_MS = 20 * 1000; // 같은 기기가 너무 자주 보내면 판 수에 넣지 않음 (장난 방지)
const STATS_CACHE_MS = 30 * 1000;

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extra },
  });
}

export class Stats extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, games INTEGER NOT NULL DEFAULT 0, first INTEGER, last INTEGER);
      CREATE TABLE IF NOT EXISTS counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL DEFAULT 0);
    `);
    this.cache = null;
  }
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
  // 게임 한 판 시작: 처음 보는 기기면 참여 플레이어 +1, 판 수 +1
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
}

const statsOf = (env) => env.STATS.get(env.STATS.idFromName('main'));

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/stats' && request.method === 'GET') {
      return json(await statsOf(env).stats(), 200, { 'cache-control': 'public, max-age=30' });
    }
    if (url.pathname === '/api/played' && request.method === 'POST') {
      let body = {};
      try { body = await request.json(); } catch { /* 빈 요청 */ }
      const id = String(body.id || '');
      if (!ID_RE.test(id)) return json({ error: 'bad id' }, 400);
      return json(await statsOf(env).played(id), 200, { 'cache-control': 'no-store' });
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'not found' }, 404);
    return env.ASSETS.fetch(request);
  },
};
