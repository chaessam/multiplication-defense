/* 구구단 디펜스 - 그래픽 (모든 그림을 캔버스로 직접 그림: 외부 이미지 없음) */
const Art = (() => {
  // 결정적 난수 (배경이 매번 같은 모양이 되도록)
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  // 돌 벽 텍스처
  function stoneWall(c, x, y, w, h, base = '#8d8273', bh = 12, seed = 1) {
    const R = rng(seed);
    c.save();
    c.beginPath(); c.rect(x, y, w, h); c.clip();
    c.fillStyle = base; c.fillRect(x, y, w, h);
    for (let row = 0, yy = y; yy < y + h; row++, yy += bh) {
      const off = (row % 2) * 11;
      for (let xx = x - off; xx < x + w; xx += 22) {
        c.fillStyle = shade(base, Math.floor(R() * 26 - 13));
        c.fillRect(xx + 1, yy + 1, 20, bh - 2);
      }
    }
    c.strokeStyle = 'rgba(40,30,20,.35)'; c.lineWidth = 1;
    for (let yy = y; yy < y + h; yy += bh) { c.beginPath(); c.moveTo(x, yy + .5); c.lineTo(x + w, yy + .5); c.stroke(); }
    c.restore();
  }

  function crenels(c, x, y, w, size, color) {
    c.fillStyle = color;
    const n = Math.max(2, Math.round(w / (size * 1.6)));
    const step = w / n;
    for (let i = 0; i < n; i++) c.fillRect(x + i * step + step * 0.15, y - size, step * 0.7, size);
  }

  // ============== 배경 ==============
  function drawBackground(c, L) {
    const { W, H, roadTop, roadBot } = L;
    // 하늘
    const sky = c.createLinearGradient(0, 0, 0, 110);
    sky.addColorStop(0, '#f2b46a'); sky.addColorStop(0.6, '#f6d79a'); sky.addColorStop(1, '#cfd9a8');
    c.fillStyle = sky; c.fillRect(0, 0, W, 110);
    // 해
    c.fillStyle = 'rgba(255,240,200,.85)'; c.beginPath(); c.arc(W * 0.28, 52, 22, 0, 7); c.fill();
    const R = rng(7);
    // 먼 산
    c.fillStyle = '#9a8a9e';
    c.beginPath(); c.moveTo(0, 95);
    for (let x = 0; x <= W; x += 40) c.lineTo(x, 50 + Math.sin(x * 0.013) * 18 + R() * 14);
    c.lineTo(W, 110); c.lineTo(0, 110); c.fill();
    c.fillStyle = '#6f7d6a';
    c.beginPath(); c.moveTo(0, 100);
    for (let x = 0; x <= W; x += 30) c.lineTo(x, 75 + Math.sin(x * 0.02 + 2) * 10 + R() * 8);
    c.lineTo(W, 110); c.lineTo(0, 110); c.fill();
    // 먼 성 실루엣
    c.fillStyle = '#5d6a5a';
    c.fillRect(W * 0.55, 66, 10, 30); c.fillRect(W * 0.55 + 14, 74, 22, 22); c.fillRect(W * 0.55 + 38, 60, 10, 36);
    // 초원
    const g = c.createLinearGradient(0, 95, 0, H);
    g.addColorStop(0, '#6d9a45'); g.addColorStop(1, '#4b7a2e');
    c.fillStyle = g; c.fillRect(0, 95, W, H - 95);
    // 숲 띠
    for (let x = -10; x < W + 20; x += 16) {
      const h = 18 + R() * 14, y = 98 + R() * 6;
      c.fillStyle = R() < 0.5 ? '#2f5a28' : '#3b6a2c';
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + 10, y - h); c.lineTo(x + 20, y); c.fill();
    }
    // 풀 무늬
    for (let i = 0; i < W * 0.9; i++) {
      const x = R() * W, y = 112 + R() * (H - 112);
      if (y > roadTop - 6 && y < roadBot + 6) continue;
      c.strokeStyle = R() < 0.5 ? 'rgba(40,80,25,.5)' : 'rgba(150,190,90,.45)';
      c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + (R() - 0.5) * 4, y - 4 - R() * 4); c.stroke();
    }
    // 꽃
    for (let i = 0; i < 40; i++) {
      const x = R() * W, y = 120 + R() * (H - 125);
      if (y > roadTop - 8 && y < roadBot + 8) continue;
      c.fillStyle = ['#f6e27a', '#f2f2f2', '#e88aa8', '#a8c4f0'][i % 4];
      c.beginPath(); c.arc(x, y, 1.8, 0, 7); c.fill();
    }
    // 길
    const rg = c.createLinearGradient(0, roadTop, 0, roadBot);
    rg.addColorStop(0, '#a6865a'); rg.addColorStop(0.5, '#b8976a'); rg.addColorStop(1, '#957548');
    c.fillStyle = rg;
    c.beginPath();
    c.moveTo(0, roadTop + 4);
    for (let x = 0; x <= W; x += 20) c.lineTo(x, roadTop + Math.sin(x * 0.05) * 3);
    for (let x = W; x >= 0; x -= 20) c.lineTo(x, roadBot + Math.cos(x * 0.04) * 3);
    c.fill();
    c.strokeStyle = 'rgba(70,50,25,.5)'; c.lineWidth = 3;
    c.beginPath(); for (let x = 0; x <= W; x += 20) c.lineTo(x, roadTop + Math.sin(x * 0.05) * 3); c.stroke();
    c.beginPath(); for (let x = 0; x <= W; x += 20) c.lineTo(x, roadBot + Math.cos(x * 0.04) * 3); c.stroke();
    // 바퀴 자국과 돌
    c.strokeStyle = 'rgba(110,80,45,.35)'; c.lineWidth = 2;
    [0.33, 0.66].forEach(f => {
      const y = roadTop + (roadBot - roadTop) * f;
      c.beginPath(); c.moveTo(0, y); for (let x = 0; x <= W; x += 25) c.lineTo(x, y + Math.sin(x * 0.03 + f * 9) * 2); c.stroke();
    });
    for (let i = 0; i < W / 9; i++) {
      const x = R() * W, y = roadTop + 6 + R() * (roadBot - roadTop - 12);
      c.fillStyle = R() < 0.5 ? 'rgba(120,100,80,.7)' : 'rgba(200,180,150,.6)';
      c.beginPath(); c.ellipse(x, y, 2 + R() * 3, 1.5 + R() * 2, 0, 0, 7); c.fill();
    }
    // 길가 바위 / 덤불
    for (let i = 0; i < 6; i++) {
      const x = R() * (L.castleX - 40), top = R() < 0.5;
      const y = top ? 108 + R() * 8 : H - 10 - R() * 6;
      c.fillStyle = '#7d7466'; c.beginPath(); c.ellipse(x, y, 9, 6, 0, 0, 7); c.fill();
      c.fillStyle = '#968c7c'; c.beginPath(); c.ellipse(x - 2, y - 2, 5, 3, 0, 0, 7); c.fill();
    }
  }

  // ============== 설치 칸 ==============
  function drawSlot(c, x, y, s, highlight, t) {
    c.save();
    c.fillStyle = 'rgba(0,0,0,.22)';
    rr(c, x - s / 2 + 2, y - s / 2 + 4, s, s, 8); c.fill();
    c.fillStyle = '#9b8d77';
    rr(c, x - s / 2, y - s / 2, s, s, 8); c.fill();
    c.fillStyle = '#b3a68d';
    rr(c, x - s / 2 + 4, y - s / 2 + 4, s - 8, s - 8, 6); c.fill();
    c.strokeStyle = 'rgba(80,65,45,.5)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(x, y - s / 2 + 4); c.lineTo(x, y + s / 2 - 4);
    c.moveTo(x - s / 2 + 4, y); c.lineTo(x + s / 2 - 4, y); c.stroke();
    if (highlight) {
      const a = 0.35 + Math.sin(t * 4) * 0.2;
      c.strokeStyle = `rgba(255,220,110,${a + 0.3})`; c.lineWidth = 3;
      rr(c, x - s / 2, y - s / 2, s, s, 8); c.stroke();
      c.fillStyle = `rgba(255,230,140,${a * 0.5})`;
      rr(c, x - s / 2, y - s / 2, s, s, 8); c.fill();
      c.fillStyle = 'rgba(90,60,20,.75)';
      c.font = `bold ${Math.round(s * 0.42)}px sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('+', x, y + 1);
    }
    c.restore();
  }

  // ============== 성 ==============
  function drawCastle(c, L, t, hpRatio, flash) {
    const x = L.castleX, W = L.W, cw = W - x;
    const gy = L.roadBot + 30; // 성의 바닥
    c.save();
    // 그림자
    c.fillStyle = 'rgba(0,0,0,.25)';
    c.beginPath(); c.ellipse(x + cw * 0.55, gy + 4, cw * 0.65, 18, 0, 0, 7); c.fill();

    // 뒤쪽 큰 탑(본성)
    const kx = x + cw * 0.42, kw = cw * 0.5, ky = 70;
    stoneWall(c, kx, ky, kw, gy - ky, '#8a8070', 12, 3);
    crenels(c, kx - 4, ky, kw + 8, 10, '#7a7062');
    c.fillStyle = '#7a7062'; c.fillRect(kx - 4, ky, kw + 8, 6);
    // 창문
    c.fillStyle = '#2a1d12';
    for (let i = 0; i < 2; i++) {
      const wx = kx + kw * (0.3 + i * 0.4) - 5;
      rr(c, wx, ky + 30, 10, 18, 5); c.fill();
    }
    // 뾰족 지붕 탑
    const tx = kx + kw * 0.5;
    c.fillStyle = '#7d1f1a';
    c.beginPath(); c.moveTo(tx - 20, ky - 10); c.lineTo(tx, ky - 52); c.lineTo(tx + 20, ky - 10); c.fill();
    c.fillStyle = '#5e1612';
    c.beginPath(); c.moveTo(tx, ky - 52); c.lineTo(tx + 20, ky - 10); c.lineTo(tx + 6, ky - 10); c.fill();
    flag(c, tx, ky - 52, t, '#c8302a');

    // 앞 성벽
    const wy = L.roadTop - 30;
    stoneWall(c, x + 10, wy, cw - 10, gy - wy, '#9a8f7e', 12, 5);
    crenels(c, x + 10, wy, cw - 10, 10, '#8a7f6e');

    // 양쪽 망루
    const tw = 38;
    [[x - 6, wy - 60], [x - 6, L.roadBot - 5]].forEach(([tx2, ty2], i) => {
      const th = i === 0 ? (L.roadTop + 5 - ty2) : (gy - ty2);
      stoneWall(c, tx2, ty2, tw, th + (i === 0 ? 0 : 0), '#a39886', 11, 11 + i);
      crenels(c, tx2 - 3, ty2, tw + 6, 9, '#8f8471');
      c.fillStyle = '#8f8471'; c.fillRect(tx2 - 3, ty2, tw + 6, 5);
      c.fillStyle = '#2a1d12'; rr(c, tx2 + tw / 2 - 3, ty2 + 14, 6, 14, 3); c.fill();
    });
    // 위 망루 위 깃발
    flag(c, x + 13, wy - 70, t + 1, '#2f5f8f');

    // 성문 (길 쪽)
    const gx = x + 4, gTop = L.roadTop + 10, gBot = L.roadBot - 6;
    c.fillStyle = '#a39886'; c.fillRect(gx - 8, gTop - 14, 30, gBot - gTop + 14);
    c.fillStyle = '#2a1a0e';
    c.beginPath();
    c.moveTo(gx - 2, gBot); c.lineTo(gx - 2, gTop + 18);
    c.quadraticCurveTo(gx - 2, gTop, gx + 10, gTop);
    c.quadraticCurveTo(gx + 20, gTop, gx + 20, gTop + 18);
    c.lineTo(gx + 20, gBot); c.fill();
    // 내려진 쇠창살
    c.strokeStyle = '#6d6a66'; c.lineWidth = 2.2;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(gx + 1 + i * 5.5, gTop + 6); c.lineTo(gx + 1 + i * 5.5, gBot); c.stroke(); }
    for (let j = 0; j < 5; j++) { const yy = gTop + 14 + j * ((gBot - gTop - 14) / 5); c.beginPath(); c.moveTo(gx - 2, yy); c.lineTo(gx + 20, yy); c.stroke(); }

    // 손상 표현
    if (hpRatio < 0.6) {
      c.strokeStyle = 'rgba(30,20,10,.7)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(kx + 10, ky + 60); c.lineTo(kx + 18, ky + 80); c.lineTo(kx + 12, ky + 95); c.lineTo(kx + 22, ky + 120); c.stroke();
      c.beginPath(); c.moveTo(x + 50, wy + 20); c.lineTo(x + 56, wy + 40); c.lineTo(x + 48, wy + 55); c.stroke();
    }
    if (hpRatio < 0.3) {
      for (let i = 0; i < 3; i++) {
        const fx = kx + 12 + i * 22, fy = ky + 4 + (i % 2) * 6;
        const fl = 8 + Math.sin(t * 12 + i * 2) * 3;
        c.fillStyle = 'rgba(255,140,30,.9)';
        c.beginPath(); c.moveTo(fx - 5, fy); c.quadraticCurveTo(fx, fy - fl * 2, fx + 5, fy); c.fill();
        c.fillStyle = 'rgba(255,230,90,.9)';
        c.beginPath(); c.moveTo(fx - 2, fy); c.quadraticCurveTo(fx, fy - fl, fx + 2, fy); c.fill();
      }
    }
    if (flash > 0) {
      c.globalAlpha = Math.min(0.55, flash);
      c.fillStyle = '#ff3020';
      c.fillRect(x - 8, 20, cw + 8, gy - 20);
    }
    c.restore();
  }

  function flag(c, x, y, t, color) {
    c.strokeStyle = '#3a2a1a'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 26); c.stroke();
    c.fillStyle = color;
    c.beginPath(); c.moveTo(x, y - 26);
    for (let i = 0; i <= 6; i++) c.lineTo(x - i * 4, y - 26 + Math.sin(t * 5 + i * 0.9) * 2 * (i / 6));
    for (let i = 6; i >= 0; i--) c.lineTo(x - i * 4, y - 15 + Math.sin(t * 5 + i * 0.9) * 2 * (i / 6));
    c.fill();
    c.fillStyle = '#f0c050'; c.beginPath(); c.arc(x - 12, y - 20.5 + Math.sin(t * 5 + 2.7) * 1, 2.2, 0, 7); c.fill();
  }

  // ============== 타워 ==============
  function drawTower(c, type, x, y, s, t, aim, recoil, lvlGlow) {
    c.save();
    c.translate(x, y);
    const k = s / 60;
    c.scale(k, k);
    // 그림자
    c.fillStyle = 'rgba(0,0,0,.28)';
    c.beginPath(); c.ellipse(2, 24, 26, 8, 0, 0, 7); c.fill();
    if (type === 'archer') {
      // 나무 망루
      c.fillStyle = '#6b4a2b'; c.fillRect(-18, -6, 6, 30); c.fillRect(12, -6, 6, 30);
      c.strokeStyle = '#4a3019'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(-15, 22); c.lineTo(15, 0); c.moveTo(15, 22); c.lineTo(-15, 0); c.stroke();
      c.fillStyle = '#8a6238'; c.fillRect(-22, -12, 44, 8);
      c.fillStyle = '#5e3f22'; for (let i = -22; i < 22; i += 8) c.fillRect(i, -12, 2, 8);
      // 궁수
      const bob = Math.sin(t * 3) * 0.8;
      c.save(); c.translate(0, -18 + bob);
      c.fillStyle = '#2f6a2a'; rr(c, -6, -2, 12, 12, 3); c.fill();
      c.fillStyle = '#f0c8a0'; c.beginPath(); c.arc(0, -7, 5.5, 0, 7); c.fill();
      c.fillStyle = '#245a20'; c.beginPath(); c.moveTo(-7, -8); c.lineTo(0, -17); c.lineTo(7, -8); c.fill();
      // 활
      c.rotate(aim);
      c.strokeStyle = '#5a3a1a'; c.lineWidth = 2;
      c.beginPath(); c.arc(8, 2, 9, -1.2, 1.2); c.stroke();
      c.strokeStyle = '#ddd'; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(8 + 9 * Math.cos(-1.2), 2 + 9 * Math.sin(-1.2)); c.lineTo(8 - recoil * 6, 2); c.lineTo(8 + 9 * Math.cos(1.2), 2 + 9 * Math.sin(1.2)); c.stroke();
      c.restore();
      // 지붕
      c.fillStyle = '#9b2a22';
      c.beginPath(); c.moveTo(-24, -26); c.lineTo(0, -44); c.lineTo(24, -26); c.fill();
      c.fillStyle = '#6e1c16'; c.beginPath(); c.moveTo(0, -44); c.lineTo(24, -26); c.lineTo(12, -26); c.fill();
      c.strokeStyle = '#4a3019'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-20, -26); c.lineTo(-20, -12); c.moveTo(20, -26); c.lineTo(20, -12); c.stroke();
    } else if (type === 'cannon') {
      // 돌 포대
      stoneWall(c, -24, -2, 48, 24, '#8d8273', 8, 21);
      c.fillStyle = '#766c5e'; c.fillRect(-26, -6, 52, 6);
      crenels(c, -26, -6, 52, 6, '#766c5e');
      // 포
      c.save(); c.translate(0, -12);
      c.rotate(aim);
      c.translate(-recoil * 7, 0);
      const bg = c.createLinearGradient(0, -7, 0, 7);
      bg.addColorStop(0, '#5a5a5a'); bg.addColorStop(0.5, '#2a2a2a'); bg.addColorStop(1, '#1a1a1a');
      c.fillStyle = bg; rr(c, -8, -6.5, 34, 13, 5); c.fill();
      c.fillStyle = '#222'; c.fillRect(24, -8, 6, 16);
      c.fillStyle = '#b8862b'; c.fillRect(4, -7, 3, 14); c.fillRect(14, -7, 3, 14);
      c.restore();
      // 바퀴
      c.fillStyle = '#5a3a1a'; c.beginPath(); c.arc(-4, -5, 7, 0, 7); c.fill();
      c.strokeStyle = '#3a2410'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#b8862b'; c.beginPath(); c.arc(-4, -5, 2, 0, 7); c.fill();
    } else if (type === 'mage') {
      // 돌 첨탑
      c.fillStyle = '#6d6f86';
      c.beginPath(); c.moveTo(-18, 22); c.lineTo(-11, -22); c.lineTo(11, -22); c.lineTo(18, 22); c.fill();
      c.fillStyle = '#585a70';
      c.beginPath(); c.moveTo(4, 22); c.lineTo(5, -22); c.lineTo(11, -22); c.lineTo(18, 22); c.fill();
      c.strokeStyle = 'rgba(30,30,50,.4)'; c.lineWidth = 1;
      for (let yy = -14; yy < 22; yy += 8) { c.beginPath(); c.moveTo(-18, yy); c.lineTo(18, yy); c.stroke(); }
      c.fillStyle = '#3a3c55'; c.fillRect(-15, -26, 30, 6);
      c.fillStyle = '#1a1030'; rr(c, -4, 0, 8, 12, 4); c.fill();
      // 떠 있는 수정
      const fy = -40 + Math.sin(t * 2.5) * 3;
      const glow = c.createRadialGradient(0, fy, 1, 0, fy, 18);
      glow.addColorStop(0, 'rgba(160,230,255,.9)'); glow.addColorStop(1, 'rgba(120,200,255,0)');
      c.fillStyle = glow; c.beginPath(); c.arc(0, fy, 18, 0, 7); c.fill();
      c.fillStyle = '#9fe6ff';
      c.beginPath(); c.moveTo(0, fy - 11); c.lineTo(7, fy); c.lineTo(0, fy + 11); c.lineTo(-7, fy); c.fill();
      c.fillStyle = '#e8fbff';
      c.beginPath(); c.moveTo(0, fy - 11); c.lineTo(-7, fy); c.lineTo(-2, fy); c.fill();
    }
    if (lvlGlow) {
      c.fillStyle = '#f0c050'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center';
      c.fillText('★'.repeat(Math.min(lvlGlow, 3)), 0, 32);
    }
    c.restore();
  }

  // ============== 적 ==============
  // 사람형 유닛 (원점 = 발 중앙, 오른쪽을 향함)
  function humanoid(c, o, phase) {
    const sw = Math.sin(phase) * 0.5;
    const skin = o.skin, armor = o.armor;
    // 다리
    c.lineCap = 'round';
    c.strokeStyle = o.legs || shade(armor, -30); c.lineWidth = o.bulk ? 6 : 4.5;
    c.beginPath(); c.moveTo(-2, -14); c.lineTo(-2 + Math.sin(phase) * 6, 0); c.stroke();
    c.beginPath(); c.moveTo(2, -14); c.lineTo(2 - Math.sin(phase) * 6, 0); c.stroke();
    // 뒤 팔
    c.strokeStyle = o.bulk ? skin : shade(armor, -15); c.lineWidth = o.bulk ? 5 : 3.5;
    c.beginPath(); c.moveTo(-2, -28); c.lineTo(-6 - sw * 6, -18); c.stroke();
    // 몸통
    c.fillStyle = armor;
    rr(c, o.bulk ? -9 : -7, -32, o.bulk ? 18 : 14, 19, o.bulk ? 6 : 4); c.fill();
    if (o.belt) { c.fillStyle = o.belt; c.fillRect(o.bulk ? -9 : -7, -18, o.bulk ? 18 : 14, 3); }
    if (o.tabard) { c.fillStyle = o.tabard; c.fillRect(-3, -31, 6, 17); }
    // 머리
    const hy = -38 - (o.bulk ? 1 : 0);
    c.fillStyle = skin;
    c.beginPath(); c.arc(1, hy, o.headR || 6.5, 0, 7); c.fill();
    if (o.ears) {
      c.beginPath(); c.moveTo(-3, hy - 2); c.lineTo(-11, hy - 7); c.lineTo(-3, hy + 2); c.fill();
    }
    // 눈
    c.fillStyle = o.eye || '#111';
    c.beginPath(); c.arc(4.5, hy - 1, 1.3, 0, 7); c.fill();
    if (o.tusk) { c.fillStyle = '#f4eedc'; c.beginPath(); c.moveTo(5, hy + 3); c.lineTo(7, hy - 1); c.lineTo(8, hy + 3); c.fill(); }
    // 투구
    if (o.helmet === 'cap') {
      c.fillStyle = '#7d7d82'; c.beginPath(); c.arc(1, hy - 1, 7, Math.PI, 0); c.fill();
      c.fillRect(-6, hy - 2, 14, 2);
    } else if (o.helmet === 'knight') {
      c.fillStyle = '#c3c7cf'; c.beginPath(); c.arc(1, hy, 7.5, 0, 7); c.fill();
      c.fillStyle = '#222'; c.fillRect(2, hy - 2, 7, 2);
      c.fillStyle = o.plume || '#c8302a';
      c.beginPath(); c.moveTo(-1, hy - 7); c.quadraticCurveTo(-10, hy - 16, -14, hy - 4); c.quadraticCurveTo(-8, hy - 9, -1, hy - 5); c.fill();
    } else if (o.helmet === 'horn') {
      c.fillStyle = '#5b5148'; c.beginPath(); c.arc(1, hy - 1, 7.5, Math.PI, 0); c.fill();
      c.fillStyle = '#eee3c8';
      c.beginPath(); c.moveTo(-5, hy - 4); c.quadraticCurveTo(-12, hy - 8, -10, hy - 16); c.quadraticCurveTo(-8, hy - 8, -2, hy - 6); c.fill();
      c.beginPath(); c.moveTo(6, hy - 4); c.quadraticCurveTo(13, hy - 8, 11, hy - 16); c.quadraticCurveTo(9, hy - 8, 4, hy - 6); c.fill();
    } else if (o.helmet === 'hood') {
      c.fillStyle = o.hoodColor || '#3a2a4a';
      c.beginPath(); c.arc(1, hy - 1, 8, Math.PI * 0.9, Math.PI * 2.1); c.fill();
    }
    // 앞 팔 + 무기
    const ax = 3 + sw * 3, ay = -20 + Math.abs(sw) * 2;
    c.strokeStyle = o.bulk ? skin : shade(armor, -5); c.lineWidth = o.bulk ? 5 : 3.5;
    c.beginPath(); c.moveTo(2, -28); c.lineTo(ax + 4, ay); c.stroke();
    c.save(); c.translate(ax + 4, ay);
    if (o.weapon === 'spear') {
      c.strokeStyle = '#6b4a2b'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-6, 10); c.lineTo(10, -24); c.stroke();
      c.fillStyle = '#ccc'; c.beginPath(); c.moveTo(10, -24); c.lineTo(8, -32); c.lineTo(14, -26); c.fill();
    } else if (o.weapon === 'sword') {
      c.strokeStyle = '#d8d8e0'; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(10, -16); c.stroke();
      c.strokeStyle = '#b8862b'; c.lineWidth = 2; c.beginPath(); c.moveTo(-3, -2); c.lineTo(3, 2); c.stroke();
    } else if (o.weapon === 'dagger') {
      c.strokeStyle = '#ccc'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(7, -6); c.stroke();
    } else if (o.weapon === 'club') {
      c.fillStyle = '#6b4a2b';
      c.beginPath(); c.moveTo(-1, 2); c.lineTo(6, -20); c.lineTo(13, -18); c.lineTo(3, 3); c.fill();
      c.fillStyle = '#4a3019'; c.beginPath(); c.arc(9, -19, 5, 0, 7); c.fill();
    } else if (o.weapon === 'axe') {
      c.strokeStyle = '#5a3a1a'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-2, 6); c.lineTo(6, -22); c.stroke();
      c.fillStyle = '#b8b8c0';
      c.beginPath(); c.moveTo(5, -22); c.quadraticCurveTo(18, -26, 16, -12); c.lineTo(6, -16); c.fill();
    } else if (o.weapon === 'staff') {
      c.strokeStyle = '#3a2a1a'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-2, 14); c.lineTo(4, -30); c.stroke();
      c.fillStyle = '#b06bff'; c.beginPath(); c.arc(4.5, -33, 4.5, 0, 7); c.fill();
      c.fillStyle = 'rgba(200,140,255,.35)'; c.beginPath(); c.arc(4.5, -33, 9, 0, 7); c.fill();
    }
    c.restore();
    // 방패
    if (o.shield) {
      c.fillStyle = o.shield;
      c.beginPath(); c.moveTo(6, -30); c.lineTo(13, -28); c.lineTo(13, -18); c.quadraticCurveTo(12, -12, 8, -10); c.quadraticCurveTo(5, -14, 5, -18); c.fill();
      c.strokeStyle = '#d8b050'; c.lineWidth = 1.2; c.stroke();
    }
  }

  function dragon(c, phase, t) {
    const flap = Math.sin(t * 7) * 0.6;
    // 꼬리
    c.strokeStyle = '#8f1d17'; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-14, -6); c.quadraticCurveTo(-30, 0 + Math.sin(t * 3) * 4, -40, -10 + Math.sin(t * 3) * 6); c.stroke();
    c.fillStyle = '#8f1d17'; c.beginPath(); c.moveTo(-40, -16); c.lineTo(-48, -10); c.lineTo(-38, -6); c.fill();
    // 뒤 날개
    c.fillStyle = '#5e1210';
    c.beginPath(); c.moveTo(-4, -14); c.lineTo(-18, -40 - flap * 20); c.lineTo(4, -34 - flap * 14); c.closePath(); c.fill();
    // 몸통
    c.fillStyle = '#b8261d'; c.beginPath(); c.ellipse(0, -8, 17, 10, 0, 0, 7); c.fill();
    c.fillStyle = '#e8a050'; c.beginPath(); c.ellipse(2, -3, 12, 5, 0, 0, 7); c.fill();
    // 다리
    c.fillStyle = '#8f1d17'; c.fillRect(-8, -2, 4, 7); c.fillRect(6, -2, 4, 7);
    // 목 + 머리
    c.strokeStyle = '#b8261d'; c.lineWidth = 7;
    c.beginPath(); c.moveTo(10, -12); c.quadraticCurveTo(18, -24, 22, -26); c.stroke();
    c.fillStyle = '#b8261d'; c.beginPath(); c.ellipse(26, -27, 8, 5.5, 0.2, 0, 7); c.fill();
    c.beginPath(); c.moveTo(30, -27); c.lineTo(38, -24); c.lineTo(30, -23); c.fill();
    c.fillStyle = '#ffe14a'; c.beginPath(); c.arc(27, -29, 1.6, 0, 7); c.fill();
    c.fillStyle = '#f0e6c8';
    c.beginPath(); c.moveTo(22, -31); c.lineTo(17, -38); c.lineTo(24, -32); c.fill();
    // 불씨
    if (Math.sin(t * 2) > 0.6) {
      c.fillStyle = 'rgba(255,150,40,.8)';
      c.beginPath(); c.arc(41 + Math.random() * 3, -24, 2.5, 0, 7); c.fill();
    }
    // 앞 날개
    c.fillStyle = '#d63a2c';
    c.beginPath(); c.moveTo(-2, -14); c.lineTo(-8, -46 - flap * 24); c.lineTo(8, -40 - flap * 18); c.lineTo(10, -14); c.closePath(); c.fill();
    c.strokeStyle = '#7a1510'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-2, -14); c.lineTo(-8, -46 - flap * 24); c.moveTo(4, -14); c.lineTo(8, -40 - flap * 18); c.stroke();
  }

  const LOOKS = {
    goblin:  { skin: '#6fae3a', armor: '#6b4a2b', helmet: null, weapon: 'dagger', ears: true, eye: '#ffde3a', headR: 6 },
    soldier: { skin: '#e8c09a', armor: '#7a2e2a', tabard: '#3a2a20', helmet: 'cap', weapon: 'spear', belt: '#3a2410' },
    knight:  { skin: '#e8c09a', armor: '#9aa0ab', helmet: 'knight', weapon: 'sword', shield: '#2a3a6a', plume: '#3a3a3a' },
    ogre:    { skin: '#a08b58', armor: '#6b4a2b', legs: '#7d6b40', helmet: null, weapon: 'club', bulk: true, eye: '#d22', headR: 7.5, tusk: true },
    troll:   { skin: '#6e8a96', armor: '#4a5a4a', legs: '#57707a', helmet: null, weapon: 'club', bulk: true, eye: '#ff6', headR: 7.5, tusk: true },
    orcking: { skin: '#4f8a3a', armor: '#3b2b22', legs: '#3d6b2c', helmet: 'horn', weapon: 'axe', bulk: true, eye: '#f33', headR: 8, tusk: true, belt: '#b8862b' },
    lich:    { skin: '#e4e0d0', armor: '#3a1f52', legs: '#2a153c', helmet: 'hood', hoodColor: '#24123a', weapon: 'staff', eye: '#b06bff', tabard: '#6a3a9a' },
  };

  function drawEnemy(c, e, t) {
    const s = e.def.size;
    c.save();
    c.translate(e.x, e.y);
    // 그림자
    c.fillStyle = 'rgba(0,0,0,.25)';
    c.beginPath(); c.ellipse(0, 1, 11 * s, 3.5 * s, 0, 0, 7); c.fill();
    const fly = e.def.fly ? -28 - Math.sin(t * 3) * 4 : (e.def.float ? -6 - Math.sin(t * 2.5) * 3 : 0);
    c.translate(0, fly);
    c.scale(s, s);
    if (e.hitT > 0) c.filter = 'brightness(2.2)';
    if (e.frozen > 0) c.filter = 'saturate(.2) brightness(1.3) hue-rotate(160deg)';
    else if (e.slowT > 0) c.filter = 'hue-rotate(150deg) saturate(1.4)';
    if (e.type === 'dragon') dragon(c, e.phase, t);
    else humanoid(c, LOOKS[e.type], e.phase);
    c.filter = 'none';
    if (e.frozen > 0) {
      c.fillStyle = 'rgba(180,230,255,.45)';
      rr(c, -12, -46, 24, 48, 6); c.fill();
    }
    c.restore();
  }

  // 머리 위 문제 말풍선
  function labelTop(e) {
    const s = e.def.size;
    return e.y - (e.def.fly ? 80 : 50) * s - (e.def.fly ? 0 : 6);
  }

  function drawLabel(c, e, font, highlight, lift = 0) {
    const s = e.def.size;
    const top = labelTop(e) - lift;
    const text = `${e.q.a} × ${e.q.b}`;
    c.font = font;
    const tw = c.measureText(text).width;
    const pw = tw + 18, ph = 30;
    const cx = Math.max(pw / 2 + 2, e.x); // 화면 왼쪽 끝에서 잘리지 않게
    const minY = 6 + (e.def.probs > 1 ? 10 : 0) + (e.def.boss ? 26 : 0);
    const x = cx - pw / 2, y = Math.max(minY, top - ph);
    c.fillStyle = 'rgba(0,0,0,.3)'; rr(c, x + 2, y + 3, pw, ph, 7); c.fill();
    c.fillStyle = e.def.boss ? '#3a1250' : (highlight ? '#fff6c8' : '#f6e8c0');
    rr(c, x, y, pw, ph, 7); c.fill();
    c.strokeStyle = e.def.boss ? '#d070ff' : (highlight ? '#e09a10' : '#8a6324'); c.lineWidth = highlight ? 3 : 2; c.stroke();
    // 꼬리
    c.fillStyle = e.def.boss ? '#3a1250' : (highlight ? '#fff6c8' : '#f6e8c0');
    c.beginPath(); c.moveTo(e.x - 5, y + ph - 1); c.lineTo(e.x, y + ph + 6); c.lineTo(e.x + 5, y + ph - 1); c.fill();
    c.fillStyle = e.def.boss ? '#fff' : '#3a2412';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, cx, y + ph / 2 + 1);
    // 남은 문제 수 (큰 적)
    let by = y - 8;
    if (e.def.probs > 1) {
      const n = e.def.probs, pr = 3.2, gap = 9;
      const sx = cx - ((n - 1) * gap) / 2;
      for (let i = 0; i < n; i++) {
        c.fillStyle = i < e.probsLeft ? '#f0c050' : 'rgba(60,40,20,.5)';
        c.beginPath(); c.arc(sx + i * gap, by, pr, 0, 7); c.fill();
      }
      by -= 9;
    }
    // 체력바
    if (e.hp < e.maxHp || e.def.boss) {
      const bw = Math.max(36, 30 * s), bx = Math.max(2, cx - bw / 2);
      c.fillStyle = '#1b0f08'; c.fillRect(bx - 1, by - 3, bw + 2, 6);
      c.fillStyle = e.def.boss ? '#c050ff' : '#e04030';
      c.fillRect(bx, by - 2, bw * Math.max(0, e.hp / e.maxHp), 4);
    }
    if (e.def.boss) {
      c.font = 'bold 13px "Gowun Batang", serif';
      c.fillStyle = '#ffe9a8'; c.strokeStyle = '#000'; c.lineWidth = 3;
      c.strokeText(e.def.name, Math.max(50, cx), by - 12); c.fillText(e.def.name, Math.max(50, cx), by - 12);
    }
  }

  return { labelTop, rr, shade, drawBackground, drawSlot, drawCastle, drawTower, drawEnemy, drawLabel, LOOKS };
})();
