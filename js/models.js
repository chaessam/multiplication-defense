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
  function buildCastle(theme) {
    const g = new T.Group();
    const stone = mat('#d3cbbd'), stone2 = mat('#b8b0a2'), roofR = mat('#d9493c'), roofB = mat('#3f78c8'), wood = mat('#8d5b34'), gold = mat('#f4c247', { metalness: 0.3, roughness: 0.5 });
    const win = new T.MeshStandardMaterial({ color: '#4a3b30', flatShading: true, emissive: '#ffb347', emissiveIntensity: 0 });
    g.add(part(G.cyl8, mat(theme.castleHill), 5.4, 0.5, 6.4, 0.6, 0.25, 0));
    g.add(part(G.box, stone, 5.2, 2.6, 7.6, 0.6, 1.3, 0));
    for (let i = 0; i < 6; i++) {
      g.add(part(G.box, stone2, 0.55, 0.5, 0.55, -1.8, 2.85, -3.2 + i * 1.28));
      g.add(part(G.box, stone2, 0.55, 0.5, 0.55, 3.0, 2.85, -3.2 + i * 1.28));
    }
    for (let i = 0; i < 4; i++) {
      g.add(part(G.box, stone2, 0.55, 0.5, 0.55, -1.0 + i * 1.2, 2.85, -3.6));
      g.add(part(G.box, stone2, 0.55, 0.5, 0.55, -1.0 + i * 1.2, 2.85, 3.6));
    }
    const torches = [];
    [[-1.9, -3.7], [-1.9, 3.7], [3.1, -3.7], [3.1, 3.7]].forEach(([x, z], i) => {
      g.add(part(G.cyl8, stone, 1.05, 4.2, 1.05, x, 2.1, z));
      g.add(part(G.cyl8, stone2, 1.25, 0.4, 1.25, x, 4.3, z));
      g.add(part(G.cone8, i < 2 ? roofR : roofB, 1.45, 2.0, 1.45, x, 5.5, z));
      g.add(part(G.box, win, 0.15, 0.55, 0.3, x - 1.02, 2.6, z));
    });
    g.add(part(G.box, mat('#e2dbcf'), 3.2, 5.2, 3.4, 1.2, 2.6, 0));
    const roof = part(G.cone4, roofR, 2.7, 2.8, 2.7, 1.2, 6.6, 0); roof.rotation.y = Math.PI / 4; g.add(roof);
    for (let i = 0; i < 3; i++) g.add(part(G.box, win, 0.15, 0.7, 0.42, -0.42, 3.4 + (i === 1 ? 0.9 : 0), -0.9 + i * 0.9));
    g.add(part(G.box, gold, 0.12, 0.6, 0.9, -0.42, 4.6, 0));
    g.add(part(G.box, stone2, 0.5, 2.4, 2.6, -2.05, 1.2, 0));
    g.add(part(G.box, mat('#4a3b30'), 0.2, 1.7, 1.7, -2.3, 0.85, 0));
    g.add(part(G.box, wood, 0.12, 1.5, 1.45, -2.38, 0.75, 0));
    for (let i = 0; i < 3; i++) g.add(part(G.box, mat('#5f4430'), 0.13, 1.5, 0.06, -2.46, 0.75, -0.45 + i * 0.45));
    // 성문 양옆 횃불
    [[-2.5, 2.0, -1.5], [-2.5, 2.0, 1.5], [-2.0, 3.4, -3.7], [-2.0, 3.4, 3.7]].forEach(([x, y, z]) => {
      const t = torch(x, y, z, 1.3); g.add(t); torches.push(t);
    });
    const flags = [];
    const flagMat = mat('#e14b3c', { side: T.DoubleSide });
    const flagMat2 = mat('#f4c247', { side: T.DoubleSide });
    [[1.2, 8.0, 0, flagMat], [-1.9, 6.5, -3.7, flagMat2], [3.1, 6.5, 3.7, flagMat2]].forEach(([x, y, z, m]) => {
      g.add(part(G.cyl6, wood, 0.05, 1.6, 0.05, x, y + 0.6, z));
      const fg = new T.PlaneGeometry(1.1, 0.6, 6, 1); fg.translate(0.55, 0, 0);
      const f = new T.Mesh(fg, m); f.position.set(x, y + 1.1, z); f.castShadow = true;
      f.userData.base = fg.attributes.position.array.slice();
      g.add(f); flags.push(f);
    });
    shadowAll(g);
    g.userData = { flags, torches, win };
    return g;
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
    hero:    { skin: '#f2c39c', armor: '#3f6fd8', legs: '#2a4a9a', helm: 'hero', weapon: 'crossbow', cape: '#e5483b', belt: '#f4c247', shield: null, hero: true },
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
    if (L.hero) {
      // 영웅 가슴 문장
      body.add(part(G.oct, mat('#f4c247', { metalness: 0.5, roughness: 0.35 }), 0.06, 0.14, 0.12, 0.36, 0.95, 0));
      body.add(part(G.cyl6, mat('#e8eef5', { metalness: 0.5, roughness: 0.35 }), 0.42, 0.14, 0.42, 0, 1.12, 0));
    }
    if (L.cape) { const cp = part(G.box, mat(L.cape), 0.08, 1.0, 1.0, -0.5, 1.05, 0); cp.rotation.z = -0.15; body.add(cp); g.userData.cape = cp; }
    const headY = bulk ? 1.65 : 1.42;
    body.add(part(G.ico1, mat(L.skin), 0.3, 0.3, 0.3, 0.02, headY, 0));
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
      // 영웅: 금빛 머리카락 + 은빛 서클릿
      body.add(part(G.halfSphere, mat('#f4c247'), 0.33, 0.32, 0.34, -0.03, headY + 0.03, 0));
      body.add(part(G.box, mat('#f4c247'), 0.2, 0.28, 0.5, -0.2, headY - 0.12, 0));
      body.add(part(G.cyl8, mat('#e8eef5', { metalness: 0.6, roughness: 0.3 }), 0.33, 0.06, 0.33, 0.02, headY + 0.12, 0));
      body.add(part(G.oct, glow('#5fd3ff'), 0.06, 0.09, 0.04, 0.33, headY + 0.13, 0));
    }
    const armGeo = new T.BoxGeometry(bulk ? 0.24 : 0.17, 0.55, bulk ? 0.24 : 0.17); armGeo.translate(0, -0.27, 0);
    const shoulderY = bulk ? 1.32 : 1.13, sz = bulk ? 0.6 : 0.43;
    const armR = new T.Group(); armR.position.set(0, shoulderY, sz); body.add(armR);
    armR.add(mesh(armGeo, mat(bulk ? L.skin : L.armor)));
    const armL = new T.Group(); armL.position.set(0, shoulderY, -sz); body.add(armL);
    armL.add(mesh(armGeo, mat(bulk ? L.skin : L.armor)));
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
    } else if (L.weapon === 'greatsword') {
      const bl = part(G.box, mat('#ff4a3a', { emissive: '#ff2a1a', emissiveIntensity: 0.9, roughness: 0.3 }), 0.12, 1.5, 0.05, 0.3, 0.85, 0); bl.rotation.z = -0.35; hand.add(bl);
      hand.add(part(G.box, mat('#f4c247'), 0.1, 0.08, 0.45, 0.04, 0.1, 0));
      hand.add(part(G.box, mat('#2a2030'), 0.07, 0.3, 0.07, -0.02, -0.08, 0));
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
      // 어깨 갑옷
      [-1, 1].forEach(sd => body.add(part(G.halfSphere, mat('#e8eef5', { metalness: 0.5, roughness: 0.35 }), 0.17, 0.14, 0.17, 0, shoulderY + 0.02, sd * sz)));
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

  function buildEnemy(type) {
    let g;
    if (type === 'dragon') g = buildDragon();
    else if (type === 'lich') g = buildLich();
    else g = buildHumanoid(LOOKS[type]);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  function buildHero() { return shadowAll(buildHumanoid(LOOKS.hero)); }

  return { mat, glow, mesh, part, G, torch, buildCastle, buildTower, buildEnemy, buildHero, LOOKS };
})();
