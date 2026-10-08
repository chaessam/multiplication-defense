// 전국 초등학교 목록 만들기 → data/schools.json (게임 대상이 초등학생)
//   NEIS_API_KEY=발급받은키 node scripts/update-schools.mjs   (빠름, https://open.neis.go.kr 무료 인증키)
//   ... --all                                                  (중·고등학교까지 넣을 때)
//   node scripts/update-schools.mjs                            (키 없이: 한 번에 5개씩 받아서 오래 걸림)
// 형식: { updated, source, count, schools: [[학교코드, 학교명, 시도, 시군구], ...] }
// 전라남도·광주광역시는 2026-07-01 통합 → 모두 '전남광주'로 표기
// 주의: 계정과 랭킹은 학교 코드로 저장되므로 학교 코드(SD_SCHUL_CODE)를 바꾸지 마세요.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'schools.json');
const KINDS = process.argv.includes('--all') ? ['초등학교', '중학교', '고등학교'] : ['초등학교'];
const KEY = process.env.NEIS_API_KEY || '';
const PAGE = KEY ? 1000 : 5;

const SIDO_SHORT = {
  서울특별시: '서울', 부산광역시: '부산', 대구광역시: '대구', 인천광역시: '인천', 광주광역시: '전남광주',
  대전광역시: '대전', 울산광역시: '울산', 세종특별자치시: '세종', 경기도: '경기',
  강원도: '강원', 강원특별자치도: '강원', 충청북도: '충북', 충청남도: '충남',
  전라북도: '전북', 전북특별자치도: '전북', 전라남도: '전남광주', 경상북도: '경북', 경상남도: '경남',
  제주특별자치도: '제주', 제주도: '제주',
};
export function shortSido(name) {
  const s = String(name || '').trim();
  if (/^전남광주/.test(s)) return '전남광주';
  return SIDO_SHORT[s] || s.replace(/(특별자치시|특별자치도|특별시|광역시)$/, '');
}
export function sigunguOf(address) {
  const parts = String(address || '').trim().split(/\s+/).slice(1);
  const out = [];
  for (const p of parts) { if (/(시|군|구)$/.test(p) && out.length < 2) out.push(p); else break; }
  return out.join(' ');
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getPage(kind, page) {
  const url = new URL('https://open.neis.go.kr/hub/schoolInfo');
  url.search = new URLSearchParams({ ...(KEY ? { KEY } : {}), Type: 'json', pIndex: String(page), pSize: String(PAGE), SCHUL_KND_SC_NM: kind });
  for (let tryN = 0; tryN < 5; tryN++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = await res.json();
      if (!d.schoolInfo) { if (d.RESULT && d.RESULT.CODE === 'INFO-200') return { total: 0, rows: [] }; throw new Error(JSON.stringify(d.RESULT)); }
      return { total: d.schoolInfo[0].head[0].list_total_count, rows: d.schoolInfo[1].row || [] };
    } catch (e) { await sleep(1000 * (tryN + 1)); if (tryN === 4) throw e; }
  }
}
async function fetchKind(kind) {
  const first = await getPage(kind, 1);
  const pages = Math.ceil(first.total / PAGE);
  const rows = [...first.rows];
  let next = 2;
  const worker = async () => { while (next <= pages) { const p = next++; const r = await getPage(kind, p); rows.push(...r.rows); if (p % 50 === 0) console.log(`  ${kind} ${p}/${pages}`); await sleep(KEY ? 0 : 60); } };
  await Promise.all([worker(), worker(), worker(), worker()]);
  console.log(`${kind}: ${rows.length} / ${first.total}`);
  return rows;
}
async function main() {
  const t = (v) => String(v == null ? '' : v).trim();
  let all = [];
  for (const k of KINDS) all = all.concat(await fetchKind(k));
  const seen = new Set();
  const schools = all
    .filter((r) => t(r.SD_SCHUL_CODE) && !t(r.SCHUL_NM).startsWith('(가칭)'))
    .map((r) => [t(r.SD_SCHUL_CODE), t(r.SCHUL_NM), shortSido(t(r.LCTN_SC_NM) || t(r.ORG_RDNMA).split(/\s+/)[0]), sigunguOf(t(r.ORG_RDNMA))])
    .filter((s) => !seen.has(s[0]) && seen.add(s[0]))
    .sort((a, b) => a[1].localeCompare(b[1], 'ko') || a[2].localeCompare(b[2], 'ko'));
  const out = { updated: new Date().toISOString().slice(0, 10), source: `NEIS 교육정보 개방 포털 학교기본정보 (${KINDS.join('·')})`, count: schools.length, schools };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log('저장:', OUT, schools.length, '곳');
}
if (process.argv[1] && process.argv[1].endsWith('update-schools.mjs')) main().catch((e) => { console.error(e); process.exit(1); });
