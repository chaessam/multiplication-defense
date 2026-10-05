/* 구구단 디펜스 - 3D 월드 (Three.js)
 * 맵(지형·길·설치 칸·성), 영웅, 탑·적·투사체 동기화, 파티클·효과, 낮/노을/밤, 구름·새, 날씨, 카메라 연출, 도감 초상화.
 * 좌표: XZ 평면이 땅, Y가 높이. 적은 -X(왼쪽)에서 +X(성)으로 이동.
 */
const World = (() => {
  const T = THREE;
  const { mat, glow, mesh, part, G } = Models;
  let renderer, scene, camera, sun, hemi;
  let viewW = 1, viewH = 1, portrait = false;
  const isMobile = Math.min(screen.width, screen.height) < 700;

  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  const CASTLE = { x: 20.6, z: 0 };
  // 성을 비스듬히 돌려 성문이 카메라 쪽을 보게 함
  const CASTLE_YAW = 0.55;
  const GATE_N = { x: -Math.cos(CASTLE_YAW), z: Math.sin(CASTLE_YAW) }; // 성문이 바라보는 방향
  const gateAt = d => ({ x: CASTLE.x - (2.45 + d) * Math.cos(CASTLE_YAW), z: CASTLE.z + (2.45 + d) * Math.sin(CASTLE_YAW) });
  const GATE = gateAt(0);
  const gateDir = new T.Vector3(GATE_N.x, 0.62, GATE_N.z).normalize();
  const BOUNDS = { x0: -21.5, x1: 24.5, z0: -9.6, z1: 9.6 };

  // ================= 맵 상태 =================
  let mapId = null, theme = null, curve = null, pathLength = 1;
  const LUT_N = 600;
  let lut = [];
  const slots = [];
  const heroSpot = { x: 15, z: 3 };
  let mapGroup = null, castleObj = null;
  const castleTop = new T.Vector3();
  let padMeshes = [], padMat, padHiMat;
  let lavaMats = [];

  function pathAt(t, lane = 0) {
    t = Math.max(0, Math.min(1, t));
    const f = t * LUT_N, i = Math.min(LUT_N - 1, Math.floor(f)), r = f - i;
    const a = lut[i], b = lut[i + 1];
    const x = a.x + (b.x - a.x) * r, z = a.z + (b.z - a.z) * r;
    const tx = a.tx + (b.tx - a.tx) * r, tz = a.tz + (b.tz - a.tz) * r;
    const len = Math.hypot(tx, tz) || 1;
    return { x: x + (-tz / len) * lane, z: z + (tx / len) * lane, dx: tx / len, dz: tz / len };
  }
  function distToPath(x, z) {
    let best = 1e9;
    for (let i = 0; i <= LUT_N; i += 3) best = Math.min(best, Math.hypot(lut[i].x - x, lut[i].z - z));
    return best;
  }

  // ================= 초기화 =================
  let particles;
  const fx = [];
  const enemyObjs = new Map(), towerObjs = new Map(), projObjs = new Map();
  let envGroup;

  function init(cv) {
    renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.75 : 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = isMobile ? T.PCFShadowMap : T.PCFSoftShadowMap;
    scene = new T.Scene();
    scene.background = new T.Color('#2f7f5b');
    scene.fog = new T.Fog('#2f7f5b', 70, 140);
    camera = new T.PerspectiveCamera(30, 1, 1, 400);
    hemi = new T.HemisphereLight('#fffaf0', '#4d7a5d', 1.55);
    scene.add(hemi);
    sun = new T.DirectionalLight('#fff3dc', 2.6);
    sun.position.set(-14, 34, 18);
    sun.target.position.set(2, 0, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 26, bottom: -26, near: 5, far: 90 });
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.03;
    scene.add(sun, sun.target);
    particles = makeParticles(900);
    scene.add(fireLight);
    envGroup = new T.Group();
    scene.add(envGroup);
    buildClouds();
  }

  // ================= 맵 불러오기 =================
  function loadMap(id) {
    const M = GD.MAPS[id] || GD.MAPS.forest;
    mapId = id; theme = M.theme;
    if (mapGroup) { scene.remove(mapGroup); disposeGroup(mapGroup); }
    mapGroup = new T.Group();
    scene.add(mapGroup);
    lavaMats = [];
    // 길
    // 길의 끝은 항상 성문 앞
    const end = gateAt(0.45);
    const pts = M.path.slice(0, -1).concat([[end.x, end.z]]);
    curve = new T.CatmullRomCurve3(pts.map(([x, z]) => new T.Vector3(x, 0, z)), false, 'centripetal');
    lut = [];
    for (let i = 0; i <= LUT_N; i++) {
      const u = i / LUT_N, p = curve.getPointAt(u), tg = curve.getTangentAt(u);
      lut.push({ x: p.x, z: p.z, tx: tg.x, tz: tg.z });
    }
    pathLength = curve.getLength();
    placeHero();
    makeSlots();
    buildTerrain();
    buildPath();
    buildPads();
    castleObj = Models.buildCastle(theme);
    castleObj.position.set(CASTLE.x, 0, CASTLE.z);
    castleObj.rotation.y = CASTLE_YAW;
    mapGroup.add(castleObj);
    gate.k = gate.goal = 0; castleObj.userData.updateGate(0);
    castleTop.set(CASTLE.x + 1.2, 8.5, CASTLE.z);
    buildHeroObj();
    env.cur = null;
    setTime(env.kind || 'day', true);
  }
  function disposeGroup(g) {
    g.traverse(o => {
      if (o.geometry && !Object.values(G).includes(o.geometry)) o.geometry.dispose();
    });
  }

  function placeHero() {
    const cands = [];
    // 길의 화면 아래쪽(카메라 쪽, +z)을 먼저 고른다: 적 머리 위 문제 말풍선은 위로 뜨므로 영웅을 가리지 않음
    for (const t of [0.9, 0.87, 0.93, 0.84, 0.8, 0.76]) {
      const p = pathAt(t);
      const sides = p.dx >= 0 ? [1, -1] : [-1, 1];
      for (const side of sides) cands.push({ x: p.x + (-p.dz) * 3.0 * side, z: p.z + p.dx * 3.0 * side });
    }
    cands.sort((a, b) => (b.z > 0.5 ? 1 : 0) - (a.z > 0.5 ? 1 : 0));
    const ok = cands.find(c => distToPath(c.x, c.z) >= 2.6 && Math.hypot(c.x - CASTLE.x, c.z - CASTLE.z) > 4.6 && Math.abs(c.z) < 8.6) || cands[0];
    heroSpot.x = ok.x; heroSpot.z = ok.z;
  }

  function makeSlots() {
    slots.length = 0;
    const cands = [];
    for (let u = 0.06; u <= 0.94; u += 0.014) {
      const p = pathAt(u);
      for (const side of [-1, 1]) cands.push({ x: p.x + (-p.dz) * 3.4 * side, z: p.z + p.dx * 3.4 * side });
    }
    for (const c of cands) {
      if (c.x < -18.5 || c.x > 16 || Math.abs(c.z) > 8.4) continue;
      if (distToPath(c.x, c.z) < 3.0) continue;
      if (Math.hypot(c.x - CASTLE.x, c.z - CASTLE.z) < 6) continue;
      if (Math.hypot(c.x - heroSpot.x, c.z - heroSpot.z) < 2.8) continue;
      if (slots.some(s => Math.hypot(s.x - c.x, s.z - c.z) < 3.05)) continue;
      slots.push({ x: +c.x.toFixed(2), z: +c.z.toFixed(2) });
    }
  }

  // ================= 지형 =================
  function buildTerrain() {
    const R = rng(11 + mapId.length * 7);
    const th = theme;
    const gcols = th.ground.map(h => new T.Color(h));
    const geo = new T.PlaneGeometry(220, 160, 88, 64);
    geo.rotateX(-Math.PI / 2);
    const g2 = geo.toNonIndexed();
    geo.dispose();
    const p2 = g2.attributes.position;
    const colors = [];
    for (let i = 0; i < p2.count; i += 3) {
      const r = R(), c = gcols[r < 0.4 ? 0 : r < 0.75 ? 1 : 2];
      for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b);
    }
    for (let i = 0; i < p2.count; i++) {
      const x = p2.getX(i), z = p2.getZ(i);
      const out = Math.max(0, Math.abs(z) - 13, x < -24 ? -24 - x : x > 27 ? x - 27 : 0);
      if (out > 0) p2.setY(i, Math.sin(x * 0.7) * Math.cos(z * 0.6) * Math.min(1, out * 0.15) * 0.6);
    }
    g2.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    g2.computeVertexNormals();
    const ground = new T.Mesh(g2, new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
    ground.receiveShadow = true;
    mapGroup.add(ground);

    const mesas = [];
    const gf = gateAt(3.5);
    const gateClear = (x, z, r = 0) => Math.hypot(x - gf.x, z - gf.z) > r + 5;
    const freeSpot = (x, z, r) =>
      gateClear(x, z, r) &&
      distToPath(x, z) > r + 2.6 &&
      slots.every(s => Math.hypot(s.x - x, s.z - z) > r + 2.2) &&
      Math.hypot(x - CASTLE.x, z - CASTLE.z) > r + 6 &&
      Math.hypot(x - heroSpot.x, z - heroSpot.z) > r + 2.2;
    const inPlay = (x, z) => x > BOUNDS.x0 - 1 && x < BOUNDS.x1 + 1 && z > BOUNDS.z0 - 1 && z < BOUNDS.z1 + 1;
    const entry = pathAt(0);
    for (let i = 0; i < 70; i++) {
      const x = -48 + R() * 100, z = -34 + R() * 68, r = 3 + R() * 5;
      if (inPlay(x, z) || (!freeSpot(x, z, r) && Math.abs(z) < 14)) continue;
      if (x < -20 && Math.abs(z - entry.z) < r + 3) continue;
      if (mesas.some(m => Math.hypot(m.x - x, m.z - z) < m.r + r)) continue;
      mesas.push({ x, z, r, h: 1.6 + R() * 3.2 });
    }
    for (let i = 0; i < 300 && mesas.length < 90; i++) {
      const x = BOUNDS.x0 + R() * (BOUNDS.x1 - BOUNDS.x0 - 6), z = BOUNDS.z0 + R() * (BOUNDS.z1 - BOUNDS.z0);
      const r = 1.4 + R() * 1.6;
      if (!freeSpot(x, z, r)) continue;
      if (mesas.some(m => Math.hypot(m.x - x, m.z - z) < m.r + r + 1)) continue;
      mesas.push({ x, z, r, h: 0.9 + R() * 1.2, inner: true });
    }
    const topMat = mat(th.mesaTop), sideMats = th.mesaSide.map(c => mat(c));
    for (const m of mesas) {
      const shape = new T.Shape();
      const n = 7 + Math.floor(R() * 4);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, rr = m.r * (0.75 + R() * 0.35);
        if (i === 0) shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      const eg = new T.ExtrudeGeometry(shape, { depth: m.h, bevelEnabled: false });
      eg.rotateX(-Math.PI / 2);
      const o = new T.Mesh(eg, [topMat, sideMats[Math.floor(R() * sideMats.length)]]);
      o.position.set(m.x, 0, m.z);
      o.castShadow = true; o.receiveShadow = true;
      mapGroup.add(o);
    }

    // 용암 웅덩이 (화산)
    if (th.lava) {
      for (let i = 0, made = 0; i < 400 && made < 9; i++) {
        const x = BOUNDS.x0 + R() * (BOUNDS.x1 - BOUNDS.x0 - 4), z = BOUNDS.z0 - 4 + R() * (BOUNDS.z1 - BOUNDS.z0 + 8);
        const r = 1.2 + R() * 1.8;
        if (!freeSpot(x, z, r) || mesas.some(m => Math.hypot(m.x - x, m.z - z) < m.r + r)) continue;
        const shape = new T.Shape();
        const n = 8;
        for (let k = 0; k < n; k++) {
          const a = k / n * Math.PI * 2, rr = r * (0.7 + R() * 0.4);
          if (k === 0) shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        const sg = new T.ShapeGeometry(shape); sg.rotateX(-Math.PI / 2);
        const lm = new T.MeshStandardMaterial({ color: '#ff6a1a', emissive: '#ff4a0a', emissiveIntensity: 1.2, flatShading: true, roughness: 0.6 });
        const lava = new T.Mesh(sg, lm); lava.position.set(x, 0.04, z);
        mapGroup.add(lava);
        const rim = new T.Mesh(new T.RingGeometry(r * 0.95, r * 1.25, 10).rotateX(-Math.PI / 2), mat('#2a1e1a'));
        rim.position.set(x, 0.03, z); mapGroup.add(rim);
        lavaMats.push({ m: lm, x, z, r });
        made++;
      }
    }

    // 나무 (인스턴싱)
    const trees = [];
    const treeOk = (x, z) => gateClear(x, z) && distToPath(x, z) > 2.6 && slots.every(s => Math.hypot(s.x - x, s.z - z) > 2.0) &&
      Math.hypot(x - CASTLE.x, z - CASTLE.z) > 6.5 && Math.hypot(x - heroSpot.x, z - heroSpot.z) > 2.4 &&
      !lavaMats.some(l => Math.hypot(l.x - x, l.z - z) < l.r + 0.8);
    for (let i = 0; i < 900 && trees.length < 260; i++) {
      const x = -50 + R() * 104, z = -36 + R() * 72;
      if (inPlay(x, z) && R() < 0.75) continue;
      if (!treeOk(x, z)) continue;
      if (x < -19 && Math.abs(z - entry.z) < 3) continue;
      let y = 0;
      const on = mesas.find(m => Math.hypot(m.x - x, m.z - z) < m.r * 0.6);
      if (on) y = on.h;
      else if (mesas.some(m => Math.hypot(m.x - x, m.z - z) < m.r + 0.6)) continue;
      if (trees.some(t => Math.hypot(t.x - x, t.z - z) < 1.3)) continue;
      trees.push({ x, z, y, s: 0.8 + R() * 0.7, c: R() });
    }
    buildTrees(trees, th);

    // 바위
    const rocks = [];
    for (let i = 0; i < 400 && rocks.length < 90; i++) {
      const x = -40 + R() * 84, z = -28 + R() * 56;
      if (!treeOk(x, z) || distToPath(x, z) < 2.3) continue;
      if (mesas.some(m => Math.hypot(m.x - x, m.z - z) < m.r * 0.7)) continue;
      rocks.push({ x, z, s: 0.25 + R() * 0.55, r: R() * 6 });
    }
    mesas.forEach(m => {
      for (let k = 0; k < 3; k++) {
        const a = R() * 6.28;
        rocks.push({ x: m.x + Math.cos(a) * m.r * 0.95, z: m.z + Math.sin(a) * m.r * 0.95, s: 0.3 + R() * 0.5, r: R() * 6 });
      }
    });
    const m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), ps = new T.Vector3();
    const rockIM = new T.InstancedMesh(new T.DodecahedronGeometry(1, 0), mat(th.rock), rocks.length);
    rocks.forEach((r, i) => {
      q.setFromEuler(new T.Euler(r.r, r.r * 2, 0));
      m4.compose(ps.set(r.x, r.s * 0.3, r.z), q, sc.set(r.s, r.s * 0.75, r.s));
      rockIM.setMatrixAt(i, m4);
    });
    rockIM.castShadow = true; rockIM.receiveShadow = true;
    mapGroup.add(rockIM);

    // 덤불 / 꽃
    const bushes = [];
    for (let i = 0; i < 600 && bushes.length < 140; i++) {
      const x = BOUNDS.x0 + R() * (BOUNDS.x1 - BOUNDS.x0), z = BOUNDS.z0 - 3 + R() * (BOUNDS.z1 - BOUNDS.z0 + 6);
      if (!treeOk(x, z) || distToPath(x, z) < 2.4) continue;
      if (mesas.some(m => Math.hypot(m.x - x, m.z - z) < m.r + 0.3)) continue;
      bushes.push({ x, z, s: 0.18 + R() * 0.25, f: R() });
    }
    const bushIM = new T.InstancedMesh(new T.IcosahedronGeometry(1, 0), new T.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), bushes.length);
    const bushCols = th.bush.map(h => new T.Color(h)), flowerCols = th.flower.map(h => new T.Color(h));
    bushes.forEach((b, i) => {
      const flower = b.f > 0.7;
      m4.compose(ps.set(b.x, flower ? 0.06 : b.s * 0.4, b.z), q.identity(), flower ? sc.set(0.09, 0.09, 0.09) : sc.set(b.s * 1.4, b.s, b.s * 1.4));
      bushIM.setMatrixAt(i, m4);
      bushIM.setColorAt(i, flower ? flowerCols[Math.floor(b.f * 10) % flowerCols.length] : bushCols[Math.floor(b.f * 10) % bushCols.length]);
    });
    bushIM.receiveShadow = true;
    mapGroup.add(bushIM);
  }

  function buildTrees(trees, th) {
    if (!trees.length) return;
    const m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), ps = new T.Vector3();
    const cols = th.treeCols.map(h => new T.Color(h));
    const add = im => { im.castShadow = true; im.receiveShadow = true; mapGroup.add(im); };
    const up = new T.Vector3(0, 1, 0);
    if (th.tree === 'pine' || th.tree === 'snowpine') {
      const trunkGeo = new T.CylinderGeometry(0.16, 0.22, 1, 5); trunkGeo.translate(0, 0.5, 0);
      const coneGeo = new T.ConeGeometry(1, 1, 7); coneGeo.translate(0, 0.5, 0);
      const trunkIM = new T.InstancedMesh(trunkGeo, mat(th.trunk), trees.length);
      const tiers = [[0.95, 1.5, 0.55], [0.75, 1.3, 1.35], [0.52, 1.1, 2.1]];
      const coneIMs = tiers.map(() => new T.InstancedMesh(coneGeo, new T.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), trees.length));
      const snowIM = th.tree === 'snowpine' ? new T.InstancedMesh(coneGeo, mat('#ffffff'), trees.length * 2) : null;
      trees.forEach((t, i) => {
        q.setFromAxisAngle(up, t.c * 6);
        m4.compose(ps.set(t.x, t.y, t.z), q, sc.set(t.s, t.s * 0.9, t.s)); trunkIM.setMatrixAt(i, m4);
        tiers.forEach(([r, h, y], k) => {
          m4.compose(ps.set(t.x, t.y + y * t.s, t.z), q, sc.set(r * t.s, h * t.s, r * t.s));
          coneIMs[k].setMatrixAt(i, m4);
          coneIMs[k].setColorAt(i, cols[Math.floor(t.c * 4) % 4]);
        });
        if (snowIM) {
          m4.compose(ps.set(t.x, t.y + (2.1 + 0.55) * t.s, t.z), q, sc.set(0.32 * t.s, 0.55 * t.s, 0.32 * t.s)); snowIM.setMatrixAt(i * 2, m4);
          m4.compose(ps.set(t.x, t.y + (1.35 + 0.55) * t.s, t.z), q, sc.set(0.5 * t.s, 0.45 * t.s, 0.5 * t.s)); snowIM.setMatrixAt(i * 2 + 1, m4);
        }
      });
      [trunkIM, ...coneIMs].forEach(add);
      if (snowIM) add(snowIM);
    } else if (th.tree === 'cactus') {
      const cylGeo = new T.CylinderGeometry(0.28, 0.32, 1, 7); cylGeo.translate(0, 0.5, 0);
      const capGeo = new T.SphereGeometry(0.28, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2);
      const main = new T.InstancedMesh(cylGeo, new T.MeshStandardMaterial({ flatShading: true, roughness: 0.8 }), trees.length * 3);
      const caps = new T.InstancedMesh(capGeo, new T.MeshStandardMaterial({ flatShading: true, roughness: 0.8 }), trees.length * 3);
      let n = 0;
      trees.forEach(t => {
        const c = cols[Math.floor(t.c * 4) % 4];
        const h = 2.2 * t.s;
        q.setFromAxisAngle(up, t.c * 6);
        m4.compose(ps.set(t.x, t.y, t.z), q, sc.set(t.s, h, t.s)); main.setMatrixAt(n, m4); main.setColorAt(n, c);
        m4.compose(ps.set(t.x, t.y + h, t.z), q, sc.set(t.s, t.s, t.s)); caps.setMatrixAt(n, m4); caps.setColorAt(n, c); n++;
        // 팔 두 개
        [-1, 1].forEach((s, k) => {
          const ah = (0.7 + k * 0.3) * t.s;
          const ax = t.x + Math.cos(t.c * 6) * 0.5 * s * t.s, az = t.z - Math.sin(t.c * 6) * 0.5 * s * t.s;
          const ay = t.y + h * (0.35 + k * 0.15);
          m4.compose(ps.set(ax, ay, az), q, sc.set(t.s * 0.65, ah, t.s * 0.65)); main.setMatrixAt(n, m4); main.setColorAt(n, c);
          m4.compose(ps.set(ax, ay + ah, az), q, sc.set(t.s * 0.65, t.s * 0.65, t.s * 0.65)); caps.setMatrixAt(n, m4); caps.setColorAt(n, c); n++;
        });
      });
      main.count = n; caps.count = n;
      add(main); add(caps);
    } else {
      // 죽은 나무 (화산)
      const trunkGeo = new T.CylinderGeometry(0.1, 0.25, 1, 5); trunkGeo.translate(0, 0.5, 0);
      const brGeo = new T.CylinderGeometry(0.04, 0.09, 1, 4); brGeo.translate(0, 0.5, 0);
      const trunkIM = new T.InstancedMesh(trunkGeo, mat(th.trunk), trees.length);
      const brIM = new T.InstancedMesh(brGeo, mat(th.trunk), trees.length * 3);
      const e = new T.Euler();
      trees.forEach((t, i) => {
        q.setFromAxisAngle(up, t.c * 6);
        m4.compose(ps.set(t.x, t.y, t.z), q, sc.set(t.s, 2.4 * t.s, t.s)); trunkIM.setMatrixAt(i, m4);
        for (let k = 0; k < 3; k++) {
          q.setFromEuler(e.set(0.7 * (k % 2 ? 1 : -1), t.c * 6 + k * 2, 0.6 * (k - 1)));
          m4.compose(ps.set(t.x, t.y + (1 + k * 0.45) * t.s, t.z), q, sc.set(t.s, 0.9 * t.s, t.s));
          brIM.setMatrixAt(i * 3 + k, m4);
        }
      });
      add(trunkIM); add(brIM);
    }
  }

  function ribbon(width, y, color, seed) {
    const R = rng(seed);
    const pos = [], idx = [], pts = [];
    const N = 300;
    for (let i = 0; i <= N; i++) {
      const u = i / N, p = curve.getPointAt(u), tg = curve.getTangentAt(u);
      pts.push({ x: p.x, z: p.z, tx: tg.x, tz: tg.z });
    }
    const a = pts[0];
    for (let k = 1; k <= 6; k++) pts.unshift({ x: a.x - a.tx * k * 2, z: a.z - a.tz * k * 2, tx: a.tx, tz: a.tz });
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
    mapGroup.add(ribbon(2.15, 0.03, theme.path[0], 3));
    mapGroup.add(ribbon(1.8, 0.05, theme.path[1], 5));
    const R = rng(21);
    const pebbles = [];
    for (let i = 0; i < 160; i++) pebbles.push(pathAt(R(), (R() - 0.5) * 3.2));
    const im = new T.InstancedMesh(new T.IcosahedronGeometry(0.07, 0), theme.lava ? glow(theme.pebble, 0.6) : mat(theme.pebble), pebbles.length);
    const m4 = new T.Matrix4();
    pebbles.forEach((p, i) => { m4.makeTranslation(p.x, 0.07, p.z); im.setMatrixAt(i, m4); });
    mapGroup.add(im);
  }

  // ================= 설치 칸 =================
  function roundRect(x, a, b, w, h, r) {
    x.beginPath(); x.moveTo(a + r, b);
    x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r);
    x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath();
  }
  const PAD_COL = { forest: [36, 112, 72], desert: [140, 92, 48], snow: [70, 110, 150], volcano: [110, 40, 30] };
  function padTexture(hi) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const [r, g, b] = PAD_COL[mapId] || PAD_COL.forest;
    x.fillStyle = hi ? `rgba(${r + 14},${g + 26},${b + 16},0.95)` : `rgba(${r},${g},${b},0.9)`;
    roundRect(x, 6, 6, 116, 116, 14); x.fill();
    x.strokeStyle = '#ffffff'; x.lineWidth = 6; x.setLineDash([16, 10]);
    roundRect(x, 10, 10, 108, 108, 12); x.stroke();
    x.setLineDash([]);
    x.fillStyle = hi ? '#ffe27a' : 'rgba(255,255,255,0.9)';
    x.fillRect(56, 34, 16, 60); x.fillRect(34, 56, 60, 16);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }
  function buildPads() {
    padMat = new T.MeshStandardMaterial({ map: padTexture(false), transparent: true, roughness: 1 });
    padHiMat = new T.MeshStandardMaterial({ map: padTexture(true), transparent: true, roughness: 1, emissive: '#ffd34a', emissiveIntensity: 0 });
    const geo = new T.PlaneGeometry(2.5, 2.5); geo.rotateX(-Math.PI / 2);
    padMeshes = slots.map(s => {
      const o = new T.Mesh(geo, padMat);
      o.position.set(s.x, 0.06, s.z);
      o.receiveShadow = true;
      mapGroup.add(o);
      return o;
    });
  }

  // ================= 영웅 =================
  let heroObj = null;
  const hero = { aim: Math.PI, aimGoal: Math.PI, shootT: 0, castT: 0, ultT: 0, ultDur: 1.3 };
  function buildHeroObj() {
    heroObj = new T.Group();
    const m = Models.buildHero();
    m.scale.setScalar(2.6);
    heroObj.add(m);
    // 발밑 2단 석재 받침 + 금테
    const base = new T.Mesh(new T.CylinderGeometry(1.2, 1.35, 0.22, 12), mat('#e8e2d6'));
    base.position.y = 0.11; base.receiveShadow = true; heroObj.add(base);
    const base2 = new T.Mesh(new T.CylinderGeometry(0.95, 1.05, 0.16, 12), mat('#f4efe4'));
    base2.position.y = 0.3; base2.receiveShadow = true; heroObj.add(base2);
    const trim = new T.Mesh(new T.CylinderGeometry(1.36, 1.36, 0.06, 24), mat('#f4c247', { metalness: 0.5, roughness: 0.35 }));
    trim.position.y = 0.2; heroObj.add(trim);
    const ring = new T.Mesh(new T.RingGeometry(1.45, 1.7, 32).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.7, depthWrite: false }));
    ring.position.y = 0.25; heroObj.add(ring);
    // 회전하는 마법진 + 빛기둥 (멀리서도 영웅이 보이게)
    const rune = new T.Group(); rune.position.y = 0.4; heroObj.add(rune);
    const runeMat = new T.MeshBasicMaterial({ color: '#7fe3ff', transparent: true, opacity: 0.55, depthWrite: false, side: T.DoubleSide });
    rune.add(new T.Mesh(new T.RingGeometry(0.8, 0.88, 32).rotateX(-Math.PI / 2), runeMat));
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      const d = new T.Mesh(new T.PlaneGeometry(0.16, 0.16).rotateX(-Math.PI / 2), runeMat);
      d.position.set(Math.cos(a) * 1.08, 0, Math.sin(a) * 1.08); d.rotation.y = a + Math.PI / 4; rune.add(d);
    }
    const beam = new T.Mesh(new T.CylinderGeometry(0.75, 1.0, 5.5, 16, 1, true), new T.MeshBasicMaterial({ color: '#ffe680', transparent: true, opacity: 0.12, depthWrite: false, side: T.DoubleSide }));
    beam.position.y = 2.95; heroObj.add(beam);
    // 머리 위 금빛 별 표식
    const mark = new T.Mesh(new T.OctahedronGeometry(0.28, 0), new T.MeshBasicMaterial({ color: '#ffd23f' }));
    mark.position.y = 5.3; heroObj.add(mark);
    heroObj.userData = { model: m, ring, rune, beam, mark };
    m.position.y = 0.38;
    heroObj.position.set(heroSpot.x, 0, heroSpot.z);
    // 처음엔 길 쪽을 바라봄
    const p = pathAt(0.8);
    hero.aim = hero.aimGoal = Math.atan2(-(p.z - heroSpot.z), p.x - heroSpot.x);
    mapGroup.add(heroObj);
  }
  function heroAim(x, z) { hero.aimGoal = Math.atan2(-(z - heroSpot.z), x - heroSpot.x); }
  function heroShoot(x, z) { heroAim(x, z); hero.shootT = 0.25; }
  function heroCast(x, z) { heroAim(x, z); hero.castT = 0.4; }
  function heroUlt() { hero.ultT = hero.ultDur; }
  const mv = new T.Vector3();
  function heroMuzzle() {
    const u = heroObj && heroObj.userData.model.userData;
    if (u && u.nock) { u.nock.children[1].getWorldPosition(mv); return { x: mv.x, y: mv.y, z: mv.z }; }
    return { x: heroSpot.x + Math.cos(hero.aim) * 1.1, y: 3.2, z: heroSpot.z - Math.sin(hero.aim) * 1.1 };
  }
  function syncHero(dt, time, gauge) {
    if (!heroObj) return;
    let d = hero.aimGoal - hero.aim;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    hero.aim += d * Math.min(1, dt * 10);
    const m = heroObj.userData.model, u = m.userData;
    m.rotation.y = hero.aim;
    hero.shootT = Math.max(0, hero.shootT - dt);
    hero.castT = Math.max(0, hero.castT - dt);
    // 기본 자세: 석궁을 앞으로 겨눔
    let arm = 1.35, armL = 0.9, y = 0.38, spin = 0;
    u.body.position.y = Math.sin(time * 2.2) * 0.03;
    if (hero.shootT > 0) arm = 1.35 + hero.shootT * 1.2;
    if (hero.castT > 0) { arm = 2.7; armL = 2.4; }
    if (hero.ultT > 0) {
      hero.ultT = Math.max(0, hero.ultT - dt);
      const p = 1 - hero.ultT / hero.ultDur;
      y = 0.38 + Math.sin(Math.min(1, p * 1.4) * Math.PI) * 3.2;
      spin = p < 0.7 ? p / 0.7 * Math.PI * 4 : 0;
      arm = 2.9; armL = 2.9;
    }
    u.armR.rotation.z = arm;
    u.armL.rotation.z = armL;
    u.legs[0].rotation.z = u.legs[1].rotation.z = 0;
    m.position.y = y;
    m.rotation.y = hero.aim + spin;
    if (u.cape) u.cape.rotation.z = -0.15 - Math.sin(time * 3) * 0.06;
    if (u.nock) {
      // 시위에 건 불화살: 쏜 직후 잠깐 비었다가 다시 걸림, 촉에서 불꽃이 피어오름
      u.nock.visible = hero.shootT <= 0.05;
      if (u.nock.visible && Math.random() < dt * 14) { const m = heroMuzzle(); flame(m.x, m.y, m.z, { vx: rs(0.2), vy: 0.8, vz: rs(0.2), life: 0.35, size: 0.32, grow: -0.2 }); }
    }
    const hu = heroObj.userData;
    hu.rune.rotation.y = time * 0.8;
    hu.rune.children[0].material.opacity = 0.35 + gauge * 0.35;
    hu.beam.material.opacity = 0.07 + gauge * 0.1 + (gauge >= 1 ? 0.06 + Math.sin(time * 6) * 0.04 : 0);
    hu.mark.position.y = 5.3 + Math.sin(time * 2.5) * 0.15 + (hero.ultT > 0 ? 3 : 0);
    hu.mark.rotation.y = time * 2;
    const ring = heroObj.userData.ring;
    ring.material.opacity = 0.35 + gauge * 0.5 + (gauge >= 1 ? Math.sin(time * 8) * 0.2 : 0);
    ring.scale.setScalar(1 + (gauge >= 1 ? Math.sin(time * 6) * 0.06 : 0));
    ring.material.color.set(gauge >= 1 ? '#fff07a' : '#ffd23f');
    if (gauge >= 1 && Math.random() < 0.3) burst(heroSpot.x + (Math.random() - 0.5) * 1.6, 0.4, heroSpot.z + (Math.random() - 0.5) * 1.6, 1, ['#ffe14a', '#ffffff'], 0.3, { grav: 5 });
  }

  // ================= 탑 =================
  function addTower(tw) {
    const s = slots[tw.slot];
    const g = Models.buildTower(tw.type, tw.lvl || 1);
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
    if (padMeshes[tw.slot]) padMeshes[tw.slot].visible = true;
  }
  function upgradeTower(tw) {
    const old = towerObjs.get(tw);
    const aimY = old ? old.userData.turret.rotation.y : 0;
    if (old) scene.remove(old);
    towerObjs.delete(tw);
    addTower(tw);
    const g = towerObjs.get(tw);
    g.userData.turret.rotation.y = aimY;
    const s = slots[tw.slot];
    const evo = (tw.lvl || 1) >= 3;
    pillar(s.x, s.z, evo ? '#ffe14a' : '#9fe6ff', evo ? 7 : 4);
    ring(s.x, s.z, evo ? 3.2 : 2.2, evo ? '#ffe14a' : '#9fe6ff');
    burst(s.x, 1.5, s.z, evo ? 50 : 24, evo ? ['#ffe14a', '#ffffff', '#ffb030'] : ['#9fe6ff', '#ffffff'], evo ? 1.6 : 1, { grav: -3 });
  }
  function clearTowers() { [...towerObjs.keys()].forEach(removeTower); }
  function muzzle(tw) {
    const s = slots[tw.slot];
    return { x: s.x, y: towerObjs.get(tw)?.userData.muzzleY || 2.5, z: s.z };
  }

  // ================= 적 =================
  const iceGeo = new T.BoxGeometry(1, 1, 1);
  const iceMat = new T.MeshStandardMaterial({ color: '#bfefff', transparent: true, opacity: 0.45, roughness: 0.1, emissive: '#7fd8ff', emissiveIntensity: 0.25 });
  const slowRingGeo = new T.RingGeometry(0.5, 0.7, 16); slowRingGeo.rotateX(-Math.PI / 2);
  const slowRingMat = new T.MeshBasicMaterial({ color: '#7fd8ff', transparent: true, opacity: 0.7 });
  const burnRingMat = new T.MeshBasicMaterial({ color: '#ff7a2a', transparent: true, opacity: 0.7 });

  function addEnemy(e) {
    const g = Models.buildEnemy(e.type);
    // 맞을 때 하얗게 번쩍이도록 재질을 적마다 복제
    const flashMats = [];
    g.traverse(o => {
      if (o.isMesh && o.material && o.material.isMeshStandardMaterial) {
        o.material = o.material.clone();
        flashMats.push({ m: o.material, e: o.material.emissive.clone(), i: o.material.emissiveIntensity });
      }
    });
    const root = new T.Group();
    root.add(g);
    const sc = e.def.size * 1.75;
    g.scale.setScalar(sc);
    const ice = new T.Mesh(iceGeo, iceMat);
    ice.scale.set(1.1 * sc, (g.userData.height + 0.2) * sc, 1.1 * sc);
    ice.position.y = (g.userData.height + 0.2) * sc / 2 + (e.def.fly ? 2.2 : 0);
    ice.visible = false;
    root.add(ice);
    const rg = new T.Mesh(slowRingGeo, slowRingMat);
    rg.scale.setScalar(sc); rg.position.y = 0.08; rg.visible = false;
    root.add(rg);
    root.userData = { model: g, ice, ring: rg, sc, flashMats, flashing: false };
    if (e.def.final) {
      const aura = new T.Mesh(new T.RingGeometry(0.7, 1.2, 24).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: '#ff2a3a', transparent: true, opacity: 0.3, depthWrite: false }));
      aura.position.y = 0.1; aura.scale.setScalar(sc * 0.9);
      root.add(aura);
      root.userData.aura = aura;
    }
    scene.add(root);
    enemyObjs.set(e, root);
  }
  function removeEnemy(e) {
    const o = enemyObjs.get(e);
    if (o) { scene.remove(o); o.userData.flashMats.forEach(f => f.m.dispose()); }
    enemyObjs.delete(e);
  }
  function clearEnemies() { [...enemyObjs.keys()].forEach(removeEnemy); }
  function enemyHeadY(e) {
    const o = enemyObjs.get(e);
    const sc = o ? o.userData.sc : e.def.size;
    const h = o ? o.userData.model.userData.height : 1.8;
    return h * sc + (e.def.fly ? 2.4 : 0) + (e.def.float ? 0.4 : 0) + 0.25;
  }
  function enemyCenterY(e) { return enemyHeadY(e) * 0.55 + (e.def.fly ? 1.0 : 0); }

  // ================= 투사체 =================
  const arrowGeo = (() => { const g = new T.CylinderGeometry(0.03, 0.03, 0.9, 4); g.rotateZ(Math.PI / 2); return g; })();
  function addProjectile(p) {
    let o;
    if (p.kind === 'arrow' || p.kind === 'bolt') {
      o = new T.Group();
      const gold = p.kind === 'bolt';
      o.add(mesh(arrowGeo, gold ? glow('#ffd23f', 0.6) : mat('#7a5233'), false));
      const tip = mesh(G.cone4, gold ? glow('#9fe6ff', 1) : mat('#dde2ea'), false); tip.scale.set(0.07, 0.2, 0.07); tip.rotation.z = -Math.PI / 2; tip.position.x = 0.5; o.add(tip);
      const fl = mesh(G.box, mat(p.elf ? '#7dff8a' : '#ffffff'), false); fl.scale.set(0.18, 0.02, 0.14); fl.position.x = -0.4; o.add(fl);
      if (gold) o.scale.setScalar(1.4);
    } else if (p.kind === 'ball') {
      o = mesh(G.sphere, p.fire ? glow('#ff6a1a', 1.2) : mat('#26282c', { metalness: 0.4, roughness: 0.4 }));
      o.scale.setScalar(p.fire ? 0.3 : 0.24);
    } else {
      o = mesh(G.ico1, new T.MeshBasicMaterial({ color: p.arcane ? '#e6d4ff' : '#bff4ff' }), false);
      o.scale.setScalar(0.22);
      const halo = mesh(G.sphere, new T.MeshBasicMaterial({ color: p.arcane ? '#a66bff' : '#5fd0ff', transparent: true, opacity: 0.35, depthWrite: false }), false);
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

  // ================= 파티클 =================
  function makeParticles(max) {
    const im = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ color: '#ffffff' }), max);
    im.instanceMatrix.setUsage(T.DynamicDrawUsage);
    im.frustumCulled = false;
    const zero = new T.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) { im.setMatrixAt(i, zero); im.setColorAt(i, new T.Color('#fff')); }
    scene.add(im);
    return { im, list: [], max, next: 0 };
  }
  const tmpC = new T.Color();
  function burst(x, y, z, n, colors, power = 1, opts = {}) {
    const P = particles;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, el = Math.random() * 1.2 + 0.2;
      const v = (2 + Math.random() * 4) * power;
      const slot = P.next; P.next = (P.next + 1) % P.max;
      const life = (opts.life || 0.5) + Math.random() * 0.5;
      P.list[slot] = {
        x: x + (opts.spread ? (Math.random() - 0.5) * opts.spread : 0), y, z: z + (opts.spread ? (Math.random() - 0.5) * opts.spread : 0),
        vx: Math.cos(a) * Math.cos(el) * v * (opts.hv ?? 1), vy: Math.sin(el) * v * (opts.up || 1), vz: Math.sin(a) * Math.cos(el) * v * (opts.hv ?? 1),
        life, max: life, size: (0.08 + Math.random() * 0.12) * (opts.size || 1),
        grav: opts.grav ?? -14, rot: Math.random() * 6, drift: opts.drift || 0,
      };
      tmpC.set(colors[i % colors.length]);
      P.im.setColorAt(slot, tmpC);
    }
    P.im.instanceColor.needsUpdate = true;
  }
  const pm4 = new T.Matrix4(), pq = new T.Quaternion(), pe = new T.Euler(), pp = new T.Vector3(), ps = new T.Vector3();
  function updateParticles(dt, time) {
    const P = particles;
    for (let i = 0; i < P.max; i++) {
      const p = P.list[i];
      if (!p) continue;
      p.life -= dt;
      if (p.life <= 0) { P.list[i] = null; P.im.setMatrixAt(i, pm4.makeScale(0, 0, 0)); continue; }
      p.vy += p.grav * dt;
      if (p.drift) p.vx = Math.sin(time * 1.5 + i) * p.drift;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.05) { p.y = 0.05; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      p.rot += dt * 6;
      const s = p.size * Math.min(1, p.life / p.max * 2);
      pq.setFromEuler(pe.set(p.rot, p.rot * 0.7, 0));
      P.im.setMatrixAt(i, pm4.compose(pp.set(p.x, p.y, p.z), pq, ps.set(s, s, s)));
    }
    P.im.instanceMatrix.needsUpdate = true;
  }

  // ================= 3D 효과 =================
  const boomGeo = new T.IcosahedronGeometry(1, 1);
  function explosion(x, y, z, r, color = '#ffb030') {
    const o = new T.Mesh(boomGeo, new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false }));
    o.position.set(x, y, z); o.scale.setScalar(0.2);
    scene.add(o);
    fx.push({ o, life: 0.4, max: 0.4, r, kind: 'boom' });
    burst(x, y, z, 14, [color, '#ff6a20', '#5a5a5a', '#fff1a0'], 1.3);
  }
  function ring(x, z, r, color, life = 0.5) {
    const g = new T.RingGeometry(0.85, 1, 40); g.rotateX(-Math.PI / 2);
    const o = new T.Mesh(g, new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
    o.position.set(x, 0.14, z);
    scene.add(o);
    fx.push({ o, life, max: life, r, kind: 'ring' });
  }
  function pillar(x, z, color, h = 6) {
    const o = new T.Mesh(new T.CylinderGeometry(1, 1, 1, 16, 1, true), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false, side: T.DoubleSide }));
    o.position.set(x, h / 2, z);
    o.scale.set(1.2, h, 1.2);
    scene.add(o);
    fx.push({ o, life: 0.9, max: 0.9, kind: 'pillar', h });
  }
  function meteor(x, z, delay, onHit, kind = 'meteor') {
    let o;
    if (kind === 'blade') {
      o = new T.Group();
      o.add(part(G.box, glow('#fff3a0', 1.2), 0.18, 2.2, 0.05, 0, 1.1, 0));
      o.add(part(G.box, glow('#ffd23f', 0.8), 0.7, 0.14, 0.14, 0, 0, 0));
      o.rotation.x = Math.PI;
    } else {
      o = new T.Mesh(G.ico1, new T.MeshBasicMaterial({ color: '#ffb347' }));
      o.scale.setScalar(0.55);
      const core = new T.Mesh(G.ico, new T.MeshBasicMaterial({ color: '#fff3a0' })); core.scale.setScalar(0.7); o.add(core);
    }
    o.visible = false;
    scene.add(o);
    const dur = kind === 'blade' ? 0.35 : 0.7;
    fx.push({ o, life: dur + delay, max: dur + delay, delay, x, z, kind, onHit, dur });
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
      } else if (f.kind === 'pillar') {
        f.o.material.opacity = a * 0.6;
        f.o.scale.x = f.o.scale.z = 1.2 + (1 - a) * 0.8;
      } else if (f.kind === 'meteor' || f.kind === 'blade') {
        const p = 1 - Math.max(0, f.life) / f.dur;
        if (p < 0) continue;
        f.o.visible = true;
        const k = Math.min(1, p);
        if (f.kind === 'blade') {
          f.o.position.set(f.x, 0.3 + 12 * (1 - k), f.z);
          if (Math.random() < 0.6) burst(f.o.position.x, f.o.position.y + 1, f.o.position.z, 1, ['#fff3a0', '#ffd23f'], 0.2, { grav: 0 });
        } else {
          f.o.position.set(f.x - 9 * (1 - k), 0.5 + 22 * (1 - k), f.z - 5 * (1 - k));
          if (Math.random() < 0.7) burst(f.o.position.x, f.o.position.y, f.o.position.z, 1, ['#ffb030', '#ff6a20', '#777'], 0.3, { grav: 2 });
        }
        if (f.life <= 0 && !f.hit) { f.hit = true; f.onHit && f.onHit(); }
      }
    }
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      if (f.life <= 0 && ((f.kind !== 'meteor' && f.kind !== 'blade') || f.hit)) { scene.remove(f.o); fx.splice(i, 1); }
    }
  }
  function clearFx() {
    fx.forEach(f => scene.remove(f.o)); fx.length = 0;
    fireArrows.forEach(a => scene.remove(a.g)); fireArrows.length = 0;
    sweeps.forEach(w => scene.remove(w.g)); sweeps.length = 0;
    flames.forEach(f => { scene.remove(f.s); flamePool.push(f); }); flames.length = 0;
  }

  // ================= 영웅의 불화살 =================
  // 불꽃·연기 스프라이트 (부드러운 원형 텍스처)
  function softTex(stops) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    stops.forEach(([o, col]) => gr.addColorStop(o, col));
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }
  const FIRE_TEX = softTex([[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,0.85)'], [0.75, 'rgba(255,255,255,0.3)'], [1, 'rgba(255,255,255,0)']]);
  const SMOKE_TEX = softTex([[0, 'rgba(255,255,255,0.7)'], [0.6, 'rgba(255,255,255,0.25)'], [1, 'rgba(255,255,255,0)']]);
  const FIRE_COLS = ['#ffe27a', '#ffa21f', '#ff5512', '#b8200c', '#4a1408'];
  const SMOKE_COLS = ['#6a5a52', '#3a3230'];
  const flames = [], flamePool = [];
  const MAX_FLAMES = 520;
  function flame(x, y, z, o = {}) {
    let f = flamePool.pop();
    if (!f) {
      if (flames.length >= MAX_FLAMES) return;
      f = { s: new T.Sprite(new T.SpriteMaterial({ map: FIRE_TEX, transparent: true, depthWrite: false })) };
    }
    const m = f.s.material;
    m.map = o.smoke ? SMOKE_TEX : FIRE_TEX;
    m.blending = o.add ? T.AdditiveBlending : T.NormalBlending;
    m.needsUpdate = true;
    f.s.position.set(x, y, z);
    f.vx = o.vx || 0; f.vy = o.vy || 0; f.vz = o.vz || 0;
    f.life = f.max = o.life || 0.5;
    f.size = o.size || 0.5; f.grow = o.grow ?? 0.4; f.grav = o.grav || 0;
    f.cols = o.cols || (o.smoke ? SMOKE_COLS : FIRE_COLS); f.smoke = !!o.smoke;
    m.color.set(f.cols[0]); m.opacity = 1;
    f.s.scale.setScalar(f.size);
    scene.add(f.s); flames.push(f);
  }
  const fc1 = new T.Color(), fc2 = new T.Color();
  function updateFlames(dt) {
    for (let i = flames.length - 1; i >= 0; i--) {
      const f = flames[i];
      f.life -= dt;
      if (f.life <= 0) { scene.remove(f.s); flames.splice(i, 1); flamePool.push(f); continue; }
      f.vy -= f.grav * dt;
      f.s.position.x += f.vx * dt; f.s.position.y += f.vy * dt; f.s.position.z += f.vz * dt;
      const k = 1 - f.life / f.max, q = k * (f.cols.length - 1), a = Math.floor(q);
      fc1.set(f.cols[a]); fc2.set(f.cols[Math.min(a + 1, f.cols.length - 1)]);
      f.s.material.color.copy(fc1.lerp(fc2, q - a));
      f.s.material.opacity = f.smoke ? 0.45 * (1 - k) : Math.min(1, (1 - k) * 1.6);
      f.s.scale.setScalar(Math.max(0.01, f.size * (1 + f.grow * k * 3)));
    }
  }
  const rs = (a = 1) => (Math.random() - 0.5) * 2 * a;
  function fireBurst(x, y, z, n, power, size = 0.4) {
    for (let i = 0; i < n; i++) {
      const v = new T.Vector3(rs(), Math.random() * 0.9 + 0.2, rs()).normalize().multiplyScalar(power * (0.4 + Math.random() * 0.8));
      flame(x, y, z, { vx: v.x, vy: v.y, vz: v.z, life: 0.35 + Math.random() * 0.45, size, grow: -0.15, grav: 9 });
    }
  }
  const fireLight = new T.PointLight('#ff8a2a', 0, 16, 1.6);
  let fireLightT = 0, fireLightMax = 0;

  // 불화살 모델: 나무 화살대, 쇠 화살촉, 불붙은 천 뭉치, 깃 3장, 불꽃 두 겹
  function fireArrowMesh(big) {
    const g = new T.Group();
    const s = big ? 2.0 : 1.4;
    g.add(part(G.box, mat('#8d5b34'), 1.1 * s, 0.055 * s, 0.055 * s, -0.45 * s, 0, 0));
    const head = part(G.oct, mat('#c9ced6', { metalness: 0.6, roughness: 0.3 }), 0.2 * s, 0.07 * s, 0.07 * s, 0.2 * s, 0, 0); g.add(head);
    g.add(part(G.box, glow('#ff6a12', 1.4), 0.16 * s, 0.12 * s, 0.12 * s, 0.02 * s, 0, 0));
    g.add(part(G.box, glow('#ffb030', 1.2), 0.09 * s, 0.14 * s, 0.14 * s, 0.06 * s, 0, 0));
    for (let i = 0; i < 3; i++) {
      const v = part(G.box, mat(i ? '#e5483b' : '#f6eedb'), 0.26 * s, 0.015, 0.13 * s, -0.92 * s, 0, 0);
      const pivot = new T.Group(); pivot.rotation.x = i * Math.PI * 2 / 3; pivot.add(v); v.position.z = 0.06 * s; g.add(pivot);
    }
    const outer = new T.Sprite(new T.SpriteMaterial({ map: FIRE_TEX, color: '#ff7a1a', transparent: true, depthWrite: false }));
    outer.scale.setScalar(big ? 2.4 : 1.25); outer.position.x = 0.05 * s; g.add(outer);
    const inner = new T.Sprite(new T.SpriteMaterial({ map: FIRE_TEX, color: '#fff0a0', transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    inner.scale.setScalar(big ? 1.1 : 0.55); inner.position.x = 0.1 * s; g.add(inner);
    g.userData = { outer, inner, base: big ? 2.4 : 1.25 };
    if (big) {
      // 불사조: 불꽃 날개와 꼬리깃
      const wingGeo = new T.BufferGeometry();
      wingGeo.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, -1.6, 0, 0, -0.6, 0, 1.9, 0, 0, 0, -0.6, 0, 1.9, 0.4, 0, 1.2], 3));
      const wm = new T.MeshBasicMaterial({ color: '#ff7a1a', transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false });
      const wm2 = new T.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false });
      g.userData.wings = [-1, 1].map(sd => {
        const w = new T.Group(); w.scale.z = sd; w.position.x = -0.3; g.add(w);
        w.add(new T.Mesh(wingGeo, wm));
        const w2 = new T.Mesh(wingGeo, wm2); w2.scale.set(0.6, 1, 0.6); w2.position.y = 0.02; w.add(w2);
        return w;
      });
      [-0.25, 0, 0.25].forEach(z => g.add(part(G.cone4, glow('#ff5512', 1.2), 0.08, 0.9, 0.08, -2.3, 0, z).rotateZ(Math.PI / 2)));
    }
    return g;
  }
  const fireArrows = [];
  const AX = new T.Vector3(1, 0, 0);
  function arrowTarget(a) {
    const e = a.e;
    if (e && enemyObjs.has(e)) a.last.set(e.x, enemyCenterY(e), e.z);
    return a.last;
  }
  // 하늘에서 떨어지는 불화살 (필살기 불화살 비)
  function fireRain(x, z, delay, onHit, opts = {}) {
    const e = opts.e || null;
    const tx = e ? e.x : x, tz = e ? e.z : z;
    const from = new T.Vector3(tx - 5 + rs(2), 20 + Math.random() * 4, tz - 3 + rs(2));
    const a = {
      e, g: fireArrowMesh(!!opts.big), big: !!opts.big, rain: true,
      from, prev: from.clone(), last: new T.Vector3(tx, e ? enemyCenterY(e) : 0.3, tz),
      side: 0, arc: 0, t: -delay / 0.45, dur: 0.45, onHit, small: !onHit,
    };
    a.g.visible = false;
    scene.add(a.g);
    fireArrows.push(a);
  }
  // 거대한 불사조가 성에서 길 끝까지 길을 따라 날며 불바다를 만듦
  const sweeps = [];
  function phoenixSweep(dur = 1.2) {
    const g = fireArrowMesh(true);
    g.scale.setScalar(2.6);
    scene.add(g);
    sweeps.push({ g, t: 0, dur, prev: null });
  }
  function updateSweeps(dt, time) {
    for (let i = sweeps.length - 1; i >= 0; i--) {
      const w = sweeps[i];
      w.t += dt / w.dur;
      const k = Math.min(1, w.t);
      const p = pathAt(1 - k);
      const pos = new T.Vector3(p.x, 4.5 + Math.sin(k * Math.PI) * 2.5, p.z);
      if (w.prev) {
        adir.copy(pos).sub(w.prev);
        if (adir.lengthSq() > 1e-6) w.g.quaternion.setFromUnitVectors(AX, adir.normalize());
      }
      w.g.position.copy(pos);
      const u = w.g.userData;
      if (u.wings) u.wings.forEach(x => { x.rotation.x = Math.sin(time * 14) * 0.6 * x.scale.z; });
      u.outer.scale.setScalar(u.base * (0.9 + Math.sin(time * 40) * 0.12));
      // 거대한 불꽃 꼬리 + 길 위에 남는 불바다
      for (let j = 0; j < 5; j++) flame(pos.x + rs(1.2), pos.y + rs(0.8), pos.z + rs(1.2), { vx: rs(1), vy: 1 + Math.random(), vz: rs(1), life: 0.35 + Math.random() * 0.3, size: 1.4 + Math.random(), grow: -0.1 });
      for (let j = 0; j < 2; j++) flame(p.x + rs(1.4), 0.3, p.z + rs(1.4), { vy: 1.2 + Math.random() * 1.2, life: 1.2 + Math.random() * 0.9, size: 0.9 + Math.random() * 0.6, grow: -0.25 });
      if (Math.random() < 0.6) flame(pos.x, pos.y, pos.z, { vy: 1.5, life: 1.0, size: 1.6, grow: 0.6, smoke: true });
      fireLight.position.set(pos.x, pos.y, pos.z); fireLightT = 0.3; fireLightMax = 60;
      w.prev = pos;
      if (w.t >= 1) { scene.remove(w.g); sweeps.splice(i, 1); }
    }
  }
  // tier: 'arrow' 한 발 / 'volley' 세 발 / 'phoenix' 불사조. 마지막 화살이 꽂힐 때 onHit(위치)
  function fireArrow(e, tier, onHit) {
    const n = tier === 'volley' ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const from = heroMuzzle();
      const a = {
        e, g: fireArrowMesh(tier === 'phoenix'), big: tier === 'phoenix',
        from: new T.Vector3(from.x, from.y, from.z), prev: new T.Vector3(from.x, from.y, from.z), last: new T.Vector3(e.x, enemyCenterY(e), e.z),
        side: n > 1 ? (i - 1) : 0, arc: 1 + i * 0.12, t: -i * 0.09, onHit: i === n - 1 ? onHit : null,
      };
      const d = a.from.distanceTo(a.last);
      a.dur = (0.2 + d * 0.011) * (a.big ? 1.3 : 1);
      a.g.visible = a.t >= 0;
      a.g.position.copy(a.from);
      scene.add(a.g);
      fireArrows.push(a);
    }
  }
  const ap = new T.Vector3(), adir = new T.Vector3(), aside = new T.Vector3();
  function updateFireArrows(dt, time) {
    for (let i = fireArrows.length - 1; i >= 0; i--) {
      const a = fireArrows[i];
      a.t += dt / a.dur;
      if (a.t < 0) continue;
      if (!a.g.visible) {
        // 3연발: 발사 순간 영웅 위치에서 출발 (불화살 비는 하늘에서)
        if (!a.rain) { const m = heroMuzzle(); a.from.set(m.x, m.y, m.z); }
        a.prev.copy(a.from); a.g.visible = true;
      }
      const to = arrowTarget(a);
      const k = Math.min(1, a.t);
      ap.copy(a.from).lerp(to, k);
      const dist = a.from.distanceTo(to);
      ap.y += Math.sin(k * Math.PI) * (1.2 + dist * 0.07) * a.arc;
      if (a.side) {
        aside.set(-(to.z - a.from.z), 0, to.x - a.from.x).normalize();
        ap.addScaledVector(aside, Math.sin(k * Math.PI) * 1.3 * a.side);
      }
      adir.copy(ap).sub(a.prev);
      if (adir.lengthSq() > 1e-6) a.g.quaternion.setFromUnitVectors(AX, adir.normalize());
      a.g.position.copy(ap);
      const u = a.g.userData;
      u.outer.scale.setScalar(u.base * (0.9 + Math.sin(time * 40 + i) * 0.12));
      if (u.wings) u.wings.forEach(w => { w.rotation.x = Math.sin(time * 18) * 0.5 * w.scale.z; });
      // 불꽃 꼬리 + 연기
      const n = a.big ? 6 : 3;
      for (let j = 0; j < n; j++) {
        const q = j / n;
        flame(a.prev.x + (ap.x - a.prev.x) * q, a.prev.y + (ap.y - a.prev.y) * q, a.prev.z + (ap.z - a.prev.z) * q,
          { vx: rs(0.4), vy: 0.6 + Math.random() * 0.6, vz: rs(0.4), life: 0.22 + Math.random() * 0.22, size: (a.big ? 0.9 : 0.45) * (0.7 + Math.random() * 0.6), grow: -0.2 });
      }
      if (Math.random() < (a.big ? 0.8 : 0.3)) flame(ap.x, ap.y, ap.z, { vx: rs(0.3), vy: 0.9, vz: rs(0.3), life: 0.7, size: a.big ? 0.8 : 0.5, grow: 0.5, smoke: true });
      a.prev.copy(ap);
      if (a.t >= 1) {
        scene.remove(a.g);
        fireArrows.splice(i, 1);
        fireImpact(to.x, to.y, to.z, a.big, a.small || !a.onHit);
        if (a.onHit) a.onHit({ x: to.x, y: to.y, z: to.z });
      }
    }
    fireLightT = Math.max(0, fireLightT - dt);
    fireLight.intensity = fireLightT > 0 ? fireLightMax * fireLightT / 0.3 : 0;
  }
  function fireImpact(x, y, z, big, small) {
    fireBurst(x, y, z, big ? 60 : small ? 12 : 28, big ? 9 : 6.5, big ? 0.55 : 0.4);
    flame(x, y, z, { life: 0.3, size: big ? 3.4 : small ? 1.0 : 1.7, grow: 0.5, cols: ['#ffe9a0', '#ff9a2a', '#ff4a12'] });
    flame(x, y, z, { life: 0.14, size: big ? 2.2 : 1.1, grow: 0.8, add: true, cols: ['#ffffff', '#ffd27a'] });
    for (let i = 0; i < (big ? 8 : small ? 1 : 4); i++) flame(x + rs(0.5), y, z + rs(0.5), { vx: rs(0.6), vy: 1.2, vz: rs(0.6), life: 1.0, size: big ? 1.3 : 0.8, grow: 0.6, smoke: true });
    if (!small) ring(x, z, big ? 6 : 2.6, big ? '#ff8a1a' : '#ff6a12', big ? 0.6 : 0.45);
    burst(x, y, z, big ? 16 : 6, ['#ffd23f', '#ff7a1a', '#3a2a22'], big ? 1.4 : 0.9);
    fireLight.position.set(x, y + 1, z);
    fireLightT = big ? 0.35 : 0.22; fireLightMax = big ? 70 : 30;
  }

  // ================= 환경: 낮/노을/밤, 구름, 새, 날씨 =================
  const TIMES = {
    day:    { sun: '#fff3dc', sunI: 2.6, pos: [-14, 34, 18], sky: '#fffaf0', gnd: '#4d7a5d', hemiI: 1.55, bgK: 1, tint: null, night: 0 },
    sunset: { sun: '#ffbe8a', sunI: 2.3, pos: [-30, 18, 8], sky: '#ffe2c8', gnd: '#6a5a5a', hemiI: 1.35, bgK: 0.9, tint: '#ff9a6a', night: 0.4 },
    night:  { sun: '#a8c0ff', sunI: 0.8, pos: [12, 30, -14], sky: '#6f88cc', gnd: '#1c2840', hemiI: 0.8, bgK: 0.4, tint: '#24345e', night: 1 },
  };
  const env = { kind: 'day', cur: null, from: null, to: null, k: 1, night: 0 };
  function envParams(kind) {
    const t = TIMES[kind];
    const bg = new T.Color(theme ? theme.bg : '#2f7f5b');
    if (t.tint) bg.lerp(new T.Color(t.tint), 0.5);
    bg.multiplyScalar(t.bgK);
    const sunC = new T.Color(t.sun);
    if (theme && kind === 'day') sunC.lerp(new T.Color(theme.tint), 0.5);
    return {
      sun: sunC, sunI: t.sunI * (theme ? theme.light : 1), pos: new T.Vector3(...t.pos),
      sky: new T.Color(t.sky), gnd: new T.Color(t.gnd), hemiI: t.hemiI * (theme ? theme.light : 1), bg, night: t.night,
    };
  }
  function setTime(kind, instant) {
    env.kind = kind;
    const to = envParams(kind);
    if (instant || !env.cur) { env.cur = to; env.k = 1; applyEnv(to); return; }
    env.from = env.cur; env.to = to; env.k = 0;
  }
  function applyEnv(p) {
    sun.color.copy(p.sun); sun.intensity = p.sunI; sun.position.copy(p.pos);
    hemi.color.copy(p.sky); hemi.groundColor.copy(p.gnd); hemi.intensity = p.hemiI;
    scene.background.copy(p.bg); scene.fog.color.copy(p.bg);
    env.night = p.night;
  }
  function stepEnv(dt) {
    if (env.k >= 1 || !env.to) return;
    env.k = Math.min(1, env.k + dt / 2.5);
    const a = env.from, b = env.to, k = env.k, c = {
      sun: a.sun.clone().lerp(b.sun, k), sunI: a.sunI + (b.sunI - a.sunI) * k, pos: a.pos.clone().lerp(b.pos, k),
      sky: a.sky.clone().lerp(b.sky, k), gnd: a.gnd.clone().lerp(b.gnd, k), hemiI: a.hemiI + (b.hemiI - a.hemiI) * k,
      bg: a.bg.clone().lerp(b.bg, k), night: a.night + (b.night - a.night) * k,
    };
    env.cur = c;
    applyEnv(c);
  }

  // 구름 그림자 (땅 위를 천천히 지나감)
  const clouds = [];
  function buildClouds() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.6, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const tex = new T.CanvasTexture(c);
    const R = rng(5);
    for (let i = 0; i < 6; i++) {
      const m = new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.12, depthWrite: false, color: '#0a1a20' });
      const o = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), m);
      o.scale.set(14 + R() * 12, 1, 9 + R() * 8);
      o.position.set(-45 + R() * 90, 0.2, -22 + R() * 44);
      o.renderOrder = 1;
      envGroup.add(o);
      clouds.push(o);
    }
  }
  // 새 떼 (밤에는 박쥐)
  const birdGeo = (() => {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, -0.3, 0, 0.9, 0.35, 0, 0.2], 3));
    g.computeVertexNormals();
    return g;
  })();
  const flocks = [];
  let flockTimer = 6;
  function spawnFlock() {
    const bat = env.night > 0.6;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const grp = new T.Group();
    const n = 5 + Math.floor(Math.random() * 4);
    const m = new T.MeshBasicMaterial({ color: bat ? '#1a1420' : '#2a2a30', side: T.DoubleSide });
    const birds = [];
    for (let i = 0; i < n; i++) {
      const b = new T.Group();
      const w1 = new T.Mesh(birdGeo, m), w2 = new T.Mesh(birdGeo, m);
      w2.scale.z = -1;
      b.add(w1, w2);
      b.position.set(-Math.abs(i - n / 2) * 1.2, (Math.random() - 0.5) * 0.6, (i - n / 2) * 1.1);
      b.scale.setScalar(bat ? 0.8 : 1);
      b.userData = { w1, w2, ph: Math.random() * 6 };
      grp.add(b); birds.push(b);
    }
    grp.position.set(-dir * 48, 11 + Math.random() * 4, -14 + Math.random() * 28);
    grp.rotation.y = dir > 0 ? 0 : Math.PI;
    envGroup.add(grp);
    flocks.push({ grp, birds, v: (bat ? 9 : 7) * dir, bat });
  }
  function stepBirds(dt, time) {
    flockTimer -= dt;
    if (flockTimer <= 0) { spawnFlock(); flockTimer = 16 + Math.random() * 18; }
    for (let i = flocks.length - 1; i >= 0; i--) {
      const f = flocks[i];
      f.grp.position.x += f.v * dt;
      f.grp.position.y += Math.sin(time * 0.8 + i) * dt * 0.3;
      f.birds.forEach(b => {
        const a = Math.sin(time * (f.bat ? 18 : 10) + b.userData.ph) * 0.7;
        b.userData.w1.rotation.x = a; b.userData.w2.rotation.x = -a;
      });
      if (Math.abs(f.grp.position.x) > 52) { envGroup.remove(f.grp); flocks.splice(i, 1); }
    }
  }
  function stepWeather(dt) {
    if (!theme) return;
    if (mapId === 'snow' && Math.random() < dt * 30) {
      burst(-26 + Math.random() * 54, 14, -14 + Math.random() * 28, 1, ['#ffffff', '#e8f4ff'], 0.05, { grav: -1.2, life: 6, size: 0.9, drift: 0.8, hv: 0 });
    }
    if (mapId === 'desert' && Math.random() < dt * 3) {
      burst(-24 + Math.random() * 48, 0.4, -10 + Math.random() * 20, 2, ['#e8c47e', '#d6a66c'], 0.3, { grav: 0.6, life: 1.5, size: 1.3, drift: 1.5, hv: 0.2 });
    }
    if (theme.lava) {
      lavaMats.forEach(l => {
        if (Math.random() < dt * 1.5) burst(l.x + (Math.random() - 0.5) * l.r, 0.2, l.z + (Math.random() - 0.5) * l.r, 1, ['#ffb030', '#ff6a1a', '#ffe14a'], 0.4, { grav: 3, life: 1.2, size: 0.9 });
      });
    }
  }

  // ================= 성문 =================
  const gate = { k: 0, goal: 0, shake: 0 };
  function setGate(closed, instant) {
    gate.goal = closed ? 1 : 0;
    if (instant) { gate.k = gate.goal; if (castleObj) castleObj.userData.updateGate(gate.k); }
  }
  function stepGate(dt) {
    if (!castleObj) return;
    const before = gate.k;
    if (gate.k < gate.goal) gate.k = Math.min(gate.goal, gate.k + dt * 3.2);
    else if (gate.k > gate.goal) gate.k = Math.max(gate.goal, gate.k - dt * 1.2);
    // 닫히는 순간 쿵! 먼지
    if (before < 1 && gate.k >= 1) burst(GATE.x + GATE_N.x * 0.6, 0.4, GATE.z + GATE_N.z * 0.6, 18, ['#c9b48a', '#a89a80', '#ffffff'], 0.9, { grav: -6 });
    gate.shake = Math.max(0, gate.shake - dt * 3);
    const k = gate.k + (gate.shake > 0 ? Math.sin(performance.now() / 25) * 0.05 * gate.shake : 0);
    castleObj.userData.updateGate(Math.max(0, Math.min(1.04, k)));
  }
  function gateHit() {
    gate.shake = 1;
    burst(GATE.x + GATE_N.x * 0.4, 1.2, GATE.z + GATE_N.z * 0.4, 16, ['#8a5a32', '#d3cbbd', '#ffb030'], 1.1);
  }

  // ================= 카메라 연출 =================
  const cam = { basePos: new T.Vector3(), baseTgt: new T.Vector3(), focus: new T.Vector3(), dist: 22, f: 0, goal: 0, hold: 0, dir: null, orbit: false, ang: 0, vo: 0 };
  function focusOn(x, y, z, hold = 1.6, dist = 22, opts = {}) {
    cam.focus.set(x, y, z); cam.dist = dist; cam.goal = 1; cam.hold = hold;
    cam.dir = opts.dir ? opts.dir.clone() : null;
    if (opts.instant) cam.f = 1;
  }
  // 성문 클로즈업 (게임 시작 / 웨이브 시작)
  function gateShot(hold = 0.9, dist = 13, instant = false) {
    cam.orbit = false;
    focusOn(GATE.x, 1.8, GATE.z, hold, dist, { dir: gateDir, instant });
  }
  // 처음 화면: 성문 앞을 천천히 도는 카메라
  function setTitleCam(on) {
    cam.orbit = on;
    // 바닥 아래 지점을 바라보게 해서 성이 화면 위쪽에 오도록 (아래는 타이틀 카드 자리)
    if (on) { cam.ang = 0; cam.vo = 1; focusOn(GATE.x + 0.8, 2.4, GATE.z - 0.4, 1e9, 24, { dir: gateDir, instant: true }); }
    else { cam.goal = 0; cam.hold = 0; }
  }
  function stepCamera(dt) {
    if (cam.orbit) {
      cam.ang += dt * 0.18;
      const a = Math.sin(cam.ang) * 0.55;
      cam.dir = new T.Vector3(GATE_N.x * Math.cos(a) - GATE_N.z * Math.sin(a), 0.7, GATE_N.z * Math.cos(a) + GATE_N.x * Math.sin(a)).normalize();
    }
    // 처음 화면에서는 화면 중심을 아래로 밀어 성이 위쪽에 보이게 (아래는 타이틀 카드)
    cam.vo = Math.max(0, Math.min(1, (cam.vo || 0) + (cam.orbit ? dt * 2 : -dt * 1.5)));
    if (cam.vo > 0.001) camera.setViewOffset(viewW, viewH, 0, viewH * 0.3 * cam.vo * cam.vo, viewW, viewH);
    else if (camera.view && camera.view.enabled) camera.clearViewOffset();
    if (cam.goal === 1) {
      cam.f = Math.min(1, cam.f + dt * 2.2);
      if (cam.f >= 1) { cam.hold -= dt; if (cam.hold <= 0) cam.goal = 0; }
    } else cam.f = Math.max(0, cam.f - dt * 1.4);
    const k = cam.f * cam.f * (3 - 2 * cam.f);
    if (k <= 0) { camera.position.copy(cam.basePos); camera.lookAt(cam.baseTgt); return; }
    const dir = cam.dir || cam.basePos.clone().sub(cam.baseTgt).normalize();
    const fp = cam.focus.clone().addScaledVector(dir, cam.dist);
    camera.position.copy(cam.basePos).lerp(fp, k);
    camera.lookAt(cam.baseTgt.clone().lerp(cam.focus, k));
  }
  const focusing = () => cam.f > 0.01;

  // ================= 프레임 동기화 =================
  const qv = new T.Vector3(), XV = new T.Vector3(1, 0, 0);
  function sync(S, dt, time, realDt) {
    for (const [e, o] of enemyObjs) {
      const m = o.userData.model, u = m.userData;
      o.position.set(e.x, 0, e.z);
      const target = Math.atan2(-e.dz, e.dx);
      let d = target - o.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      o.rotation.y += d * Math.min(1, dt * 8);
      const moving = e.frozen <= 0 && e.stun <= 0;
      if (u.dragon) {
        m.position.y = 2.2 + Math.sin(time * 3) * 0.25;
        const f = moving ? Math.sin(time * 9) * 0.7 : 0.2;
        u.wings.forEach(w => { w.rotation.x = f * (w.scale.z); });
        u.tail.rotation.y = Math.sin(time * 3) * 0.3;
      } else if (u.crawl) {
        // 전갈: 다리 꼼지락, 꼬리 까딱, 집게 딸깍
        u.legs.forEach((l, i) => { l.rotation.y = moving ? Math.sin(e.phase * 1.6 + i * 1.3) * 0.35 : 0; });
        u.tail.rotation.z = Math.sin(time * 3 + e.phase) * 0.12;
        u.claws.forEach((c, i) => { c.rotation.y = Math.sin(time * 4 + i * 2) * 0.2 * (i ? 1 : -1); });
        u.body.position.y = moving ? Math.abs(Math.sin(e.phase * 1.6)) * 0.03 : 0;
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
      // 맞으면 찌그러졌다 펴지고 하얗게 번쩍
      const h = Math.max(0, e.hitT);
      const sq = h > 0 ? 1 - h * 1.6 : 1;
      const wide = o.userData.sc * (1 + (1 - sq) * 0.5);
      m.scale.set(wide, o.userData.sc * sq, wide);
      if (h > 0) {
        o.userData.flashing = true;
        o.userData.flashMats.forEach(f => { f.m.emissive.setRGB(1, 1, 1); f.m.emissiveIntensity = Math.min(1, h * 9); });
      } else if (o.userData.flashing) {
        o.userData.flashing = false;
        o.userData.flashMats.forEach(f => { f.m.emissive.copy(f.e); f.m.emissiveIntensity = f.i; });
      }
      o.userData.ice.visible = e.frozen > 0;
      const rg = o.userData.ring;
      rg.visible = (e.slowT > 0 || e.burnT > 0) && e.frozen <= 0;
      if (rg.visible) { rg.material = e.burnT > 0 ? burnRingMat : slowRingMat; rg.rotation.y = time * 2; }
      if (e.burnT > 0 && Math.random() < 0.4) burst(e.x, 0.8 + Math.random(), e.z, 1, ['#ff7a2a', '#ffb030'], 0.3, { grav: 3 });
      if (e.stun > 0 && Math.random() < 0.3) burst(e.x, enemyHeadY(e), e.z, 1, ['#ffe14a', '#ffffff'], 0.2, { grav: 0 });
      if (e.exhausted) {
        // 지친 적: 비틀거림 + 머리 위 별빛
        m.rotation.z = Math.sin(time * 5 + e.phase) * 0.12;
        if (Math.random() < 0.18) burst(e.x, enemyHeadY(e) - 0.2, e.z, 1, ['#ffb030', '#ffe14a'], 0.15, { grav: 0, life: 0.6 });
      } else m.rotation.z = 0;
      if (o.userData.aura) {
        o.userData.aura.rotation.y = time;
        o.userData.aura.material.opacity = 0.25 + Math.sin(time * 4) * 0.1;
        if (Math.random() < 0.5) burst(e.x + (Math.random() - 0.5) * 2, 0.3, e.z + (Math.random() - 0.5) * 2, 1, ['#ff2a3a', '#7a0f1f', '#2b2236'], 0.3, { grav: 4, size: 1.6 });
      }
    }
    // 탑
    const night = env.night;
    for (const [tw, g] of towerObjs) {
      if (g.userData.grow < 1) {
        g.userData.grow = Math.min(1, g.userData.grow + realDt * 3);
        const k = g.userData.grow;
        g.scale.setScalar(k < 0.7 ? k / 0.7 * 1.15 : 1.15 - (k - 0.7) / 0.3 * 0.15);
      }
      const tu = g.userData.turret;
      if (g.userData.type === 'mage') {
        tu.userData.crystal.rotation.y = time * 2;
        tu.position.y = g.userData.muzzleY + Math.sin(time * 2.5 + tw.slot) * 0.15;
        if (tu.userData.orbit) tu.userData.orbit.rotation.y = -time * 1.5;
      } else if (tw.aim !== undefined) {
        let d = tw.aim - tu.rotation.y;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        tu.rotation.y += d * Math.min(1, dt * 10);
        if (tu.userData.barrel) tu.userData.barrel.position.x = -(tw.recoil || 0) * 0.3;
      }
      g.userData.torches.forEach(t => {
        t.visible = night > 0.3;
        if (t.visible) t.userData.torch.scale.set(1, 0.85 + Math.sin(time * 14 + tw.slot) * 0.15, 1);
      });
      if (g.userData.sparkle && Math.random() < 0.08) {
        const s = slots[tw.slot];
        burst(s.x + (Math.random() - 0.5) * 2, 1 + Math.random() * 3, s.z + (Math.random() - 0.5) * 2, 1, [g.userData.sparkle, '#ffffff'], 0.2, { grav: 1.5 });
      }
    }
    // 투사체
    for (const [p, o] of projObjs) {
      o.position.set(p.x, p.y, p.z);
      if ((p.kind === 'arrow' || p.kind === 'bolt') && p.vx !== undefined) {
        qv.set(p.vx, p.vy, p.vz).normalize();
        o.quaternion.setFromUnitVectors(XV, qv);
      } else if (p.kind === 'ball') o.rotation.x += dt * 8;
      else o.rotation.y += dt * 6;
    }
    // 설치 칸 반짝임
    const hi = S.mode === 'prep';
    padHiMat.emissiveIntensity = 0.12 + Math.sin(time * 4) * 0.1;
    padMeshes.forEach(p => { p.material = hi ? padHiMat : padMat; });
    // 성: 깃발, 횃불, 창문 불빛
    if (castleObj) {
      castleObj.userData.flags.forEach((f, k) => {
        const pa = f.geometry.attributes.position, base = f.userData.base;
        for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.sin(time * 6 + base[i * 3] * 4 + k) * 0.12 * base[i * 3]);
        pa.needsUpdate = true;
      });
      castleObj.userData.torches.forEach((t, i) => {
        t.visible = night > 0.3;
        if (t.visible) t.userData.torch.scale.set(1, 0.85 + Math.sin(time * 13 + i * 2) * 0.15, 1);
      });
      castleObj.userData.win.emissiveIntensity = night * 1.3;
    }
    const hpR = S.castleHp / S.castleMax;
    if (S.mode === 'wave' && hpR < 0.5 && Math.random() < (hpR < 0.25 ? 0.5 : 0.2)) {
      burst(CASTLE.x + (Math.random() - 0.5) * 4, 3 + Math.random() * 2, CASTLE.z + (Math.random() - 0.5) * 6, 1,
        hpR < 0.25 ? ['#ff8a2a', '#ffcf4a', '#555'] : ['#777', '#999'], 0.25, { grav: 3, size: 2 });
    }
    // 용암 일렁임
    lavaMats.forEach((l, i) => { l.m.emissiveIntensity = 1.0 + Math.sin(time * 2 + i) * 0.35; });
    // 구름
    clouds.forEach((c, i) => {
      c.position.x += realDt * (0.8 + i * 0.1);
      if (c.position.x > 50) c.position.x = -50;
      c.material.opacity = 0.12 * (1 - env.night);
    });
    syncHero(dt, time, S.heroGauge || 0);
    stepBirds(realDt, time);
    stepWeather(dt);
    stepEnv(realDt);
    stepGate(realDt);
    updateParticles(dt, time);
    updateFx(dt);
    updateFireArrows(dt, time);
    updateSweeps(dt, time);
    updateFlames(dt);
    stepCamera(realDt);
  }

  // ================= 카메라 / 화면 =================
  const corners = [];
  [BOUNDS.x0, BOUNDS.x1].forEach(x => [BOUNDS.z0, BOUNDS.z1].forEach(z => [0, 3].forEach(y => corners.push(new T.Vector3(x, y, z)))));
  [[-2.6, -3.4, 6], [-2.6, 3.4, 6], [4.3, -4.5, 8], [4.3, 4.5, 8], [1.5, 0, 9.5]].forEach(([lx, lz, y]) => {
    const c = Math.cos(CASTLE_YAW), sn = Math.sin(CASTLE_YAW);
    corners.push(new T.Vector3(CASTLE.x + lx * c + lz * sn, y, CASTLE.z - lx * sn + lz * c));
  });
  [BOUNDS.x0, BOUNDS.x1].forEach(x => corners.push(new T.Vector3(x, 4.5, BOUNDS.z0)));
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
    // 처음 화면의 화면 밀기(view offset)가 남아 있으면 맞춤 계산이 틀어져 카메라가 너무 멀어짐 → 계산 동안 끔
    const hadView = camera.view && camera.view.enabled;
    if (hadView) camera.clearViewOffset();
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
    cam.basePos.copy(camera.position); cam.baseTgt.copy(tgt);
    // 안개는 카메라 거리에 맞춰 전장 너머에서만 (전장은 늘 선명하게)
    scene.fog.near = hi + 18; scene.fog.far = hi + 90;
    if (hadView && cam.vo > 0.001) camera.setViewOffset(viewW, viewH, 0, viewH * 0.3 * cam.vo * cam.vo, viewW, viewH);
  }

  const pv = new T.Vector3();
  function project(x, y, z) {
    pv.set(x, y, z).project(camera);
    return { x: (pv.x + 1) / 2 * viewW, y: (1 - pv.y) / 2 * viewH, behind: pv.z > 1 };
  }
  const ray = new T.Raycaster(), plane = new T.Plane(new T.Vector3(0, 1, 0), 0), hitP = new T.Vector3();
  function pickSlot(sx, sy) {
    ray.setFromCamera(new T.Vector2(sx / viewW * 2 - 1, -(sy / viewH) * 2 + 1), camera);
    if (!ray.ray.intersectPlane(plane, hitP)) return -1;
    let best = -1, bd = 1.7;
    slots.forEach((s, i) => { const d = Math.max(Math.abs(s.x - hitP.x), Math.abs(s.z - hitP.z)); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  function pickHero(sx, sy) {
    const p = project(heroSpot.x, 2.2, heroSpot.z);
    return Math.hypot(p.x - sx, p.y - sy) < 48;
  }

  function render() { renderer.render(scene, camera); }

  // ================= 도감 초상화 =================
  let pr = null;
  const prCache = {};
  function portraitOf(kind, id, opts = {}) {
    const key = `${kind}:${id}:${opts.lvl || 1}:${opts.dark ? 1 : 0}`;
    if (prCache[key]) return prCache[key];
    if (!pr) {
      const c = document.createElement('canvas');
      pr = { r: new T.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true }), s: new T.Scene(), c: new T.PerspectiveCamera(28, 1, 0.1, 100) };
      pr.r.setSize(220, 220, false);
      pr.r.setPixelRatio(1);
      pr.s.add(new T.HemisphereLight('#ffffff', '#6a7a8a', 2.0));
      const d = new T.DirectionalLight('#fff3dc', 2.4); d.position.set(4, 8, 6); pr.s.add(d);
    }
    let obj;
    if (kind === 'enemy') { obj = Models.buildEnemy(id); if (id === 'dragon') obj.userData.wings.forEach(w => { w.rotation.x = 0.5 * w.scale.z; }); }
    else if (kind === 'tower') obj = Models.buildTower(id, opts.lvl || 1);
    else obj = Models.buildHero();
    if (kind === 'enemy' || kind === 'hero') obj.rotation.y = -0.6;
    pr.s.add(obj);
    const box = new T.Box3().setFromObject(obj);
    const sph = box.getBoundingSphere(new T.Sphere());
    const dir = new T.Vector3(kind === 'tower' ? 0.8 : 0.9, 0.55, 1).normalize();
    pr.c.position.copy(sph.center).addScaledVector(dir, sph.radius / Math.sin(14 * Math.PI / 180) * 0.92);
    pr.c.lookAt(sph.center);
    pr.s.overrideMaterial = opts.dark ? new T.MeshBasicMaterial({ color: '#1b2a38' }) : null;
    pr.r.render(pr.s, pr.c);
    const url = pr.r.domElement.toDataURL('image/png');
    pr.s.remove(obj);
    prCache[key] = url;
    return url;
  }

  return {
    init, loadMap, resize, render, sync, project, pickSlot, pickHero, setTime, focusOn, focusing, portraitOf,
    get slots() { return slots; }, get pathLength() { return pathLength; }, get mapId() { return mapId; }, get night() { return env.night; },
    pathAt, CASTLE, castleTop, heroSpot, GATE, setGate, gateHit, gateShot, setTitleCam,
    heroShoot, heroCast, heroUlt, heroMuzzle, fireArrow, fireRain, phoenixSweep, fireBurst,
    addEnemy, removeEnemy, clearEnemies, enemyHeadY, enemyCenterY,
    addTower, removeTower, upgradeTower, clearTowers, muzzle,
    addProjectile, removeProjectile, clearProjectiles,
    burst, explosion, ring, pillar, meteor, clearFx,
    get portrait() { return portrait; },
  };
})();
