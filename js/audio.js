/* 구구단 디펜스 - 사운드 (Web Audio로 실시간 합성: 외부 음원 파일 없음)
 * BGM: D 도리안 선법의 중세풍 선율(리코더) + 류트 아르페지오 + 드론 베이스 + 프레임 드럼
 */
const Sound = (() => {
  let ac = null, master = null, musicBus = null, sfxBus = null;
  let muted = false;
  let noiseBuf = null;

  // ---------- 음악 데이터 ----------
  // [미디 음높이, 길이(8분음표 단위)], null = 쉼표
  const MELODY_A = [
    [74,2],[72,1],[69,2],[67,1],
    [69,3],[65,2],[64,1],
    [62,2],[65,1],[67,2],[69,1],
    [69,5],[null,1],
    [72,2],[74,1],[76,2],[74,1],
    [72,2],[69,1],[67,3],
    [65,2],[64,1],[65,2],[67,1],
    [62,6],
  ];
  const ROOTS_A = [38, 41, 36, 33, 36, 41, 43, 38];
  const MELODY_B = [
    [69,2],[71,1],[72,2],[69,1],
    [67,2],[69,1],[65,3],
    [64,2],[65,1],[67,2],[64,1],
    [62,2],[64,1],[65,3],
    [69,2],[72,1],[74,3],
    [72,2],[71,1],[69,3],
    [67,2],[65,1],[64,2],[60,1],
    [62,6],
  ];
  const ROOTS_B = [33, 41, 36, 38, 38, 33, 36, 38];
  const PHRASES = [[MELODY_A, ROOTS_A], [MELODY_B, ROOTS_B]];

  let intensity = 0; // 0 = 준비(잔잔), 1 = 전투, 2 = 보스
  let playing = false;
  let timer = null;
  let nextTime = 0;
  let step = 0; // 8분음표 단위 전체 진행

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ac.destination);
    musicBus = ac.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.6; sfxBus.connect(master);

    // 간단한 홀 잔향 (딜레이 피드백)
    const delay = ac.createDelay(); delay.delayTime.value = 0.23;
    const fb = ac.createGain(); fb.gain.value = 0.28;
    const wet = ac.createGain(); wet.gain.value = 0.22;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    musicBus.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(wet); wet.connect(master);

    noiseBuf = ac.createBuffer(1, ac.sampleRate * 1.0, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  // ---------- 악기 ----------
  function recorder(t, midi, dur, vol = 0.22) {
    const o = ac.createOscillator(), o2 = ac.createOscillator();
    const g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = 'triangle'; o2.type = 'sine';
    o.frequency.value = mtof(midi); o2.frequency.value = mtof(midi) * 2;
    const vib = ac.createOscillator(), vg = ac.createGain();
    vib.frequency.value = 5.2; vg.gain.value = mtof(midi) * 0.006;
    vib.connect(vg); vg.connect(o.frequency);
    const g2 = ac.createGain(); g2.gain.value = 0.15;
    f.type = 'lowpass'; f.frequency.value = 2600;
    o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(musicBus);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.04);
    g.gain.setValueAtTime(vol * 0.85, t + Math.max(0.05, dur - 0.08));
    g.gain.linearRampToValueAtTime(0, t + dur);
    [o, o2, vib].forEach(x => { x.start(t); x.stop(t + dur + 0.05); });
  }

  function lute(t, midi, vol = 0.13) {
    const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = mtof(midi);
    f.type = 'lowpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(400, t + 0.35);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    o.connect(f); f.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + 0.75);
  }

  function drone(t, midi, dur, vol = 0.07) {
    [0, 7].forEach(iv => {
      const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = mtof(midi + iv);
      f.type = 'lowpass'; f.frequency.value = 500;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.15);
      g.gain.setValueAtTime(vol, t + dur - 0.1); g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(f); f.connect(g); g.connect(musicBus);
      o.start(t); o.stop(t + dur + 0.05);
    });
  }

  function drum(t, strong) {
    // 프레임 드럼: 낮은 사인 + 노이즈 탁
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(strong ? 110 : 160, t);
    o.frequency.exponentialRampToValueAtTime(strong ? 55 : 90, t + 0.18);
    g.gain.setValueAtTime(strong ? 0.5 : 0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.32);
    const n = ac.createBufferSource(), ng = ac.createGain(), nf = ac.createBiquadFilter();
    n.buffer = noiseBuf; nf.type = 'bandpass'; nf.frequency.value = strong ? 900 : 2500;
    ng.gain.setValueAtTime(strong ? 0.12 : 0.07, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    n.connect(nf); nf.connect(ng); ng.connect(musicBus); n.start(t); n.stop(t + 0.1);
  }

  // ---------- 시퀀서 ----------
  const PHRASE_LEN = 48; // 8마디 * 6

  function eighthDur() { return intensity === 2 ? 0.155 : intensity === 1 ? 0.175 : 0.21; }

  function scheduleStep(t, s) {
    const phraseIdx = Math.floor(s / PHRASE_LEN) % PHRASES.length;
    const pos = s % PHRASE_LEN;
    const [mel, roots] = PHRASES[phraseIdx];
    const bar = Math.floor(pos / 6), beat = pos % 6;
    const ed = eighthDur();
    const root = roots[bar] + (intensity === 2 ? -0 : 0);

    // 멜로디: 현재 위치에서 시작하는 음 찾기
    let acc = 0;
    for (const [m, len] of mel) {
      if (acc === pos) { if (m !== null) recorder(t, m + (intensity === 2 ? -12 : 0), len * ed * 0.98, intensity === 2 ? 0.26 : 0.2); break; }
      acc += len; if (acc > pos) break;
    }
    // 류트 아르페지오 (근음-5도-옥타브)
    const arp = [0, 7, 12, 7, 12, 7];
    if (intensity > 0 || beat % 3 === 0) lute(t, root + 24 + arp[beat], intensity > 0 ? 0.11 : 0.09);
    // 드론
    if (beat === 0) drone(t, root, ed * 6, intensity === 2 ? 0.09 : 0.06);
    // 드럼 (전투 중에만)
    if (intensity > 0) {
      if (beat === 0 || beat === 3) drum(t, true);
      else if (beat === 5 || (intensity === 2 && beat % 2 === 1)) drum(t, false);
    }
  }

  function tick() {
    if (!ac || !playing) return;
    while (nextTime < ac.currentTime + 0.35) {
      scheduleStep(nextTime, step);
      nextTime += eighthDur();
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
  function stopMusic() {
    playing = false;
    clearInterval(timer);
  }
  function setIntensity(v) { intensity = v; }

  // ---------- 효과음 ----------
  function tone(type, f0, f1, dur, vol, delay = 0) {
    if (!ac) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, freq, type = 'lowpass', delay = 0) {
    if (!ac) return;
    const t = ac.currentTime + delay;
    const n = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
    n.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(f); f.connect(g); g.connect(sfxBus); n.start(t); n.stop(t + dur + 0.02);
  }

  const sfx = {
    key()     { tone('square', 900, 700, 0.04, 0.05); },
    correct(combo = 0) {
      const base = 660 * Math.pow(2, Math.min(combo, 12) / 24);
      tone('triangle', base, null, 0.12, 0.25);
      tone('triangle', base * 1.5, null, 0.18, 0.2, 0.07);
      noise(0.25, 0.15, 5000, 'highpass', 0.02); // 번개 지직
    },
    wrong()   { tone('sawtooth', 180, 110, 0.25, 0.2); tone('square', 140, 90, 0.25, 0.1, 0.05); },
    arrow()   { noise(0.08, 0.12, 3000, 'bandpass'); tone('triangle', 500, 900, 0.06, 0.05); },
    cannon()  { tone('sine', 120, 40, 0.35, 0.5); noise(0.3, 0.3, 700); },
    boom()    { tone('sine', 90, 30, 0.4, 0.4); noise(0.45, 0.35, 500); },
    frost()   { tone('sine', 1400, 2200, 0.15, 0.08); tone('sine', 1800, 2600, 0.12, 0.05, 0.04); },
    hit()     { noise(0.05, 0.08, 1500, 'bandpass'); },
    die()     { tone('square', 300, 80, 0.18, 0.08); noise(0.15, 0.1, 1200); },
    gem()     { tone('sine', 1320, null, 0.08, 0.12); tone('sine', 1760, null, 0.12, 0.1, 0.06); },
    castleHit(){ tone('sine', 80, 40, 0.4, 0.5); noise(0.35, 0.3, 400); },
    build()   { noise(0.08, 0.2, 800, 'bandpass'); noise(0.08, 0.2, 600, 'bandpass', 0.12); tone('triangle', 520, null, 0.1, 0.12, 0.25); tone('triangle', 780, null, 0.16, 0.12, 0.33); },
    coin()    { tone('square', 988, null, 0.06, 0.06); tone('square', 1319, null, 0.12, 0.06, 0.06); },
    upgrade() { [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, null, 0.15, 0.15, i * 0.07)); },
    horn()    { // 웨이브 시작 나팔
      if (!ac) return;
      [[62, 0, 0.3], [69, 0.3, 0.3], [74, 0.6, 0.7]].forEach(([m, d, l]) => {
        const t = ac.currentTime + d;
        const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = mtof(m - 12);
        f.type = 'lowpass'; f.frequency.value = 1400;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.05);
        g.gain.setValueAtTime(0.18, t + l - 0.08); g.gain.linearRampToValueAtTime(0, t + l);
        o.connect(f); f.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + l + 0.02);
      });
    },
    boss()    { tone('sawtooth', 70, 50, 1.2, 0.3); tone('sawtooth', 73, 52, 1.2, 0.25); noise(1.0, 0.15, 300); },
    victory() { [62, 66, 69, 74].forEach((m, i) => tone('triangle', mtof(m + 12), null, 0.3, 0.18, i * 0.12)); },
    lose()    { [62, 61, 60, 55].forEach((m, i) => tone('sawtooth', mtof(m), null, 0.45, 0.12, i * 0.35)); },
    skill()   { tone('sine', 300, 1200, 0.5, 0.2); noise(0.6, 0.12, 2000, 'bandpass'); },
  };

  function play(name, ...args) {
    if (!ac || muted) return;
    try { sfx[name] && sfx[name](...args); } catch (e) { /* 무시 */ }
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ac.currentTime, 0.05);
  }

  return {
    init, play, startMusic, stopMusic, setIntensity, setMuted,
    get muted() { return muted; },
    suspend() { if (ac && ac.state === 'running') ac.suspend(); },
    resume() { if (ac && ac.state === 'suspended') ac.resume(); },
  };
})();
