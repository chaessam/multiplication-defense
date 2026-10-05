/* 구구단 디펜스 - 3D 로우폴리 모델 (성, 탑 3단계, 적, 보스, 영웅) */
const Models = (() => {
  const T = THREE;

  // ---------------- 공용 재질 / 도형 ----------------
  const matCache = new Map();
  function mat(color, opts) {
    const key = color + (opts ? JSON.stringify(opts) : '');
    if (!matCache.has(key)) {
      matCache.set(key, new T.MeshStandardMaterial(Object.assign({ color, flatShading: true, roughness: 0.88, metalness: 0 }, opts || {})));
    }
    return matCache.get(key);
  }
  function glow(color, k = 0.9) { return mat(color, { emissive: color, emissiveIntensity: k }); }
  function mesh(geo, m, shadow = true) {
    const o = new T.Mesh(geo, m);
    o.castShadow = shadow;
    return o;
  }
  const G = {
    box: new T.BoxGeometry(1, 1, 1),
    ico: new T.IcosahedronGeometry(1, 0),
    ico1: new T.IcosahedronGeometry(1, 1),
    oct: new T.OctahedronGeometry(1, 0),
    sphere: new T.SphereGeometry(1, 8, 6),
    halfSphere: new T.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
    cyl6: new T.CylinderGeometry(1, 1, 1, 6),
    cyl8: new T.CylinderGeometry(1, 1, 1, 8),
    cone4: new T.ConeGeometry(1, 1, 4),
    cone6: new T.ConeGeometry(1, 1, 6),
    cone8: new T.ConeGeometry(1, 1, 8),
    torus: new T.TorusGeometry(1, 0.08, 4, 16),
  };
  function part(geo, m, sx, sy, sz, x = 0, y = 0, z = 0) {
    const o = mesh(geo, m);
    o.scale.set(sx, sy, sz); o.position.set(x, y, z);
    return o;
  }
  function shadowAll(g) { g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; }

  // 횃불 (밤에만 켜짐)
  const flameMat = new T.MeshBasicMaterial({ color: '#ffb347' });
  const flameMat2 = new T.MeshBasicMaterial({ color: '#fff1a0' });
  function torch(x, y, z, s = 1) {
    const g = new T.Group();
    g.add(part(G.cyl6, mat('#5a3a22'), 0.06 * s, 0.5 * s, 0.06 * s, 0, -0.25 * s, 0));
    const f = new T.Group();
    const a = mesh(G.cone6, flameMat, false); a.scale.set(0.16 * s, 0.38 * s, 0.16 * s); a.position.y = 0.15 * s; f.add(a);
    const b = mesh(G.cone6, flameMat2, false); b.scale.set(0.08 * s, 0.22 * s, 0.08 * s); b.position.y = 0.1 * s; f.add(b);
    g.add(f);
    g.position.set(x, y, z);
    g.userData.torch = f;
    return g;
  }

  // ---------------- 성 ----------------
  // 손으로 그린 질감 (돌벽 / 지붕 기와) - 캔버스로 만들어 재사용
  const texCache = {};
  function canvasTex(key, draw, size = 256) {
    if (!texCache[key]) {
      const c = document.createElement('canvas'); c.width = c.height = size;
      draw(c.getContext('2d'), size);
      const t = new T.CanvasTexture(c);
      t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4;
      texCache[key] = t;
    }
    return texCache[key];
  }
  function shadeHex(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = v => Math.max(0, Math.min(255, Math.round(v * k)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }
  function stoneTex(base) {
    return canvasTex('stone' + base, (x, S) => {
      let seed = 7;
      const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      x.fillStyle = shadeHex(base, 0.62); x.fillRect(0, 0, S, S); // 줄눈
      const bh = S / 8, bw = S / 4;
      for (let row = 0; row < 8; row++) {
        const off = row % 2 ? bw / 2 : 0;
        for (let col = -1; col < 5; col++) {
          const bx = col * bw + off + 2, by = row * bh + 2, w = bw - 4, h = bh - 4;
          x.fillStyle = shadeHex(base, 0.86 + R() * 0.22);
          x.fillRect(bx, by, w, h);
          x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(bx, by, w, 3);   // 윗면 밝게
          x.fillStyle = 'rgba(0,0,0,0.16)'; x.fillRect(bx, by + h - 3, w, 3); // 아랫면 어둡게
          for (let k = 0; k < 6; k++) { x.fillStyle = `rgba(0,0,0,${0.05 + R() * 0.08})`; x.fillRect(bx + R() * w, by + R() * h, 2 + R() * 4, 2 + R() * 3); }
        }
      }
    });
  }
  function roofTex(base) {
    return canvasTex('roof' + base, (x, S) => {
      x.fillStyle = shadeHex(base, 0.55); x.fillRect(0, 0, S, S);
      const rh = S / 8, tw = S / 8;
      for (let row = 0; row < 9; row++) {
        const off = row % 2 ? tw / 2 : 0;
        for (let col = -1; col < 9; col++) {
          const cx = col * tw + off + tw / 2, cy = row * rh;
          x.fillStyle = shadeHex(base, 0.9 + ((row * 7 + col * 3) % 5) * 0.05);
          x.beginPath(); x.moveTo(cx - tw / 2 + 1, cy); x.lineTo(cx + tw / 2 - 1, cy);
          x.lineTo(cx + tw / 2 - 1, cy + rh * 0.55); x.quadraticCurveTo(cx, cy + rh * 1.25, cx - tw / 2 + 1, cy + rh * 0.55); x.closePath(); x.fill();
          x.strokeStyle = shadeHex(base, 0.6); x.lineWidth = 1.5; x.stroke();
        }
      }
    });
  }
  function texMat(tex, rx, ry, opts = {}) {
    const t = tex.clone(); t.needsUpdate = true; t.repeat.set(rx, ry);
    return new T.MeshStandardMaterial(Object.assign({ map: t, roughness: 0.92 }, opts));
  }
  // 둥근 탑 하나 (돌 몸통 + 받침 + 돌출 회랑 + 총안 + 원뿔 지붕)
  function roundTower(r, h, roofCol, wallTex, slitMat, opts = {}) {
    const g = new T.Group();
    const segs = 14;
    g.add(part(new T.CylinderGeometry(r * 1.12, r * 1.2, 0.5, segs), texMat(wallTex, 6, 0.5, { color: '#c9c1b2' }), 1, 1, 1, 0, 0.25, 0));
    g.add(part(new T.CylinderGeometry(r, r * 1.05, h, segs), texMat(wallTex, Math.round(r * 5), h * 1.3), 1, 1, 1, 0, h / 2, 0));
    // 돌출 회랑 (마치콜레이션) + 받침돌
    const ringY = h - 0.15;
    g.add(part(new T.CylinderGeometry(r * 1.22, r * 1.12, 0.4, segs), texMat(wallTex, 6, 0.4, { color: '#d8d0c2' }), 1, 1, 1, 0, ringY, 0));
    const stoneM = mat('#bdb5a6');
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      g.add(part(G.box, stoneM, 0.16, 0.32, 0.16, Math.cos(a) * r * 1.08, ringY - 0.32, Math.sin(a) * r * 1.08));
      if (i % 2 === 0) g.add(part(G.box, mat('#d8d0c2'), 0.3, 0.42, 0.24, Math.cos(a) * r * 1.16, ringY + 0.4, Math.sin(a) * r * 1.16).rotateY(-a));
    }
    // 화살 구멍
    for (const [yy, aa] of opts.slits || [[h * 0.45, Math.PI], [h * 0.75, Math.PI * 0.8], [h * 0.75, Math.PI * 1.2]]) {
      const sl = part(G.box, slitMat, 0.1, 0.42, 0.08, Math.cos(aa) * (r * 1.02), yy, -Math.sin(aa) * (r * 1.02));
      sl.rotation.y = aa; g.add(sl);
    }
    // 지붕
    const roofH = opts.roofH || r * 2.3;
    const roof = new T.Mesh(new T.ConeGeometry(r * 1.35, roofH, segs), texMat(roofTex(roofCol), 5, 3));
    roof.position.y = ringY + 0.35 + roofH / 2; g.add(roof);
    g.add(part(new T.TorusGeometry(r * 1.3, 0.06, 4, segs), mat(shadeHexToHex(roofCol, 0.7)), 1, 1, 1, 0, ringY + 0.37, 0).rotateX(Math.PI / 2));
    g.add(part(G.sphere, mat('#f4c247', { metalness: 0.5, roughness: 0.3 }), 0.12, 0.12, 0.12, 0, ringY + 0.35 + roofH + 0.05, 0));
    g.add(part(G.cone4, mat('#f4c247', { metalness: 0.5, roughness: 0.3 }), 0.05, 0.35, 0.05, 0, ringY + 0.35 + roofH + 0.3, 0));
    g.userData.top = ringY + 0.35 + roofH + 0.45;
    return g;
  }
  function shadeHexToHex(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = v => Math.max(0, Math.min(255, Math.round(v * k)));
    return '#' + ((1 << 24) | (f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).slice(1);
  }
  // 아치 창문 (밤에 불이 켜짐)
  function archWindow(win, w, h) {
    // -X 방향을 바라보는 아치형 창문 (사각 + 반원), 밤에 불빛
    const g = new T.Group();
    const rect = new T.Mesh(new T.PlaneGeometry(w, h), win);
    rect.rotation.y = -Math.PI / 2; g.add(rect);
    const top = new T.Mesh(new T.CircleGeometry(w / 2, 10, 0, Math.PI), win);
    top.rotation.y = -Math.PI / 2; top.position.y = h / 2; g.add(top);
    const frame = new T.Mesh(new T.TorusGeometry(w / 2 + 0.03, 0.035, 4, 10, Math.PI), mat('#e8e0d0'));
    frame.rotation.y = -Math.PI / 2; frame.position.set(-0.01, h / 2, 0); g.add(frame);
    g.add(part(G.box, mat('#e8e0d0'), 0.1, 0.07, w + 0.16, 0, -h / 2 - 0.04, 0)); // 창턱
    g.add(part(G.box, mat('#3a2a1e'), 0.02, h + w / 2, 0.035, -0.01, w / 4, 0)); // 창살
    return g;
  }
  // 문장 방패
  function crest(sc = 1) {
    const g = new T.Group();
    const sh = new T.Shape();
    sh.moveTo(-0.4, 0.45); sh.lineTo(0.4, 0.45); sh.lineTo(0.4, 0.0); sh.quadraticCurveTo(0.38, -0.35, 0, -0.55); sh.quadraticCurveTo(-0.38, -0.35, -0.4, 0); sh.closePath();
    const geo = new T.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.04, bevelSegments: 1 });
    const m = new T.Mesh(geo, [mat('#2f5fb8'), mat('#f4c247', { metalness: 0.5, roughness: 0.35 })]);
    m.rotation.y = -Math.PI / 2; g.add(m);
    // 금관 모양
    const gold = mat('#f4c247', { metalness: 0.5, roughness: 0.3 });
    g.add(part(G.box, gold, 0.06, 0.12, 0.42, -0.1, 0.02, 0));
    [-0.16, 0, 0.16].forEach(z => g.add(part(G.cone4, gold, 0.06, 0.18, 0.06, -0.1, 0.17, z)));
    g.scale.setScalar(sc);
    return g;
  }

  function buildCastle(theme) {
    const g = new T.Group();
    const torches = [], flags = [];
    const wallTex = stoneTex('#cfc6b6'), keepTex = stoneTex('#e2dacb'), darkTex = stoneTex('#a9a090');
    const win = new T.MeshStandardMaterial({ color: '#2a1f18', emissive: '#ffb347', emissiveIntensity: 0, roughness: 0.6 });
    const slit = mat('#1d1712');
    const capM = mat('#bcb3a3'), merlonM = texMat(wallTex, 0.5, 0.5, { color: '#ddd5c6' });
    const gold = mat('#f4c247', { metalness: 0.5, roughness: 0.3 });
    const wood = mat('#8a5a32'), wood2 = mat('#6a4325'), iron = mat('#3a3d44', { metalness: 0.6, roughness: 0.4 });

    // 언덕 + 바위 + 돌 기단
    g.add(part(new T.CylinderGeometry(1, 1.12, 1, 16), mat(theme.castleHill), 5.6, 0.55, 6.6, 0.9, 0.27, 0));
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2;
      const rk = part(G.ico, mat(i % 2 ? '#8f98a8' : '#a3abb8'), 0.45 + (i % 3) * 0.12, 0.35, 0.5, 0.9 + Math.cos(a) * 5.7, 0.2, Math.sin(a) * 6.6);
      rk.rotation.y = a * 3; g.add(rk);
    }
    g.add(part(G.box, texMat(darkTex, 6, 0.6), 5.6, 0.5, 7.9, 0.9, 0.55, 0));

    // ---- 성벽 (사방) ----
    const x0 = -1.6, x1 = 3.4, z0 = -3.6, z1 = 3.6, wy = 0.8, wh = 2.3, th = 0.6;
    const wallSeg = (cx, cz, lx, lz) => {
      g.add(part(G.box, texMat(wallTex, Math.max(lx, lz) * 1.1, wh * 1.2), lx, wh, lz, cx, wy + wh / 2, cz));
      g.add(part(G.box, capM, lx + (lx > lz ? 0 : 0.12), 0.14, lz + (lz > lx ? 0 : 0.12), cx, wy + wh + 0.07, cz));
    };
    wallSeg((x0 + x1) / 2, z0, x1 - x0, th);
    wallSeg((x0 + x1) / 2, z1, x1 - x0, th);
    wallSeg(x1, 0, th, z1 - z0);
    wallSeg(x0, -2.4, th, 2.4); wallSeg(x0, 2.4, th, 2.4); // 앞벽 (가운데는 성문)
    const merlons = (ax, az, bx, bz, n) => {
      for (let i = 0; i <= n; i++) {
        const f = i / n, mx = ax + (bx - ax) * f, mz = az + (bz - az) * f;
        g.add(part(G.box, merlonM, 0.36, 0.45, 0.36, mx, wy + wh + 0.36, mz));
      }
    };
    merlons(x0 + 0.9, z0 - 0.15, x1 - 0.9, z0 - 0.15, 5);
    merlons(x0 + 0.9, z1 + 0.15, x1 - 0.9, z1 + 0.15, 5);
    merlons(x1 + 0.15, z0 + 0.9, x1 + 0.15, z1 - 0.9, 7);
    merlons(x0 - 0.15, z0 + 0.9, x0 - 0.15, -1.9, 2);
    merlons(x0 - 0.15, 1.9, x0 - 0.15, z1 - 0.9, 2);
    // 앞벽 문장 방패와 화살 구멍
    [[-2.6, 'r'], [2.6, 'b']].forEach(([z, c]) => {
      const sh = crest(0.55); sh.position.set(x0 - 0.34, wy + 1.4, z); g.add(sh);
      if (c === 'b') sh.children[0].material = [mat('#c8342a'), sh.children[0].material[1]];
    });
    [-1.7, 1.7, -3.0, 3.0].forEach(z => g.add(part(G.box, slit, 0.06, 0.45, 0.1, x0 - 0.31, wy + 0.9, z)));

    // ---- 모서리 탑 4개 ----
    [[x0, z0, '#d9493c'], [x0, z1, '#d9493c'], [x1, z0, '#3f78c8'], [x1, z1, '#3f78c8']].forEach(([x, z, rc], i) => {
      const t = roundTower(0.95, 3.9, rc, wallTex, slit, { roofH: 2.2 });
      t.position.set(x, wy - 0.3, z);
      g.add(t);
      if (i < 2) {
        const fl = flagOn(g, flags, x, wy - 0.3 + t.userData.top, z, '#f4c247', 0.9);
        fl.userData.dir = 1;
      }
    });

    // ---- 성문 건물 (게이트하우스) ----
    const gx0 = -2.45, gx1 = -1.1, gz = 1.55, gh = 3.3;
    g.add(part(G.box, texMat(wallTex, 2.2, gh * 1.2), gx1 - gx0, gh, gz * 2, (gx0 + gx1) / 2, wy + gh / 2, 0));
    g.add(part(G.box, capM, gx1 - gx0 + 0.15, 0.14, gz * 2 + 0.15, (gx0 + gx1) / 2, wy + gh + 0.07, 0));
    merlons(gx0 - 0.05, -gz + 0.2, gx0 - 0.05, gz - 0.2, 3);
    // 양옆 작은 원형 탑
    [-1, 1].forEach(sd => {
      const t = roundTower(0.62, 3.9, '#d9493c', wallTex, slit, { roofH: 1.5, slits: [[2.4, Math.PI]] });
      t.position.set(gx0 + 0.25, wy - 0.3, sd * (gz + 0.15));
      g.add(t);
    });
    // 아치 입구 (어두운 통로)
    const arch = new T.Shape();
    const aw = 0.72, ah = 1.25;
    arch.moveTo(-aw, 0); arch.lineTo(-aw, ah); arch.absarc(0, ah, aw, Math.PI, 0, true); arch.lineTo(aw, 0); arch.closePath();
    const archGeo = new T.ShapeGeometry(arch, 12);
    const hole = new T.Mesh(archGeo, mat('#15100c'));
    hole.rotation.y = -Math.PI / 2; hole.position.set(gx0 - 0.01, wy, 0); g.add(hole);
    // 아치 테두리 돌 (홍예석)
    const rim = new T.Mesh(new T.TorusGeometry(aw + 0.08, 0.12, 4, 12, Math.PI), mat('#e4dccd'));
    rim.rotation.y = -Math.PI / 2; rim.position.set(gx0 - 0.03, wy + ah, 0); g.add(rim);
    [-1, 1].forEach(sd => g.add(part(G.box, mat('#e4dccd'), 0.12, ah, 0.22, gx0 - 0.03, wy + ah / 2, sd * (aw + 0.08))));
    g.add(part(G.box, gold, 0.12, 0.2, 0.2, gx0 - 0.05, wy + ah + aw + 0.12, 0)); // 쐐기돌
    // 쇠창살 (위에서 내려오는 격자문) - 그룹 원점이 아치 꼭대기, y 크기로 열림/닫힘
    const portcullis = new T.Group();
    portcullis.position.set(gx0 - 0.05, wy + ah + aw, 0);
    for (let i = -3; i <= 3; i++) {
      const z = i * 0.2, topOff = aw - Math.sqrt(Math.max(0, aw * aw - z * z)); // 아치 곡선에 맞춘 시작 높이
      const len = ah + aw - topOff;
      const bar = part(G.box, iron, 0.05, len, 0.05, 0, -topOff - len / 2, z);
      portcullis.add(bar);
      portcullis.add(part(G.cone4, iron, 0.05, 0.12, 0.05, 0, -ah - aw - 0.04, z).rotateZ(Math.PI)); // 끝 송곳
    }
    for (let j = 0; j < 4; j++) portcullis.add(part(G.box, iron, 0.05, 0.05, aw * 1.9, 0, -0.45 - j * 0.42, 0));
    g.add(portcullis);
    // 도개교 (나무 다리) - 닫히면 들어 올려져 성문을 막음
    const bridge = new T.Group();
    for (let i = 0; i < 6; i++) bridge.add(part(G.box, i % 2 ? wood : wood2, 0.22, 0.1, aw * 2.1, -0.11 - i * 0.23, 0, 0));
    bridge.add(part(G.box, iron, 1.4, 0.05, 0.06, -0.69, 0.07, aw * 1.0));
    bridge.add(part(G.box, iron, 1.4, 0.05, 0.06, -0.69, 0.07, -aw * 1.0));
    bridge.position.set(gx0 - 0.15, wy - 0.22, 0);
    g.add(bridge);
    const chains = [-1, 1].map(sd => { const ch = part(G.cyl6, iron, 0.022, 1, 0.022, 0, 0, sd * aw); g.add(ch); return ch; });
    // k: 0 = 열림(다리 내려가고 창살 올라감), 1 = 닫힘
    function updateGate(k) {
      portcullis.scale.y = 0.16 + 0.84 * k;
      const th = 0.1 + (-1.42 - 0.1) * k;
      bridge.rotation.z = th;
      const px = bridge.position.x, py = bridge.position.y;
      const ex = px - 1.38 * Math.cos(th) - 0.05 * Math.sin(th), ey = py - 1.38 * Math.sin(th) + 0.05 * Math.cos(th);
      const sx = gx0 - 0.08, sy = wy + ah + aw * 0.95;
      const len = Math.max(0.05, Math.hypot(ex - sx, ey - sy));
      chains.forEach(ch => {
        ch.position.set((sx + ex) / 2, (sy + ey) / 2, ch.position.z);
        ch.scale.y = len;
        ch.rotation.z = Math.atan2(-(ex - sx), ey - sy);
      });
    }
    updateGate(0);
    // 성문 위 큰 문장 + 늘어진 깃발(배너)
    const bigCrest = crest(0.9); bigCrest.position.set(gx0 - 0.08, wy + gh - 0.75, 0); g.add(bigCrest);
    [-1, 1].forEach(sd => {
      const b = new T.Group();
      b.add(part(G.box, mat('#c8342a'), 0.04, 1.3, 0.42, 0, 0, 0));
      b.add(part(G.box, gold, 0.05, 1.3, 0.06, 0, 0, 0.18)); b.add(part(G.box, gold, 0.05, 1.3, 0.06, 0, 0, -0.18));
      b.add(part(G.cone4, mat('#c8342a'), 0.3, 0.3, 0.03, 0, -0.78, 0).rotateZ(Math.PI));
      b.add(part(G.oct, gold, 0.03, 0.12, 0.1, -0.03, 0.2, 0));
      b.position.set(gx0 - 0.04, wy + 1.9, sd * 1.15);
      g.add(b);
    });
    // 성문 횃불
    [[gx0 - 0.2, wy + 1.1, -1.05], [gx0 - 0.2, wy + 1.1, 1.05]].forEach(([x, y, z]) => { const t = torch(x, y, z, 1.2); g.add(t); torches.push(t); });

    // ---- 본성 (킵) ----
    const kx0 = 0.2, kx1 = 2.8, kz = 1.6, kh = 4.9;
    g.add(part(G.box, texMat(keepTex, 2.8, kh * 1.1), kx1 - kx0, kh, kz * 2, (kx0 + kx1) / 2, wy + kh / 2, 0));
    // 버팀벽
    [-1, 1].forEach(sd => {
      g.add(part(G.box, texMat(keepTex, 0.4, 2), 0.4, kh * 0.7, 0.35, kx0 - 0.15, wy + kh * 0.35, sd * (kz - 0.15)));
      g.add(part(G.box, capM, 0.42, 0.12, 0.37, kx0 - 0.15, wy + kh * 0.7 + 0.06, sd * (kz - 0.15)));
    });
    // 띠 장식
    g.add(part(G.box, capM, kx1 - kx0 + 0.12, 0.12, kz * 2 + 0.12, (kx0 + kx1) / 2, wy + kh * 0.55, 0));
    g.add(part(G.box, capM, kx1 - kx0 + 0.2, 0.18, kz * 2 + 0.2, (kx0 + kx1) / 2, wy + kh + 0.09, 0));
    merlons(kx0 - 0.08, -kz + 0.25, kx0 - 0.08, kz - 0.25, 4);
    merlons(kx0 + 0.3, -kz - 0.08, kx1 - 0.3, -kz - 0.08, 3);
    merlons(kx0 + 0.3, kz + 0.08, kx1 - 0.3, kz + 0.08, 3);
    // 창문 (앞면 2층, 옆면)
    [[-0.7, wy + 1.9], [0.7, wy + 1.9], [0, wy + 3.4]].forEach(([z, y]) => { const w = archWindow(win, 0.42, 0.6); w.position.set(kx0 - 0.04, y, z); g.add(w); });
    [-1, 1].forEach(sd => [0.8, 1.9].forEach(x => {
      const w = archWindow(win, 0.36, 0.5); w.rotation.y = sd * Math.PI / 2; w.position.set(kx0 + x, wy + 3.0, sd * (kz + 0.04)); g.add(w);
    }));
    // 발코니 + 큰 문장
    g.add(part(G.box, capM, 0.4, 0.1, 1.2, kx0 - 0.2, wy + 2.85, 0));
    for (let i = 0; i < 5; i++) g.add(part(G.cyl6, capM, 0.04, 0.3, 0.04, kx0 - 0.36, wy + 3.05, -0.5 + i * 0.25));
    // 지붕 (기와 질감 피라미드) + 지붕창
    const roofG = new T.ConeGeometry(1, 1, 4, 1); roofG.rotateY(Math.PI / 4);
    const roof = new T.Mesh(roofG, texMat(roofTex('#d9493c'), 4, 3));
    roof.scale.set((kx1 - kx0) * 0.78, 2.6, kz * 1.55); roof.position.set((kx0 + kx1) / 2, wy + kh + 0.18 + 1.3, 0);
    g.add(roof);
    const dormer = new T.Group();
    dormer.add(part(G.box, texMat(keepTex, 0.5, 0.5), 0.5, 0.5, 0.6, 0, 0, 0));
    const dw = archWindow(win, 0.24, 0.26); dw.position.set(-0.26, -0.02, 0); dormer.add(dw);
    const dr = part(G.cone4, texMat(roofTex('#d9493c'), 1, 1), 0.48, 0.4, 0.48, 0, 0.45, 0); dr.rotation.y = Math.PI / 4; dormer.add(dr);
    dormer.position.set(kx0 + 0.55, wy + kh + 0.8, 0); g.add(dormer);
    g.add(part(G.sphere, gold, 0.14, 0.14, 0.14, (kx0 + kx1) / 2, wy + kh + 2.85, 0));
    // 뒤쪽 모서리 작은 탑
    [-1, 1].forEach(sd => {
      const t = roundTower(0.48, 1.6, '#3f78c8', keepTex, slit, { roofH: 1.3, slits: [] });
      t.position.set(kx1 - 0.05, wy + kh - 0.6, sd * (kz - 0.05));
      g.add(t);
    });
    // 굴뚝
    g.add(part(G.box, texMat(darkTex, 0.3, 0.6), 0.3, 0.9, 0.3, kx1 - 0.5, wy + kh + 1.0, 0.75));
    // 본성 큰 깃발
    const big = flagOn(g, flags, (kx0 + kx1) / 2, wy + kh + 2.95, 0, '#e14b3c', 1.4);
    big.userData.crown = true;
    // 성 안 작은 집들
    [[2.0, -2.6], [2.6, 2.7]].forEach(([x, z], i) => {
      g.add(part(G.box, texMat(keepTex, 1, 0.6), 1.0, 0.7, 0.8, x, wy + 0.35, z));
      const r = part(G.cone4, texMat(roofTex(i ? '#3f78c8' : '#b8572e'), 2, 1), 0.85, 0.6, 0.7, x, wy + 0.95, z); r.rotation.y = Math.PI / 4; g.add(r);
    });
    // 성벽 위 횃불
    [[x0 - 0.1, wy + wh + 0.3, -1.9], [x0 - 0.1, wy + wh + 0.3, 1.9]].forEach(([x, y, z]) => { const t = torch(x, y, z, 1.1); g.add(t); torches.push(t); });

    shadowAll(g);
    g.userData = { flags, torches, win, updateGate, gateLocal: new T.Vector3(gx0 - 0.3, wy + 1.0, 0) };
    return g;
  }
  // 깃대 + 펄럭이는 깃발 (world.js가 흔들어 줌)
  function flagOn(g, flags, x, y, z, color, s = 1) {
    g.add(part(G.cyl6, mat('#6a4325'), 0.04 * s, 1.5 * s, 0.04 * s, x, y + 0.75 * s, z));
    g.add(part(G.sphere, mat('#f4c247', { metalness: 0.5, roughness: 0.3 }), 0.07 * s, 0.07 * s, 0.07 * s, x, y + 1.52 * s, z));
    const fg = new T.PlaneGeometry(1.0 * s, 0.6 * s, 8, 1); fg.translate(-0.5 * s, 0, 0);
    const f = new T.Mesh(fg, mat(color, { side: T.DoubleSide }));
    f.position.set(x, y + 1.18 * s, z);
    f.userData.base = fg.attributes.position.array.slice();
    g.add(f); flags.push(f);
    return f;
  }

  // ---------------- 탑 (레벨별 모델) ----------------
  function banner(color, x, y, z, rotY = 0) {
    const f = part(G.box, mat(color), 0.04, 0.7, 0.42, x, y, z);
    f.rotation.y = rotY;
    return f;
  }
  function archerFigure(color, hat) {
    const a = new T.Group();
    a.add(part(G.cyl6, mat(color), 0.28, 0.6, 0.28, 0, 0.35, 0));
    a.add(part(G.ico1, mat('#f1c49a'), 0.24, 0.24, 0.24, 0, 0.85, 0));
    if (hat === 'hood') a.add(part(G.cone6, mat(color), 0.3, 0.4, 0.3, 0, 1.12, 0));
    else if (hat === 'helm') a.add(part(G.halfSphere, mat('#aeb5bf', { metalness: 0.4, roughness: 0.4 }), 0.27, 0.26, 0.27, 0, 0.9, 0));
    else {
      // 엘프: 금빛 머리 + 뾰족 귀
      a.add(part(G.halfSphere, mat('#f4d36b'), 0.27, 0.28, 0.27, -0.02, 0.9, 0));
      [-1, 1].forEach(s => { const e = part(G.cone4, mat('#f1c49a'), 0.05, 0.22, 0.05, 0, 0.9, s * 0.25); e.rotation.x = s * -1.2; a.add(e); });
    }
    const bow = new T.Mesh(new T.TorusGeometry(0.42, 0.045, 4, 10, Math.PI), mat(hat === 'elf' ? '#f4c247' : '#6f4526'));
    bow.position.set(0.38, 0.55, 0); bow.rotation.set(0, 0, -Math.PI / 2); a.add(bow);
    return a;
  }

  function buildTower(type, lvl = 1) {
    const g = new T.Group();
    const turret = new T.Group();
    const wood = mat('#9a6638'), wood2 = mat('#6f4526'), stone = mat('#c9c2b6'), stone2 = mat('#a9a296'), gold = mat('#f4c247', { metalness: 0.4, roughness: 0.45 });
    const torches = [];
    g.add(part(G.box, lvl === 3 ? mat('#e8e2d6') : stone2, 2.3, 0.3, 2.3, 0, 0.15, 0));
    if (type === 'archer') {
      if (lvl === 1) {
        [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]].forEach(([x, z]) => g.add(part(G.box, wood2, 0.22, 2.2, 0.22, x, 1.3, z)));
        const b1 = part(G.box, wood, 0.12, 1.9, 0.12, 0, 1.2, -0.7); b1.rotation.z = 0.62; g.add(b1);
        const b2 = part(G.box, wood, 0.12, 1.9, 0.12, 0, 1.2, 0.7); b2.rotation.z = -0.62; g.add(b2);
        g.add(part(G.box, wood, 2.0, 0.22, 2.0, 0, 2.4, 0));
        [[0, -0.95, 2.0, 0.12], [0, 0.95, 2.0, 0.12], [-0.95, 0, 0.12, 2.0], [0.95, 0, 0.12, 2.0]].forEach(([x, z, sx, sz]) => g.add(part(G.box, wood2, sx, 0.4, sz, x, 2.7, z)));
        [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]].forEach(([x, z]) => g.add(part(G.box, wood2, 0.1, 1.3, 0.1, x, 3.1, z)));
        const roof = part(G.cone4, mat('#d9493c'), 1.5, 1.25, 1.5, 0, 4.25, 0); roof.rotation.y = Math.PI / 4; g.add(roof);
        turret.position.set(0, 2.5, 0);
        turret.add(archerFigure('#3f8f45', 'hood'));
        g.userData.muzzleY = 3.2;
        torches.push(torch(0.95, 3.0, 0.95));
      } else if (lvl === 2) {
        // 석궁 망루: 돌 기단 + 나무 위층 + 파란 깃발
        g.add(part(G.cyl8, stone, 1.05, 1.8, 1.05, 0, 1.2, 0));
        g.add(part(G.cyl8, stone2, 1.2, 0.25, 1.2, 0, 2.2, 0));
        g.add(part(G.box, wood, 2.2, 0.22, 2.2, 0, 2.45, 0));
        [[0, -1.05, 2.2, 0.14], [0, 1.05, 2.2, 0.14], [-1.05, 0, 0.14, 2.2], [1.05, 0, 0.14, 2.2]].forEach(([x, z, sx, sz]) => g.add(part(G.box, wood2, sx, 0.45, sz, x, 2.78, z)));
        [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]].forEach(([x, z]) => g.add(part(G.box, wood2, 0.12, 1.5, 0.12, x, 3.2, z)));
        const roof = part(G.cone4, mat('#3f78c8'), 1.7, 1.5, 1.7, 0, 4.5, 0); roof.rotation.y = Math.PI / 4; g.add(roof);
        g.add(part(G.cyl6, wood2, 0.04, 0.9, 0.04, 0, 5.6, 0));
        g.add(banner('#3f78c8', 0.25, 5.8, 0));
        g.add(banner('#3f78c8', -1.12, 1.6, 0));
        turret.position.set(0, 2.55, 0);
        turret.add(archerFigure('#3a5f9a', 'helm'));
        g.userData.muzzleY = 3.3;
        torches.push(torch(1.05, 3.1, 1.05), torch(-1.05, 3.1, -1.05));
      } else {
        // 엘프 궁수 요새: 하얀 돌 첨탑, 녹색·금빛 지붕, 엘프 둘
        g.add(part(new T.CylinderGeometry(0.95, 1.2, 2.6, 8), mat('#eee9df'), 1, 1, 1, 0, 1.6, 0));
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * Math.PI * 2;
          g.add(part(G.box, gold, 0.08, 2.4, 0.08, Math.cos(a) * 1.05, 1.6, Math.sin(a) * 1.05));
        }
        g.add(part(G.cyl8, mat('#d8d0c2'), 1.45, 0.3, 1.45, 0, 3.0, 0));
        for (let i = 0; i < 10; i++) {
          const a = i / 10 * Math.PI * 2;
          g.add(part(G.box, mat('#d8d0c2'), 0.3, 0.4, 0.3, Math.cos(a) * 1.3, 3.35, Math.sin(a) * 1.3));
        }
        [[-1.1, 1.1], [1.1, -1.1]].forEach(([x, z]) => {
          g.add(part(G.cyl8, mat('#eee9df'), 0.35, 1.6, 0.35, x, 3.9, z));
          g.add(part(G.cone8, mat('#3fae5a'), 0.5, 1.4, 0.5, x, 5.4, z));
          g.add(part(G.oct, gold, 0.12, 0.2, 0.12, x, 6.2, z));
        });
        g.add(banner('#3fae5a', -1.2, 2.0, 0));
        g.add(banner('#3fae5a', 1.2, 2.0, 0));
        turret.position.set(0, 3.15, 0);
        const e1 = archerFigure('#2f8f4e', 'elf'); e1.position.z = -0.45; turret.add(e1);
        const e2 = archerFigure('#2f8f4e', 'elf'); e2.position.z = 0.45; turret.add(e2);
        g.userData.muzzleY = 3.9;
        torches.push(torch(1.3, 3.8, 0), torch(-1.3, 3.8, 0));
        g.userData.sparkle = '#7dff8a';
      }
    } else if (type === 'cannon') {
      const big = lvl >= 2;
      const baseMat = lvl === 3 ? mat('#4a3a3a') : stone;
      const crenMat = lvl === 3 ? mat('#7a2a22') : stone2;
      g.add(part(G.cyl8, baseMat, big ? 1.2 : 1.05, big ? 1.4 : 1.1, big ? 1.2 : 1.05, 0, big ? 1.0 : 0.85, 0));
      const n = big ? 10 : 8, r = big ? 1.05 : 0.9, top = big ? 1.85 : 1.55;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2;
        g.add(part(G.box, crenMat, 0.34, 0.36, 0.34, Math.cos(a) * r, top, Math.sin(a) * r));
      }
      if (lvl === 2) { g.add(banner('#d9493c', -1.22, 1.1, 0)); g.add(part(G.cyl8, mat('#8a8070'), 1.25, 0.15, 1.25, 0, 0.5, 0)); }
      if (lvl === 3) {
        // 용의 장식: 뿔과 붉은 띠
        g.add(part(G.cyl8, mat('#d9493c'), 1.24, 0.18, 1.24, 0, 1.2, 0));
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => {
          const h = part(G.cone6, mat('#efe5cb'), 0.12, 0.7, 0.12, x * 0.9, 2.35, z * 0.9);
          h.rotation.x = z * 0.4; h.rotation.z = -x * 0.4; g.add(h);
        });
        g.userData.sparkle = '#ff7a2a';
      }
      turret.position.set(0, big ? 1.75 : 1.45, 0);
      turret.add(part(G.box, lvl === 3 ? mat('#3a2a22') : wood, big ? 1.1 : 0.9, 0.3, big ? 1.0 : 0.8, 0, 0.05, 0));
      const wheelGeo = new T.CylinderGeometry(0.3, 0.3, 0.12, 8); wheelGeo.rotateX(Math.PI / 2);
      [-1, 1].forEach(s => turret.add(part(wheelGeo, wood2, big ? 1.2 : 1, big ? 1.2 : 1, 1, -0.1, 0.05, s * (big ? 0.55 : 0.45))));
      const barrel = new T.Group();
      const barrels = lvl === 3 ? [-0.28, 0.28] : [0];
      const thick = lvl === 1 ? 1 : 1.25;
      barrels.forEach(z => {
        const bg = new T.CylinderGeometry(0.2 * thick, 0.28 * thick, 1.6 * (lvl === 1 ? 1 : 1.15), 8); bg.rotateZ(-Math.PI / 2); bg.translate(0.6, 0, z);
        barrel.add(part(bg, mat(lvl === 3 ? '#2a1e1e' : '#33363b', { metalness: 0.4, roughness: 0.5 }), 1, 1, 1));
        const ring = part(G.cyl8, lvl === 3 ? mat('#ff7a2a', { emissive: '#ff5a1a', emissiveIntensity: 0.8 }) : gold, 0.27 * thick, 0.08, 0.27 * thick, lvl === 1 ? 0.95 : 1.15, 0, z);
        ring.rotation.z = Math.PI / 2; barrel.add(ring);
        if (lvl >= 2) { const r2 = part(G.cyl8, gold, 0.3 * thick, 0.06, 0.3 * thick, 0.2, 0, z); r2.rotation.z = Math.PI / 2; barrel.add(r2); }
      });
      barrel.position.set(0, 0.38, 0); barrel.rotation.z = 0.25;
      turret.add(barrel);
      turret.userData.barrel = barrel;
      g.userData.muzzleY = big ? 2.3 : 2.0;
      torches.push(torch(-1.0, top + 0.5, 0.9));
    } else {
      // 마법탑
      const h = lvl === 1 ? 2.8 : lvl === 2 ? 3.4 : 4.0;
      const col = lvl === 3 ? '#6b5bd6' : lvl === 2 ? '#7a86c8' : '#8e94b8';
      g.add(part(new T.CylinderGeometry(lvl === 3 ? 0.55 : 0.62, 0.95, h, lvl === 3 ? 8 : 6), mat(col), 1, 1, 1, 0, 0.3 + h / 2, 0));
      g.add(part(G.cyl6, mat(lvl === 3 ? '#4a3ca8' : '#6d7299'), 0.85, 0.3, 0.85, 0, 0.3 + h, 0));
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        g.add(part(G.box, mat(lvl === 3 ? '#4a3ca8' : '#6d7299'), 0.22, 0.4, 0.22, Math.cos(a) * 0.7, 0.6 + h, Math.sin(a) * 0.7));
      }
      g.add(part(G.box, mat('#2c2450'), 0.08, 0.6, 0.4, -0.86, 1.1, 0));
      if (lvl >= 2) {
        // 띠 장식 + 떠 있는 돌
        g.add(part(G.cyl8, gold, lvl === 3 ? 0.68 : 0.75, 0.12, lvl === 3 ? 0.68 : 0.75, 0, 0.3 + h * 0.65, 0));
      }
      turret.position.set(0, 1.3 + h, 0);
      const crystalMat = mat(lvl === 3 ? '#d6b8ff' : '#8ff0ff', { emissive: lvl === 3 ? '#a66bff' : '#4fd6ff', emissiveIntensity: 1.1, roughness: 0.3 });
      const crystal = part(G.oct, crystalMat, 0.45 * (lvl === 1 ? 1 : 1.25), 0.7 * (lvl === 1 ? 1 : 1.25), 0.45 * (lvl === 1 ? 1 : 1.25));
      turret.add(crystal);
      turret.userData.crystal = crystal;
      if (lvl >= 2) {
        const orbit = new T.Group();
        const n = lvl === 3 ? 3 : 2;
        for (let i = 0; i < n; i++) {
          const a = i / n * Math.PI * 2;
          orbit.add(part(G.oct, crystalMat, 0.16, 0.26, 0.16, Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95));
        }
        if (lvl === 3) {
          const ring = mesh(G.torus, glow('#c9a8ff', 0.8), false); ring.scale.setScalar(1.15); ring.rotation.x = Math.PI / 2; orbit.add(ring);
        }
        turret.add(orbit);
        turret.userData.orbit = orbit;
      }
      g.userData.muzzleY = 1.3 + h;
      torches.push(torch(0.9, 1.6, 0.9));
      if (lvl === 3) g.userData.sparkle = '#c27bff';
    }
    torches.forEach(t => g.add(t));
    g.add(turret);
    g.userData.turret = turret;
    g.userData.type = type;
    g.userData.lvl = lvl;
    g.userData.torches = torches;
    // 레벨 표시 별
    if (lvl >= 2) {
      for (let i = 0; i < lvl; i++) g.add(part(G.oct, mat('#ffd23f', { emissive: '#ffb000', emissiveIntensity: 0.5 }), 0.12, 0.16, 0.05, -1.25, 0.45, (i - (lvl - 1) / 2) * 0.32));
    }
    return shadowAll(g);
  }

  // ---------------- 사람형 유닛 ----------------
  const LOOKS = {
    goblin:  { skin: '#7cc444', armor: '#8a5a32', legs: '#5a3a20', weapon: 'dagger', ears: true, eye: '#ffde3a' },
    soldier: { skin: '#f2c39c', armor: '#d8433a', legs: '#7d241f', helm: 'cap', weapon: 'spear', belt: '#4a2a18' },
    knight:  { skin: '#f2c39c', armor: '#a8b1bf', legs: '#5f6876', helm: 'knight', plume: '#d8433a', weapon: 'sword', shield: '#2d4f98' },
    ogre:    { skin: '#c4a56b', armor: '#7a5230', legs: '#9b8250', weapon: 'club', bulk: true, tusk: true, eye: '#d22' },
    troll:   { skin: '#86a7b6', armor: '#526156', legs: '#6c8a96', weapon: 'club', bulk: true, tusk: true, eye: '#ffef5a' },
    orcking: { skin: '#5aa046', armor: '#3b2b22', legs: '#3f7a30', helm: 'horn', weapon: 'axe', bulk: true, tusk: true, eye: '#f33', cape: '#b3261e' },
    demonking: { skin: '#8a2333', armor: '#2b2236', legs: '#1c1724', helm: 'demon', weapon: 'greatsword', bulk: true, eye: '#ff3b2f', cape: '#7a0f1f', spikes: true },
    hero:    { skin: '#f2c39c', armor: '#3f6fd8', legs: '#2a4a9a', helm: 'hero', weapon: 'longbow', cape: '#e5483b', belt: '#f4c247', shield: null, hero: true },
    // ---- 사막 ----
    sandthief: { skin: '#c98b5a', armor: '#e9d8a6', legs: '#7a5a3a', helm: 'turban', weapon: 'scimitar', ears: true, eye: '#ffde3a', belt: '#b3261e', scarf: '#2f8f9a' },
    mummy:     { skin: '#e3d8b8', armor: '#d6c9a2', legs: '#cbbd94', helm: 'nemes', weapon: 'spear', tip: '#f4c247', eye: '#5fffd0', wraps: true, belt: '#f4c247' },
    minotaur:  { skin: '#7a4a2e', armor: '#b3261e', legs: '#5a3420', helm: 'bull', weapon: 'axe', bulk: true, eye: '#ff3b2f', belt: '#f4c247', ring: true },
    sandgolem: { skin: '#d6a866', armor: '#c08a4e', legs: '#b07a44', weapon: 'fists', bulk: true, golem: '#e8c47e', eye: '#5fd3ff', crack: '#5fd3ff' },
    // ---- 설원 ----
    snowgob:   { skin: '#8fd0c8', armor: '#f2f6fa', legs: '#5a7a8a', helm: 'furhat', weapon: 'icicle', ears: true, eye: '#ffde3a' },
    frostbone: { skin: '#e8f1f8', armor: '#3a5a7a', legs: '#e8f1f8', helm: 'crownice', weapon: 'spear', tip: '#9fe6ff', eye: '#7fd8ff', skeleton: true, thin: true },
    frostknight: { skin: '#cfe6f5', armor: '#bfe6ff', legs: '#7fa6c6', helm: 'knight', helmCol: '#d8f1ff', plume: '#5fd3ff', weapon: 'sword', blade: '#9fe6ff', shield: '#3f86c6', eye: '#7fd8ff', iceSpikes: true },
    yeti:      { skin: '#f4f8fb', armor: '#e2ebf3', legs: '#e8eff5', weapon: 'icicle', bulk: true, tusk: true, eye: '#3f86c6', face: '#8fb4d0', fur: true },
    icegolem:  { skin: '#a9d8f0', armor: '#7fbbe0', legs: '#8cc4e6', weapon: 'fists', bulk: true, golem: '#dff5ff', eye: '#ffffff', crack: '#5fd3ff', crystals: true },
    // ---- 화산 ----
    fireimp:   { skin: '#e2452f', armor: '#5a2420', legs: '#7a2a20', helm: 'imp', weapon: 'trident', ears: true, eye: '#ffde3a', wings: '#7a1f1a', tail: true },
    ashbone:   { skin: '#d8ccb4', armor: '#2a1f1c', legs: '#d8ccb4', helm: 'cap', helmCol: '#3a2c28', weapon: 'sword', blade: '#ff7a2a', eye: '#ff6a1a', skeleton: true, thin: true, shield: '#4a2a22' },
    obsidian:  { skin: '#3a2c30', armor: '#2a2430', legs: '#1f1a24', helm: 'knight', helmCol: '#3a3040', plume: '#ff6a1a', weapon: 'sword', blade: '#ff5a1a', shield: '#3a2030', eye: '#ff6a1a', crack: '#ff6a1a' },
    firedemon: { skin: '#9a2a1e', armor: '#3a1a16', legs: '#6a1c14', helm: 'horn', helmCol: '#2a1a16', weapon: 'flameaxe', bulk: true, tusk: true, eye: '#ffde3a', flames: true },
    lavagolem: { skin: '#3d302c', armor: '#2e2422', legs: '#35292a', weapon: 'fists', bulk: true, golem: '#4a3a36', eye: '#ffb030', crack: '#ff6a1a' },
  };

  function buildHumanoid(L) {
    const g = new T.Group();
    const body = new T.Group(); g.add(body);
    const bulk = !!L.bulk;
    const legGeo = new T.BoxGeometry(bulk ? 0.34 : 0.24, 0.55, bulk ? 0.34 : 0.26); legGeo.translate(0, -0.275, 0);
    const legs = [];
    [-1, 1].forEach(side => {
      const leg = mesh(legGeo, mat(L.legs));
      leg.position.set(0, 0.58, side * (bulk ? 0.22 : 0.15));
      g.add(leg); legs.push(leg);
    });
    if (bulk) body.add(part(G.ico1, mat(L.armor), 0.62, 0.58, 0.6, 0, 0.98, 0));
    else body.add(part(G.cyl6, mat(L.armor), 0.37, 0.64, 0.37, 0, 0.88, 0));
    if (bulk) body.add(part(G.ico1, mat(L.skin), 0.5, 0.42, 0.52, 0.06, 1.25, 0));
    if (L.belt) body.add(part(G.cyl6, mat(L.belt), bulk ? 0.6 : 0.39, 0.1, bulk ? 0.6 : 0.39, 0, bulk ? 0.72 : 0.64, 0));
    const gold = mat('#f4c247', { metalness: 0.55, roughness: 0.3 });
    const silver = mat('#e8eef5', { metalness: 0.55, roughness: 0.3 });
    if (L.hero) {
      // 영웅: 은빛 흉갑 + 금빛 문장 + 허리 망토 자락
      body.add(part(G.cyl6, silver, 0.42, 0.34, 0.42, 0, 1.0, 0));
      body.add(part(G.oct, gold, 0.07, 0.17, 0.15, 0.4, 1.0, 0));
      body.add(part(G.oct, glow('#5fd3ff', 1.2), 0.04, 0.07, 0.06, 0.45, 1.0, 0));
      body.add(part(G.box, mat('#2a4a9a'), 0.1, 0.32, 0.36, 0.3, 0.45, 0));
      body.add(part(G.box, gold, 0.11, 0.05, 0.37, 0.31, 0.31, 0));
    }
    if (L.cape) {
      const cp = new T.Group(); cp.position.set(bulk ? -0.58 : -0.36, bulk ? 1.5 : 1.28, 0); cp.rotation.z = -0.15; body.add(cp);
      const big = L.hero ? 1.25 : 1;
      cp.add(part(G.box, mat(L.cape), 0.07, 1.15 * big, 1.0 * big, -0.06, -0.55 * big, 0));
      if (L.hero) {
        cp.add(part(G.box, gold, 0.08, 0.07, 1.27, -0.06, -1.35, 0));
        cp.add(part(G.box, mat('#f6eedb'), 0.08, 0.3, 0.3, -0.08, -0.55, 0));
        cp.add(part(G.oct, gold, 0.06, 0.12, 0.12, -0.12, -0.55, 0));
      }
      g.userData.cape = cp;
    }
    if (L.wraps) for (let i = 0; i < 5; i++) { const w = part(G.cyl6, mat('#b9ab84'), 0.385, 0.035, 0.385, 0, 0.62 + i * 0.13, 0); w.rotation.x = (i % 2 ? 0.18 : -0.18); body.add(w); }
    if (L.skeleton) {
      body.add(part(G.box, mat(L.skin), 0.14, 0.62, 0.1, 0.12, 0.9, 0));
      for (let i = 0; i < 3; i++) body.add(part(G.box, mat(L.skin), 0.3, 0.05, 0.42, 0.06, 0.78 + i * 0.13, 0));
    }
    if (L.scarf) { body.add(part(G.cyl6, mat(L.scarf), 0.3, 0.12, 0.3, 0, 1.23, 0)); const tl = part(G.box, mat(L.scarf), 0.06, 0.4, 0.14, -0.28, 1.05, 0.1); tl.rotation.z = 0.3; body.add(tl); }
    if (L.ring) body.add(part(G.torus, gold, 0.07, 0.07, 0.07, 0.36, 1.58, 0).rotateY(Math.PI / 2));
    if (L.fur) for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; body.add(part(G.cone4, mat(L.armor), 0.12, 0.3, 0.12, Math.cos(a) * 0.5, 1.45, Math.sin(a) * 0.5)); }
    if (L.golem) {
      // 바위 몸: 울퉁불퉁한 덩어리 + 빛나는 틈
      const rock = mat(L.golem);
      [[0.35, 1.0, 0.35, 0.3], [-0.3, 1.1, -0.35, 0.28], [0.1, 0.75, -0.5, 0.22], [-0.2, 1.4, 0.4, 0.24]].forEach(([x, y, z, r]) => body.add(part(G.ico, rock, r, r, r, x, y, z)));
      if (L.crack) [[0.55, 1.05, 0.15], [0.58, 0.9, -0.2], [0.5, 1.25, -0.05]].forEach(([x, y, z]) => body.add(part(G.box, glow(L.crack, 1.2), 0.04, 0.22, 0.06, x, y, z).rotateX(0.6)));
      if (L.crystals) [[-0.1, 1.85, 0.3], [-0.2, 1.9, -0.25], [-0.35, 1.7, 0]].forEach(([x, y, z], i) => { const c = part(G.oct, mat('#e6fbff', { emissive: '#7fd8ff', emissiveIntensity: 0.6, roughness: 0.2 }), 0.12, 0.38, 0.12, x, y, z); c.rotation.z = -0.3 + i * 0.2; body.add(c); });
    }
    if (L.crack && !L.golem) [-0.12, 0.12].forEach(z => body.add(part(G.box, glow(L.crack, 1.1), 0.04, 0.5, 0.04, 0.37, 0.88, z)));
    if (L.flames) for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; body.add(part(G.cone6, glow(i % 2 ? '#ffb030' : '#ff5a1a', 1.2), 0.1, 0.38, 0.1, Math.cos(a) * 0.2, 2.02, Math.sin(a) * 0.2)); }
    if (L.wings) [-1, 1].forEach(sd => { const w = part(G.cone4, mat(L.wings, { side: T.DoubleSide }), 0.06, 0.6, 0.45, -0.32, 1.2, sd * 0.32); w.rotation.x = sd * -0.9; body.add(w); });
    if (L.tail) { const t = part(G.cyl6, mat(L.skin), 0.04, 0.7, 0.04, -0.4, 0.55, 0); t.rotation.z = 0.9; body.add(t); body.add(part(G.cone4, mat(L.skin), 0.08, 0.16, 0.08, -0.68, 0.36, 0).rotateZ(2.4)); }
    if (L.iceSpikes) [-1, 1].forEach(sd => [0, 1].forEach(i => body.add(part(G.oct, mat('#e6fbff', { emissive: '#7fd8ff', emissiveIntensity: 0.5 }), 0.06, 0.22, 0.06, -0.05 + i * 0.12, 1.36, sd * 0.45))));
    const headY = bulk ? 1.65 : 1.42;
    body.add(part(G.ico1, mat(L.skin), 0.3, 0.3, 0.3, 0.02, headY, 0));
    if (L.face) body.add(part(G.box, mat(L.face), 0.08, 0.26, 0.36, 0.25, headY - 0.02, 0));
    if (L.skeleton) body.add(part(G.box, mat('#1d1d1d'), 0.04, 0.05, 0.16, 0.3, headY - 0.13, 0));
    const eyeM = L.eye ? glow(L.eye) : mat('#1d1d1d');
    [-0.1, 0.1].forEach(z => body.add(part(G.box, eyeM, 0.05, 0.07, 0.06, 0.29, headY + 0.03, z)));
    if (L.ears) [-1, 1].forEach(s => { const e = part(G.cone4, mat(L.skin), 0.09, 0.32, 0.09, -0.02, headY + 0.08, s * 0.32); e.rotation.x = s * -1.3; body.add(e); });
    if (L.tusk) [-0.1, 0.1].forEach(z => body.add(part(G.cone4, mat('#f7f0dc'), 0.04, 0.14, 0.04, 0.27, headY - 0.1, z)));
    if (L.helm === 'cap') {
      body.add(part(G.halfSphere, mat(L.helmCol || '#aeb5bf', { metalness: 0.3, roughness: 0.5 }), 0.33, 0.3, 0.33, 0.02, headY + 0.04, 0));
      body.add(part(G.cyl8, mat(L.helmCol || '#8e96a2'), 0.36, 0.04, 0.36, 0.02, headY + 0.04, 0));
    } else if (L.helm === 'turban') {
      body.add(part(G.ico1, mat('#f2ead6'), 0.34, 0.24, 0.34, 0, headY + 0.16, 0));
      body.add(part(G.oct, glow('#e5483b', 0.6), 0.05, 0.07, 0.05, 0.33, headY + 0.18, 0));
      body.add(part(G.box, mat(L.scarf || '#2f8f9a'), 0.06, 0.12, 0.34, 0.28, headY - 0.12, 0));
    } else if (L.helm === 'nemes') {
      // 파라오 두건 (금·청 줄무늬)
      body.add(part(G.halfSphere, mat('#f4c247', { metalness: 0.4, roughness: 0.4 }), 0.34, 0.3, 0.34, 0.0, headY + 0.03, 0));
      [-1, 1].forEach(sd => {
        body.add(part(G.box, mat('#2d4f98'), 0.12, 0.4, 0.14, 0.02, headY - 0.22, sd * 0.3));
        body.add(part(G.box, mat('#f4c247'), 0.125, 0.06, 0.145, 0.02, headY - 0.12, sd * 0.3));
        body.add(part(G.box, mat('#f4c247'), 0.125, 0.06, 0.145, 0.02, headY - 0.3, sd * 0.3));
      });
      body.add(part(G.cone4, glow('#5fffd0', 0.6), 0.05, 0.14, 0.05, 0.32, headY + 0.28, 0));
    } else if (L.helm === 'furhat') {
      body.add(part(G.cyl8, mat('#f2f6fa'), 0.34, 0.12, 0.34, 0.02, headY + 0.12, 0));
      body.add(part(G.halfSphere, mat('#3f86c6'), 0.3, 0.32, 0.3, 0.02, headY + 0.16, 0));
      body.add(part(G.ico1, mat('#f2f6fa'), 0.1, 0.1, 0.1, -0.02, headY + 0.5, 0));
    } else if (L.helm === 'crownice') {
      const ice = mat('#e6fbff', { emissive: '#7fd8ff', emissiveIntensity: 0.6, roughness: 0.2 });
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; body.add(part(G.oct, ice, 0.05, 0.18, 0.05, 0.02 + Math.cos(a) * 0.24, headY + 0.3, Math.sin(a) * 0.24)); }
    } else if (L.helm === 'imp') {
      [-1, 1].forEach(sd => { const h = part(G.cone6, mat('#2a1a16'), 0.07, 0.3, 0.07, 0, headY + 0.3, sd * 0.16); h.rotation.x = sd * -0.4; body.add(h); });
    } else if (L.helm === 'bull') {
      body.add(part(G.box, mat('#5a3420'), 0.3, 0.22, 0.3, 0.27, headY - 0.06, 0));
      [-1, 1].forEach(sd => {
        const h1 = part(G.cone6, mat('#efe5cb'), 0.09, 0.5, 0.09, 0.05, headY + 0.24, sd * 0.38); h1.rotation.x = sd * -1.3; body.add(h1);
        const h2 = part(G.cone6, mat('#efe5cb'), 0.06, 0.3, 0.06, 0.05, headY + 0.42, sd * 0.6); body.add(h2);
      });
    } else if (L.helm === 'knight') {
      body.add(part(G.cyl8, mat(L.helmCol || '#c3cad4', { metalness: 0.4, roughness: 0.45 }), 0.33, 0.42, 0.33, 0.02, headY + 0.04, 0));
      body.add(part(G.box, mat('#222'), 0.04, 0.05, 0.36, 0.34, headY + 0.04, 0));
      body.add(part(G.box, mat(L.plume), 0.5, 0.18, 0.08, -0.08, headY + 0.32, 0));
    } else if (L.helm === 'horn') {
      body.add(part(G.halfSphere, mat(L.helmCol || '#5b5148'), 0.33, 0.3, 0.33, 0.02, headY + 0.04, 0));
      [-1, 1].forEach(s => { const h = part(G.cone6, mat('#efe5cb'), 0.08, 0.42, 0.08, 0, headY + 0.3, s * 0.3); h.rotation.x = s * -0.6; body.add(h); });
    } else if (L.helm === 'demon') {
      const gold = mat('#f4c247', { metalness: 0.5, roughness: 0.35 });
      body.add(part(G.halfSphere, mat('#1c1724', { metalness: 0.4, roughness: 0.4 }), 0.34, 0.3, 0.34, 0.02, headY + 0.04, 0));
      body.add(part(G.cyl8, gold, 0.3, 0.12, 0.3, 0.02, headY + 0.24, 0));
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; body.add(part(G.cone4, gold, 0.05, 0.2, 0.05, 0.02 + Math.cos(a) * 0.26, headY + 0.38, Math.sin(a) * 0.26)); }
      [-1, 1].forEach(sd => {
        const h1 = part(G.cone6, mat('#2a2030'), 0.11, 0.55, 0.11, -0.05, headY + 0.32, sd * 0.3); h1.rotation.x = sd * -1.0; body.add(h1);
        const h2 = part(G.cone6, mat('#e8dcc0'), 0.07, 0.4, 0.07, -0.1, headY + 0.62, sd * 0.55); h2.rotation.x = sd * -0.2; h2.rotation.z = 0.4; body.add(h2);
      });
    } else if (L.helm === 'hero') {
      // 영웅: 금빛 머리카락 + 날개 달린 은빛 투구 + 푸른 보석
      body.add(part(G.halfSphere, mat('#f4c247'), 0.33, 0.32, 0.34, -0.03, headY + 0.03, 0));
      body.add(part(G.box, mat('#f4c247'), 0.22, 0.34, 0.52, -0.2, headY - 0.14, 0));
      body.add(part(G.halfSphere, silver, 0.34, 0.26, 0.35, 0.0, headY + 0.1, 0));
      body.add(part(G.cyl8, gold, 0.35, 0.07, 0.36, 0.0, headY + 0.11, 0));
      body.add(part(G.box, silver, 0.36, 0.06, 0.06, 0.08, headY + 0.36, 0));
      body.add(part(G.oct, glow('#5fd3ff', 1.3), 0.07, 0.11, 0.05, 0.35, headY + 0.13, 0));
      [-1, 1].forEach(sd => {
        // 투구 날개
        const wg = new T.Group(); wg.position.set(-0.05, headY + 0.2, sd * 0.34); wg.rotation.x = sd * -0.5; body.add(wg);
        [0, 1, 2].forEach(i => { const f = part(G.box, i ? silver : gold, 0.3 - i * 0.06, 0.07, 0.04, -0.08 - i * 0.05, 0.08 + i * 0.09, 0); f.rotation.z = 0.5 + i * 0.15; wg.add(f); });
      });
    }
    const aw = bulk ? 0.24 : L.thin ? 0.1 : 0.17;
    const armGeo = new T.BoxGeometry(aw, 0.55, aw); armGeo.translate(0, -0.27, 0);
    const shoulderY = bulk ? 1.32 : 1.13, sz = bulk ? 0.6 : 0.43;
    const armR = new T.Group(); armR.position.set(0, shoulderY, sz); body.add(armR);
    armR.add(mesh(armGeo, mat(bulk || L.thin ? L.skin : L.armor)));
    const armL = new T.Group(); armL.position.set(0, shoulderY, -sz); body.add(armL);
    armL.add(mesh(armGeo, mat(bulk || L.thin ? L.skin : L.armor)));
    const hand = new T.Group(); hand.position.set(0.05, -0.52, 0); armR.add(hand);
    const woodM = mat('#7a5233');
    if (L.weapon === 'spear') {
      const sp = part(G.cyl6, woodM, 0.035, 1.9, 0.035, 0.1, 0.35, 0); sp.rotation.z = -0.25; hand.add(sp);
      const tip = part(G.cone4, L.tip ? glow(L.tip, 0.7) : mat('#d8dde4', { metalness: 0.5, roughness: 0.4 }), 0.08, 0.26, 0.08, 0.36, 1.3, 0); tip.rotation.z = -0.25; hand.add(tip);
    } else if (L.weapon === 'sword') {
      const bl = part(G.box, L.blade ? glow(L.blade, 0.8) : mat('#e2e6ec', { metalness: 0.6, roughness: 0.3 }), 0.07, 0.8, 0.03, 0.2, 0.4, 0); bl.rotation.z = -0.5; hand.add(bl);
      hand.add(part(G.box, mat('#f4c247'), 0.08, 0.06, 0.25, 0.03, 0.06, 0));
    } else if (L.weapon === 'scimitar') {
      const bl = part(G.box, mat('#e2e6ec', { metalness: 0.6, roughness: 0.3 }), 0.09, 0.55, 0.03, 0.15, 0.3, 0); bl.rotation.z = -0.4; hand.add(bl);
      const cv = part(G.box, mat('#e2e6ec', { metalness: 0.6, roughness: 0.3 }), 0.12, 0.25, 0.03, 0.34, 0.58, 0); cv.rotation.z = -0.9; hand.add(cv);
      hand.add(part(G.box, mat('#f4c247'), 0.06, 0.05, 0.18, 0.03, 0.04, 0));
    } else if (L.weapon === 'icicle') {
      const ic = part(G.cone6, mat('#e6fbff', { emissive: '#7fd8ff', emissiveIntensity: 0.5, roughness: 0.15 }), bulk ? 0.16 : 0.07, bulk ? 1.2 : 0.55, bulk ? 0.16 : 0.07, 0.2, bulk ? 0.55 : 0.28, 0); ic.rotation.z = -0.4; hand.add(ic);
    } else if (L.weapon === 'trident') {
      const sp = part(G.cyl6, mat('#2a1a16'), 0.03, 1.5, 0.03, 0.08, 0.3, 0); sp.rotation.z = -0.25; hand.add(sp);
      [-0.08, 0, 0.08].forEach(z => { const t = part(G.cone4, glow('#ffb030', 0.8), 0.04, 0.24, 0.04, 0.3, 1.08, z); t.rotation.z = -0.25; hand.add(t); });
    } else if (L.weapon === 'flameaxe') {
      const h = part(G.cyl6, mat('#2a1a16'), 0.05, 1.4, 0.05, 0.1, 0.55, 0); h.rotation.z = -0.2; hand.add(h);
      hand.add(part(G.box, mat('#3a2c28', { metalness: 0.4 }), 0.55, 0.4, 0.06, 0.38, 1.1, 0));
      hand.add(part(G.box, glow('#ff6a1a', 1.2), 0.5, 0.06, 0.07, 0.42, 1.31, 0));
    } else if (L.weapon === 'fists') {
      hand.add(part(G.ico, mat(L.golem || L.skin), 0.24, 0.24, 0.24, 0.05, -0.05, 0));
    } else if (L.weapon === 'dagger') {
      const bl = part(G.box, mat('#d8dde4'), 0.05, 0.36, 0.03, 0.08, 0.18, 0); bl.rotation.z = -0.6; hand.add(bl);
    } else if (L.weapon === 'club') {
      const cl = part(G.cyl6, woodM, 0.09, 1.1, 0.09, 0.15, 0.45, 0); cl.rotation.z = -0.35; hand.add(cl);
      hand.add(part(G.ico, mat('#6b4628'), 0.24, 0.3, 0.24, 0.35, 1.0, 0));
    } else if (L.weapon === 'axe') {
      const h = part(G.cyl6, woodM, 0.05, 1.4, 0.05, 0.1, 0.55, 0); h.rotation.z = -0.2; hand.add(h);
      hand.add(part(G.box, mat('#c9ced6', { metalness: 0.5, roughness: 0.35 }), 0.55, 0.4, 0.06, 0.38, 1.1, 0));
    } else if (L.weapon === 'greatsword') {
      const bl = part(G.box, mat('#ff4a3a', { emissive: '#ff2a1a', emissiveIntensity: 0.9, roughness: 0.3 }), 0.12, 1.5, 0.05, 0.3, 0.85, 0); bl.rotation.z = -0.35; hand.add(bl);
      hand.add(part(G.box, mat('#f4c247'), 0.1, 0.08, 0.45, 0.04, 0.1, 0));
      hand.add(part(G.box, mat('#2a2030'), 0.07, 0.3, 0.07, -0.02, -0.08, 0));
    } else if (L.weapon === 'longbow') {
      // 장궁: 팔을 앞으로 뻗으면 활이 세로로 서고, 불화살이 시위에 걸려 있음
      const bw = new T.Group(); bw.position.set(0.05, -0.02, 0);
      const wood = mat('#6b3f1f'), goldM = mat('#f4c247', { metalness: 0.55, roughness: 0.3 });
      bw.add(part(G.box, mat('#3a2414'), 0.1, 0.16, 0.1, 0, 0, 0));
      [[1, 0.3], [-1, -0.3]].forEach(([sd]) => {
        const lb = part(G.box, wood, 0.62, 0.07, 0.07, sd * 0.32, -0.04, 0); lb.rotation.z = sd * 0.28; bw.add(lb);
        bw.add(part(G.oct, goldM, 0.06, 0.06, 0.06, sd * 0.62, 0.1, 0));
      });
      bw.add(part(G.box, mat('#f6eedb'), 1.22, 0.015, 0.015, 0, 0.12, 0));
      const nock = new T.Group(); bw.add(nock);
      nock.add(part(G.box, mat('#8d5b34'), 0.03, 0.85, 0.03, 0, -0.27, 0));
      nock.add(part(G.cone4, glow('#ff7a1a', 1.4), 0.06, 0.16, 0.06, 0, -0.74, 0).rotateZ(Math.PI));
      nock.add(part(G.box, mat('#e5483b'), 0.01, 0.14, 0.1, 0, 0.1, 0));
      hand.add(bw);
      g.userData.bow = bw; g.userData.nock = nock;
    } else if (L.weapon === 'crossbow') {
      // 황금 석궁 (앞으로 겨눔)
      const cb = new T.Group();
      cb.add(part(G.box, mat('#8d5b34'), 0.75, 0.1, 0.1, 0.3, 0, 0));
      const arc = new T.Mesh(new T.TorusGeometry(0.34, 0.04, 4, 10, Math.PI), mat('#f4c247', { metalness: 0.5, roughness: 0.3 }));
      arc.position.set(0.55, 0, 0); arc.rotation.set(Math.PI / 2, 0, Math.PI / 2); cb.add(arc);
      cb.add(part(G.oct, glow('#5fd3ff'), 0.07, 0.07, 0.07, 0.72, 0.02, 0));
      cb.position.set(0.05, 0.05, 0); cb.rotation.z = -Math.PI / 2;
      hand.add(cb);
      g.userData.crossbow = cb;
    }
    if (L.spikes) {
      [-1, 1].forEach(sd => {
        body.add(part(G.ico, mat('#3a3046', { metalness: 0.4, roughness: 0.4 }), 0.26, 0.2, 0.26, 0, shoulderY + 0.05, sd * sz));
        for (let i = 0; i < 3; i++) body.add(part(G.cone4, mat('#c9c2d6'), 0.05, 0.25, 0.05, -0.1 + i * 0.1, shoulderY + 0.25, sd * sz));
      });
    }
    if (L.hero) {
      // 겹친 어깨 갑옷 + 등에 멘 대검
      [-1, 1].forEach(sd => {
        body.add(part(G.halfSphere, silver, 0.22, 0.17, 0.22, 0, shoulderY + 0.02, sd * sz));
        body.add(part(G.cyl8, gold, 0.225, 0.04, 0.225, 0, shoulderY + 0.02, sd * sz));
        body.add(part(G.cone4, gold, 0.04, 0.16, 0.04, -0.02, shoulderY + 0.22, sd * (sz + 0.02)));
      });
      if (L.weapon === 'longbow') {
        // 화살통: 붉은 깃 화살들
        const qv = new T.Group(); qv.position.set(-0.3, 1.0, -0.18); qv.rotation.x = -0.45; body.add(qv);
        qv.add(part(G.cyl8, mat('#7a4a22'), 0.12, 0.7, 0.12, 0, 0, 0));
        qv.add(part(G.cyl8, gold, 0.125, 0.05, 0.125, 0, 0.3, 0));
        [-0.05, 0.03, 0.06].forEach((z, i) => qv.add(part(G.box, mat(i % 2 ? '#ffb030' : '#e5483b'), 0.04, 0.2, 0.08, (i - 1) * 0.05, 0.45, z)));
      }
      const sw = new T.Group(); sw.position.set(-0.32, 1.15, L.weapon === 'longbow' ? 0.12 : 0); sw.rotation.x = 0.6; body.add(sw);
      sw.add(part(G.box, mat('#cfe7ff', { emissive: '#5fd3ff', emissiveIntensity: 0.35, metalness: 0.5, roughness: 0.25 }), 0.05, 1.05, 0.12, 0, 0.1, 0));
      sw.add(part(G.box, gold, 0.07, 0.07, 0.36, 0, -0.45, 0));
      sw.add(part(G.box, mat('#5a3a22'), 0.06, 0.22, 0.06, 0, -0.6, 0));
      sw.add(part(G.oct, glow('#5fd3ff', 1.2), 0.06, 0.06, 0.06, 0, -0.73, 0));
    }
    if (L.shield) {
      const sh = part(G.cyl8, mat(L.shield), 0.3, 0.07, 0.3, 0.1, -0.3, -0.1);
      sh.rotation.x = Math.PI / 2; armL.add(sh);
      const boss = part(G.cyl8, mat('#f4c247'), 0.1, 0.08, 0.1, 0.1, -0.3, -0.14); boss.rotation.x = Math.PI / 2; armL.add(boss);
    }
    Object.assign(g.userData, { legs, armR, armL, body, height: headY + 0.4 });
    return g;
  }

  function buildDragon() {
    const g = new T.Group();
    const body = new T.Group(); g.add(body);
    const red = mat('#d0352b'), red2 = mat('#9f231c'), belly = mat('#f0b25a'), horn = mat('#f6eedb');
    body.add(part(G.ico1, red, 1.1, 0.7, 0.75, 0, 0, 0));
    body.add(part(G.ico1, belly, 0.9, 0.45, 0.55, 0.15, -0.25, 0));
    const neck = part(G.cyl6, red, 0.28, 1.0, 0.28, 1.0, 0.55, 0); neck.rotation.z = -0.8; body.add(neck);
    const head = new T.Group(); head.position.set(1.55, 1.0, 0); body.add(head);
    head.add(part(G.box, red, 0.7, 0.42, 0.5, 0, 0, 0));
    head.add(part(G.box, red2, 0.5, 0.22, 0.4, 0.45, -0.08, 0));
    [-0.16, 0.16].forEach(z => {
      head.add(part(G.box, glow('#ffe14a'), 0.08, 0.08, 0.06, 0.2, 0.12, z * 1.4));
      const h = part(G.cone4, horn, 0.07, 0.4, 0.07, -0.25, 0.32, z); h.rotation.z = 0.9; head.add(h);
    });
    const tail = new T.Group(); tail.position.set(-1.0, 0, 0); body.add(tail);
    const tg = new T.ConeGeometry(0.3, 1.8, 5); tg.rotateZ(Math.PI / 2); tg.translate(-0.9, 0, 0);
    tail.add(part(tg, red, 1, 1, 1));
    tail.add(part(G.cone4, red2, 0.2, 0.4, 0.06, -1.85, 0.05, 0).rotateZ(Math.PI / 2));
    const wingGeo = new T.BufferGeometry();
    wingGeo.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, 0.9, 0, 0, -0.5, 0, 2.2, 0.9, 0, 0, 0.4, 0, 2.0, -0.5, 0, 2.2], 3));
    wingGeo.computeVertexNormals();
    const wingM = mat('#a8241c', { side: T.DoubleSide });
    const wings = [-1, 1].map(s => {
      const w = new T.Group(); w.position.set(-0.1, 0.35, s * 0.4); w.scale.z = s; body.add(w);
      w.add(mesh(wingGeo, wingM));
      return w;
    });
    [-0.3, 0.3].forEach(z => body.add(part(G.box, red2, 0.2, 0.5, 0.2, 0.3, -0.6, z)));
    Object.assign(g.userData, { body, wings, tail, height: 1.6, dragon: true });
    return g;
  }

  function buildLich() {
    const g = new T.Group();
    const body = new T.Group(); g.add(body);
    const robe = mat('#4a2a72'), robe2 = mat('#2c1745'), bone = mat('#ece6d4');
    body.add(part(new T.CylinderGeometry(0.28, 0.72, 1.4, 7), robe, 1, 1, 1, 0, 0.7, 0));
    body.add(part(G.cyl6, robe2, 0.4, 0.5, 0.4, 0, 1.45, 0));
    body.add(part(G.cone6, robe2, 0.46, 0.7, 0.46, -0.05, 1.95, 0));
    body.add(part(G.ico1, bone, 0.27, 0.3, 0.27, 0.08, 1.78, 0));
    [-0.09, 0.09].forEach(z => body.add(part(G.box, glow('#c27bff'), 0.05, 0.07, 0.07, 0.33, 1.82, z)));
    const gold = mat('#f4c247', { metalness: 0.4, roughness: 0.4 });
    body.add(part(G.cyl8, gold, 0.3, 0.1, 0.3, 0.06, 2.0, 0));
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; body.add(part(G.cone4, gold, 0.05, 0.18, 0.05, 0.06 + Math.cos(a) * 0.25, 2.12, Math.sin(a) * 0.25)); }
    const armR = new T.Group(); armR.position.set(0, 1.3, 0.42); body.add(armR);
    armR.add(part(G.box, robe2, 0.2, 0.55, 0.2, 0, -0.25, 0));
    armR.add(part(G.cyl6, mat('#3a2a1a'), 0.04, 2.0, 0.04, 0.2, 0.3, 0));
    const orb = part(G.ico1, glow('#c27bff'), 0.18, 0.18, 0.18, 0.2, 1.38, 0); armR.add(orb);
    Object.assign(g.userData, { body, armR, orb, height: 2.3, lich: true });
    return g;
  }

  // 사막의 거대 전갈 (기사 역할: 단단한 껍질)
  function buildScorpion() {
    const g = new T.Group();
    const body = new T.Group(); g.add(body);
    const shell = mat('#3a2a3e', { metalness: 0.25, roughness: 0.5 }), shell2 = mat('#5a3e5a', { metalness: 0.25, roughness: 0.5 });
    body.add(part(G.ico1, shell, 0.6, 0.28, 0.42, 0, 0.5, 0));
    body.add(part(G.ico1, shell2, 0.32, 0.22, 0.32, 0.5, 0.52, 0));
    [-0.1, 0.1].forEach(z => body.add(part(G.box, glow('#ff3b2f'), 0.05, 0.05, 0.05, 0.78, 0.6, z)));
    const legs = [];
    for (let i = 0; i < 4; i++) [-1, 1].forEach(sd => {
      const lg = new T.Group(); lg.position.set(0.25 - i * 0.2, 0.48, sd * 0.32); body.add(lg);
      const a = part(G.box, shell2, 0.07, 0.07, 0.45, 0, 0.05, sd * 0.2); a.rotation.x = sd * 0.5; lg.add(a);
      lg.add(part(G.box, shell2, 0.06, 0.45, 0.06, 0, -0.18, sd * 0.42));
      legs.push(lg);
    });
    const claws = [-1, 1].map(sd => {
      const c = new T.Group(); c.position.set(0.6, 0.55, sd * 0.3); body.add(c);
      c.add(part(G.box, shell, 0.45, 0.1, 0.1, 0.2, 0, sd * 0.05));
      c.add(part(G.ico, shell2, 0.18, 0.12, 0.14, 0.5, 0, sd * 0.05));
      const p1 = part(G.cone4, shell2, 0.06, 0.28, 0.06, 0.72, 0, sd * 0.1); p1.rotation.z = -Math.PI / 2; c.add(p1);
      const p2 = part(G.cone4, shell2, 0.05, 0.24, 0.05, 0.7, 0, sd * -0.02); p2.rotation.z = -Math.PI / 2; c.add(p2);
      return c;
    });
    // 꼬리: 마디 5개가 위로 휘어 독침
    const tail = new T.Group(); tail.position.set(-0.5, 0.55, 0); body.add(tail);
    let seg = tail;
    for (let i = 0; i < 5; i++) {
      const s = new T.Group(); s.position.set(i ? -0.22 : 0, i ? 0.04 : 0, 0); s.rotation.z = -0.45; seg.add(s);
      s.add(part(G.ico, i % 2 ? shell2 : shell, 0.15 - i * 0.012, 0.13 - i * 0.01, 0.15 - i * 0.012, -0.1, 0, 0));
      seg = s;
    }
    const sting = part(G.cone4, glow('#b7ff3a', 0.9), 0.07, 0.26, 0.07, -0.22, 0.02, 0); sting.rotation.z = Math.PI / 2 + 0.5; seg.add(sting);
    Object.assign(g.userData, { body, legs, claws, tail, height: 1.3, crawl: true });
    return g;
  }

  function buildEnemy(type) {
    let g;
    if (type === 'dragon') g = buildDragon();
    else if (type === 'lich') g = buildLich();
    else if (type === 'scorpion') g = buildScorpion();
    else g = buildHumanoid(LOOKS[type]);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  function buildHero() { return shadowAll(buildHumanoid(LOOKS.hero)); }

  return { mat, glow, mesh, part, G, torch, buildCastle, buildTower, buildEnemy, buildHero, LOOKS };
})();
