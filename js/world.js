/* 구구단 디펜스 - 3D 월드 (Three.js 로우폴리 그래픽)
 * 지형, 길, 성, 탑, 적 모델, 투사체, 파티클을 만들고 그린다.
 * 게임 좌표: XZ 평면이 땅, Y가 높이. 적은 -X(왼쪽)에서 +X(성)으로 이동.
 */
const World = (() => {
  const T = THREE;
  let renderer, scene, camera, canvas;
  let viewW = 1, viewH = 1, portrait = false;

  // ---------------- 유틸 ----------------
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  const matCache = new Map();
  function mat(color, opts) {
    const key = color + (opts ? JSON.stringify(opts) : '');
    if (!matCache.has(key)) {
      matCache.set(key, new T.MeshStandardMaterial(Object.assign({ color, flatShading: true, roughness: 0.88, metalness: 0 }, opts || {})));
    }
    return matCache.get(key);
  }
  function glow(color) { return mat(color, { emissive: color, emissiveIntensity: 0.9 }); }
  function mesh(geo, m, shadow = true) {
    const o = new T.Mesh(geo, m);
    o.castShadow = shadow; o.receiveShadow = false;
    return o;
  }
  // 자주 쓰는 지오메트리
  const G = {
    box: new T.BoxGeometry(1, 1, 1),
    ico: new T.IcosahedronGeometry(1, 0),
    ico1: new T.IcosahedronGeometry(1, 1),
    sphere: new T.SphereGeometry(1, 8, 6),
    halfSphere: new T.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
    cyl6: new T.CylinderGeometry(1, 1, 1, 6),
    cyl8: new T.CylinderGeometry(1, 1, 1, 8),
    cone4: new T.ConeGeometry(1, 1, 4),
    cone6: new T.ConeGeometry(1, 1, 6),
    cone8: new T.ConeGeometry(1, 1, 8),
  };
  function part(geo, m, sx, sy, sz, x = 0, y = 0, z = 0) {
    const o = mesh(geo, m);
    o.scale.set(sx, sy, sz); o.position.set(x, y, z);
    return o;
  }

  // ---------------- 길 ----------------
  const PATH_PTS = [[-25, -2.5], [-19, -3.2], [-14, -6.6], [-8.5, -5.6], [-5.6, -0.5], [-2, 4.6], [3.2, 5.2], [6.6, 0.6], [9.6, -5.2], [13.6, -5.4], [16.2, -1.2], [18.4, 0]];
  const curve = new T.CatmullRomCurve3(PATH_PTS.map(([x, z]) => new T.Vector3(x, 0, z)), false, 'centripetal');
  const LUT_N = 600;
  const lut = [];
  for (let i = 0; i <= LUT_N; i++) {
    const u = i / LUT_N;
    const p = curve.getPointAt(u), tg = curve.getTangentAt(u);
    lut.push({ x: p.x, z: p.z, tx: tg.x, tz: tg.z });
  }
  const pathLength = curve.getLength();
  function pathAt(t, lane = 0) {
    t = Math.max(0, Math.min(1, t));
    const f = t * LUT_N, i = Math.min(LUT_N - 1, Math.floor(f)), r = f - i;
    const a = lut[i], b = lut[i + 1];
    const x = a.x + (b.x - a.x) * r, z = a.z + (b.z - a.z) * r;
    const tx = a.tx + (b.tx - a.tx) * r, tz = a.tz + (b.tz - a.tz) * r;
    const len = Math.hypot(tx, tz) || 1;
    // 진행 방향의 수직 방향으로 줄 간격
    return { x: x + (-tz / len) * lane, z: z + (tx / len) * lane, dx: tx / len, dz: tz / len };
  }
  function distToPath(x, z) {
    let best = 1e9;
    for (let i = 0; i <= LUT_N; i += 3) best = Math.min(best, Math.hypot(lut[i].x - x, lut[i].z - z));
    return best;
  }

  const CASTLE = { x: 20.6, z: 0 };
  const BOUNDS = { x0: -21.5, x1: 24.5, z0: -9.6, z1: 9.6 };

  // ---------------- 설치 칸 ----------------
  const slots = [];
  (function makeSlots() {
    const cands = [];
    for (let u = 0.07; u <= 0.93; u += 0.018) {
      const p = pathAt(u);
      for (const side of [-1, 1]) {
        const x = p.x + (-p.dz) * 3.4 * side, z = p.z + p.dx * 3.4 * side;
        cands.push({ x, z });
      }
    }
    for (const c of cands) {
      if (c.x < -18.5 || c.x > 15.5 || Math.abs(c.z) > 8.4) continue;
      if (distToPath(c.x, c.z) < 3.0) continue;
      if (Math.hypot(c.x - CASTLE.x, c.z - CASTLE.z) < 6) continue;
      if (slots.some(s => Math.hypot(s.x - c.x, s.z - c.z) < 3.05)) continue;
      slots.push({ x: +c.x.toFixed(2), z: +c.z.toFixed(2) });
    }
  })();

  // ---------------- 초기화 ----------------
  let padMeshes = [], padMat, padHiMat;
  let particles;
  const fx = []; // 3D 효과 (폭발, 유성 등)
  const towerObjs = new Map();

  function init(cv) {
    canvas = cv;
    renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    const isMobile = Math.min(screen.width, screen.height) < 700;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.75 : 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = isMobile ? T.PCFShadowMap : T.PCFSoftShadowMap;
    scene = new T.Scene();
    scene.background = new T.Color('#2f7f5b');
    scene.fog = new T.Fog('#2f7f5b', 70, 140);
    camera = new T.PerspectiveCamera(30, 1, 1, 400);

    const hemi = new T.HemisphereLight('#fffaf0', '#4d7a5d', 1.55);
    scene.add(hemi);
    const sun = new T.DirectionalLight('#fff3dc', 2.6);
    sun.position.set(-14, 34, 18);
    sun.target.position.set(2, 0, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 26, bottom: -26, near: 5, far: 90 });
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.03;
    scene.add(sun, sun.target);

    buildTerrain();
    buildPath();
    buildPads();
    buildCastle();
    particles = makeParticles(700);
  }

  // ---------------- 지형 ----------------
  const GRASS_A = new T.Color('#55b571'), GRASS_B = new T.Color('#5bbb76'), GRASS_C = new T.Color('#4faf6b');

  function buildTerrain() {
    const R = rng(11);
    // 바닥: 미세한 색 변화가 있는 로우폴리 평면
    const geo = new T.PlaneGeometry(220, 160, 88, 64);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const g2 = geo.toNonIndexed();
    const p2 = g2.attributes.position;
    const colors = [];
    const c = new T.Color();
    for (let i = 0; i < p2.count; i += 3) {
      const r = R();
      c.copy(r < 0.4 ? GRASS_A : r < 0.75 ? GRASS_B : GRASS_C);
      for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b);
    }
    // 플레이 영역 밖은 살짝 울퉁불퉁하게
    for (let i = 0; i < p2.count; i++) {
      const x = p2.getX(i), z = p2.getZ(i);
      const out = Math.max(0, Math.abs(z) - 13, x < -24 ? -24 - x : x > 27 ? x - 27 : 0);
      if (out > 0) p2.setY(i, Math.sin(x * 0.7) * Math.cos(z * 0.6) * Math.min(1, out * 0.15) * 0.6);
    }
    void pos;
    g2.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    g2.computeVertexNormals();
    const ground = new T.Mesh(g2, new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
    ground.receiveShadow = true;
    scene.add(ground);

    // 절벽 고원(메사) - 플레이 영역 바깥과 빈 곳에
    const mesas = [];
    const freeSpot = (x, z, r) =>
      distToPath(x, z) > r + 2.6 &&
      slots.every(s => Math.hypot(s.x - x, s.z - z) > r + 2.2) &&
      Math.hypot(x - CASTLE.x, z - CASTLE.z) > r + 6;
    const inPlay = (x, z) => x > BOUNDS.x0 - 1 && x < BOUNDS.x1 + 1 && z > BOUNDS.z0 - 1 && z < BOUNDS.z1 + 1;
    // 바깥 둘레
    for (let i = 0; i < 70; i++) {
      const x = -48 + R() * 100, z = -34 + R() * 68;
      const r = 3 + R() * 5;
      if (inPlay(x, z) || (!freeSpot(x, z, r) && Math.abs(z) < 14)) continue;
      if (x < -20 && Math.abs(z + 2.8) < r + 3) continue; // 적이 들어오는 길 입구
      if (mesas.some(m => Math.hypot(m.x - x, m.z - z) < m.r + r)) continue;
      mesas.push({ x, z, r, h: 1.6 + R() * 3.2 });
    }
    // 안쪽 빈 곳
    for (let i = 0; i < 300 && mesas.length < 90; i++) {
      const x = BOUNDS.x0 + R() * (BOUNDS.x1 - BOUNDS.x0 - 6), z = BOUNDS.z0 + R() * (BOUNDS.z1 - BOUNDS.z0);
      const r = 1.4 + R() * 1.6;
      if (!freeSpot(x, z, r)) continue;
      if (mesas.some(m => Math.hypot(m.x - x, m.z - z) < m.r + r + 1)) continue;
      mesas.push({ x, z, r, h: 0.9 + R() * 1.2, inner: true });
    }
    const topMat = mat('#55b671'), sideMat = mat('#8f98a8'), sideMat2 = mat('#7d8696');
    for (const m of mesas) {
      const shape = new T.Shape();
      const n = 7 + Math.floor(R() * 4);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, rr = m.r * (0.75 + R() * 0.35);
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        if (i === 0) shape.moveTo(px, py); else shape.lineTo(px, py);
      }
      const eg = new T.ExtrudeGeometry(shape, { depth: m.h, bevelEnabled: false });
      eg.rotateX(-Math.PI / 2);
      const o = new T.Mesh(eg, [topMat, R() < 0.5 ? sideMat : sideMat2]);
      o.position.set(m.x, 0, m.z);
      o.castShadow = true; o.receiveShadow = true;
      scene.add(o);
      m.top = m.h;
    }

    // 나무 (인스턴싱)
    const trees = [];
    const treeOk = (x, z) => distToPath(x, z) > 2.6 && slots.every(s => Math.hypot(s.x - x, s.z - z) > 2.0) && Math.hypot(x - CASTLE.x, z - CASTLE.z) > 6.5;
    for (let i = 0; i < 900 && trees.length < 260; i++) {
      const x = -50 + R() * 104, z = -36 + R() * 72;
      const inside = inPlay(x, z);
      if (inside && R() < 0.75) continue;
      if (!treeOk(x, z)) continue;
      if (x < -19 && Math.abs(z + 2.8) < 3) continue;
      let y = 0;
      const on = mesas.find(m => Math.hypot(m.x - x, m.z - z) < m.r * 0.6);
      if (on) y = on.h;
      else if (mesas.some(m => Math.hypot(m.x - x, m.z - z) < m.r + 0.6)) continue;
      if (trees.some(t => Math.hypot(t.x - x, t.z - z) < 1.3)) continue;
      trees.push({ x, z, y, s: 0.8 + R() * 0.7, c: R() });
    }
    const trunkGeo = new T.CylinderGeometry(0.16, 0.22, 1, 5); trunkGeo.translate(0, 0.5, 0);
    const coneGeo = new T.ConeGeometry(1, 1, 7); coneGeo.translate(0, 0.5, 0);
    const trunkIM = new T.InstancedMesh(trunkGeo, mat('#7a5233'), trees.length);
    const tiers = [[0.95, 1.5, 0.55], [0.75, 1.3, 1.35], [0.52, 1.1, 2.1]];
    const coneIMs = tiers.map(() => new T.InstancedMesh(coneGeo, new T.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), trees.length));
    const m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), ps = new T.Vector3();
    const treeCols = ['#2f8f63', '#277e57', '#3a9e6c', '#22704e'].map(h => new T.Color(h));
    trees.forEach((t, i) => {
      q.setFromAxisAngle(new T.Vector3(0, 1, 0), t.c * 6);
      m4.compose(ps.set(t.x, t.y, t.z), q, sc.set(t.s, t.s * 0.9, t.s)); trunkIM.setMatrixAt(i, m4);
      tiers.forEach(([r, h, y], k) => {
        m4.compose(ps.set(t.x, t.y + y * t.s, t.z), q, sc.set(r * t.s, h * t.s, r * t.s));
        coneIMs[k].setMatrixAt(i, m4);
        coneIMs[k].setColorAt(i, treeCols[Math.floor(t.c * 4) % 4]);
      });
    });
    [trunkIM, ...coneIMs].forEach(im => { im.castShadow = true; im.receiveShadow = true; scene.add(im); });

    // 바위
    const rocks = [];
    for (let i = 0; i < 400 && rocks.length < 90; i++) {
      const x = -40 + R() * 84, z = -28 + R() * 56;
      if (!treeOk(x, z) || distToPath(x, z) < 2.3) continue;
      if (mesas.some(m => Math.hypot(m.x - x, m.z - z) < m.r * 0.7)) continue;
      rocks.push({ x, z, s: 0.25 + R() * 0.55, r: R() * 6 });
    }
    // 절벽 아래 바위 무더기
    mesas.forEach(m => {
      for (let k = 0; k < 3; k++) {
        const a = R() * 6.28;
        rocks.push({ x: m.x + Math.cos(a) * m.r * 0.95, z: m.z + Math.sin(a) * m.r * 0.95, s: 0.3 + R() * 0.5, r: R() * 6 });
      }
    });
    const rockIM = new T.InstancedMesh(new T.DodecahedronGeometry(1, 0), mat('#9aa2ae'), rocks.length);
    rocks.forEach((r, i) => {
      q.setFromEuler(new T.Euler(r.r, r.r * 2, 0));
      m4.compose(ps.set(r.x, r.s * 0.3, r.z), q, sc.set(r.s, r.s * 0.75, r.s));
      rockIM.setMatrixAt(i, m4);
    });
    rockIM.castShadow = true; rockIM.receiveShadow = true;
    scene.add(rockIM);

    // 꽃/풀 덤불
    const bushes = [];
    for (let i = 0; i < 600 && bushes.length < 140; i++) {
      const x = BOUNDS.x0 + R() * (BOUNDS.x1 - BOUNDS.x0), z = BOUNDS.z0 - 3 + R() * (BOUNDS.z1 - BOUNDS.z0 + 6);
      if (!treeOk(x, z) || distToPath(x, z) < 2.4) continue;
      if (mesas.some(m => Math.hypot(m.x - x, m.z - z) < m.r + 0.3)) continue;
      bushes.push({ x, z, s: 0.18 + R() * 0.25, f: R() });
    }
    const bushIM = new T.InstancedMesh(new T.IcosahedronGeometry(1, 0), new T.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), bushes.length);
    const bushCols = ['#3c9b5e', '#6cc77f', '#f3d36b', '#f08aa6', '#ffffff'].map(h => new T.Color(h));
    bushes.forEach((b, i) => {
      const flower = b.f > 0.7;
      m4.compose(ps.set(b.x, flower ? 0.06 : b.s * 0.4, b.z), q.identity(), flower ? sc.set(0.09, 0.09, 0.09) : sc.set(b.s * 1.4, b.s, b.s * 1.4));
      bushIM.setMatrixAt(i, m4);
      bushIM.setColorAt(i, bushCols[flower ? 2 + Math.floor(b.f * 10) % 3 : Math.floor(b.f * 10) % 2]);
    });
    bushIM.receiveShadow = true;
    scene.add(bushIM);
  }

  function ribbon(width, y, color, jitterSeed, extendStart) {
    const R = rng(jitterSeed);
    const pos = [], idx = [];
    const N = 300;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const p = curve.getPointAt(u), tg = curve.getTangentAt(u);
      pts.push({ x: p.x, z: p.z, tx: tg.x, tz: tg.z });
    }
    if (extendStart) {
      const a = pts[0];
      for (let k = 1; k <= 6; k++) pts.unshift({ x: a.x - a.tx * k * 2, z: a.z - a.tz * k * 2, tx: a.tx, tz: a.tz });
    }
    let w = width;
    pts.forEach((p, i) => {
      if (i % 4 === 0) w = width * (0.9 + R() * 0.2);
      const nx = -p.tz, nz = p.tx;
      pos.push(p.x + nx * w, y, p.z + nz * w, p.x - nx * w, y, p.z - nz * w);
      if (i > 0) { const b = (i - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    });
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const o = new T.Mesh(geo, new T.MeshStandardMaterial({ color, roughness: 1, flatShading: true, side: T.DoubleSide }));
    o.receiveShadow = true;
    return o;
  }

  function buildPath() {
    scene.add(ribbon(2.15, 0.03, '#d2ae7c', 3, true));
    scene.add(ribbon(1.8, 0.05, '#ecd1a2', 5, true));
    // 길 위 자갈
    const R = rng(21);
    const pebbles = [];
    for (let i = 0; i < 160; i++) {
      const p = pathAt(R(), (R() - 0.5) * 3.2);
      pebbles.push(p);
    }
    const im = new T.InstancedMesh(new T.IcosahedronGeometry(0.07, 0), mat('#c4a57a'), pebbles.length);
    const m4 = new T.Matrix4();
    pebbles.forEach((p, i) => { m4.makeTranslation(p.x, 0.07, p.z); im.setMatrixAt(i, m4); });
    scene.add(im);
  }

  // ---------------- 설치 칸 ----------------
  function padTexture(hi) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = hi ? 'rgba(48,140,88,0.95)' : 'rgba(36,112,72,0.9)';
    roundRect(x, 6, 6, 116, 116, 14); x.fill();
    x.strokeStyle = '#ffffff'; x.lineWidth = 6; x.setLineDash([16, 10]);
    roundRect(x, 10, 10, 108, 108, 12); x.stroke();
    x.setLineDash([]);
    // 망치 + 플러스 아이콘
    x.fillStyle = hi ? '#ffe27a' : 'rgba(255,255,255,0.9)';
    x.fillRect(56, 34, 16, 60); x.fillRect(34, 56, 60, 16);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }
  function roundRect(x, a, b, w, h, r) {
    x.beginPath(); x.moveTo(a + r, b);
    x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r);
    x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath();
  }
  function buildPads() {
    padMat = new T.MeshStandardMaterial({ map: padTexture(false), transparent: true, roughness: 1 });
    padHiMat = new T.MeshStandardMaterial({ map: padTexture(true), transparent: true, roughness: 1, emissive: '#ffd34a', emissiveIntensity: 0 });
    const geo = new T.PlaneGeometry(2.5, 2.5); geo.rotateX(-Math.PI / 2);
    padMeshes = slots.map(s => {
      const o = new T.Mesh(geo, padMat);
      o.position.set(s.x, 0.06, s.z);
      o.receiveShadow = true;
      scene.add(o);
      return o;
    });
  }

  // ---------------- 성 ----------------
  let castleGroup, castleFlags = [], castleTop = new T.Vector3();
  function buildCastle() {
    const g = new T.Group();
    const stone = mat('#d3cbbd'), stone2 = mat('#b8b0a2'), dark = mat('#4a3b30'), roofR = mat('#d9493c'), roofB = mat('#3f78c8'), wood = mat('#8d5b34'), gold = mat('#f4c247', { metalness: 0.3, roughness: 0.5 });
    // 바닥 언덕
    g.add(part(G.cyl8, mat('#5cbd77'), 5.4, 0.5, 6.4, 0.6, 0.25, 0));
    // 성벽
    g.add(part(G.box, stone, 5.2, 2.6, 7.6, 0.6, 1.3, 0));
    for (let i = 0; i < 6; i++) {
      g.add(part(G.box, stone2, 0.55, 0.5, 0.55, -1.8, 2.85, -3.2 + i * 1.28));
      g.add(part(G.box, stone2, 0.55, 0.5, 0.55, 3.0, 2.85, -3.2 + i * 1.28));
    }
    for (let i = 0; i < 4; i++) {
      g.add(part(G.box, stone2, 0.55, 0.5, 0.55, -1.0 + i * 1.2, 2.85, -3.6));
      g.add(part(G.box, stone2, 0.55, 0.5, 0.55, -1.0 + i * 1.2, 2.85, 3.6));
    }
    // 모서리 탑
    [[-1.9, -3.7], [-1.9, 3.7], [3.1, -3.7], [3.1, 3.7]].forEach(([x, z], i) => {
      g.add(part(G.cyl8, stone, 1.05, 4.2, 1.05, x, 2.1, z));
      g.add(part(G.cyl8, stone2, 1.25, 0.4, 1.25, x, 4.3, z));
      g.add(part(G.cone8, i < 2 ? roofR : roofB, 1.45, 2.0, 1.45, x, 5.5, z));
      const w = part(G.box, dark, 0.15, 0.55, 0.3, x - 1.02, 2.6, z); g.add(w);
    });
    // 본성(킵)
    g.add(part(G.box, mat('#e2dbcf'), 3.2, 5.2, 3.4, 1.2, 2.6, 0));
    const roof = part(G.cone4, roofR, 2.7, 2.8, 2.7, 1.2, 6.6, 0); roof.rotation.y = Math.PI / 4; g.add(roof);
    for (let i = 0; i < 3; i++) g.add(part(G.box, dark, 0.15, 0.7, 0.42, -0.42, 3.4 + (i === 1 ? 0.9 : 0), -0.9 + i * 0.9));
    // 문장 (왕관)
    g.add(part(G.box, gold, 0.12, 0.6, 0.9, -0.42, 4.6, 0));
    // 성문
    g.add(part(G.box, stone2, 0.5, 2.4, 2.6, -2.05, 1.2, 0));
    g.add(part(G.box, dark, 0.2, 1.7, 1.7, -2.3, 0.85, 0));
    g.add(part(G.box, wood, 0.12, 1.5, 1.45, -2.38, 0.75, 0));
    for (let i = 0; i < 3; i++) g.add(part(G.box, mat('#5f4430'), 0.13, 1.5, 0.06, -2.46, 0.75, -0.45 + i * 0.45));
    // 깃발
    const flagMat = mat('#e14b3c', { side: T.DoubleSide });
    const flagMat2 = mat('#f4c247', { side: T.DoubleSide });
    [[1.2, 8.0, 0, flagMat], [-1.9, 6.5, -3.7, flagMat2], [3.1, 6.5, 3.7, flagMat2]].forEach(([x, y, z, m]) => {
      g.add(part(G.cyl6, wood, 0.05, 1.6, 0.05, x, y + 0.6, z));
      const fg = new T.PlaneGeometry(1.1, 0.6, 6, 1); fg.translate(0.55, 0, 0);
      const f = new T.Mesh(fg, m); f.position.set(x, y + 1.1, z); f.castShadow = true;
      f.userData.base = fg.attributes.position.array.slice();
      g.add(f); castleFlags.push(f);
    });
    g.position.set(CASTLE.x, 0, CASTLE.z);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(g);
    castleGroup = g;
    castleTop.set(CASTLE.x + 1.2, 8.5, CASTLE.z);
  }

  // ---------------- 탑 ----------------
  function buildTower(type) {
    const g = new T.Group();
    const turret = new T.Group();
    const wood = mat('#9a6638'), wood2 = mat('#6f4526'), stone = mat('#c9c2b6'), stone2 = mat('#a9a296');
    // 공통: 돌 받침
    g.add(part(G.box, stone2, 2.3, 0.3, 2.3, 0, 0.15, 0));
    if (type === 'archer') {
      [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]].forEach(([x, z]) => g.add(part(G.box, wood2, 0.22, 2.2, 0.22, x, 1.3, z)));
      const b1 = part(G.box, wood, 0.12, 1.9, 0.12, 0, 1.2, -0.7); b1.rotation.x = 0; b1.rotation.z = 0.62; g.add(b1);
      const b2 = part(G.box, wood, 0.12, 1.9, 0.12, 0, 1.2, 0.7); b2.rotation.z = -0.62; g.add(b2);
      g.add(part(G.box, wood, 2.0, 0.22, 2.0, 0, 2.4, 0));
      // 난간
      [[0, -0.95, 2.0, 0.12], [0, 0.95, 2.0, 0.12], [-0.95, 0, 0.12, 2.0], [0.95, 0, 0.12, 2.0]].forEach(([x, z, sx, sz]) => g.add(part(G.box, wood2, sx, 0.4, sz, x, 2.7, z)));
      // 지붕
      [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]].forEach(([x, z]) => g.add(part(G.box, wood2, 0.1, 1.3, 0.1, x, 3.1, z)));
      const roof = part(G.cone4, mat('#d9493c'), 1.5, 1.25, 1.5, 0, 4.25, 0); roof.rotation.y = Math.PI / 4; g.add(roof);
      // 궁수
      turret.position.set(0, 2.5, 0);
      turret.add(part(G.cyl6, mat('#3f8f45'), 0.28, 0.6, 0.28, 0, 0.35, 0));
      turret.add(part(G.ico1, mat('#f1c49a'), 0.24, 0.24, 0.24, 0, 0.85, 0));
      turret.add(part(G.cone6, mat('#2f7a37'), 0.3, 0.4, 0.3, 0, 1.12, 0));
      const bow = new T.Mesh(new T.TorusGeometry(0.42, 0.04, 4, 10, Math.PI), wood2);
      bow.position.set(0.38, 0.55, 0); bow.rotation.set(0, 0, -Math.PI / 2); turret.add(bow);
      g.userData.muzzleY = 3.2;
    } else if (type === 'cannon') {
      g.add(part(G.cyl8, stone, 1.05, 1.1, 1.05, 0, 0.85, 0));
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        g.add(part(G.box, stone2, 0.32, 0.32, 0.32, Math.cos(a) * 0.9, 1.55, Math.sin(a) * 0.9));
      }
      turret.position.set(0, 1.45, 0);
      turret.add(part(G.box, wood, 0.9, 0.3, 0.8, 0, 0.05, 0));
      const wheelGeo = new T.CylinderGeometry(0.3, 0.3, 0.12, 8); wheelGeo.rotateX(Math.PI / 2);
      [-0.45, 0.45].forEach(z => turret.add(part(wheelGeo, wood2, 1, 1, 1, -0.1, 0.05, z)));
      const barrel = new T.Group();
      const bg = new T.CylinderGeometry(0.2, 0.28, 1.6, 8); bg.rotateZ(-Math.PI / 2); bg.translate(0.55, 0, 0);
      barrel.add(part(bg, mat('#33363b', { metalness: 0.4, roughness: 0.5 }), 1, 1, 1));
      barrel.add(part(G.cyl8, mat('#f4c247'), 0.25, 0.08, 0.25, 0.9, 0, 0).rotateZ(Math.PI / 2));
      barrel.position.set(0, 0.35, 0); barrel.rotation.z = 0.25;
      turret.add(barrel);
      turret.userData.barrel = barrel;
      g.userData.muzzleY = 2.0;
    } else {
      const spire = new T.CylinderGeometry(0.62, 0.95, 2.8, 6);
      g.add(part(spire, mat('#8e94b8'), 1, 1, 1, 0, 1.6, 0));
      g.add(part(G.cyl6, mat('#6d7299'), 0.85, 0.3, 0.85, 0, 3.1, 0));
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        g.add(part(G.box, mat('#6d7299'), 0.22, 0.4, 0.22, Math.cos(a) * 0.7, 3.4, Math.sin(a) * 0.7));
      }
      g.add(part(G.box, mat('#2c2450'), 0.08, 0.6, 0.4, -0.86, 1.1, 0));
      turret.position.set(0, 4.1, 0);
      const crystal = part(new T.OctahedronGeometry(0.45, 0), mat('#8ff0ff', { emissive: '#4fd6ff', emissiveIntensity: 1.1, roughness: 0.3 }), 1, 1.5, 1);
      turret.add(crystal);
      turret.userData.crystal = crystal;
      g.userData.muzzleY = 4.1;
    }
    g.add(turret);
    g.userData.turret = turret;
    g.userData.type = type;
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  function addTower(tw) {
    const s = slots[tw.slot];
    const g = buildTower(tw.type);
    g.position.set(s.x, 0, s.z);
    g.scale.setScalar(0.01);
    g.userData.grow = 0;
    scene.add(g);
    towerObjs.set(tw, g);
    padMeshes[tw.slot].visible = false;
  }
  function removeTower(tw) {
    const g = towerObjs.get(tw);
    if (g) scene.remove(g);
    towerObjs.delete(tw);
    padMeshes[tw.slot].visible = true;
  }
  function clearTowers() { [...towerObjs.keys()].forEach(removeTower); }
  function muzzle(tw) {
    const s = slots[tw.slot];
    return { x: s.x, y: towerObjs.get(tw)?.userData.muzzleY || 2.5, z: s.z };
  }

  // ---------------- 적 모델 ----------------
  const LOOKS = {
    goblin:  { skin: '#7cc444', armor: '#8a5a32', legs: '#5a3a20', weapon: 'dagger', ears: true, eye: '#ffde3a' },
    soldier: { skin: '#f2c39c', armor: '#d8433a', legs: '#7d241f', helm: 'cap', weapon: 'spear', belt: '#4a2a18' },
    knight:  { skin: '#f2c39c', armor: '#a8b1bf', legs: '#5f6876', helm: 'knight', plume: '#d8433a', weapon: 'sword', shield: '#2d4f98' },
    ogre:    { skin: '#c4a56b', armor: '#7a5230', legs: '#9b8250', weapon: 'club', bulk: true, tusk: true, eye: '#d22' },
    troll:   { skin: '#86a7b6', armor: '#526156', legs: '#6c8a96', weapon: 'club', bulk: true, tusk: true, eye: '#ffef5a' },
    orcking: { skin: '#5aa046', armor: '#3b2b22', legs: '#3f7a30', helm: 'horn', weapon: 'axe', bulk: true, tusk: true, eye: '#f33', cape: '#b3261e' },
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
    if (L.belt) body.add(part(G.cyl6, mat(L.belt), 0.39, 0.1, 0.39, 0, 0.64, 0));
    if (L.cape) { const cp = part(G.box, mat(L.cape), 0.08, 1.0, 1.0, -0.5, 1.05, 0); cp.rotation.z = -0.15; body.add(cp); }
    const headY = bulk ? 1.65 : 1.42;
    const head = part(G.ico1, mat(L.skin), 0.3, 0.3, 0.3, 0.02, headY, 0);
    body.add(head);
    const eyeM = L.eye ? glow(L.eye) : mat('#1d1d1d');
    [-0.1, 0.1].forEach(z => body.add(part(G.box, eyeM, 0.05, 0.07, 0.06, 0.29, headY + 0.03, z)));
    if (L.ears) [-1, 1].forEach(s => { const e = part(G.cone4, mat(L.skin), 0.09, 0.32, 0.09, -0.02, headY + 0.08, s * 0.32); e.rotation.x = s * -1.3; body.add(e); });
    if (L.tusk) [-0.1, 0.1].forEach(z => body.add(part(G.cone4, mat('#f7f0dc'), 0.04, 0.14, 0.04, 0.27, headY - 0.1, z)));
    if (L.helm === 'cap') {
      body.add(part(G.halfSphere, mat('#aeb5bf', { metalness: 0.3, roughness: 0.5 }), 0.33, 0.3, 0.33, 0.02, headY + 0.04, 0));
      body.add(part(G.cyl8, mat('#8e96a2'), 0.36, 0.04, 0.36, 0.02, headY + 0.04, 0));
    } else if (L.helm === 'knight') {
      body.add(part(G.cyl8, mat('#c3cad4', { metalness: 0.4, roughness: 0.45 }), 0.33, 0.42, 0.33, 0.02, headY + 0.04, 0));
      body.add(part(G.box, mat('#222'), 0.04, 0.05, 0.36, 0.34, headY + 0.04, 0));
      body.add(part(G.box, mat(L.plume), 0.5, 0.18, 0.08, -0.08, headY + 0.32, 0));
    } else if (L.helm === 'horn') {
      body.add(part(G.halfSphere, mat('#5b5148'), 0.33, 0.3, 0.33, 0.02, headY + 0.04, 0));
      [-1, 1].forEach(s => { const h = part(G.cone6, mat('#efe5cb'), 0.08, 0.42, 0.08, 0, headY + 0.3, s * 0.3); h.rotation.x = s * -0.6; body.add(h); });
    }
    // 팔
    const armGeo = new T.BoxGeometry(bulk ? 0.24 : 0.17, 0.55, bulk ? 0.24 : 0.17); armGeo.translate(0, -0.27, 0);
    const shoulderY = bulk ? 1.32 : 1.13, sz = bulk ? 0.6 : 0.43;
    const armR = new T.Group(); armR.position.set(0, shoulderY, sz); body.add(armR);
    armR.add(mesh(armGeo, mat(bulk ? L.skin : L.armor)));
    const armL = new T.Group(); armL.position.set(0, shoulderY, -sz); body.add(armL);
    armL.add(mesh(armGeo, mat(bulk ? L.skin : L.armor)));
    // 무기
    const hand = new T.Group(); hand.position.set(0.05, -0.52, 0); armR.add(hand);
    const woodM = mat('#7a5233');
    if (L.weapon === 'spear') {
      const sp = part(G.cyl6, woodM, 0.035, 1.9, 0.035, 0.1, 0.35, 0); sp.rotation.z = -0.25; hand.add(sp);
      const tip = part(G.cone4, mat('#d8dde4', { metalness: 0.5, roughness: 0.4 }), 0.08, 0.26, 0.08, 0.36, 1.3, 0); tip.rotation.z = -0.25; hand.add(tip);
    } else if (L.weapon === 'sword') {
      const bl = part(G.box, mat('#e2e6ec', { metalness: 0.6, roughness: 0.3 }), 0.07, 0.8, 0.03, 0.2, 0.4, 0); bl.rotation.z = -0.5; hand.add(bl);
      hand.add(part(G.box, mat('#f4c247'), 0.08, 0.06, 0.25, 0.03, 0.06, 0));
    } else if (L.weapon === 'dagger') {
      const bl = part(G.box, mat('#d8dde4'), 0.05, 0.36, 0.03, 0.08, 0.18, 0); bl.rotation.z = -0.6; hand.add(bl);
    } else if (L.weapon === 'club') {
      const cl = part(G.cyl6, woodM, 0.09, 1.1, 0.09, 0.15, 0.45, 0); cl.rotation.z = -0.35; hand.add(cl);
      hand.add(part(G.ico, mat('#6b4628'), 0.24, 0.3, 0.24, 0.35, 1.0, 0));
    } else if (L.weapon === 'axe') {
      const h = part(G.cyl6, woodM, 0.05, 1.4, 0.05, 0.1, 0.55, 0); h.rotation.z = -0.2; hand.add(h);
      hand.add(part(G.box, mat('#c9ced6', { metalness: 0.5, roughness: 0.35 }), 0.55, 0.4, 0.06, 0.38, 1.1, 0));
    }
    if (L.shield) {
      const sh = part(G.cyl8, mat(L.shield), 0.3, 0.07, 0.3, 0.1, -0.3, -0.1);
      sh.rotation.x = Math.PI / 2; armL.add(sh);
      armL.add(part(G.cyl8, mat('#f4c247'), 0.1, 0.08, 0.1, 0.1, -0.3, -0.14).rotateX(Math.PI / 2));
    }
    g.userData = { legs, armR, armL, body, height: headY + 0.4 };
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
    // 다리
    [-0.3, 0.3].forEach(z => body.add(part(G.box, red2, 0.2, 0.5, 0.2, 0.3, -0.6, z)));
    g.userData = { body, wings, tail, height: 1.6, dragon: true };
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
    // 왕관
    const gold = mat('#f4c247', { metalness: 0.4, roughness: 0.4 });
    body.add(part(G.cyl8, gold, 0.3, 0.1, 0.3, 0.06, 2.0, 0));
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; body.add(part(G.cone4, gold, 0.05, 0.18, 0.05, 0.06 + Math.cos(a) * 0.25, 2.12, Math.sin(a) * 0.25)); }
    const armR = new T.Group(); armR.position.set(0, 1.3, 0.42); body.add(armR);
    armR.add(part(G.box, robe2, 0.2, 0.55, 0.2, 0, -0.25, 0));
    armR.add(part(G.cyl6, mat('#3a2a1a'), 0.04, 2.0, 0.04, 0.2, 0.3, 0));
    const orb = part(G.ico1, glow('#c27bff'), 0.18, 0.18, 0.18, 0.2, 1.38, 0); armR.add(orb);
    g.userData = { body, armR, orb, height: 2.3, lich: true };
    return g;
  }

  const enemyObjs = new Map();
  const iceGeo = new T.BoxGeometry(1, 1, 1);
  const iceMat = new T.MeshStandardMaterial({ color: '#bfefff', transparent: true, opacity: 0.45, roughness: 0.1, emissive: '#7fd8ff', emissiveIntensity: 0.25 });
  const slowRingGeo = new T.RingGeometry(0.5, 0.7, 16); slowRingGeo.rotateX(-Math.PI / 2);
  const slowRingMat = new T.MeshBasicMaterial({ color: '#7fd8ff', transparent: true, opacity: 0.7 });

  function addEnemy(e) {
    let g;
    if (e.type === 'dragon') g = buildDragon();
    else if (e.type === 'lich') g = buildLich();
    else g = buildHumanoid(LOOKS[e.type]);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    const root = new T.Group();
    root.add(g);
    const sc = e.def.size * 1.75;
    g.scale.setScalar(sc);
    const ice = new T.Mesh(iceGeo, iceMat);
    ice.scale.set(1.1 * sc, (g.userData.height + 0.2) * sc, 1.1 * sc);
    ice.position.y = (g.userData.height + 0.2) * sc / 2 + (e.def.fly ? 2.2 : 0);
    ice.visible = false;
    root.add(ice);
    const ring = new T.Mesh(slowRingGeo, slowRingMat);
    ring.scale.setScalar(sc); ring.position.y = 0.08; ring.visible = false;
    root.add(ring);
    root.userData = { model: g, ice, ring, sc };
    scene.add(root);
    enemyObjs.set(e, root);
  }
  function removeEnemy(e) {
    const o = enemyObjs.get(e);
    if (o) scene.remove(o);
    enemyObjs.delete(e);
  }
  function clearEnemies() { [...enemyObjs.keys()].forEach(removeEnemy); }

  // 적 머리 위 (말풍선 위치)
  function enemyHeadY(e) {
    const o = enemyObjs.get(e);
    const sc = o ? o.userData.sc : e.def.size;
    const h = o ? o.userData.model.userData.height : 1.8;
    return h * sc + (e.def.fly ? 2.4 : 0) + (e.def.float ? 0.4 : 0) + 0.25;
  }
  function enemyCenterY(e) {
    return enemyHeadY(e) * 0.55 + (e.def.fly ? 1.0 : 0);
  }

  // ---------------- 투사체 ----------------
  const projObjs = new Map();
  const arrowGeo = (() => {
    const g = new T.CylinderGeometry(0.03, 0.03, 0.9, 4); g.rotateZ(Math.PI / 2);
    return g;
  })();
  function addProjectile(p) {
    let o;
    if (p.kind === 'arrow') {
      o = new T.Group();
      o.add(mesh(arrowGeo, mat('#7a5233'), false));
      const tip = mesh(G.cone4, mat('#dde2ea'), false); tip.scale.set(0.07, 0.2, 0.07); tip.rotation.z = -Math.PI / 2; tip.position.x = 0.5; o.add(tip);
      const fl = mesh(G.box, mat('#ffffff'), false); fl.scale.set(0.18, 0.02, 0.14); fl.position.x = -0.4; o.add(fl);
    } else if (p.kind === 'ball') {
      o = mesh(G.sphere, mat('#26282c', { metalness: 0.4, roughness: 0.4 }));
      o.scale.setScalar(0.24);
    } else {
      o = mesh(G.ico1, new T.MeshBasicMaterial({ color: '#bff4ff' }), false);
      o.scale.setScalar(0.22);
      const halo = mesh(G.sphere, new T.MeshBasicMaterial({ color: '#5fd0ff', transparent: true, opacity: 0.35, depthWrite: false }), false);
      halo.scale.setScalar(1.9); o.add(halo);
    }
    scene.add(o);
    projObjs.set(p, o);
  }
  function removeProjectile(p) {
    const o = projObjs.get(p);
    if (o) scene.remove(o);
    projObjs.delete(p);
  }
  function clearProjectiles() { [...projObjs.keys()].forEach(removeProjectile); }

  // ---------------- 파티클 ----------------
  function makeParticles(max) {
    const im = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ color: '#ffffff' }), max);
    im.instanceMatrix.setUsage(T.DynamicDrawUsage);
    im.frustumCulled = false;
    const list = [];
    const zero = new T.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) { im.setMatrixAt(i, zero); im.setColorAt(i, new T.Color('#fff')); }
    scene.add(im);
    return { im, list, max, next: 0 };
  }
  const tmpC = new T.Color();
  function burst(x, y, z, n, colors, power = 1, opts = {}) {
    const P = particles;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, el = Math.random() * 1.2 + 0.2;
      const v = (2 + Math.random() * 4) * power;
      const slot = P.next; P.next = (P.next + 1) % P.max;
      P.list[slot] = {
        x, y, z,
        vx: Math.cos(a) * Math.cos(el) * v, vy: Math.sin(el) * v * (opts.up || 1), vz: Math.sin(a) * Math.cos(el) * v,
        life: 0.5 + Math.random() * 0.5, max: 1, size: (0.08 + Math.random() * 0.12) * (opts.size || 1),
        grav: opts.grav ?? -14, rot: Math.random() * 6,
      };
      P.list[slot].max = P.list[slot].life;
      tmpC.set(colors[i % colors.length]);
      P.im.setColorAt(slot, tmpC);
    }
    P.im.instanceColor.needsUpdate = true;
  }
  const pm4 = new T.Matrix4(), pq = new T.Quaternion(), pe = new T.Euler(), pp = new T.Vector3(), ps = new T.Vector3();
  function updateParticles(dt) {
    const P = particles;
    for (let i = 0; i < P.max; i++) {
      const p = P.list[i];
      if (!p) continue;
      p.life -= dt;
      if (p.life <= 0) { P.list[i] = null; P.im.setMatrixAt(i, pm4.makeScale(0, 0, 0)); continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.05) { p.y = 0.05; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      p.rot += dt * 6;
      const s = p.size * Math.min(1, p.life / p.max * 2);
      pq.setFromEuler(pe.set(p.rot, p.rot * 0.7, 0));
      P.im.setMatrixAt(i, pm4.compose(pp.set(p.x, p.y, p.z), pq, ps.set(s, s, s)));
    }
    P.im.instanceMatrix.needsUpdate = true;
  }

  // ---------------- 3D 효과 ----------------
  const boomGeo = new T.IcosahedronGeometry(1, 1);
  function explosion(x, y, z, r, color = '#ffb030') {
    const m = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false });
    const o = new T.Mesh(boomGeo, m);
    o.position.set(x, y, z); o.scale.setScalar(0.2);
    scene.add(o);
    fx.push({ o, life: 0.4, max: 0.4, r, kind: 'boom' });
    burst(x, y, z, 14, ['#ffb030', '#ff6a20', '#5a5a5a', '#fff1a0'], 1.3);
  }
  function ring(x, z, r, color) {
    const g = new T.RingGeometry(0.85, 1, 32); g.rotateX(-Math.PI / 2);
    const o = new T.Mesh(g, new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
    o.position.set(x, 0.12, z);
    scene.add(o);
    fx.push({ o, life: 0.5, max: 0.5, r, kind: 'ring' });
  }
  function meteor(x, z, delay, onHit) {
    const o = new T.Mesh(G.ico1, new T.MeshBasicMaterial({ color: '#ffb347' }));
    o.scale.setScalar(0.55);
    const core = new T.Mesh(G.ico, new T.MeshBasicMaterial({ color: '#fff3a0' })); core.scale.setScalar(0.7); o.add(core);
    o.visible = false;
    scene.add(o);
    fx.push({ o, life: 0.7 + delay, max: 0.7 + delay, delay, x, z, kind: 'meteor', onHit });
  }
  function updateFx(dt) {
    for (const f of fx) {
      f.life -= dt;
      const a = Math.max(0, f.life / f.max);
      if (f.kind === 'boom') {
        f.o.scale.setScalar(f.r * (1.1 - a * 0.8));
        f.o.material.opacity = a * 0.85;
      } else if (f.kind === 'ring') {
        f.o.scale.setScalar(f.r * (1.05 - a * 0.6));
        f.o.material.opacity = a;
      } else if (f.kind === 'meteor') {
        const p = 1 - Math.max(0, f.life) / (f.max - f.delay);
        if (p < 0) continue;
        f.o.visible = true;
        const k = Math.min(1, p);
        f.o.position.set(f.x - 9 * (1 - k), 0.5 + 22 * (1 - k), f.z - 5 * (1 - k));
        if (Math.random() < 0.7) burst(f.o.position.x, f.o.position.y, f.o.position.z, 1, ['#ffb030', '#ff6a20', '#777'], 0.3, { grav: 2 });
        if (f.life <= 0 && !f.hit) { f.hit = true; f.onHit && f.onHit(); }
      }
    }
    for (let i = fx.length - 1; i >= 0; i--) {
      if (fx[i].life <= 0 && (fx[i].kind !== 'meteor' || fx[i].hit)) { scene.remove(fx[i].o); fx.splice(i, 1); }
    }
  }
  function clearFx() { fx.forEach(f => scene.remove(f.o)); fx.length = 0; }

  // ---------------- 프레임 동기화 ----------------
  const qv = new T.Vector3();
  function sync(S, dt, time) {
    // 적
    for (const [e, o] of enemyObjs) {
      const m = o.userData.model, u = m.userData;
      o.position.set(e.x, 0, e.z);
      // 방향 (모델 정면은 +X)
      const target = Math.atan2(-e.dz, e.dx);
      let d = target - o.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      o.rotation.y += d * Math.min(1, dt * 8);
      const moving = e.frozen <= 0;
      if (u.dragon) {
        m.position.y = 2.2 + Math.sin(time * 3) * 0.25;
        const f = moving ? Math.sin(time * 9) * 0.7 : 0.2;
        u.wings.forEach(w => { w.rotation.x = f * (w.scale.z); });
        u.tail.rotation.y = Math.sin(time * 3) * 0.3;
      } else if (u.lich) {
        m.position.y = 0.4 + Math.sin(time * 2.4) * 0.15;
        u.armR.rotation.z = Math.sin(time * 2) * 0.15;
        u.orb.scale.setScalar(0.18 + Math.sin(time * 6) * 0.03);
      } else {
        const sw = moving ? Math.sin(e.phase) : 0;
        u.legs[0].rotation.z = sw * 0.7;
        u.legs[1].rotation.z = -sw * 0.7;
        u.armL.rotation.z = -sw * 0.5;
        u.armR.rotation.z = sw * 0.4 - 0.2;
        u.body.position.y = moving ? Math.abs(Math.cos(e.phase)) * 0.06 : 0;
      }
      const hit = e.hitT > 0 ? 1.15 : 1;
      m.scale.setScalar(o.userData.sc * hit);
      o.userData.ice.visible = e.frozen > 0;
      o.userData.ring.visible = e.slowT > 0 && e.frozen <= 0;
      if (o.userData.ring.visible) o.userData.ring.rotation.y = time * 2;
    }
    // 탑
    for (const [tw, g] of towerObjs) {
      if (g.userData.grow < 1) {
        g.userData.grow = Math.min(1, g.userData.grow + dt * 3);
        const k = g.userData.grow;
        g.scale.setScalar(k < 0.7 ? k / 0.7 * 1.15 : 1.15 - (k - 0.7) / 0.3 * 0.15);
      }
      const tu = g.userData.turret;
      if (g.userData.type === 'mage') {
        tu.userData.crystal.rotation.y = time * 2;
        tu.position.y = 4.1 + Math.sin(time * 2.5 + tw.slot) * 0.15;
      } else if (tw.aim !== undefined) {
        let d = tw.aim - tu.rotation.y;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        tu.rotation.y += d * Math.min(1, dt * 10);
        if (tu.userData.barrel) tu.userData.barrel.position.x = -(tw.recoil || 0) * 0.3;
      }
    }
    // 투사체
    for (const [p, o] of projObjs) {
      o.position.set(p.x, p.y, p.z);
      if (p.kind === 'arrow' && p.vx !== undefined) {
        qv.set(p.vx, p.vy, p.vz).normalize();
        o.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), qv);
      } else if (p.kind === 'ball') o.rotation.x += dt * 8;
      else o.rotation.y += dt * 6;
    }
    // 설치 칸 반짝임
    const hi = S.mode === 'prep';
    padHiMat.emissiveIntensity = 0.12 + Math.sin(time * 4) * 0.1;
    padMeshes.forEach(p => { p.material = hi ? padHiMat : padMat; });
    // 깃발 펄럭임
    castleFlags.forEach((f, k) => {
      const pa = f.geometry.attributes.position, base = f.userData.base;
      for (let i = 0; i < pa.count; i++) {
        const x = base[i * 3];
        pa.setZ(i, Math.sin(time * 6 + x * 4 + k) * 0.12 * x);
      }
      pa.needsUpdate = true;
    });
    // 성 피해 연기/불
    const hpR = S.castleHp / S.castleMax;
    if (S.mode === 'wave' && hpR < 0.5 && Math.random() < (hpR < 0.25 ? 0.5 : 0.2)) {
      burst(CASTLE.x + (Math.random() - 0.5) * 4, 3 + Math.random() * 2, CASTLE.z + (Math.random() - 0.5) * 6, 1,
        hpR < 0.25 ? ['#ff8a2a', '#ffcf4a', '#555'] : ['#777', '#999'], 0.25, { grav: 3, size: 2 });
    }
    updateParticles(dt);
    updateFx(dt);
  }

  // ---------------- 카메라 / 화면 ----------------
  const corners = [];
  [BOUNDS.x0, BOUNDS.x1].forEach(x => [BOUNDS.z0, BOUNDS.z1].forEach(z => [0, 3].forEach(y => corners.push(new T.Vector3(x, y, z)))));
  // 성 꼭대기까지 화면에 들어오도록
  // 먼 쪽 위에 문제 말풍선 자리 확보
  [BOUNDS.x0, BOUNDS.x1].forEach(x => corners.push(new T.Vector3(x, 4.5, BOUNDS.z0)));
  [[CASTLE.x - 2.5, 7, -4], [CASTLE.x - 2.5, 7, 4], [CASTLE.x + 3.5, 9, -4], [CASTLE.x + 3.5, 9, 4]].forEach(([x, y, z]) => corners.push(new T.Vector3(x, y, z)));
  const center = new T.Vector3((BOUNDS.x0 + BOUNDS.x1) / 2, 0, (BOUNDS.z0 + BOUNDS.z1) / 2);

  function resize(w, h) {
    viewW = w; viewH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    portrait = w / h < 0.95;
    const el = 54 * Math.PI / 180;
    // 세로 화면이면 성이 위쪽에 오도록 카메라를 돌린다 (킹샷 스타일)
    const dir = portrait ? new T.Vector3(-Math.cos(el), Math.sin(el), 0) : new T.Vector3(0, Math.sin(el), Math.cos(el));
    const tgt = center.clone();
    if (!portrait) tgt.z += 0.6; else tgt.x -= 0.6;
    camera.updateProjectionMatrix();
    let lo = 5, hi = 300;
    for (let i = 0; i < 30; i++) {
      const D = (lo + hi) / 2;
      camera.position.copy(tgt).addScaledVector(dir, D);
      camera.lookAt(tgt);
      camera.updateMatrixWorld();
      let ok = true;
      for (const c of corners) {
        const p = c.clone().project(camera);
        if (Math.abs(p.x) > 0.98 || Math.abs(p.y) > 0.96) { ok = false; break; }
      }
      if (ok) hi = D; else lo = D;
    }
    camera.position.copy(tgt).addScaledVector(dir, hi);
    camera.lookAt(tgt);
    camera.updateMatrixWorld();
  }

  const pv = new T.Vector3();
  function project(x, y, z) {
    pv.set(x, y, z).project(camera);
    return { x: (pv.x + 1) / 2 * viewW, y: (1 - pv.y) / 2 * viewH, behind: pv.z > 1 };
  }
  // 1월드 단위가 화면에서 몇 px인지 (대략)
  function pxPerUnit(x, z) {
    const a = project(x, 0, z), b = project(x + 1, 0, z);
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  const ray = new T.Raycaster(), plane = new T.Plane(new T.Vector3(0, 1, 0), 0), hitP = new T.Vector3();
  function pickSlot(sx, sy) {
    ray.setFromCamera(new T.Vector2(sx / viewW * 2 - 1, -(sy / viewH) * 2 + 1), camera);
    if (!ray.ray.intersectPlane(plane, hitP)) return -1;
    let best = -1, bd = 1.7;
    slots.forEach((s, i) => { const d = Math.max(Math.abs(s.x - hitP.x), Math.abs(s.z - hitP.z)); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  function render() { renderer.render(scene, camera); }

  return {
    init, resize, render, sync, project, pxPerUnit, pickSlot,
    slots, pathAt, pathLength, CASTLE, castleTop,
    addEnemy, removeEnemy, clearEnemies, enemyHeadY, enemyCenterY,
    addTower, removeTower, clearTowers, muzzle,
    addProjectile, removeProjectile, clearProjectiles,
    burst, explosion, ring, meteor, clearFx,
    buildTower, get portrait() { return portrait; },
  };
})();
