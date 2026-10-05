/* 구구단 디펜스 - 게임 데이터 (탑, 적, 난이도, 맵, 카드, 업적) */
const GD = (() => {
  // ---------------- 탑 (레벨 1~3, 3레벨은 진화) ----------------
  const TOWERS = {
    archer: {
      name: '궁수탑', icon: 'bow', cost: 60, range: 7.5, rate: 1.15, dmg: 14,
      desc: '빠르게 화살을 쏴서 적을 지치게 하는 기본 탑',
      levels: [
        { name: '궁수탑', desc: '나무로 지은 망루에서 궁수가 화살을 쏴요.' },
        { name: '석궁 망루', desc: '돌로 보강한 망루. 석궁병이 더 강한 화살을 쏴요.', cost: 70 },
        { name: '엘프 궁수 요새', desc: '진화! 엘프 명사수 둘이 화살을 2발씩 쏴요.', cost: 150, special: '2연발' },
      ],
    },
    cannon: {
      name: '대포', icon: 'bomb', cost: 110, range: 8.2, rate: 0.42, dmg: 40, splash: 2.4,
      desc: '폭발로 여러 적을 한꺼번에 지치게 해요',
      levels: [
        { name: '대포', desc: '돌 포대 위의 청동 대포. 폭발로 주변 적까지 공격해요.' },
        { name: '중포대', desc: '더 크고 무거운 포. 폭발이 더 강해요.', cost: 120 },
        { name: '용의 거포', desc: '진화! 쌍포에서 화염탄을 쏴요. 폭발 범위가 넓고 불이 붙어요.', cost: 240, special: '화염 폭발' },
      ],
    },
    mage: {
      name: '서리 마법탑', icon: 'crystal', cost: 90, range: 6.8, rate: 0.85, dmg: 9, slow: 0.45, slowT: 2.0,
      desc: '적을 느리게 만드는 얼음 마법',
      levels: [
        { name: '서리 마법탑', desc: '떠 있는 얼음 수정이 적을 느리게 만들어요.' },
        { name: '빙결 첨탑', desc: '수정이 커지고 둔화가 더 오래가요.', cost: 100 },
        { name: '대마법사의 탑', desc: '진화! 세 개의 수정이 두 적을 동시에 얼려요.', cost: 200, special: '2명 동시 공격' },
      ],
    },
  };
  const LV_DMG = [1, 1.7, 2.8], LV_RATE = [1, 1.1, 1.2], LV_RANGE = [1, 1.08, 1.16];

  // ---------------- 적 ----------------
  const ENEMIES = {
    goblin:  { name: '고블린', hp: 22, speed: 1.4, size: 0.85, dmg: 4, gems: 1, probs: 1,
      lore: '작고 재빠른 초록 도둑. 반짝이는 것만 보면 정신을 못 차려요. 빨리 맞히지 않으면 성까지 달려와요!' },
    soldier: { name: '병사', hp: 40, speed: 1.0, size: 1.0, dmg: 6, gems: 1, probs: 1,
      lore: '어둠의 군대 보병. 창을 들고 줄지어 행군해요. 혼자서는 약하지만 수가 많아요.' },
    knight:  { name: '기사', hp: 95, speed: 0.8, size: 1.1, dmg: 10, gems: 2, probs: 1,
      lore: '두꺼운 갑옷과 방패로 무장한 흑기사. 느리지만 화살을 잘 버텨요.' },
    ogre:    { name: '오우거', hp: 260, speed: 0.62, size: 1.5, dmg: 16, gems: 4, probs: 2,
      lore: '몽둥이를 휘두르는 거대한 괴물. 문제를 두 번 맞혀야 쓰러져요.' },
    troll:   { name: '트롤', hp: 380, speed: 0.58, size: 1.65, dmg: 20, gems: 5, probs: 3,
      lore: '산에서 내려온 푸른 트롤. 엄청 튼튼해서 문제를 세 번 맞혀야 해요.' },
    orcking: { name: '오크 대족장', hp: 1100, speed: 0.6, size: 2.0, dmg: 40, gems: 20, probs: 5, boss: true,
      lore: '뿔 투구를 쓴 오크 부족의 우두머리. 거대한 도끼 한 방이면 성벽이 흔들려요.' },
    dragon:  { name: '붉은 드래곤', hp: 1700, speed: 0.65, size: 0.85, dmg: 55, gems: 30, probs: 6, boss: true, fly: true,
      lore: '하늘을 나는 불꽃의 용. 날개를 펄럭이며 성을 향해 곧장 날아와요.' },
    lich:    { name: '해골 마왕', hp: 2400, speed: 0.58, size: 1.9, dmg: 70, gems: 40, probs: 7, boss: true, float: true,
      lore: '죽음의 마법을 다루는 해골 왕. 보랏빛 지팡이로 언데드를 부려요.' },
    demonking: { name: '마왕', hp: 3500, speed: 0.42, size: 2.3, dmg: 120, gems: 100, probs: 12, boss: true, final: true,
      lore: '모든 어둠의 군대를 이끄는 마왕. 불타는 대검을 든 최후의 적. 문제를 12번 맞혀야 쓰러뜨릴 수 있어요!' },
  };
  // 맵마다 테마에 맞는 적 (역할·능력치는 숲의 적과 같고 모습·이름만 다름)
  const ROLES = ['goblin', 'soldier', 'knight', 'ogre', 'troll'];
  const VARIANTS = {
    desert: {
      goblin: ['sandthief', '사막 도적', '터번을 두른 재빠른 도적. 굽은 칼을 들고 모래 위를 미끄러지듯 달려와요.'],
      soldier: ['mummy', '미라 병사', '피라미드에서 깨어난 미라. 붕대 사이로 초록 눈이 빛나요. 금빛 창을 들고 줄지어 걸어와요.'],
      knight: ['scorpion', '거대 전갈', '단단한 껍질로 덮인 거대 전갈. 집게를 딸깍거리며 느릿느릿 다가와요. 꼬리 독침을 조심!'],
      ogre: ['minotaur', '미노타우로스', '황소 머리를 한 거인. 코에 금 고리를 걸고 커다란 도끼를 휘둘러요. 문제를 두 번 맞혀야 해요.'],
      troll: ['sandgolem', '모래 골렘', '사막의 마법으로 움직이는 모래 바위 거인. 푸른 틈새가 빛나요. 문제를 세 번 맞혀야 해요.'],
    },
    snow: {
      goblin: ['snowgob', '눈 고블린', '털모자를 쓴 파란 고블린. 고드름 단검을 들고 눈밭을 깡충깡충 뛰어와요.'],
      soldier: ['frostbone', '얼음 해골', '얼음 왕관을 쓴 해골 병사. 차가운 푸른 눈으로 성을 노려봐요.'],
      knight: ['frostknight', '서리 기사', '얼음 갑옷을 입은 기사. 푸르게 빛나는 서리 검과 방패로 무장했어요.'],
      ogre: ['yeti', '예티', '설산에 사는 하얀 털복숭이 괴물. 거대한 고드름을 몽둥이처럼 휘둘러요. 문제를 두 번 맞혀야 해요.'],
      troll: ['icegolem', '얼음 골렘', '빙하가 깨어나 생긴 거인. 등에 얼음 수정이 솟아 있어요. 문제를 세 번 맞혀야 해요.'],
    },
    volcano: {
      goblin: ['fireimp', '불꽃 임프', '박쥐 날개와 꼬리를 단 작은 악마. 불타는 삼지창을 들고 쏜살같이 달려와요.'],
      soldier: ['ashbone', '잿빛 해골', '화산재 속에서 일어난 해골 병사. 불타는 칼과 방패를 들었어요.'],
      knight: ['obsidian', '흑요석 기사', '검은 흑요석 갑옷 틈으로 용암이 흘러요. 불꽃 검을 든 마왕의 근위대예요.'],
      ogre: ['firedemon', '화염 마귀', '머리 위로 불꽃이 타오르는 마귀. 용암 도끼를 휘둘러요. 문제를 두 번 맞혀야 해요.'],
      troll: ['lavagolem', '용암 골렘', '굳은 용암 바위로 된 거인. 몸의 틈새마다 용암이 이글거려요. 문제를 세 번 맞혀야 해요.'],
    },
  };
  Object.entries(VARIANTS).forEach(([map, v]) => ROLES.forEach(role => {
    const [id, name, lore] = v[role];
    ENEMIES[id] = Object.assign({}, ENEMIES[role], { name, lore, role, map });
  }));
  // 도감 순서: 숲 → 사막 → 설원 → 화산 → 보스
  const DEX_ENEMIES = [...ROLES, ...['desert', 'snow', 'volcano'].flatMap(m => ROLES.map(r => VARIANTS[m][r][0])), 'orcking', 'dragon', 'lich', 'demonking'];
  const BOSS_ORDER = ['orcking', 'dragon', 'lich'];
  const FINAL_WAVE = 30;

  // ---------------- 영웅 ----------------
  const HERO = {
    name: '용사 아린', range: 8.5, rate: 0.9, dmg: 18,
    lore: '왕국을 지키는 젊은 용사. 황금 석궁으로 구구단의 힘을 번개로 바꿔 쏴요. 정답을 맞힐수록 힘이 모여 필살기 "용사의 심판"을 쓸 수 있어요.',
  };

  // ---------------- 난이도 ----------------
  const DIFFS = {
    easy: {
      name: '쉬움', icon: 'leaf', desc: '구구단 연습 중인 친구에게! 적이 느리고, 단이 천천히 늘어나요. 틀리면 힌트가 나와요.',
      // 2학년 기준: 한 문제에 7~8초 걸려도 탑과 함께라면 끝까지 갈 수 있게
      spd: 0.58, spdCap: 1.3, minSpd: 0.3, hp: 0.6, iStart: 7.5, iMin: 4.4, iDec: 0.12, cBase: 5, cPer: 0.7, cMax: 20,
      gold: 1.25, castle: 150, startGold: 120, hint: true,
    },
    normal: {
      name: '보통', icon: 'swords', desc: '기본 난이도. 2단부터 시작해서 점점 어려운 단이 나와요.',
      // 한 문제 3초 안팎이면 끝까지, 느리면 중간에 막힘
      spd: 1, spdCap: 1.9, minSpd: 0.4, hp: 1, iStart: 4.0, iMin: 2.0, iDec: 0.09, cBase: 6, cPer: 1.1, cMax: 30,
      gold: 1, castle: 100, startGold: 80,
    },
    hard: {
      name: '어려움', icon: 'fire', desc: '구구단 고수 도전! 처음부터 2~9단이 모두 나오고, 적이 빠르고 튼튼해요.',
      // 한 문제 2초 안쪽의 구구단 고수용
      spd: 1.15, spdCap: 2.2, minSpd: 0.5, hp: 1.35, iStart: 2.8, iMin: 1.35, iDec: 0.07, cBase: 8, cPer: 1.3, cMax: 36,
      gold: 0.9, castle: 100, startGold: 80, allDan: true,
    },
    expert: {
      name: '매우 어려움', icon: 'skull', desc: '19단 모드! 11~19단이 나오고, 후반에는 19 × 19까지 나와요. 진짜 고수만 도전!',
      // 두 자리 곱셈은 암산이 오래 걸리므로 한 문제 시간은 길게(6.5초 → 4.2초), 대신 적이 튼튼하고 많음
      spd: 1.05, spdCap: 2.0, minSpd: 0.5, hp: 1.45, iStart: 6.5, iMin: 4.2, iDec: 0.08, cBase: 7, cPer: 1.1, cMax: 30,
      gold: 0.75, castle: 100, startGold: 90, big: true,
    },
  };

  // ---------------- 맵 ----------------
  const MAPS = {
    forest: {
      name: '초록 숲 고개', icon: 'leaf', desc: '평화롭던 숲길로 어둠의 군대가 몰려와요.',
      hp: 1, speed: 1,
      path: [[-25, -2.5], [-19, -3.2], [-14, -6.6], [-8.5, -5.6], [-5.6, -0.5], [-2, 4.6], [3.2, 5.2], [6.6, 0.6], [9.6, -5.2], [13.6, -5.4], [16.2, -1.2], [18.4, 0]],
      theme: {
        bg: '#2f7f5b', ground: ['#55b571', '#5bbb76', '#4faf6b'], path: ['#d2ae7c', '#ecd1a2'], pebble: '#c4a57a',
        mesaTop: '#55b671', mesaSide: ['#8f98a8', '#7d8696'], rock: '#9aa2ae',
        tree: 'pine', treeCols: ['#2f8f63', '#277e57', '#3a9e6c', '#22704e'], trunk: '#7a5233',
        bush: ['#3c9b5e', '#6cc77f'], flower: ['#f3d36b', '#f08aa6', '#ffffff'], castleHill: '#5cbd77',
        light: 1, tint: '#fff3dc',
      },
    },
    desert: {
      name: '타오르는 사막', icon: 'sun', desc: '뜨거운 모래 언덕 사이 구불구불한 길.',
      hp: 1.15, speed: 1.05, unlock: 'forest',
      path: [[-25, 6.5], [-18, 6.8], [-12.5, 4.5], [-12, -1], [-14, -6], [-8, -7.2], [-3, -4.5], [-2, 1.5], [1, 6.5], [6.5, 6.8], [9.5, 2], [8.5, -3.5], [11.5, -6.8], [16, -5], [17.2, -1.5], [18.4, 0]],
      theme: {
        bg: '#d9a35c', ground: ['#e8c47e', '#efcd88', '#e2bb72'], path: ['#b98550', '#d6a66c'], pebble: '#a8763f',
        mesaTop: '#e0a865', mesaSide: ['#c27a45', '#a9653a'], rock: '#c98a55',
        tree: 'cactus', treeCols: ['#4f9a4a', '#5aa852', '#3f8a3e', '#6bb35c'], trunk: '#8a6a3a',
        bush: ['#b8a05a', '#c9b06a'], flower: ['#ff7a5a', '#ffd36a', '#ffffff'], castleHill: '#e0b46e',
        light: 1.08, tint: '#ffe7c0',
      },
    },
    snow: {
      name: '얼어붙은 설원', icon: 'snow', desc: '눈보라 치는 설원. 미끄러운 얼음길을 지켜라!',
      hp: 1.3, speed: 1.1, unlock: 'desert',
      path: [[-25, -6.5], [-17, -6.8], [-11, -3.5], [-12.5, 2.5], [-8, 7], [-2, 5], [-0.5, -1], [3, -6.8], [9, -6.5], [10.5, -1], [8.5, 4.5], [12.5, 7.2], [16.5, 4.5], [18.4, 0]],
      theme: {
        bg: '#cfe2ee', ground: ['#eef5fa', '#e4eef6', '#f6fafd'], path: ['#9fb4c6', '#c4d4e2'], pebble: '#8aa0b4',
        mesaTop: '#f4f8fb', mesaSide: ['#8ea6bd', '#7b93ab'], rock: '#a9bccd',
        tree: 'snowpine', treeCols: ['#2f6f5e', '#2a6455', '#367a68', '#235a4c'], trunk: '#6b4a33',
        bush: ['#dfe9f2', '#c9dceb'], flower: ['#9fd8ff', '#ffffff', '#c8e6ff'], castleHill: '#eaf2f8',
        light: 0.95, tint: '#e6f2ff',
      },
    },
    volcano: {
      name: '불꽃 화산', icon: 'fire', desc: '용암이 흐르는 마왕의 땅. 최후의 결전!',
      hp: 1.5, speed: 1.15, unlock: 'snow',
      path: [[-25, 0.5], [-19.5, 0.5], [-16, 5.8], [-10, 7], [-7, 2.5], [-9.5, -3.5], [-5.5, -7.2], [0.5, -6], [2, -1], [-0.5, 4.5], [3.5, 7.4], [8.5, 6.2], [10.5, 1.2], [8.5, -4], [12.5, -7], [16.5, -4], [18.4, 0]],
      theme: {
        bg: '#3a2622', ground: ['#4a3a36', '#54423c', '#433430'], path: ['#7a5a4a', '#94705a'], pebble: '#ff7a2a',
        mesaTop: '#5a4640', mesaSide: ['#2e2422', '#3a2c28'], rock: '#3d302c',
        tree: 'dead', treeCols: ['#3a2c26', '#4a3830', '#2e231f', '#55402f'], trunk: '#3a2a22',
        bush: ['#5a4038', '#6a4a3e'], flower: ['#ff6a2a', '#ffb030', '#ff3b2f'], castleHill: '#5a4a44',
        light: 0.85, tint: '#ffc9a0', lava: true,
      },
    },
  };
  const MAP_ORDER = ['forest', 'desert', 'snow', 'volcano'];

  // ---------------- 웨이브 보상 카드 ----------------
  // rarity: common(일반) / rare(희귀) / epic(영웅)
  const CARDS = [
    { id: 'archer_rate', name: '궁수 연사', icon: 'bow', rarity: 'common', desc: '궁수탑 공격 속도 +20%', max: 5 },
    { id: 'cannon_power', name: '화약 강화', icon: 'bomb', rarity: 'common', desc: '대포 피해 +20%, 폭발 범위 +15%', max: 5 },
    { id: 'frost_deep', name: '혹한', icon: 'snow', rarity: 'common', desc: '마법탑 둔화 +10%p, 지속 시간 +0.6초', max: 4 },
    { id: 'gold_bag', name: '황금 주머니', icon: 'coin', rarity: 'common', desc: '즉시 골드 +(100 + 웨이브×10)', instant: true },
    { id: 'repair', name: '성벽 수리', icon: 'wrench', rarity: 'common', desc: '성 체력 50% 즉시 회복', instant: true },
    { id: 'thick_wall', name: '두꺼운 성벽', icon: 'shield', rarity: 'common', desc: '성 최대 체력 +40', max: 6 },
    { id: 'dan_treasure', name: '단 보물', icon: 'crown', rarity: 'rare', desc: '{dan}단 문제 정답 골드 2배', param: 'dan' },
    { id: 'combo_master', name: '콤보 달인', icon: 'bolt', rarity: 'rare', desc: '콤보 보너스 골드 2배, 상한 +10', max: 2 },
    { id: 'gem_mine', name: '보석 광산', icon: 'gem', rarity: 'rare', desc: '적 처치 보석 +50%', max: 3 },
    { id: 'sharp', name: '예리한 무기', icon: 'sword', rarity: 'rare', desc: '모든 탑 피해 +15%', max: 5 },
    { id: 'guild', name: '건축가 길드', icon: 'hammer', rarity: 'rare', desc: '탑 건설·레벨업 비용 -15%', max: 2 },
    { id: 'mud', name: '진흙탕', icon: 'leaf', rarity: 'rare', desc: '모든 적 이동 속도 -7%', max: 3 },
    { id: 'hero_spirit', name: '영웅의 투지', icon: 'hero', rarity: 'rare', desc: '정답 시 영웅 게이지 충전 +35%', max: 3 },
    { id: 'hero_blade', name: '영웅의 검', icon: 'swords', rarity: 'rare', desc: '영웅 공격력 +40%, 필살기 +20%', max: 4 },
    { id: 'chain', name: '연쇄 번개', icon: 'bolt', rarity: 'epic', desc: '정답 시 40% 확률로 근처 적에게 번개가 튀어요', max: 1 },
    { id: 'crit', name: '치명타', icon: 'star', rarity: 'epic', desc: '탑 공격이 15% 확률로 2배 피해', max: 2 },
    { id: 'double_gem', name: '용의 보물', icon: 'crown', rarity: 'epic', desc: '보스 처치 보석 2배, 웨이브 승리 골드 +50%', max: 1 },
  ];
  const RARITY = {
    common: { name: '일반', weight: 60, color: '#6fb6e8' },
    rare: { name: '희귀', weight: 30, color: '#a77bff' },
    epic: { name: '영웅', weight: 10, color: '#ffb02a' },
  };

  // ---------------- 업적 ----------------
  // tier: bronze / silver / gold / legend, check(p) → [현재값, 목표값]
  const ACH = [
    { id: 'first_kill', name: '첫 승리', icon: 'sword', tier: 'bronze', desc: '적을 처음으로 쓰러뜨려요', check: p => [p.totalKills, 1] },
    { id: 'kills_100', name: '병사 사냥꾼', icon: 'swords', tier: 'bronze', desc: '적 100마리 처치', check: p => [p.totalKills, 100] },
    { id: 'kills_1000', name: '백전노장', icon: 'swords', tier: 'silver', desc: '적 1,000마리 처치', check: p => [p.totalKills, 1000] },
    { id: 'kills_5000', name: '전설의 수호자', icon: 'shield', tier: 'gold', desc: '적 5,000마리 처치', check: p => [p.totalKills, 5000] },
    { id: 'correct_100', name: '구구단 새싹', icon: 'leaf', tier: 'bronze', desc: '정답 100개', check: p => [p.correct, 100] },
    { id: 'correct_1000', name: '구구단 박사', icon: 'scroll', tier: 'silver', desc: '정답 1,000개', check: p => [p.correct, 1000] },
    { id: 'correct_5000', name: '구구단 대마법사', icon: 'crystal', tier: 'gold', desc: '정답 5,000개', check: p => [p.correct, 5000] },
    { id: 'combo_10', name: '연속 공격', icon: 'bolt', tier: 'bronze', desc: '콤보 10 달성', check: p => [p.bestCombo, 10] },
    { id: 'combo_30', name: '번개 손가락', icon: 'bolt', tier: 'silver', desc: '콤보 30 달성', check: p => [p.bestCombo, 30] },
    { id: 'combo_60', name: '멈출 수 없어!', icon: 'bolt', tier: 'gold', desc: '콤보 60 달성', check: p => [p.bestCombo, 60] },
    ...[2, 3, 4, 5, 6, 7, 8, 9].map(d => ({
      id: `dan_${d}`, name: `${d}단 정복`, icon: 'medal', tier: d >= 7 ? 'silver' : 'bronze', desc: `${d}단 문제 40개 맞히기`,
      check: p => [(p.dan && p.dan[d]) || 0, 40],
    })),
    { id: 'boss_orc', name: '족장 사냥', icon: 'skull', tier: 'bronze', desc: '오크 대족장 처치', check: p => [p.kills.orcking || 0, 1] },
    { id: 'boss_dragon', name: '드래곤 슬레이어', icon: 'fire', tier: 'silver', desc: '붉은 드래곤 처치', check: p => [p.kills.dragon || 0, 1] },
    { id: 'boss_lich', name: '언데드 퇴치', icon: 'skull', tier: 'silver', desc: '해골 마왕 처치', check: p => [p.kills.lich || 0, 1] },
    { id: 'boss_demon', name: '마왕 토벌', icon: 'crown', tier: 'gold', desc: '최종 보스 마왕 처치', check: p => [p.kills.demonking || 0, 1] },
    { id: 'clear_easy', name: '첫 번째 왕관', icon: 'crown', tier: 'silver', desc: '쉬움 난이도 클리어', check: p => [p.clears.easy || 0, 1] },
    { id: 'clear_normal', name: '왕국의 영웅', icon: 'crown', tier: 'gold', desc: '보통 난이도 클리어', check: p => [p.clears.normal || 0, 1] },
    { id: 'clear_hard', name: '전설이 되다', icon: 'crown', tier: 'legend', desc: '어려움 난이도 클리어', check: p => [p.clears.hard || 0, 1] },
    { id: 'clear_expert', name: '19단의 신', icon: 'crown', tier: 'legend', desc: '매우 어려움(19단) 난이도 클리어', check: p => [p.clears.expert || 0, 1] },
    { id: 'dan_big', name: '두 자리 단 정복', icon: 'medal', tier: 'gold', desc: '11~19단 문제 200개 맞히기', check: p => [[11, 12, 13, 14, 15, 16, 17, 18, 19].reduce((s, d) => s + ((p.dan && p.dan[d]) || 0), 0), 200] },
    { id: 'dex_all', name: '몬스터 박사', icon: 'book', tier: 'gold', desc: '도감의 몬스터 24종을 모두 만나기', check: p => [DEX_ENEMIES.filter(t => p.seen && p.seen[t]).length, DEX_ENEMIES.length] },
    { id: 'all_maps', name: '세계 여행자', icon: 'map', tier: 'legend', desc: '네 개의 맵을 모두 클리어', check: p => [Object.keys(p.mapClears || {}).length, 4] },
    { id: 'stars_12', name: '별을 모으는 자', icon: 'star', tier: 'legend', desc: '모든 맵에서 별 3개 (아무 난이도)', check: p => [p.totalStars || 0, 12] },
    { id: 'build_50', name: '건축가', icon: 'hammer', tier: 'bronze', desc: '탑 50개 건설', check: p => [p.built, 50] },
    { id: 'evolve_1', name: '첫 진화', icon: 'star', tier: 'bronze', desc: '탑을 3레벨로 진화', check: p => [p.evolved, 1] },
    { id: 'evolve_all', name: '진화의 정점', icon: 'star', tier: 'silver', desc: '세 종류 탑을 모두 진화 (누적)', check: p => [Object.keys(p.evolvedTypes || {}).length, 3] },
    { id: 'ult_10', name: '용사의 심판', icon: 'hero', tier: 'silver', desc: '영웅 필살기 10번 사용', check: p => [p.ults, 10] },
    { id: 'perfect_20', name: '철벽 수비', icon: 'shield', tier: 'silver', desc: '별 3개 웨이브 20번 (성 피해 없이 승리)', check: p => [p.perfectWaves, 20] },
    { id: 'cards_30', name: '카드 수집가', icon: 'card', tier: 'bronze', desc: '보상 카드 30장 고르기', check: p => [p.cards, 30] },
    { id: 'epic_card', name: '행운의 손', icon: 'card', tier: 'silver', desc: '영웅 등급 카드 고르기', check: p => [p.epicCards || 0, 1] },
  ];
  const TIERS = {
    bronze: { name: '동', color: '#d08a4e', gems: 0 },
    silver: { name: '은', color: '#b9c6d3', gems: 0 },
    gold: { name: '금', color: '#ffd23f', gems: 0 },
    legend: { name: '전설', color: '#c27bff', gems: 0 },
  };

  // ---------------- 영구 강화 (골드) ----------------
  const UPGRADES = {
    castle: { name: '성벽 강화', icon: 'castle', base: 60, growth: 1.4, max: 20, desc: l => `최대 체력 +25 (지금 +${l * 25})` },
    archer: { name: '궁수 훈련', icon: 'bow', base: 70, growth: 1.45, max: 15, desc: l => `모든 궁수탑 피해 +25% (지금 +${l * 25}%)` },
    cannon: { name: '대포 개량', icon: 'bomb', base: 90, growth: 1.45, max: 15, desc: l => `모든 대포 피해 +25% (지금 +${l * 25}%)` },
    mage:   { name: '마법 연구', icon: 'crystal', base: 80, growth: 1.45, max: 15, desc: l => `마법탑 피해 +25%, 둔화 시간 증가 (지금 +${l * 25}%)` },
    speed:  { name: '공격 속도', icon: 'bolt', base: 100, growth: 1.55, max: 10, desc: l => `모든 탑 공격 속도 +10% (지금 +${l * 10}%)` },
    hero:   { name: '영웅 훈련', icon: 'hero', base: 90, growth: 1.5, max: 10, desc: l => `영웅 공격력 +30%, 게이지 충전 +5% (지금 +${l * 30}%)` },
    bounty: { name: '현상금', icon: 'coin', base: 80, growth: 1.5, max: 10, desc: l => `정답 골드 +15% (지금 +${l * 15}%)` },
  };

  Object.entries(VARIANTS).forEach(([m, v]) => { MAPS[m].enemies = Object.fromEntries(ROLES.map(r => [r, v[r][0]])); });
  return { TOWERS, LV_DMG, LV_RATE, LV_RANGE, ENEMIES, ROLES, VARIANTS, DEX_ENEMIES, BOSS_ORDER, FINAL_WAVE, HERO, DIFFS, MAPS, MAP_ORDER, CARDS, RARITY, ACH, TIERS, UPGRADES };
})();
