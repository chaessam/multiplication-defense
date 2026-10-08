/* 구구단 디펜스 - 사운드
 * 기본: Web Audio로 실시간 합성 (중세풍 BGM + 효과음, 홀 잔향 포함)
 * audio/ 폴더에 음원 파일(예: bgm_battle.mp3, correct.mp3)을 넣으면 그 파일을 우선 사용한다. (audio/README.md 참고)
 */
const Sound = (() => {
  let ac = null, master = null, musicBus = null, sfxBus = null, reverbIn = null;
  let muted = false;
  let noiseBuf = null;

  // ---------------- 음악 데이터 (D 도리안) ----------------
  // [미디 음높이, 길이(8분음표)], null = 쉼표
  const MELODY_A = [
    [74, 2], [72, 1], [69, 2], [67, 1], [69, 3], [65, 2], [64, 1],
    [62, 2], [65, 1], [67, 2], [69, 1], [69, 5], [null, 1],
    [72, 2], [74, 1], [76, 2], [74, 1], [72, 2], [69, 1], [67, 3],
    [65, 2], [64, 1], [65, 2], [67, 1], [62, 6],
  ];
  const ROOTS_A = [38, 41, 36, 33, 36, 41, 43, 38];
  const MELODY_B = [
    [69, 2], [71, 1], [72, 2], [69, 1], [67, 2], [69, 1], [65, 3],
    [64, 2], [65, 1], [67, 2], [64, 1], [62, 2], [64, 1], [65, 3],
    [69, 2], [72, 1], [74, 3], [72, 2], [71, 1], [69, 3],
    [67, 2], [65, 1], [64, 2], [60, 1], [62, 6],
  ];
  const ROOTS_B = [33, 41, 36, 38, 38, 33, 36, 38];
  // 보스: D 프리지안 느낌의 긴장되는 선율
  const MELODY_BOSS = [
    [62, 1], [63, 1], [62, 1], [69, 3], [67, 2], [65, 1], [63, 3],
    [62, 1], [63, 1], [65, 1], [67, 3], [65, 2], [63, 1], [62, 3],
    [74, 2], [72, 1], [70, 3], [69, 2], [67, 1], [65, 3],
    [63, 2], [65, 1], [63, 2], [61, 1], [62, 6],
  ];
  const ROOTS_BOSS = [38, 38, 34, 34, 38, 34, 36, 38];
  // 준비 시간: 느긋한 하프 선율
  const MELODY_CALM = [
    [69, 3], [67, 1], [65, 2], [64, 3], [62, 3],
    [65, 3], [67, 1], [69, 2], [67, 6],
    [69, 3], [72, 1], [74, 2], [72, 3], [69, 3],
    [67, 2], [65, 1], [64, 3], [62, 6],
  ];
  const ROOTS_CALM = [38, 41, 36, 43, 38, 41, 36, 38];

  let mode = 'title'; // title | prep | battle | boss
  let playing = false, timer = null, nextTime = 0, step = 0;
  let night = 0;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function makeImpulse(sec, decay) {
    const len = ac.sampleRate * sec, buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.9;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 3;
    master.connect(comp); comp.connect(ac.destination);
    musicBus = ac.createGain(); musicBus.gain.value = 0.34; musicBus.connect(master);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.62; sfxBus.connect(master);
    // 홀 잔향
    const conv = ac.createConvolver(); conv.buffer = makeImpulse(2.4, 2.6);
    const wet = ac.createGain(); wet.gain.value = 0.32;
    reverbIn = ac.createGain();
    reverbIn.connect(conv); conv.connect(wet); wet.connect(master);
    musicBus.connect(reverbIn);
    const sfxSend = ac.createGain(); sfxSend.gain.value = 0.25; sfxBus.connect(sfxSend); sfxSend.connect(reverbIn);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    loadFiles();
  }

  // ---------------- 악기 ----------------
  function env(g, t, a, peak, hold, rel) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0008, t + a + hold + rel);
  }
  function flute(t, midi, dur, vol = 0.18) {
    const f = mtof(midi);
    const g = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = night > 0.5 ? 2000 : 3200;
    [[0, 'triangle', 1], [6, 'triangle', 0.5], [1200, 'sine', 0.12]].forEach(([det, type, k]) => {
      const o = ac.createOscillator(), og = ac.createGain();
      o.type = type; o.frequency.value = f; o.detune.value = det;
      const vib = ac.createOscillator(), vg = ac.createGain();
      vib.frequency.value = 5; vg.gain.value = f * 0.007;
      vib.connect(vg); vg.connect(o.frequency);
      og.gain.value = k; o.connect(og); og.connect(lp);
      o.start(t); o.stop(t + dur + 0.3); vib.start(t); vib.stop(t + dur + 0.3);
    });
    // 숨소리
    const n = ac.createBufferSource(), nf = ac.createBiquadFilter(), ng = ac.createGain();
    n.buffer = noiseBuf; nf.type = 'bandpass'; nf.frequency.value = f * 2; nf.Q.value = 3;
    ng.gain.setValueAtTime(vol * 0.25, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    n.connect(nf); nf.connect(ng); ng.connect(musicBus); n.start(t); n.stop(t + 0.15);
    lp.connect(g); g.connect(musicBus);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.05);
    g.gain.setValueAtTime(vol * 0.85, t + Math.max(0.06, dur - 0.1));
    g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
  }
  function harp(t, midi, vol = 0.12, len = 1.4) {
    const f = mtof(midi);
    const g = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(5000, t); lp.frequency.exponentialRampToValueAtTime(900, t + 0.4);
    [[1, 1, 'triangle'], [2, 0.3, 'sine'], [3, 0.12, 'sine']].forEach(([h, k, type]) => {
      const o = ac.createOscillator(), og = ac.createGain();
      o.type = type; o.frequency.value = f * h; og.gain.value = k;
      o.connect(og); og.connect(lp); o.start(t); o.stop(t + len);
    });
    lp.connect(g); g.connect(musicBus);
    env(g, t, 0.004, vol, 0, len - 0.05);
  }
  function lute(t, midi, vol = 0.1) {
    const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = mtof(midi);
    f.type = 'lowpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(380, t + 0.3);
    o.connect(f); f.connect(g); g.connect(musicBus);
    env(g, t, 0.004, vol, 0, 0.6);
    o.start(t); o.stop(t + 0.7);
  }
  function bass(t, midi, dur, vol = 0.16) {
    const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = 'sawtooth'; o2.type = 'sine';
    o.frequency.value = mtof(midi); o2.frequency.value = mtof(midi - 12);
    f.type = 'lowpass'; f.frequency.value = 420;
    o.connect(f); o2.connect(f); f.connect(g); g.connect(musicBus);
    env(g, t, 0.02, vol, dur * 0.6, dur * 0.4);
    o.start(t); o.stop(t + dur + 0.1); o2.start(t); o2.stop(t + dur + 0.1);
  }
  function pad(t, root, dur, vol = 0.05, minor = false) {
    [0, minor ? 3 : 7, 12, minor ? 15 : 19].forEach((iv, i) => {
      [-7, 7].forEach(det => {
        const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = mtof(root + 24 + iv); o.detune.value = det;
        f.type = 'lowpass'; f.frequency.value = 900;
        o.connect(f); f.connect(g); g.connect(musicBus);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol / (i + 1), t + dur * 0.4);
        g.gain.linearRampToValueAtTime(0, t + dur);
        o.start(t); o.stop(t + dur + 0.05);
      });
    });
  }
  function kick(t, vol = 0.55) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.35);
  }
  function snare(t, vol = 0.18) {
    const n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    n.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    n.connect(f); f.connect(g); g.connect(musicBus); n.start(t); n.stop(t + 0.18);
    const o = ac.createOscillator(), og = ac.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    og.gain.setValueAtTime(vol * 0.6, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(og); og.connect(musicBus); o.start(t); o.stop(t + 0.12);
  }
  function shaker(t, vol = 0.05) {
    const n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    n.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 6000;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    n.connect(f); f.connect(g); g.connect(musicBus); n.start(t); n.stop(t + 0.07);
  }
  function brass(t, midi, dur, vol = 0.1) {
    const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = 'sawtooth'; o2.type = 'square';
    o.frequency.value = mtof(midi); o2.frequency.value = mtof(midi); o2.detune.value = 8;
    f.type = 'lowpass'; f.frequency.setValueAtTime(400, t); f.frequency.linearRampToValueAtTime(1800, t + 0.08); f.frequency.linearRampToValueAtTime(900, t + dur);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(musicBus);
    env(g, t, 0.04, vol, dur * 0.7, dur * 0.3);
    o.start(t); o.stop(t + dur + 0.1); o2.start(t); o2.stop(t + dur + 0.1);
  }

  // ---------------- 시퀀서 ----------------
  const PHRASE_LEN = 48;
  function eighth() { return mode === 'boss' ? 0.15 : mode === 'battle' ? 0.17 : 0.24; }
  function phrase(s) {
    if (mode === 'boss') return [MELODY_BOSS, ROOTS_BOSS];
    if (mode === 'prep' || mode === 'title') return Math.floor(s / PHRASE_LEN) % 2 ? [MELODY_CALM, ROOTS_CALM] : [MELODY_B, ROOTS_B];
    return Math.floor(s / PHRASE_LEN) % 2 ? [MELODY_B, ROOTS_B] : [MELODY_A, ROOTS_A];
  }
  function scheduleStep(t, s) {
    const [mel, roots] = phrase(s);
    const pos = s % PHRASE_LEN, bar = Math.floor(pos / 6), beat = pos % 6;
    const ed = eighth(), root = roots[bar];
    const calm = mode === 'prep' || mode === 'title';
    let acc = 0;
    for (const [m, len] of mel) {
      if (acc === pos) {
        if (m !== null) {
          if (calm) harp(t, m, 0.13, len * ed + 0.8);
          else if (mode === 'boss') { brass(t, m - 12, len * ed * 0.95, 0.09); flute(t, m, len * ed * 0.95, 0.12); }
          else flute(t, m, len * ed * 0.96, 0.18);
        }
        break;
      }
      acc += len; if (acc > pos) break;
    }
    const arp = [0, 7, 12, 7, 12, 7];
    if (calm) { if (beat % 2 === 0) harp(t, root + 24 + arp[beat], 0.06, 1.2); }
    else lute(t, root + 24 + arp[beat], mode === 'boss' ? 0.08 : 0.1);
    if (beat === 0) {
      bass(t, root + 12, ed * 6 * 0.95, calm ? 0.1 : 0.16);
      if (!calm || night > 0.5) pad(t, root, ed * 6, calm ? 0.025 : 0.04, mode === 'boss');
    }
    if (!calm) {
      if (beat === 0 || (mode === 'boss' && beat === 3)) kick(t);
      if (beat === 3 && mode !== 'boss') kick(t, 0.35);
      if (beat === 3 && mode === 'boss') snare(t, 0.2);
      if (beat === 5) snare(t, mode === 'boss' ? 0.14 : 0.1);
      shaker(t, beat % 2 ? 0.035 : 0.05);
    }
  }
  function tick() {
    if (!ac || !playing) return;
    if (files.bgm && fileMusic()) return;
    while (nextTime < ac.currentTime + 0.35) {
      scheduleStep(nextTime, step);
      nextTime += eighth();
      step++;
    }
  }
  function startMusic() {
    init();
    if (!ac || playing) return;
    playing = true;
    nextTime = ac.currentTime + 0.1;
    timer = setInterval(tick, 90);
  }
  function setMode(m) {
    if (m === mode) return;
    mode = m;
    step = Math.floor(step / PHRASE_LEN) * PHRASE_LEN + PHRASE_LEN; // 다음 소절부터 새 분위기
    if (files.bgm) switchFileTrack();
  }
  // 예전 코드 호환: 0=준비, 1=전투, 2=보스
  function setIntensity(v) { setMode(v === 2 ? 'boss' : v === 1 ? 'battle' : 'prep'); }
  function setNight(v) { night = v; }

  // ---------------- 외부 음원 파일 (있으면 사용) ----------------
  const files = { bgm: null, sfx: {}, cur: null, curName: '' };
  const BGM_NAMES = { title: 'bgm_title', prep: 'bgm_prep', battle: 'bgm_battle', boss: 'bgm_boss' };
  async function fetchBuf(name) {
    for (const ext of ['mp3', 'ogg', 'wav']) {
      try {
        const r = await fetch(`audio/${name}.${ext}`);
        if (!r.ok) continue;
        return await ac.decodeAudioData(await r.arrayBuffer());
      } catch (_) { /* 파일 없음 */ }
    }
    return null;
  }
  async function loadFiles() {
    if (location.protocol === 'file:') return;
    const bgm = {};
    for (const [k, n] of Object.entries(BGM_NAMES)) { const b = await fetchBuf(n); if (b) bgm[k] = b; }
    if (Object.keys(bgm).length) { files.bgm = bgm; switchFileTrack(); }
    for (const n of Object.keys(sfx)) { const b = await fetchBuf(n); if (b) files.sfx[n] = b; }
  }
  function fileMusic() { return true; }
  function switchFileTrack() {
    if (!ac || !files.bgm) return;
    const want = files.bgm[mode] ? mode : files.bgm.battle ? 'battle' : Object.keys(files.bgm)[0];
    if (files.curName === want) return;
    const t = ac.currentTime;
    if (files.cur) { const old = files.cur; old.g.gain.setTargetAtTime(0, t, 0.4); old.src.stop(t + 2); }
    const src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = files.bgm[want]; src.loop = true;
    g.gain.setValueAtTime(0, t); g.gain.setTargetAtTime(0.9, t, 0.5);
    src.connect(g); g.connect(musicBus); src.start(t);
    files.cur = { src, g }; files.curName = want;
  }
  function playFile(name) {
    const b = files.sfx[name];
    if (!b) return false;
    const s = ac.createBufferSource(); s.buffer = b; s.connect(sfxBus); s.start();
    return true;
  }

  // ---------------- 효과음 ----------------
  function tone(type, f0, f1, dur, vol, delay = 0, bus = sfxBus) {
    if (!ac) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, freq, type = 'lowpass', delay = 0, q = 1) {
    if (!ac) return;
    const t = ac.currentTime + delay;
    const n = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
    n.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(f); f.connect(g); g.connect(sfxBus); n.start(t); n.stop(t + dur + 0.02);
  }
  function bell(f, vol, delay = 0, len = 0.8) {
    // FM 종소리
    if (!ac) return;
    const t = ac.currentTime + delay;
    const car = ac.createOscillator(), mod = ac.createOscillator(), mg = ac.createGain(), g = ac.createGain();
    car.frequency.value = f; mod.frequency.value = f * 3.5;
    mg.gain.setValueAtTime(f * 2, t); mg.gain.exponentialRampToValueAtTime(1, t + len);
    mod.connect(mg); mg.connect(car.frequency);
    car.connect(g); g.connect(sfxBus);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    car.start(t); mod.start(t); car.stop(t + len + 0.05); mod.stop(t + len + 0.05);
  }
  const sfx = {
    key() { tone('triangle', 1100, 900, 0.035, 0.05); },
    correct(combo = 0) {
      const base = 660 * Math.pow(2, Math.min(combo, 12) / 24);
      bell(base, 0.16); bell(base * 1.5, 0.12, 0.06);
    },
    // 장궁 시위 소리 + 불화살 휙
    fireShot(tier = 'arrow') {
      const n = tier === 'volley' ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const d = i * 0.09;
        tone('triangle', 190, 85, 0.13, 0.16, d);
        noise(0.28, 0.13, 1300, 'bandpass', d + 0.02, 1.4);
      }
      if (tier === 'phoenix') { tone('sawtooth', 260, 980, 0.5, 0.06, 0.02); bell(988, 0.07, 0.05, 0.5); noise(0.6, 0.12, 900, 'bandpass', 0.05, 0.8); }
    },
    // 불화살이 꽂히며 불꽃이 터짐
    fireHit(tier = 'arrow') {
      const big = tier === 'phoenix';
      noise(big ? 0.6 : 0.3, big ? 0.3 : 0.18, big ? 700 : 1100);
      noise(0.18, 0.1, 3200, 'highpass', 0.02);
      tone('sine', big ? 130 : 160, 45, big ? 0.5 : 0.25, big ? 0.45 : 0.22);
    },
    // 영웅마다 다른 공격 소리 (아린은 불화살 그대로)
    heroShot(hero = 'arin', tier = 'arrow') {
      const big = tier === 'phoenix', n = tier === 'volley' ? 3 : 1;
      if (hero === 'arin') return this.fireShot(tier);
      for (let i = 0; i < n; i++) {
        const d = i * 0.09;
        if (hero === 'sol') { tone('triangle', 520, 1400, 0.16, 0.09, d); noise(0.22, 0.1, 2400, 'bandpass', d, 1.2); bell(1568, 0.04, d + 0.03, 0.25); }
        else if (hero === 'seori') { bell(2093, 0.06, d, 0.3); bell(2637, 0.04, d + 0.03, 0.3); noise(0.2, 0.1, 5000, 'highpass', d); }
        else { tone('square', 1800, 300, 0.12, 0.05, d); tone('sawtooth', 900, 120, 0.15, 0.05, d + 0.02); noise(0.12, 0.12, 4000, 'bandpass', d, 3); }
      }
      if (big) {
        if (hero === 'sol') { [784, 988, 1175, 1568].forEach((f, i) => bell(f, 0.07, 0.03 + i * 0.04, 0.5)); tone('sine', 300, 900, 0.5, 0.08); }
        else if (hero === 'seori') { tone('sine', 1200, 400, 0.6, 0.08); [1568, 2093, 2637].forEach((f, i) => bell(f, 0.06, i * 0.05, 0.6)); }
        else { tone('sawtooth', 80, 1600, 0.4, 0.1); noise(0.5, 0.18, 2500, 'bandpass', 0.05, 2); }
      }
    },
    heroHit(hero = 'arin', tier = 'arrow') {
      const big = tier === 'phoenix';
      if (hero === 'arin') return this.fireHit(tier);
      if (hero === 'sol') { tone('sine', big ? 220 : 300, 90, big ? 0.5 : 0.25, big ? 0.35 : 0.18); bell(big ? 1046 : 1318, 0.07, 0, 0.4); noise(big ? 0.4 : 0.2, 0.12, 2600, 'bandpass'); }
      else if (hero === 'seori') { noise(big ? 0.5 : 0.25, big ? 0.22 : 0.14, 6000, 'highpass'); bell(big ? 1318 : 1760, 0.06, 0, 0.5); tone('sine', 400, 120, 0.25, big ? 0.3 : 0.15); }
      else { noise(big ? 0.45 : 0.22, big ? 0.3 : 0.18, 3000, 'bandpass', 0, 4); tone('square', big ? 140 : 200, 40, big ? 0.4 : 0.2, big ? 0.2 : 0.1); tone('sine', 120, 40, 0.3, big ? 0.35 : 0.15); }
    },
    wrong() { tone('sawtooth', 200, 120, 0.25, 0.16); tone('square', 150, 95, 0.28, 0.08, 0.05); },
    arrow() { noise(0.09, 0.12, 2800, 'bandpass', 0, 2); tone('triangle', 420, 900, 0.07, 0.04); },
    bolt() { noise(0.12, 0.14, 3500, 'bandpass', 0, 2); tone('sine', 900, 1800, 0.1, 0.06); },
    cannon() { tone('sine', 140, 38, 0.45, 0.6); noise(0.35, 0.32, 650); noise(0.08, 0.2, 3000, 'highpass'); },
    boom() { tone('sine', 95, 30, 0.5, 0.45); noise(0.5, 0.36, 480); },
    frost() { bell(1600, 0.05, 0, 0.3); bell(2400, 0.04, 0.05, 0.3); },
    hit() { noise(0.05, 0.08, 1500, 'bandpass'); },
    die() { tone('square', 320, 80, 0.16, 0.06); noise(0.18, 0.1, 1200); },
    gem() { bell(1568, 0.08, 0, 0.4); bell(2093, 0.07, 0.07, 0.5); },
    castleHit() { tone('sine', 85, 35, 0.5, 0.55); noise(0.4, 0.32, 380); noise(0.15, 0.15, 2500, 'bandpass', 0.05); },
    build() { noise(0.08, 0.22, 800, 'bandpass'); noise(0.08, 0.22, 600, 'bandpass', 0.12); bell(784, 0.08, 0.25, 0.4); bell(1046, 0.08, 0.33, 0.5); },
    coin() { bell(1318, 0.07, 0, 0.25); bell(1760, 0.07, 0.06, 0.35); },
    upgrade() { [523, 659, 784, 1047].forEach((f, i) => bell(f, 0.09, i * 0.07, 0.5)); },
    evolve() { [392, 523, 659, 784, 1047, 1318].forEach((f, i) => bell(f, 0.1, i * 0.08, 0.7)); noise(1.2, 0.08, 6000, 'highpass', 0.1); tone('sine', 200, 800, 0.8, 0.12); },
    horn() {
      if (!ac) return;
      [[50, 0, 0.35], [57, 0.35, 0.35], [62, 0.7, 0.8]].forEach(([m, d, l]) => {
        const t = ac.currentTime + d;
        [0, 7].forEach(det => {
          const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
          o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
          f.type = 'lowpass'; f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(1600, t + 0.08);
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.13, t + 0.05);
          g.gain.setValueAtTime(0.13, t + l - 0.08); g.gain.linearRampToValueAtTime(0, t + l);
          o.connect(f); f.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + l + 0.02);
        });
      });
    },
    boss() { tone('sawtooth', 70, 48, 1.4, 0.3); tone('sawtooth', 73, 50, 1.4, 0.25); noise(1.2, 0.18, 280); kickSfx(0); kickSfx(0.5); },
    victory() { [62, 66, 69, 74, 78].forEach((m, i) => bell(mtof(m + 12), 0.1, i * 0.1, 0.8)); },
    lose() { [62, 61, 60, 55].forEach((m, i) => tone('sawtooth', mtof(m), null, 0.45, 0.1, i * 0.35)); },
    skill() { tone('sine', 300, 1200, 0.5, 0.2); noise(0.6, 0.12, 2000, 'bandpass'); },
    ult() { tone('sawtooth', 110, 880, 0.9, 0.12); [523, 784, 1047, 1568].forEach((f, i) => bell(f, 0.1, 0.5 + i * 0.05, 0.9)); noise(1.0, 0.2, 3000, 'bandpass', 0.6); kickSfx(1.1); },
    card() { noise(0.12, 0.12, 4000, 'highpass'); bell(1046, 0.06, 0.05, 0.3); },
    pick() { bell(784, 0.1, 0, 0.4); bell(1175, 0.1, 0.08, 0.5); bell(1568, 0.08, 0.16, 0.6); },
    star(i = 0) { bell(1046 * Math.pow(1.26, i), 0.12, 0, 0.6); },
    achieve() { [784, 988, 1175, 1568].forEach((f, i) => bell(f, 0.1, i * 0.09, 0.9)); },
    gate() { // 쇠창살이 내려오고 다리가 올라가며 쿵
      for (let i = 0; i < 6; i++) noise(0.05, 0.1, 2600 + i * 200, 'bandpass', i * 0.05, 4);
      tone('sine', 110, 40, 0.5, 0.5, 0.32); noise(0.4, 0.3, 500, 'lowpass', 0.32);
    },
    gateOpen() { for (let i = 0; i < 10; i++) noise(0.04, 0.07, 2200 + (i % 3) * 400, 'bandpass', i * 0.08, 5); tone('triangle', 220, 330, 0.8, 0.05); },
    cut() { noise(0.4, 0.25, 1200, 'bandpass', 0, 0.5); tone('sawtooth', 60, 40, 0.9, 0.25); },
  };
  function kickSfx(delay) {
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(35, t + 0.3);
    g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.42);
  }

  function play(name, ...args) {
    if (!ac || muted) return;
    try {
      if (playFile(name)) return;
      sfx[name] && sfx[name](...args);
    } catch (e) { /* 무시 */ }
  }
  function setMuted(m) {
    muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ac.currentTime, 0.05);
  }

  return {
    init, play, startMusic, setMode, setIntensity, setNight, setMuted,
    get muted() { return muted; },
    suspend() { if (ac && ac.state === 'running') ac.suspend(); },
    resume() { if (ac && ac.state === 'suspended') ac.resume(); },
  };
})();
