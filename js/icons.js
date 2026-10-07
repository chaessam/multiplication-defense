/* 구구단 디펜스 - 게임 아이콘 (직접 그린 SVG, 이모지 대신 사용) */
const Icons = (() => {
  const O = '#13222f'; // 외곽선
  const sw = 'stroke="' + O + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"';
  const D = {
    coin: `<circle cx="16" cy="16" r="12" fill="#ffd23f" ${sw}/><circle cx="16" cy="16" r="8" fill="#f4b41a"/><path d="M13 11h6M16 11v10M13 21h6" stroke="#fff3b0" stroke-width="2.4" stroke-linecap="round"/>`,
    gem: `<path d="M8 6h16l5 7-13 15L3 13z" fill="#5fd3ff" ${sw}/><path d="M3 13h26M12 6l-3 7 7 15 7-15-3-7" fill="none" stroke="#c8f3ff" stroke-width="1.6"/><path d="M9 13l7 15 7-15z" fill="#2fb4ea"/>`,
    castle: `<path d="M5 28V12h4v3h3v-3h4v3h3v-3h4v3h0v-3h4v16z" fill="#d9d2c4" ${sw}/><path d="M13 28v-6a3 3 0 0 1 6 0v6z" fill="#5a3a22" ${sw}/><path d="M16 3l5 6H11z" fill="#e5483b" ${sw}/><path d="M16 9v3" ${sw}/>`,
    heart: `<path d="M16 28S4 20 4 11.5A6 6 0 0 1 16 9a6 6 0 0 1 12 2.5C28 20 16 28 16 28z" fill="#ff5a6a" ${sw}/><path d="M9 11a3 3 0 0 1 3-3" stroke="#ffd0d5" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    sword: `<path d="M24 4l4 4-14 14-4-4z" fill="#e8eef5" ${sw}/><path d="M7 17l8 8M9 23l-4 4" ${sw}/><path d="M6 16l10 10" stroke="#f4c247" stroke-width="4" stroke-linecap="round"/><path d="M6 16l10 10" ${sw} fill="none"/><circle cx="5" cy="27" r="2.5" fill="#f4c247" ${sw}/>`,
    swords: `<path d="M23 3l5 1 1 5-14 14-6-6z" fill="#e8eef5" ${sw}/><path d="M9 3l-5 1-1 5 14 14 6-6z" fill="#cfd8e3" ${sw}/><path d="M5 21l6 6M27 21l-6 6" stroke="#f4c247" stroke-width="4" stroke-linecap="round"/><circle cx="4" cy="28" r="2.4" fill="#8d5b34" ${sw}/><circle cx="28" cy="28" r="2.4" fill="#8d5b34" ${sw}/>`,
    hammer: `<path d="M6 8l8-4 6 6-8 4z" fill="#aeb8c4" ${sw}/><path d="M14 12l13 13-3 3-13-13z" fill="#a0683a" ${sw}/>`,
    anvil: `<path d="M4 9h18c0 4 3 6 7 6v3H20l2 6h3v4H7v-4h3l2-6c-5 0-8-3-8-9z" fill="#7d8796" ${sw}/><path d="M7 11h13" stroke="#b8c2cf" stroke-width="2"/>`,
    pause: `<rect x="8" y="6" width="6" height="20" rx="2" fill="#fff" ${sw}/><rect x="18" y="6" width="6" height="20" rx="2" fill="#fff" ${sw}/>`,
    play: `<path d="M10 5l17 11-17 11z" fill="#fff" ${sw}/>`,
    fast: `<path d="M4 7l12 9-12 9zM16 7l12 9-12 9z" fill="#fff" ${sw}/>`,
    sound: `<path d="M4 12h6l7-6v20l-7-6H4z" fill="#fff" ${sw}/><path d="M21 11a6 6 0 0 1 0 10M24 7a11 11 0 0 1 0 18" fill="none" ${sw}/>`,
    mute: `<path d="M4 12h6l7-6v20l-7-6H4z" fill="#fff" ${sw}/><path d="M21 12l7 8M28 12l-7 8" fill="none" ${sw}/>`,
    book: `<path d="M4 6c5-2 9-1 12 2 3-3 7-4 12-2v20c-5-2-9-1-12 2-3-3-7-4-12-2z" fill="#3f8fe0" ${sw}/><path d="M16 8v20" ${sw}/><path d="M7 10c3-1 5 0 6 1M7 14c3-1 5 0 6 1M19 11c1-1 3-2 6-1M19 15c1-1 3-2 6-1" stroke="#cfe6ff" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
    trophy: `<path d="M9 4h14v7a7 7 0 0 1-14 0z" fill="#ffd23f" ${sw}/><path d="M9 7H4c0 5 3 7 6 7M23 7h5c0 5-3 7-6 7" fill="none" ${sw}/><path d="M16 18v5M10 28h12l-2-5h-8z" fill="#f4b41a" ${sw}/><path d="M13 7v4" stroke="#fff3b0" stroke-width="2.4" stroke-linecap="round"/>`,
    star: `<path d="M16 3l4 8.5 9 1.2-6.6 6.2 1.7 9.1L16 23.6 7.9 28l1.7-9.1L3 12.7l9-1.2z" fill="#ffd23f" ${sw}/>`,
    starEmpty: `<path d="M16 3l4 8.5 9 1.2-6.6 6.2 1.7 9.1L16 23.6 7.9 28l1.7-9.1L3 12.7l9-1.2z" fill="#4a5a68" ${sw}/>`,
    wrench: `<path d="M21 4a7 7 0 0 0-6 9L5 23a3 3 0 0 0 4 4l10-10a7 7 0 0 0 9-6l-4 2-3-1-1-3 4-4c-1-.6-2-1-3-1z" fill="#b8c2cf" ${sw}/>`,
    snow: `<path d="M16 3v26M5 9.5l22 13M5 22.5l22-13" stroke="#fff" stroke-width="6" stroke-linecap="round"/><path d="M16 3v26M5 9.5l22 13M5 22.5l22-13" stroke="#7fd8ff" stroke-width="3" stroke-linecap="round"/><circle cx="16" cy="16" r="4" fill="#fff" ${sw}/>`,
    meteor: `<path d="M4 4l12 8M8 3l10 6M3 9l9 5" stroke="#ffb030" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="20" r="8" fill="#ff7a2a" ${sw}/><circle cx="18" cy="18" r="3" fill="#ffd36a"/>`,
    bow: `<path d="M8 3c12 3 18 13 21 26" fill="none" stroke="#8d5b34" stroke-width="4" stroke-linecap="round"/><path d="M8 3c12 3 18 13 21 26" fill="none" ${sw}/><path d="M8 3l21 26" stroke="#fff" stroke-width="1.4"/><path d="M5 27L22 10" ${sw}/><path d="M22 10l-1 5 4-4z" fill="#e8eef5" ${sw}/>`,
    bomb: `<circle cx="14" cy="18" r="10" fill="#3a3f47" ${sw}/><path d="M20 10l4-4" ${sw}/><path d="M25 3l2 3 3-1-2 3 2 2-3 0-1 3-1-3h-3l2-2z" fill="#ffb030"/><circle cx="10" cy="14" r="3" fill="#6b727c"/>`,
    crystal: `<path d="M16 2l8 10-8 18-8-18z" fill="#8ff0ff" ${sw}/><path d="M8 12h16M16 2v28" stroke="#d8fbff" stroke-width="1.6"/><path d="M16 12l8 0-8 18z" fill="#4fd6ff"/>`,
    crown: `<path d="M4 25l-1-15 7 6 6-10 6 10 7-6-1 15z" fill="#ffd23f" ${sw}/><circle cx="16" cy="19" r="2.4" fill="#e5483b"/><circle cx="9" cy="20" r="1.8" fill="#3f8fe0"/><circle cx="23" cy="20" r="1.8" fill="#3f8fe0"/>`,
    skull: `<path d="M16 3C9 3 5 8 5 14c0 4 2 6 4 7v5h14v-5c2-1 4-3 4-7 0-6-4-11-11-11z" fill="#efe9da" ${sw}/><circle cx="11.5" cy="14" r="3" fill="#13222f"/><circle cx="20.5" cy="14" r="3" fill="#13222f"/><path d="M14 26v-3M18 26v-3" ${sw}/>`,
    lock: `<rect x="6" y="14" width="20" height="14" rx="3" fill="#ffd23f" ${sw}/><path d="M10 14v-4a6 6 0 0 1 12 0v4" fill="none" ${sw}/><circle cx="16" cy="21" r="2" fill="#13222f"/>`,
    map: `<path d="M3 7l8-3 10 3 8-3v21l-8 3-10-3-8 3z" fill="#f3dfb0" ${sw}/><path d="M11 4v21M21 7v21" ${sw}/><path d="M6 18c3-4 7 2 10-3s6 1 9-3" stroke="#e5483b" stroke-width="2" stroke-dasharray="2 2" fill="none"/>`,
    scroll: `<path d="M8 5h17a3 3 0 0 1 0 6h-2v14a3 3 0 0 1-3 3H6a3 3 0 0 1 0-6h2z" fill="#f3dfb0" ${sw}/><path d="M12 12h8M12 16h8M12 20h5" stroke="#8a6a2a" stroke-width="2" stroke-linecap="round"/>`,
    home: `<path d="M4 15L16 4l12 11v13H20v-8h-8v8H4z" fill="#fff" ${sw}/>`,
    bolt: `<path d="M18 2L6 18h8l-3 12 15-18h-9z" fill="#ffe14a" ${sw}/>`,
    shield: `<path d="M16 3l11 4v8c0 7-5 11-11 14C10 26 5 22 5 15V7z" fill="#3f8fe0" ${sw}/><path d="M16 7v18M9 13h14" stroke="#ffd23f" stroke-width="2.4"/>`,
    // 필살기 버튼: 장궁과 불타는 화살 문장
    firearrow: `
      <path d="M7.6 26.2C2.6 18 6.8 6.8 18.4 4.2" fill="none" stroke="${O}" stroke-width="5.2" stroke-linecap="round"/>
      <path d="M7.6 26.2C2.6 18 6.8 6.8 18.4 4.2" fill="none" stroke="#a8642c" stroke-width="2.8" stroke-linecap="round"/>
      <path d="M8.2 23.4C5.6 18 7.4 10.6 14 7" fill="none" stroke="#d08a4e" stroke-width="1" stroke-linecap="round"/>
      <rect x="5.2" y="11.4" width="3.6" height="4" rx="1.2" fill="#5a3416" stroke="${O}" stroke-width="1.4" transform="rotate(28 7 13.4)"/>
      <circle cx="7.6" cy="26.2" r="1.7" fill="#ffd23f" stroke="${O}" stroke-width="1.3"/>
      <circle cx="18.4" cy="4.2" r="1.7" fill="#ffd23f" stroke="${O}" stroke-width="1.3"/>
      <path d="M7.6 26.2L18.4 4.2" stroke="#f6eedb" stroke-width="1.1"/>
      <path d="M4.6 27.4L22 10" stroke="${O}" stroke-width="3.8" stroke-linecap="round"/>
      <path d="M4.6 27.4L22 10" stroke="#e2b27a" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M2.8 25.2l3.4 3.4M4.8 23.2l3.4 3.4" stroke="${O}" stroke-width="4" stroke-linecap="round"/>
      <path d="M2.8 25.2l3.4 3.4M4.8 23.2l3.4 3.4" stroke="#e5483b" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M3.8 24.2l3.4 3.4" stroke="#f6eedb" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M25.6 2.6c3.2 2.4 5 5.8 4 9-1 3.2-4.6 4.8-7.8 3.8-1.8-.6-3.2-1.8-4-3.4 1.2.6 2.6.6 3.4.2-1.8-1.8-1.9-4.3-.4-6.4.4 1.3 1.3 2 2.3 2.2-.6-1.9.6-3.8 2.5-5.4z" fill="#e5361a" ${sw}/>
      <path d="M25.4 5.6c2 1.7 3 3.9 2.4 5.9-.6 2-2.9 3-4.9 2.4-1.2-.4-2-1.2-2.4-2.2.9.3 1.7.2 2.2-.1-1.1-1.2-1.1-2.8-.2-4.1.3.8.9 1.2 1.5 1.3-.3-1.2.4-2.3 1.4-3.2z" fill="#ff9a1f"/>
      <path d="M25 8.6c1 .9 1.5 2 1.2 3-.3 1-1.4 1.5-2.4 1.2-.6-.2-1-.6-1.2-1.1.5.1.9.1 1.1-.1-.5-.6-.5-1.4 0-2.1.2.4.5.6.8.6-.1-.6.2-1.1.5-1.5z" fill="#ffe680"/>
      <rect x="19.6" y="10.6" width="3.4" height="2.6" rx=".8" fill="#ff7a1a" stroke="${O}" stroke-width="1.2" transform="rotate(-45 21.3 11.9)"/>
      <path d="M28.6 3.2l-5.8 2.6 2.8 2.8z" fill="#e8eef5" stroke="${O}" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M27.6 3.8l-3.4 1.6" stroke="#ffffff" stroke-width=".9" stroke-linecap="round"/>
      <circle cx="17.6" cy="17.4" r="1" fill="#ff7a1a"/><circle cx="21.4" cy="18.6" r=".8" fill="#ffd23f"/><circle cx="29.2" cy="15.2" r=".7" fill="#ffd23f"/>`,
    expand: `<path d="M5 12V5h7M20 5h7v7M27 20v7h-7M12 27H5v-7" fill="none" stroke="${O}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 12V5h7M20 5h7v7M27 20v7h-7M12 27H5v-7" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    shrink: `<path d="M12 5v7H5M27 12h-7V5M20 27v-7h7M5 20h7v7" fill="none" stroke="${O}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 5v7H5M27 12h-7V5M20 27v-7h7M5 20h7v7" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    qr: `<rect x="4" y="4" width="10" height="10" rx="1.5" fill="#ffffff" ${sw}/><rect x="18" y="4" width="10" height="10" rx="1.5" fill="#ffffff" ${sw}/><rect x="4" y="18" width="10" height="10" rx="1.5" fill="#ffffff" ${sw}/><rect x="7.5" y="7.5" width="3" height="3" fill="${O}"/><rect x="21.5" y="7.5" width="3" height="3" fill="${O}"/><rect x="7.5" y="21.5" width="3" height="3" fill="${O}"/><path d="M18 18h4v4h-4zM24 18h4M24 24h4v4M18 26h3v2" fill="#ffd23f" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>`,
    hero: `<path d="M6 30c0-7 4-11 10-11s10 4 10 11z" fill="#3f6fd8" ${sw}/><circle cx="16" cy="12" r="7" fill="#f2c39c" ${sw}/><path d="M8 11c0-6 4-9 8-9s8 3 8 9l-3-2-5 2-5-2z" fill="#ffd23f" ${sw}/><circle cx="13" cy="13" r="1.2" fill="#13222f"/><circle cx="19" cy="13" r="1.2" fill="#13222f"/>`,
    card: `<rect x="6" y="3" width="20" height="26" rx="3" fill="#7b6cf0" ${sw}/><path d="M16 9l2 4 4 .5-3 3 .8 4.5L16 19l-3.8 2 .8-4.5-3-3 4-.5z" fill="#ffd23f"/>`,
    check: `<path d="M5 17l7 7L27 8" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 17l7 7L27 8" fill="none" ${sw}/>`,
    back: `<path d="M12 6h15v20H12L3 16z" fill="#fff" ${sw}/><path d="M15 12l7 8M22 12l-7 8" ${sw}/>`,
    close: `<path d="M8 8l16 16M24 8L8 24" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`,
    sun: `<circle cx="16" cy="16" r="7" fill="#ffd23f" ${sw}/><path d="M16 2v4M16 26v4M2 16h4M26 16h4M6 6l3 3M23 23l3 3M6 26l3-3M23 9l3-3" ${sw}/>`,
    moon: `<path d="M20 3a12 12 0 1 0 9 17A10 10 0 0 1 20 3z" fill="#f3e9b5" ${sw}/><circle cx="12" cy="15" r="2" fill="#d8cc8f"/>`,
    sunset: `<path d="M4 22h24" ${sw}/><path d="M8 22a8 8 0 0 1 16 0z" fill="#ff8a4a" ${sw}/><path d="M16 6v4M7 11l2 2M25 11l-2 2" ${sw}/><path d="M6 26h20" stroke="#ffb06a" stroke-width="2.4" stroke-linecap="round"/>`,
    infinity: `<path d="M9 11a5 5 0 1 0 0 10c5 0 9-10 14-10a5 5 0 1 1 0 10c-5 0-9-10-14-10z" fill="none" stroke="#fff" stroke-width="5"/><path d="M9 11a5 5 0 1 0 0 10c5 0 9-10 14-10a5 5 0 1 1 0 10c-5 0-9-10-14-10z" fill="none" ${sw}/>`,
    leaf: `<path d="M5 27C5 12 14 5 28 4c-1 14-8 23-23 23z" fill="#5cc44c" ${sw}/><path d="M5 27L20 12" ${sw}/>`,
    fire: `<path d="M16 3c2 6 9 9 9 17a9 9 0 0 1-18 0c0-5 3-7 4-10 1 3 2 4 3 4 0-4 0-7 2-11z" fill="#ff7a2a" ${sw}/><path d="M16 17c2 2 4 3 4 6a4 4 0 0 1-8 0c0-2 2-3 4-6z" fill="#ffd36a"/>`,
    medal: `<path d="M10 3h4l3 8h-4zM22 3h-4l-3 8h4z" fill="#3f8fe0" ${sw}/><circle cx="16" cy="20" r="9" fill="#ffd23f" ${sw}/><path d="M16 15l1.6 3.3 3.6.4-2.7 2.4.8 3.5L16 22.8l-3.3 1.8.8-3.5-2.7-2.4 3.6-.4z" fill="#fff3b0"/>`,
  };

  // 문서에 SVG 스프라이트 삽입
  function mount() {
    if (document.getElementById('icon-sprite')) return;
    const div = document.createElement('div');
    div.style.display = 'none';
    div.innerHTML = `<svg id="icon-sprite" xmlns="http://www.w3.org/2000/svg">${Object.entries(D).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 32 32">${v}</symbol>`).join('')}</svg>`;
    document.body.prepend(div);
  }
  // HTML 문자열
  function html(name, cls = '') {
    return `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  }
  // 캔버스용 이미지 (미리 만들어 둠)
  const imgCache = {};
  function img(name) {
    if (!imgCache[name]) {
      const im = new Image();
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="64" height="64">${D[name]}</svg>`);
      imgCache[name] = im;
    }
    return imgCache[name];
  }
  // [data-icon] 속성이 있는 요소 채우기
  function hydrate(root = document) {
    root.querySelectorAll('[data-icon]').forEach(el => {
      if (el.dataset.iconDone) return;
      el.insertAdjacentHTML('afterbegin', html(el.dataset.icon));
      el.dataset.iconDone = '1';
    });
  }
  return { mount, html, img, hydrate, names: Object.keys(D) };
})();
