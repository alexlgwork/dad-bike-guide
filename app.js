(() => {
'use strict';
const D = window.ROUTE_DATA, C = D.centers, LM = D.landmarks, P = D.pois, SEGS = D.segs, TOTAL = D.totalKm;
const IC = window.ICONS;
const CAT = {
  0: { i: 'food', n: 'Food', ko: '식당', col: '#e8590c' }, 1: { i: 'coffee', n: 'Café', ko: '카페', col: '#8c5a2b' },
  2: { i: 'store', n: 'Convenience store', ko: '편의점', col: '#2b8a3e' }, 3: { i: 'bed', n: 'Place to stay', ko: '숙소', col: '#6741d9' },
  4: { i: 'wrench', n: 'Bike shop', ko: '자전거 수리점', col: '#0c8599' }, 5: { i: 'wc', n: 'Toilet', ko: '화장실', col: '#1c7ed6' },
  6: { i: 'star', n: 'Landmark', ko: '명소', col: '#d39e00' }, 8: { i: 'camera', n: 'Photo spot', ko: '사진 명소', col: '#c2255c' }
};
const $ = (id) => document.getElementById(id);
const ico = (n) => IC.svg(n);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('bk_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('bk_' + k, JSON.stringify(v)); } catch (e) {} }
};

// ---------- geometry ----------
const RAD = Math.PI / 180;
function hav(a1, o1, a2, o2) {
  const dl = (a2 - a1) * RAD, dn = (o2 - o1) * RAD;
  const h = Math.sin(dl / 2) ** 2 + Math.cos(a1 * RAD) * Math.cos(a2 * RAD) * Math.sin(dn / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
function bearing(a1, o1, a2, o2) {
  const y = Math.sin((o2 - o1) * RAD) * Math.cos(a2 * RAD);
  const x = Math.cos(a1 * RAD) * Math.sin(a2 * RAD) - Math.sin(a1 * RAD) * Math.cos(a2 * RAD) * Math.cos((o2 - o1) * RAD);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}
const DIRS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
const SHORT = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const card8 = (b) => Math.round(b / 45) % 8;
const fmtD = (km) => km < 1 ? (Math.max(10, Math.round(km * 100) * 10)) + ' m' : (km < 10 ? km.toFixed(1) : Math.round(km)) + ' km';
const mi = (km) => Math.round(km * 0.621);
const segBox = SEGS.map((s) => { let a = 90, b = -90, c = 180, d = -180; for (const p of s) { a = Math.min(a, p[0]); b = Math.max(b, p[0]); c = Math.min(c, p[1]); d = Math.max(d, p[1]); } return [a, b, c, d]; });
function nearestOnPath(lat, lng) {
  const kx = Math.cos(lat * RAD) * 111.32, ky = 110.57;
  let best = 1e9, bl = lat, bn = lng;
  for (let i = 0; i < SEGS.length; i++) {
    const bx = segBox[i];
    const gy = Math.max(0, bx[0] - lat, lat - bx[1]) * ky, gx = Math.max(0, bx[2] - lng, lng - bx[3]) * kx;
    if (Math.hypot(gx, gy) > best) continue;
    const s = SEGS[i];
    for (let j = 0; j < s.length - 1; j++) {
      const ax = (s[j][1] - lng) * kx, ay = (s[j][0] - lat) * ky, cx = (s[j + 1][1] - lng) * kx, cy = (s[j + 1][0] - lat) * ky;
      const dx = cx - ax, dy = cy - ay, L = dx * dx + dy * dy;
      let t = L ? -(ax * dx + ay * dy) / L : 0; t = Math.max(0, Math.min(1, t));
      const px = ax + t * dx, py = ay + t * dy, d = Math.hypot(px, py);
      if (d < best) { best = d; bl = lat + py / ky; bn = lng + px / kx; }
    }
  }
  return { d: best, lat: bl, lng: bn };
}
function kmAt(lat, lng) {
  let best = 0, bd = 1e9;
  for (let i = 0; i < C.length - 1; i++) {
    const a = C[i], b = C[i + 1], dx = b.lat - a.lat, dy = b.lng - a.lng;
    let t = ((lat - a.lat) * dx + (lng - a.lng) * dy) / (dx * dx + dy * dy); t = Math.max(0, Math.min(1, t));
    const d = hav(lat, lng, a.lat + t * dx, a.lng + t * dy);
    if (d < bd) { bd = d; best = a.km + t * (b.km - a.km); }
  }
  return best;
}

// ---------- state ----------
const S = { pos: null, sim: null, heading: null, toBusan: store.get('toBusan', true), info: null, view: 'ride', nearCat: 0, wake: null };
const here = () => S.sim || S.pos;

// ---------- views ----------
function show(v) {
  S.view = v;
  document.querySelectorAll('.view').forEach((e) => e.classList.toggle('active', e.id === 'v-' + v));
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  if (v === 'ride') MapV.open();
  if (v === 'near') renderNear();
  if (v === 'route') renderRoute();
}
document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => show(b.dataset.v)));

// ---------- bottom sheet (ride) ----------
const RS = $('ridesheet');
const STATES = ['peek', 'half', 'full'];
function setSheet(st) { STATES.forEach((s) => RS.classList.toggle(s, s === st)); RS.dataset.state = st; }
(() => {
  const g = $('grab'); let y0 = null, t0 = 0, startTr = 0, moved = 0;
  const curY = () => { const m = new DOMMatrixReadOnly(getComputedStyle(RS).transform); return m.m42; };
  g.addEventListener('pointerdown', (e) => { g.setPointerCapture(e.pointerId); y0 = e.clientY; t0 = Date.now(); startTr = curY(); moved = 0; RS.classList.add('dragging'); });
  g.addEventListener('pointermove', (e) => { if (y0 == null) return; const dy = e.clientY - y0; moved = Math.max(moved, Math.abs(dy)); RS.style.transform = `translateY(${Math.max(0, startTr + dy)}px)`; });
  const end = (e) => {
    if (y0 == null) return; RS.classList.remove('dragging'); RS.style.transform = '';
    const dy = e.clientY - y0, st = RS.dataset.state || 'peek', i = STATES.indexOf(st); y0 = null;
    if (moved < 6) { setSheet(STATES[(i + 1) % 3]); return; }
    const fast = Math.abs(dy) / Math.max(1, Date.now() - t0) > 0.5;
    if (dy < -40 || (fast && dy < 0)) setSheet(STATES[Math.min(2, i + 1)]); else if (dy > 40 || (fast && dy > 0)) setSheet(STATES[Math.max(0, i - 1)]); else setSheet(st);
  };
  g.addEventListener('pointerup', end); g.addEventListener('pointercancel', end);
  RS.querySelector('.stats').addEventListener('click', () => setSheet(RS.dataset.state === 'peek' ? 'half' : 'peek'));
})();
setSheet('peek');
document.querySelectorAll('.quick button').forEach((b) => b.onclick = () => { S.nearCat = +b.dataset.q; $('search').value = ''; setChip(); show('near'); });

// ---------- sheets ----------
function sheet(html) { $('sheet-body').innerHTML = html; IC.hydrate($('sheet-body')); $('sheet').classList.remove('hidden'); $('sheet').querySelector('.sheet-in').scrollTop = 0; }
function closeSheet() { $('sheet').classList.add('hidden'); }
$('sheet-x').onclick = closeSheet;
$('sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });
function showCard(ko, en) { $('show-ko').textContent = ko; $('show-en').textContent = en || ''; $('show').classList.remove('hidden'); }
$('show-x').onclick = () => $('show').classList.add('hidden');

const omMap = (lat, lng, name) => `om://map?v=1&ll=${lat.toFixed(6)},${lng.toFixed(6)}&n=${encodeURIComponent(name || 'Here')}`;
const omRoute = (lat, lng, name) => { const h = here(); return h ? `om://route?v=1&sll=${h.lat.toFixed(6)},${h.lng.toFixed(6)}&saddr=Me&dll=${lat.toFixed(6)},${lng.toFixed(6)}&daddr=${encodeURIComponent(name)}&type=bicycle` : omMap(lat, lng, name); };
const omSearch = (q) => { const h = here(); const ll = h ? `cll=${h.lat.toFixed(5)},${h.lng.toFixed(5)}&` : ''; return `om://search?${ll}query=${encodeURIComponent(q)}&locale=en`; };
const gmaps = (name, lat, lng) => `https://www.google.com/maps/search/${encodeURIComponent(name)}/@${lat.toFixed(5)},${lng.toFixed(5)},17z`;
const nmaps = (name, lat, lng) => `https://map.naver.com/p/search/${encodeURIComponent(name)}?c=${lng.toFixed(5)},${lat.toFixed(5)},16,0,0,0,dh`;
const descOf = (o) => (window.FOOD ? window.FOOD.describe(o.name, o.cat) : { en: o.name, type: null });

const PHOTO = {
  'Jeongseojin (Start Line)': 'Sunset through the big ring sculpture. A great "day 1" photo.',
  'Ara Maru Sky Walk': 'Stand on the glass floor and shoot straight down at the canal.',
  'Floating Islands & Rainbow Fountain': 'Come at dusk: lit-up islands and the bridge fountain (warmer months).',
  'Lotte World Tower': 'Best from the riverside path a little before the Gwangnaru booth.',
  'Dumulmeori (Two Rivers Meet)': 'Early morning mist on the water and the big old tree.',
  'Pasaseong Fortress': 'Top of the wall looking down on Ipo Weir and the river.',
  'Silleuksa Temple': 'The pagoda on the rocks with the river behind it.',
  'Jungangtap Central Pagoda': 'Stone pagoda with the lawn and river behind.',
  'Suju Palbong Rocks': 'The row of rocky peaks from across the stream.',
  'Ihwaryeong Pass (Highest Point)': 'You made it to the top! Photo at the summit sign, then the valley view.',
  'Mungyeong Saejae Park': 'The old stone gate with mountains behind it.',
  'Gyeongcheondae Lookout': 'The big bend of the Nakdong River from the cliff top.',
  'The ARC & Gangjeong Weir': 'The round ARC building at sunset, from the weir bridge.',
  'Dodong Seowon Academy': 'The giant ginkgo tree, bright yellow in late autumn.',
  'Namji Canola Fields': 'Endless yellow flowers in April, the river beside them.',
  'Nakdong Rail Park & Wine Cave': 'Old iron railway bridge over the river.',
  'Imgyeongdae Pavilion': 'Pavilion roof framing the wide lower river.',
  'Nakdong Estuary Barrage (FINISH)': 'Finish-line photo with your stamped passport. Sunset over the estuary.'
};
const isPhotoSpot = (l) => !!PHOTO[l.en];
// Typical prices (2026 guides) — a rough idea only, always ask at the desk.
const PRICE = {
  'Motel': '₩40,000–70,000 per room (about $30–50)', 'Hotel': '₩80,000–140,000 per room (about $60–100)',
  'Guesthouse': 'Dorm bed ₩15,000–25,000 · private room ₩35,000–60,000', 'Sauna / jjimjilbang (cheap overnight)': '₩10,000–20,000 per person, sleep on a heated floor',
  'Old-style inn (cheap)': 'Usually ₩30,000–50,000 (older, simpler rooms)', 'Homestay / B&B': 'Usually ₩30,000–60,000', 'Place to stay': 'Motels are usually ₩40,000–70,000 per room'
};
const priceFor = (type) => PRICE[type] || 'Prices vary — ask at the desk';

async function fillPhotos(el, en, type) {
  if (!window.OFFLINE || !el) return;
  el.innerHTML = '<div class="rc-sub">Loading photos…</div>';
  const ph = await window.OFFLINE.photos(en, type);
  if (!ph.length) { el.innerHTML = type ? '' : `<div class="rc-sub">${navigator.onLine ? 'No photos found for this place.' : 'Photos not downloaded yet — Help → Download now (on wifi).'}</div>`; return; }
  el.innerHTML = `${type ? `<div class="typical">What ${esc(type.split(' (')[0].toLowerCase())} usually looks like — not this exact place</div>` : ''}<div class="gal">${ph.map((p, i) => `<img src="${p.url}" data-i="${i}" alt="">`).join('')}</div><div class="credit">Photos via Wikimedia Commons: ${ph.map((p) => esc(p.credit) + (p.lic ? ' (' + esc(p.lic) + ')' : '')).join(' · ')}</div>`;
  el.querySelectorAll('img').forEach((im) => im.onclick = () => { $('show-ko').innerHTML = `<img class="bigimg" src="${im.src}">`; $('show-en').textContent = ph[+im.dataset.i].credit + ' · Wikimedia Commons'; $('show').classList.remove('hidden'); });
}

function placeSheet(o) {
  const h = here();
  const km = o.km != null ? o.km : kmAt(o.lat, o.lng);
  const off = nearestOnPath(o.lat, o.lng).d;
  const biz = [0, 1, 2, 3, 4, 5].includes(o.cat);
  const dsc = biz ? descOf(o) : null;
  const catKey = o.cat === -1 ? null : (o.lmEn && PHOTO[o.lmEn] ? 8 : o.cat);
  const icon = o.cat === -1 ? `<div class="num">${o.stop ? o.stop.n : ''}</div>` : `<div class="ic bg${catKey}">${ico(CAT[catKey] ? CAT[catKey].i : 'pin')}</div>`;
  const tip = o.lmEn && PHOTO[o.lmEn];
  let meta = '';
  if (h) { const d = hav(h.lat, h.lng, o.lat, o.lng), b = bearing(h.lat, h.lng, o.lat, o.lng); meta += `<div><b>${fmtD(d)}</b><span>${DIRS[card8(b)]} of you</span></div>`; }
  meta += `<div><b>km ${Math.round(km)}</b><span>on the route</span></div><div><b>${off > 0.15 ? fmtD(off) : 'On path'}</b><span>${off > 0.15 ? 'off the bike path' : 'right beside it'}</span></div>`;
  sheet(`<div class="sh-head">${icon}<div><div class="over">${o.cat === -1 ? 'Stamp booth' : (CAT[catKey] ? CAT[catKey].n : '')}</div><h3>${esc(o.name)}</h3></div></div>
    ${biz && dsc.en !== o.name ? `<div class="sh-en">${esc(dsc.en)}</div>` : ''}
    ${o.ko && o.ko !== o.name ? `<div class="sh-ko">${esc(o.ko)}</div>` : ''}
    ${dsc && dsc.type ? `<div class="sh-type">${ico(CAT[o.cat].i)} ${esc(dsc.type)}</div>${dsc.chain ? '' : '<div class="rc-sub" style="margin:-4px 0 6px">Type guessed from the name</div>'}` : ''}
    <div class="sh-meta">${meta}</div>
    ${o.lmEn || (dsc && dsc.type && window.OFFLINE && window.OFFLINE.hasType(dsc.type)) ? '<div id="sheetphotos" class="photos"></div>' : ''}
    ${tip ? `<div class="tip">${ico('camera')}<div><b>Photo tip</b> — ${esc(tip)}</div></div>` : ''}
    ${o.desc ? `<p class="desc">${esc(o.desc)}</p>` : ''}
    ${o.phone ? `<a class="btn" href="tel:${esc(o.phone.replace(/[^0-9+]/g, ''))}">${ico('phone')} Call ${esc(o.phone)}</a>` : ''}
    ${o.cat === 3 ? `<div class="price">${ico('bed')}<div><b>Typical price</b><span>${esc(priceFor(dsc.type))}</span><small>A rough guide, not this place's price. Most motels take walk-ins; cash or card.</small></div></div>
      <button class="btn primary" data-act="tonight">${ico('bed')} Save as tonight's stay</button>
      <div class="grid2"><button class="btn" data-act="bikein">${ico('speech')} Room + bike inside?</button><button class="btn" data-act="price">${ico('speech')} Ask the price</button></div>` : ''}
    <button class="btn ${o.cat === 3 ? '' : 'primary'}" data-act="guide">${ico('nav')} Guide me there</button>
    <div class="grid2"><button class="btn" data-act="maphere">${ico('map')} Show on map</button>
    <button class="btn" data-act="showko">${ico('speech')} Ask the way</button></div>
    ${biz ? `<div class="online"><div class="card-title">Photos, menu &amp; reviews · needs internet</div>
      <div class="grid2"><a class="btn" href="${gmaps(o.name, o.lat, o.lng)}">Google Maps<small>reviews in English</small></a>
      <a class="btn" href="${nmaps(o.name, o.lat, o.lng)}">Naver Map<small>most Korean reviews</small></a></div></div>` : ''}
    <a class="btn ghost" href="${omRoute(o.lat, o.lng, o.ko || o.name)}">${ico('route')} Street directions in Organic Maps</a>`);
  const sb = $('sheet-body');
  sb.querySelector('[data-act=maphere]').onclick = () => { closeSheet(); show('ride'); setSheet('peek'); MapV.goto(o.lat, o.lng, 15.5); };
  sb.querySelector('[data-act=showko]').onclick = () => showCard(`${o.ko || o.name}\n여기에 가고 싶어요.\n어느 쪽이에요?`, `"${dsc ? dsc.en : o.name}" — I want to go here. Which way is it?`);
  const tn = sb.querySelector('[data-act=tonight]'); if (tn) tn.onclick = () => { store.set('tonight', { name: o.name, en: dsc.en, lat: o.lat, lng: o.lng, phone: o.phone || '' }); $('c-hotel').value = o.name; store.set('c_hotel', o.name); tn.innerHTML = ico('check') + ' Saved as tonight\'s stay'; renderTonight(); MapV.redrawSoon(); };
  const pr = sb.querySelector('[data-act=price]'); if (pr) pr.onclick = () => showCard('하룻밤에 얼마예요?\n한 명이에요.', '"How much for one night? Just one person."');
  sb.querySelector('[data-act=guide]').onclick = () => { S.target = { name: dsc && dsc.en !== o.name ? `${o.name} (${dsc.en})` : o.name, lat: o.lat, lng: o.lng }; closeSheet(); show('ride'); setSheet('peek'); MapV.follow(); update(); };
  const bi = sb.querySelector('[data-act=bikein]'); if (bi) bi.onclick = () => showCard('오늘 밤 1명 묵을 방 있어요?\n자전거를 방이나 안에 둘 수 있어요?', '"Do you have a room for one tonight? Can I keep my bike in the room or inside?"');
  if (o.lmEn) fillPhotos($('sheetphotos'), o.lmEn);
  else if ($('sheetphotos')) fillPhotos($('sheetphotos'), null, dsc.type);
}
function stopSheet(c) {
  const nk = C[c.n] ? C[c.n].km : 99999;
  const lms = LM.filter((l) => l.km >= c.km && l.km < nk);
  const near = c.near || {};
  placeSheet({ name: c.en, ko: c.ko + ' 인증센터', cat: -1, stop: c, lat: c.lat, lng: c.lng, km: c.km, phone: c.phone,
    desc: `${c.staffed ? 'Staffed booth — buy or certify your bike passport here.' + (c.hours ? ' Hours: ' + c.hours + '.' : '') : 'Self-service red stamp booth.'} Within 2 km: ${near[0] || 0} restaurants, ${near[2] || 0} convenience stores, ${near[3] || 0} places to stay.${lms.length ? ' Coming up: ' + lms.map((l) => l.en).join(', ') + '.' : ''}` });
}
const lmSheet = (l) => placeSheet({ name: l.en, ko: l.ko, cat: 6, lat: l.lat, lng: l.lng, desc: l.desc, km: l.km, lmEn: l.en });

// ---------- GPS ----------
function startGPS() {
  if (!('geolocation' in navigator)) { setStatus('err', 'No GPS available', ''); return; }
  $('btn-startgps').classList.add('hidden');
  navigator.geolocation.watchPosition((p) => {
    S.pos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, t: p.timestamp };
    store.set('lastpos', S.pos); MapV.firstFix(); update();
  }, (err) => {
    if (err.code === 1) { setStatus('err', 'Location is off', 'Settings → Privacy → Location Services'); $('btn-startgps').classList.remove('hidden'); }
    else if (!S.pos) setStatus('', 'Searching for GPS…', 'Go outside, away from tall buildings');
  }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
}
$('btn-startgps').onclick = startGPS;
$('guide-stop').onclick = () => { S.target = null; update(); MapV.redrawSoon(); };
function setStatus(cls, a, b) { $('gpsbox').className = 'navbar ' + cls; $('st-line').textContent = a; $('st-sub').textContent = b; }

// ---------- compass ----------
$('btn-compass').onclick = async () => {
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') return;
    }
    window.addEventListener('deviceorientation', (e) => {
      let hd = e.webkitCompassHeading; if (hd == null && e.absolute && e.alpha != null) hd = 360 - e.alpha;
      if (hd != null) { S.heading = hd; drawArrow(); MapV.redrawSoon(); }
    }, true);
    $('btn-compass').innerHTML = ico('compass') + ' Compass on — hold the phone flat';
  } catch (e) { $('btn-compass').textContent = 'Compass not available'; }
};

// ---------- main update ----------
function compute() {
  const h = here(); if (!h) return null;
  const np = nearestOnPath(h.lat, h.lng);
  const km = Math.max(0, Math.min(TOTAL, kmAt(h.lat, h.lng)));
  let i = 0; while (i < C.length - 1 && C[i + 1].km <= km) i++;
  const prev = C[i], nxt = C[Math.min(i + 1, C.length - 1)];
  const nextStop = S.toBusan ? C.find((c) => c.km > km + 0.3) : [...C].reverse().find((c) => c.km < km - 0.3);
  const nextLm = S.toBusan ? LM.find((l) => l.km > km + 0.3) : [...LM].reverse().find((l) => l.km < km - 0.3);
  const onPath = np.d <= Math.max(0.06, (h.acc || 10) / 1000 * 0.8);
  const far = np.d > 40;
  return { h, np, km, prev, nxt, nextStop, nextLm, onPath, far };
}
let lastClosest = 0, lastLmThumb = '';
function update() {
  const I = S.info = compute(); if (!I) return;
  const { h, np, km, onPath } = I, ns = I.nextStop;
  if (I.far) {
    const st = C[0], dKm = hav(h.lat, h.lng, st.lat, st.lng);
    setStatus('', 'Not on the route yet', `The route starts in Incheon, Korea · ${Math.round(dKm).toLocaleString()} km away`);
    drawArrow();
    $('km-done').textContent = '0'; $('km-left').textContent = TOTAL; $('next-km-short').textContent = '—'; $('progbar').style.width = '0%';
    $('next-num').textContent = '1'; $('next-name').textContent = C[0].en; $('next-ko').textContent = C[0].ko; $('next-km').textContent = 'Start of the route';
    $('between').textContent = 'You are not near the bike route right now. Everything will work once you are in Korea.';
    $('path-dir').textContent = 'Use Help → Practice mode to try the app at home.'; $('path-dist').textContent = '';
    $('lm-name').textContent = LM[0].en; $('lm-sub').textContent = 'At the start line';
    renderTonight(); if (S.view === 'ride') MapV.redrawSoon(); return;
  }
  const nsTxt = ns ? `Next: ${ns.en} · ${fmtD(Math.abs(ns.km - km))}` : 'You made it to the finish!';
  $('guidebar').classList.toggle('hidden', !S.target);
  if (S.target) {
    const t = S.target, d = hav(h.lat, h.lng, t.lat, t.lng), b = bearing(h.lat, h.lng, t.lat, t.lng);
    setStatus('guide', d < 0.04 ? 'You have arrived' : `${fmtD(d)} ${SHORT[card8(b)]}`, `To ${t.name} · straight-line`);
  } else if (onPath) setStatus('on', S.sim ? 'On route · practice' : 'On route', nsTxt);
  else { const b = bearing(h.lat, h.lng, np.lat, np.lng); setStatus('off', `Path ${fmtD(np.d)} ${SHORT[card8(b)]}`, `Head ${DIRS[card8(b)]} to rejoin · ${nsTxt}`); }
  drawArrow();
  $('between').textContent = `Between stop ${I.prev.n} ${I.prev.en} and stop ${I.nxt.n} ${I.nxt.en}`;
  $('path-dir').textContent = onPath ? `You're on the bike path. Signs ahead will say ${ns ? ns.ko : '—'}.` : `The bike path is ${fmtD(np.d)} to the ${DIRS[card8(bearing(h.lat, h.lng, np.lat, np.lng))]}.`;
  $('path-dist').textContent = S.sim ? `Practice mode: ${S.simName}` : `GPS accuracy ±${Math.round(h.acc || 0)} m`;
  $('progbar').style.width = (km / TOTAL * 100).toFixed(1) + '%';
  $('km-done').textContent = Math.round(km);
  $('km-left').textContent = Math.round(TOTAL - km);
  $('next-km-short').textContent = ns ? (Math.abs(ns.km - km) < 10 ? Math.abs(ns.km - km).toFixed(1) : Math.round(Math.abs(ns.km - km))) : '0';
  if (ns) {
    $('next-num').textContent = ns.n; $('next-lbl').textContent = `Next stamp booth · toward ${S.toBusan ? 'Busan' : 'Seoul'}`;
    $('next-name').textContent = ns.en; $('next-ko').textContent = ns.ko;
    $('next-km').textContent = `${fmtD(Math.abs(ns.km - km))} (${mi(Math.abs(ns.km - km))} mi) along the path${ns.staffed ? ' · staffed' : ''}`;
  } else { $('next-num').textContent = '✓'; $('next-name').textContent = 'Finished'; $('next-ko').textContent = ''; $('next-km').textContent = ''; }
  const nl = I.nextLm;
  if (nl) {
    $('lm-name').textContent = nl.en; $('lm-sub').textContent = `${fmtD(Math.abs(nl.km - km))} ahead${nl.off > 0.3 ? ' · ' + fmtD(nl.off) + ' off the path' : ''}`;
    if (lastLmThumb !== nl.en && window.OFFLINE) {
      lastLmThumb = nl.en; $('lm-thumb').innerHTML = ico(PHOTO[nl.en] ? 'camera' : 'star');
      window.OFFLINE.photos(nl.en).then((ph) => { if (ph[0] && lastLmThumb === nl.en) $('lm-thumb').innerHTML = `<img src="${ph[0].url}" alt="">`; }).catch(() => {});
    }
  }
  const now = Date.now();
  if (now - lastClosest > 8000 || S.sim) { lastClosest = now; renderClosest(); }
  $('gps-meta').textContent = S.sim ? '' : `Last GPS fix ${new Date(h.t || now).toLocaleTimeString()}`;
  renderTonight();
  if (S.view === 'ride') MapV.redrawSoon();
  if (S.view === 'near') renderNear(true);
}
function nearestOf(cat, n, h) {
  const out = [];
  for (const p of P) {
    if (p[2] !== cat) continue;
    if (Math.abs(p[0] - h.lat) > 0.6 || Math.abs(p[1] - h.lng) > 0.7) continue;
    out.push({ p, d: hav(h.lat, h.lng, p[0], p[1]) });
  }
  out.sort((a, b) => a.d - b.d); return out.slice(0, n);
}
function renderClosest() {
  const h = here(); if (!h) return;
  $('closest').innerHTML = [2, 0, 5, 3].map((cat) => {
    const r = nearestOf(cat, 1, h)[0];
    return `<div data-cat="${cat}">${ico(CAT[cat].i)}<span><b>${r ? fmtD(r.d) : '—'}</b><small>${CAT[cat].n}</small></span></div>`;
  }).join('');
  $('closest').querySelectorAll('div[data-cat]').forEach((d) => d.onclick = () => { S.nearCat = +d.dataset.cat; $('search').value = ''; setChip(); show('near'); });
}
$('nextcard').onclick = () => S.info?.nextStop && stopSheet(S.info.nextStop);
$('lmcard').onclick = () => { const l = S.info?.nextLm; if (l) lmSheet(l); };
$('btn-dir').onclick = () => { S.toBusan = !S.toBusan; store.set('toBusan', S.toBusan); dirLabel(); update(); };
function dirLabel() { $('dir-lbl').textContent = S.toBusan ? 'Riding toward Busan (tap to switch)' : 'Riding toward Seoul (tap to switch)'; }
$('btn-showlocal').onclick = () => {
  const ns = S.info?.nextStop;
  showCard(`저는 자전거로 ${S.toBusan ? '부산' : '서울'}까지 가는 여행자예요.\n국토종주 자전거길로 ${ns ? ns.ko + '까지 ' : ''}가려면 어느 쪽으로 가야 해요?`, `"I'm a traveler riding my bike to ${S.toBusan ? 'Busan' : 'Seoul'}. Which way is the cross-country bike path${ns ? ' to ' + ns.en : ''}?"`);
};
$('btn-om').onclick = () => { const h = here(); location.href = h ? omMap(h.lat, h.lng, 'Me') : 'om://map?v=1'; };
$('btn-wake').onclick = async () => {
  try {
    if (S.wake) { await S.wake.release(); S.wake = null; $('wake-lbl').textContent = 'Keep screen on'; return; }
    S.wake = await navigator.wakeLock.request('screen'); $('wake-lbl').textContent = 'Screen stays on (tap to stop)';
  } catch (e) { $('wake-lbl').textContent = 'Not supported on this phone'; }
};
document.addEventListener('visibilitychange', async () => { if (S.wake && document.visibilityState === 'visible') { try { S.wake = await navigator.wakeLock.request('screen'); } catch (e) {} } });

// ---------- direction arrow (nav banner) ----------
function drawArrow() {
  const cv = $('arrow'), ctx = cv.getContext('2d'), W = cv.width, I = S.info;
  ctx.clearRect(0, 0, W, W);
  ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.arc(W / 2, W / 2, W / 2 - 2, 0, 7); ctx.fill();
  if (!I) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(W / 2, W / 2, 9, 0, 7); ctx.fill(); return; }
  if (S.target) {
    const b = bearing(I.h.lat, I.h.lng, S.target.lat, S.target.lng);
    ctx.save(); ctx.translate(W / 2, W / 2); ctx.rotate((S.heading != null ? b - S.heading : b) * RAD); ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(0, -W * .33); ctx.lineTo(W * .24, W * .27); ctx.lineTo(0, W * .14); ctx.lineTo(-W * .24, W * .27); ctx.closePath(); ctx.fill(); ctx.restore(); return;
  }
  if (I.far) { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = '700 40px -apple-system, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✈', W / 2, W / 2 + 2); return; }
  ctx.save(); ctx.translate(W / 2, W / 2);
  let rot;
  if (I.onPath) {
    const t = I.nextStop; if (!t) { ctx.restore(); return; }
    const b = bearing(I.h.lat, I.h.lng, t.lat, t.lng); rot = (S.heading != null ? b - S.heading : 0) * RAD;
  } else { const b = bearing(I.h.lat, I.h.lng, I.np.lat, I.np.lng); rot = (S.heading != null ? b - S.heading : b) * RAD; }
  ctx.rotate(rot); ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(0, -W * .33); ctx.lineTo(W * .24, W * .27); ctx.lineTo(0, W * .14); ctx.lineTo(-W * .24, W * .27); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ---------- search / nearby ----------
function setChip() { document.querySelectorAll('#chips .chip').forEach((c) => c.classList.toggle('on', +c.dataset.cat === S.nearCat && !$('search').value.trim())); }
document.querySelectorAll('#chips .chip').forEach((c) => c.onclick = () => { S.nearCat = +c.dataset.cat; $('search').value = ''; setChip(); renderNear(); });
let lastNear = 0;
S.stayMode = 'ahead';
document.querySelectorAll('#staymode button').forEach((b) => b.onclick = () => { S.stayMode = b.dataset.m; document.querySelectorAll('#staymode button').forEach((x) => x.classList.toggle('on', x === b)); renderNear(); });
function arrowSvg(b) { const r = Math.round(S.heading != null ? b - S.heading : b); return `<span style="display:inline-block;transform:rotate(${r}deg)">${ico('nav').replace('<svg', '<svg width="16" height="16"')}</span>`; }
function itemRow(o, h, myKm, i) {
  const d = h ? hav(h.lat, h.lng, o.lat, o.lng) : null, b = h ? bearing(h.lat, h.lng, o.lat, o.lng) : 0;
  const k = o.km != null ? o.km : kmAt(o.lat, o.lng), diff = (k - myKm) * (S.toBusan ? 1 : -1);
  const rel = !h ? `km ${Math.round(k)} of the route` : Math.abs(diff) < 1 ? 'Right around you' : diff > 0 ? `${Math.round(diff)} km ahead on the route` : `${Math.round(-diff)} km behind you`;
  let iconCls, iconName, line2 = '';
  if (o.cat === -1) { iconCls = 'bgS'; iconName = 'flag'; }
  else if (o.cat === -2) { iconCls = 'bgT'; iconName = 'pin'; }
  else if (o.cat === 6) { const p = !!PHOTO[o.lmEn]; iconCls = p ? 'bg8' : 'bg6'; iconName = p ? 'camera' : 'star'; }
  else { iconCls = 'bg' + o.cat; iconName = CAT[o.cat].i; }
  if ([0, 1, 2, 3, 4, 5].includes(o.cat)) { const ds = descOf(o); line2 = [ds.en !== o.name ? ds.en : '', ds.type || '', o.cat === 3 && PRICE[ds.type] ? PRICE[ds.type].split(' (')[0].split(' ·')[0] : '', o.cat === 3 && o.phone ? 'has phone' : ''].filter(Boolean).join(' · '); }
  else if (o.sub) line2 = o.sub;
  return `<div class="place" data-i="${i}"><div class="ic ${iconCls}">${ico(iconName)}</div>
    <div class="pn"><b>${esc(o.name)}</b>${line2 ? `<i class="en">${esc(line2)}</i>` : ''}<span>${rel}</span></div>
    ${h ? `<div class="pd"><b>${fmtD(d)}</b><span>${arrowSvg(b)}</span></div>` : ''}</div>`;
}
const lmItem = (l, h) => ({ name: l.en, ko: l.ko, lat: l.lat, lng: l.lng, desc: l.desc, km: l.km, cat: 6, lmEn: l.en, sub: l.ko + (PHOTO[l.en] ? ' · photo spot' : ''), d: h ? hav(h.lat, h.lng, l.lat, l.lng) : 0 });
const stopItem = (c, h) => ({ name: `${c.n}. ${c.en}`, ko: c.ko, lat: c.lat, lng: c.lng, km: c.km, cat: -1, stop: c, sub: `${c.ko} · stamp booth${c.staffed ? ' (staffed)' : ''} · every rider stops here`, d: h ? hav(h.lat, h.lng, c.lat, c.lng) : 0 });
function openItem(o) { if (o.stop) stopSheet(o.stop); else if (o.lmEn) lmSheet(LM.find((l) => l.en === o.lmEn)); else placeSheet(o); }
let SEARCH_IDX = null;
function buildSearch() {
  if (SEARCH_IDX) return SEARCH_IDX;
  SEARCH_IDX = P.map((p) => { const d = window.FOOD.describe(p[3], p[2]); return (p[3] + ' ' + d.en + ' ' + (d.type || '') + ' ' + CAT[p[2]].n + ' ' + CAT[p[2]].ko).toLowerCase(); });
  return SEARCH_IDX;
}
const SYN = { hotel: 'place to stay', motel: 'motel', bed: 'place to stay', room: 'place to stay', hostel: 'guesthouse', sleep: 'place to stay', stay: 'place to stay', repair: 'bike shop', bicycle: 'bike shop', mechanic: 'bike shop', tire: 'bike shop', bathroom: 'toilet', restroom: 'toilet', wc: 'toilet', coffee: 'café', cafe: 'café', store: 'convenience', shop: 'convenience', mart: 'convenience', meat: 'bbq', noodles: 'noodle', bread: 'bakery' };
function doSearch(q, h) {
  const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean).map((w) => SYN[w] || w);
  if (!words.length) return null;
  const idx = buildSearch(), items = [];
  for (let i = 0; i < P.length; i++) if (words.every((w) => idx[i].includes(w))) { const p = P[i]; items.push({ name: p[3], ko: p[3], lat: p[0], lng: p[1], phone: p[4], cat: p[2] }); }
  LM.forEach((l) => { const t = (l.en + ' ' + l.ko + ' ' + l.desc + ' sight landmark' + (PHOTO[l.en] ? ' photo' : '')).toLowerCase(); if (words.every((w) => t.includes(w))) items.push(lmItem(l, h)); });
  C.forEach((c) => { const t = (c.en + ' ' + c.ko + ' stop stamp booth').toLowerCase(); if (words.every((w) => t.includes(w))) items.push(stopItem(c, h)); });
  (window.TOWNS || []).forEach(([ko, en, km]) => { if (words.every((w) => (ko + ' ' + en).toLowerCase().includes(w))) { const c = C.reduce((a, b) => Math.abs(b.km - km) < Math.abs(a.km - km) ? b : a); items.push({ name: en, ko, lat: c.lat, lng: c.lng, km, cat: -2, sub: `${ko} · town near stop ${c.n}` }); } });
  if (h) items.forEach((o) => { o.d = hav(h.lat, h.lng, o.lat, o.lng); });
  items.sort((a, b) => h ? a.d - b.d : (a.km ?? kmAt(a.lat, a.lng)) - (b.km ?? kmAt(b.lat, b.lng)));
  return items.slice(0, 60);
}
function renderList(items, h) {
  const myKm = S.info ? S.info.km : 0, list = $('nearlist');
  list.innerHTML = items.map((o, i) => itemRow(o, h, myKm, i)).join('');
  list.querySelectorAll('.place').forEach((e) => e.onclick = () => openItem(items[+e.dataset.i]));
}
function renderNear(auto) {
  if (auto && Date.now() - lastNear < 10000) return; lastNear = Date.now();
  const h = here(), cat = S.nearCat, q = $('search').value;
  setChip();
  if (q.trim()) {
    const items = doSearch(q, h) || [];
    $('nearhead').textContent = items.length ? `${items.length >= 60 ? '60+' : items.length} results${h ? ' · closest first' : ''}` : `Nothing found for "${q}". Try another word, like noodles, motel or bike.`;
    renderList(items, h); return;
  }
  if (cat !== 3) $('staymode').classList.add('hidden');
  if (cat === 9) {
    $('nearhead').textContent = '';
    $('nearlist').innerHTML = `<div style="padding:16px"><div class="card-title">Hospital or clinic</div>
      <p class="desc" style="margin-top:0">Hurt badly or very sick? <b>Call 119</b>. The ambulance comes to you and takes you to the right hospital.</p>
      <a class="btn red" href="tel:119">${ico('phone')} Call 119</a>
      <a class="btn" href="tel:+8221330">${ico('phone')} 1330 English interpreter</a>
      <a class="btn primary" href="${omSearch('hospital')}">${ico('search')} Find hospitals (Organic Maps)</a>
      <a class="btn" href="${omSearch('pharmacy')}">${ico('search')} Find a pharmacy (Organic Maps)</a>
      <button class="btn" id="hosp-card">${ico('speech')} Show: "Take me to a hospital"</button>
      <p class="fine">병원 = hospital · 응급실 = emergency room · 약국 = pharmacy · 의원 = clinic</p></div>`;
    $('hosp-card').onclick = () => showCard('몸이 안 좋아요.\n가장 가까운 병원에 데려다 주세요.', '"I feel unwell. Please take me to the nearest hospital."');
    return;
  }
  if (!h) { $('nearhead').textContent = 'Waiting for GPS… (or use Practice mode in Help)'; $('nearlist').innerHTML = ''; return; }
  let items, head;
  if (cat === 6) { items = LM.map((l) => lmItem(l, h)).sort((a, b) => a.d - b.d).slice(0, 25); head = 'Landmarks · closest first'; }
  else if (cat === 8) { items = LM.filter(isPhotoSpot).map((l) => lmItem(l, h)).sort((a, b) => a.d - b.d); head = 'Best photo spots · tap for the photo tip'; }
  else if (cat === 7) {
    items = C.map((c) => stopItem(c, h)).concat((D.riders || []).map((i) => { const p = P[i]; return { name: p[3], ko: p[3], lat: p[0], lng: p[1], cat: p[2], d: hav(h.lat, h.lng, p[0], p[1]) }; }));
    items.sort((a, b) => a.d - b.d); items = items.slice(0, 40); head = 'Where other riders stop: stamp booths and the cafés and stores right on the path';
  } else if (cat === 3 && S.stayMode === 'ahead' && S.info && !S.info.far) {
    const myK = S.info.km, dir = S.toBusan ? 1 : -1;
    items = P.map((p) => (p[2] === 3 ? p : null)).filter(Boolean).map((p) => ({ p, k: kmAt(p[0], p[1]) }))
      .filter(({ k }) => (k - myK) * dir > -0.5 && (k - myK) * dir < 70)
      .sort((a, b) => (a.k - b.k) * dir).slice(0, 80)
      .map(({ p, k }) => ({ name: p[3], ko: p[3], lat: p[0], lng: p[1], phone: p[4], cat: 3, km: k, d: hav(h.lat, h.lng, p[0], p[1]) }));
    head = 'Places to stay ahead of you on the route (next 70 km), in riding order';
  } else { items = nearestOf(cat, 40, h).map(({ p, d }) => ({ name: p[3], ko: p[3], lat: p[0], lng: p[1], phone: p[4], cat, d })); head = `${CAT[cat].n} · closest first`; }
  $('staymode').classList.toggle('hidden', cat !== 3);
  $('nearhead').textContent = head;
  renderList(items, h);
}
$('search').addEventListener('input', () => { clearTimeout(renderNear.t); renderNear.t = setTimeout(() => renderNear(), 300); });

// ---------- route ----------
const CLIMBS = [
  [238, 'Sojoryeong Pass — first mountain climb (about 390 m high). Take it slow.'],
  [249, 'Ihwaryeong Pass — the biggest climb, about 5 km uphill to roughly 530 m.'],
  [312, 'Short steep hills around Gyeongcheondae lookout.'],
  [478, 'Steep hill right after Hapcheon-Changnyeong Weir.'],
  [513, 'Steep hills (Bakjin / Yeongaji) before Namji.']
];
function renderRoute() {
  drawElev();
  const myKm = S.info ? S.info.km : null;
  let html = '', placedMe = false;
  const meRow = () => `<div class="tl me"><div class="rail"><div class="dot">${ico('nav')}</div></div><div class="tl-body">You are here · km ${Math.round(myKm)}</div></div>`;
  C.forEach((c, i) => {
    const nk = C[i + 1] ? C[i + 1].km : 99999;
    if (myKm != null && !placedMe && myKm < c.km) { html += meRow(); placedMe = true; }
    const passed = myKm != null && (S.toBusan ? c.km < myKm - 0.5 : c.km > myKm + 0.5);
    const lms = LM.filter((l) => l.km >= c.km && l.km < nk);
    const near = c.near || {};
    const tags = [];
    if ((near[3] || 0) >= 8) tags.push(`<span class="tag night">${ico('bed')} Good overnight town</span>`);
    if (c.staffed) tags.push(`<span class="tag staff">${ico('flag')} Staffed</span>`);
    tags.push(`<span class="tag">${ico('food')} ${near[0] || 0}</span><span class="tag">${ico('store')} ${near[2] || 0}</span><span class="tag">${ico('bed')} ${near[3] || 0}</span>`);
    if (C[i + 1]) tags.push(`<span class="tag">${C[i + 1].km - c.km} km to next</span>`);
    html += `<div class="tl${passed ? ' passed' : ''}" data-i="${i}"><div class="rail"><div class="dot">${c.n}</div></div><div class="tl-body">
      <div class="tl-top"><b>${esc(c.en)}</b><span>km ${c.km}</span></div><div class="ko">${esc(c.ko)}</div>
      <div class="tags">${tags.join('')}</div>
      ${lms.length ? `<div class="lms">${lms.map((l) => `<div>${ico(PHOTO[l.en] ? 'camera' : 'star')}${esc(l.en)} · km ${l.km}</div>`).join('')}</div>` : ''}</div></div>`;
    CLIMBS.filter(([k]) => k >= c.km && k < nk).forEach(([k, t]) => { html += `<div class="tl note"><div class="rail"><div class="dot">${ico('mountain')}</div></div><div class="tl-body"><b>km ${k}</b> · ${t}</div></div>`; });
  });
  if (myKm != null && !placedMe) html += meRow();
  $('stoplist').innerHTML = html;
  $('stoplist').querySelectorAll('.tl[data-i]').forEach((e) => e.onclick = () => stopSheet(C[+e.dataset.i]));
}
function drawElev() {
  const cv = $('elev'), dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 340, H = 160;
  cv.width = W * dpr; cv.height = H * dpr; const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
  const cs = getComputedStyle(document.documentElement), pri = cs.getPropertyValue('--pri').trim() || '#1452b8', mut = cs.getPropertyValue('--mut').trim(), line = cs.getPropertyValue('--line').trim();
  const E = D.ele, maxE = 560, pad = 44, X = (km) => pad + (km / TOTAL) * (W - pad - 4), Y = (e) => H - 20 - (Math.max(0, e) / maxE) * (H - 30);
  ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.fillStyle = mut; ctx.font = '11px -apple-system, sans-serif'; ctx.textAlign = 'right';
  [0, 250, 500].forEach((m) => { ctx.beginPath(); ctx.moveTo(pad, Y(m)); ctx.lineTo(W, Y(m)); ctx.stroke(); ctx.fillText(m + ' m', pad - 4, Y(m) + 4); });
  const grad = ctx.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, pri + '55'); grad.addColorStop(1, pri + '08');
  ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(X(0), Y(0)); E.forEach((e, i) => ctx.lineTo(X(i * 0.5), Y(e))); ctx.lineTo(X(E.length * 0.5), Y(0)); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = pri; ctx.lineWidth = 1.6; ctx.beginPath(); E.forEach((e, i) => i ? ctx.lineTo(X(i * 0.5), Y(e)) : ctx.moveTo(X(0), Y(e))); ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = mut; [0, 100, 200, 300, 400, 500, 600].forEach((k) => ctx.fillText(k, X(k), H - 4));
  if (S.info) { const x = X(S.info.km); ctx.strokeStyle = '#d93025'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 6); ctx.lineTo(x, H - 20); ctx.stroke(); ctx.fillStyle = '#d93025'; ctx.beginPath(); ctx.arc(x, 6, 4, 0, 7); ctx.fill(); }
}

// ---------- signs ----------
const DICT = [];
(window.SIGN_WORDS || []).forEach(([k, e, cat, single]) => DICT.push({ k: k.replace(/\s/g, ''), e, cat, single: !!single }));
(window.TOWNS || []).forEach(([k, e, km]) => DICT.push({ k, e, cat: 'town', km }));
C.forEach((c) => (window.STOP_ALIASES[c.id] || [c.ko]).forEach((k) => DICT.push({ k, e: `Stop ${c.n}: ${c.en} (stamp booth)`, cat: 'stop', km: c.km, stop: c })));
const DICT_SORTED = DICT.filter((d) => !d.single).sort((a, b) => b.k.length - a.k.length);
function readSign(text) {
  const t = text.replace(/[\s·,.!?:;()\[\]{}"'“”‘’<>→←↑↓▶◀▲▼\-–—/|]+/g, '');
  const covered = new Array(t.length).fill(false), hits = [];
  for (const d of DICT_SORTED) {
    let idx = t.indexOf(d.k);
    while (idx !== -1) {
      let free = true; for (let i = idx; i < idx + d.k.length; i++) if (covered[i]) { free = false; break; }
      if (free) { for (let i = idx; i < idx + d.k.length; i++) covered[i] = true; hits.push({ pos: idx, d }); }
      idx = t.indexOf(d.k, idx + 1);
    }
  }
  const tokens = text.split(/[\s·,.!?:;()\[\]→←↑↓\-–—/|]+/).filter(Boolean);
  DICT.filter((d) => d.single).forEach((d) => { if (tokens.some((tk) => tk === d.k || tk.replace(/[0-9.]+\s*(km|㎞)?$/i, '') === d.k)) hits.push({ pos: 9999, d }); });
  hits.sort((a, b) => a.pos - b.pos);
  const dists = []; const re = /(\d+(?:\.\d+)?)\s*(km|㎞|킬로미터|킬로|k\b)/gi; let m;
  while ((m = re.exec(text))) dists.push(+m[1]);
  return { hits, dists };
}
function renderSign() {
  const text = $('signtext').value.trim(), out = $('signresult');
  if (!text) { out.innerHTML = ''; return; }
  const { hits, dists } = readSign(text);
  const myKm = S.info ? S.info.km : null, seen = new Set();
  let html = hits.filter((x) => { const key = x.d.k + x.d.e; if (seen.has(key)) return false; seen.add(key); return true; }).map(({ d }) => {
    const cls = d.cat === 'warn' ? 'warn' : d.cat === 'food' ? 'food' : (d.cat === 'stop' || d.cat === 'town') ? 'plc' : '';
    let more = '';
    if (d.km != null) {
      if (myKm != null) { const diff = (d.km - myKm) * (S.toBusan ? 1 : -1); more = Math.abs(diff) < 2 ? 'You are right about here.' : diff > 0 ? `About ${Math.round(diff)} km ahead of you — keep going this way.` : `About ${Math.round(-diff)} km behind you — you already passed it.`; }
      else more = `About km ${d.km} of the route.`;
    }
    return `<div class="hit ${cls}"><div class="k">${esc(d.k)}</div><div class="e">${esc(d.e)}</div>${more ? `<div class="m">${ico('pin')}${more}</div>` : ''}</div>`;
  }).join('');
  if (dists.length) html += `<div class="hit"><div class="e">Distances on the sign: ${dists.map((x) => x + ' km (' + (Math.round(x * 6.21) / 10) + ' mi)').join(', ')}</div></div>`;
  if (!hits.length) html = `<div class="hit warn"><div class="e">No words I know. Try a closer photo, or use the Translate app → Camera.</div></div>`;
  out.innerHTML = html; IC.hydrate(out);
}
$('btn-read').onclick = renderSign;
$('signtext').addEventListener('input', () => { clearTimeout(renderSign.t); renderSign.t = setTimeout(renderSign, 400); });
$('btn-clear').onclick = () => { $('signtext').value = ''; $('signresult').innerHTML = ''; };
function renderWordList(f) {
  f = (f || '').trim().toLowerCase();
  if (!f && !renderWordList.all) { $('wordlist').innerHTML = `<button class="btn" id="btn-allwords">Show all ${DICT.length} words</button>`; $('btn-allwords').onclick = () => { renderWordList.all = true; renderWordList(''); }; return; }
  const rows = DICT.filter((d) => !f || d.k.includes(f) || d.e.toLowerCase().includes(f)).slice(0, f ? 200 : 600);
  $('wordlist').innerHTML = rows.map((d) => `<div class="w"><span class="k">${esc(d.k)}</span><span class="e">${esc(d.e)}</span></div>`).join('');
}
$('wordfilter').addEventListener('input', (e) => renderWordList(e.target.value));
const BIKE = '<g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><circle cx="36" cy="62" r="13"/><circle cx="84" cy="62" r="13"/><path d="M36 62 L52 40 L72 40 L84 62 M52 40 L62 62 L72 40 M48 32 L58 32 M72 40 L69 30 L78 30"/></g>';
const GALLERY = [
  [`<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="56" fill="#1f5fbf"/><g transform="translate(0,-2)">${BIKE}</g></svg>`, 'Blue circle + bike = bike path. Bikes go here.'],
  [`<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="56" fill="#1f5fbf"/><g transform="translate(6,28) scale(.55)">${BIKE}</g><g fill="#fff"><circle cx="86" cy="58" r="6"/><path d="M80 68h12l4 26h-6l-3-16-3 16h-6z"/></g><line x1="60" y1="20" x2="60" y2="100" stroke="#fff" stroke-width="3"/></svg>`, 'Bike + person = shared path. Ring your bell, go slow.'],
  [`<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" fill="#fff" stroke="#d62828" stroke-width="10"/><g transform="translate(6,8) scale(.9)"><g fill="none" stroke="#14202b" stroke-width="5" stroke-linecap="round"><circle cx="36" cy="62" r="13"/><circle cx="84" cy="62" r="13"/><path d="M36 62 L52 40 L72 40 L84 62 M52 40 L62 62 L72 40"/></g></g><line x1="22" y1="98" x2="98" y2="22" stroke="#d62828" stroke-width="10"/></svg>`, 'Red ring + slash = NOT allowed (no bikes).'],
  [`<svg viewBox="0 0 120 120"><path d="M60 8 L114 106 H6 Z" fill="#ffd400" stroke="#d62828" stroke-width="8" stroke-linejoin="round"/><text x="60" y="94" font-size="64" text-anchor="middle" font-weight="900" fill="#14202b">!</text></svg>`, 'Triangle = warning. Read the words under it (위험 danger, 주의 caution).'],
  [`<svg viewBox="0 0 120 120"><path d="M8 14 H112 L60 110 Z" fill="#d62828"/><text x="60" y="58" font-size="30" text-anchor="middle" font-weight="900" fill="#fff">정지</text></svg>`, 'Red upside-down triangle 정지 = STOP.'],
  [`<svg viewBox="0 0 120 120"><rect x="34" y="8" width="52" height="104" rx="6" fill="#d62828"/><rect x="42" y="26" width="36" height="56" fill="#ffe3e3"/><text x="60" y="22" font-size="11" text-anchor="middle" fill="#fff" font-weight="700">인증센터</text></svg>`, 'Red phone-booth = stamp booth (인증센터). Stamp your passport inside.'],
  [`<svg viewBox="0 0 120 120"><rect x="6" y="22" width="108" height="76" rx="8" fill="#0b6e4f"/><text x="12" y="52" font-size="15" fill="#fff" font-weight="700">← 이포보</text><text x="108" y="52" font-size="13" fill="#fff" text-anchor="end">12km</text><text x="12" y="84" font-size="15" fill="#fff" font-weight="700">여주 →</text><text x="108" y="84" font-size="13" fill="#fff" text-anchor="end">25km</text></svg>`, 'Direction sign: a place + km. Scan it and the app tells you if it\'s ahead or behind.'],
  [`<svg viewBox="0 0 120 120"><rect x="0" y="0" width="120" height="120" rx="10" fill="#6b7280"/><rect x="18" y="0" width="84" height="120" fill="#1f5fbf"/><g transform="translate(14,10) scale(.78)">${BIKE}</g><path d="M60 82 v28 M50 96 l10 -14 10 14" stroke="#fff" stroke-width="5" fill="none"/></svg>`, 'Bike symbol painted on the ground = you are on a bike path.']
];

$('signgallery').innerHTML = GALLERY.map(([s, t]) => `<div class="g">${s}<div>${esc(t)}</div></div>`).join('');
$('signphoto').addEventListener('change', async (e) => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  $('photobox').classList.remove('hidden'); $('signimg').src = URL.createObjectURL(f);
  const st = $('ocrstate'); st.textContent = 'Reading the Korean… (a few seconds)';
  try {
    if (!window.OCR) throw new Error('no ocr');
    if (!navigator.onLine && !(await window.OCR.available())) throw new Error('not downloaded');
    const txt = await window.OCR.read(f); if (!txt) throw new Error('empty');
    $('signtext').value = txt; renderSign();
    st.innerHTML = 'Done — meanings below. If something looks off, <b>press and hold the words in the photo → Translate</b>.';
  } catch (err) {
    st.innerHTML = err.message === 'not downloaded' ? 'The sign reader isn\'t downloaded yet (Help → Download now). For now: <b>press and hold the words in the photo → Translate</b>.' : 'Couldn\'t read it automatically. <b>Press and hold the words in the photo → Translate</b>.';
  }
  e.target.value = '';
});

// ---------- help ----------
['name', 'phone', 'hotel'].forEach((k) => { const el = $('c-' + k); el.value = store.get('c_' + k, ''); el.addEventListener('input', () => store.set('c_' + k, el.value)); });
$('btn-showson').onclick = () => { const ph = $('c-phone').value.trim(), nm = $('c-name').value.trim(); showCard(`제 아들${nm ? ' (' + nm + ')' : ''}에게 전화해 주세요.\n${ph || '(번호를 먼저 입력하세요)'}\n미국 번호예요.`, `"Please call my son${nm ? ' ' + nm : ''}: ${ph || 'add the number in Help first'}. It's a US number."`); };
$('btn-showhotel').onclick = () => { const ht = $('c-hotel').value.trim(); showCard(ht ? `여기로 가고 싶어요:\n${ht}` : '(먼저 숙소 주소를 입력하세요)', ht ? '"I want to go here." (your hotel)' : 'Type or paste tonight\'s hotel in Help first.'); };
$('btn-hosp').onclick = () => { S.nearCat = 9; $('search').value = ''; show('near'); };
$('phrases').innerHTML = window.PHRASES.map((g, gi) => `<div class="card"><div class="card-title">${esc(g.group)}</div>${g.items.map(([k, e], i) => `<div class="phr" data-g="${gi}" data-i="${i}"><div class="k">${esc(k.replace('{next}', '…'))}</div><div class="e">${esc(e.replace('{nextEn}', 'the next stop'))}</div></div>`).join('')}</div>`).join('');
$('phrases').querySelectorAll('.phr').forEach((e) => e.onclick = () => { const [k, en] = window.PHRASES[+e.dataset.g].items[+e.dataset.i]; const ns = S.info?.nextStop || C[1]; showCard(k.replace('{next}', ns.ko), en.replace('{nextEn}', ns.en)); });
const simSel = $('sim');
simSel.innerHTML = '<option value="">Off — use real GPS</option>' + C.map((c, i) => `<option value="s${i}">Stop ${c.n}: ${esc(c.en)}</option>`).join('') + '<option value="off">Demo: lost near Yeoju</option>';
simSel.onchange = () => {
  const v = simSel.value;
  if (!v) { S.sim = null; if (S.pos) update(); else setStatus('', 'Finding your location', 'GPS works without a phone signal'); return; }
  if (v === 'off') { S.sim = { lat: 37.3263662 + 0.0055, lng: 127.6052106 - 0.0015, acc: 8 }; S.simName = 'near Yeoju, off the path'; }
  else { const c = C[+v.slice(1)]; S.sim = { lat: c.lat + 0.0003, lng: c.lng + 0.0003, acc: 8 }; S.simName = 'Stop ' + c.n + ' ' + c.en; }
  lastClosest = 0; MapV.follow(); update(); show('ride');
};
$('btn-simoff').onclick = () => { simSel.value = ''; simSel.onchange(); };
function renderTonight() {
  const t = store.get('tonight', null), card = $('tonightcard');
  if (!t) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden'); $('tonight-name').textContent = t.name; const h = here();
  $('tonight-sub').textContent = [t.en && t.en !== t.name ? t.en : '', h ? fmtD(hav(h.lat, h.lng, t.lat, t.lng)) + ' ' + DIRS[card8(bearing(h.lat, h.lng, t.lat, t.lng))] : ''].filter(Boolean).join(' · ');
}
$('tonightcard').onclick = () => { const t = store.get('tonight', null); if (t) placeSheet({ name: t.name, ko: t.name, cat: 3, lat: t.lat, lng: t.lng, phone: t.phone }); };
async function dlStatus() {
  if (!window.OFFLINE) return;
  const c = await window.OFFLINE.counts(), ocr = window.OCR ? await window.OCR.available() : false;
  const pct = Math.round((c.tiles / c.totalTiles) * 100);
  $('dlstat').innerHTML = `Terrain ${pct}% · Photos ${c.photoPlaces}/${LM.length} places · Sign reader ${ocr ? 'ready' : 'not yet'}`;
  $('dlbar').style.width = Math.round((pct + c.photoPlaces / LM.length * 100 + (ocr ? 100 : 0)) / 3) + '%';
  const all = pct >= 98 && c.photoPlaces >= LM.length - 3 && c.typePhotos >= c.typeTotal - 4 && ocr;
  $('btn-dl').innerHTML = all ? ico('check') + ' Everything downloaded' : ico('download') + ' Download now';
  $('dlstat').innerHTML = `<div class="dlrow">${ico(pct >= 98 ? 'check' : 'download')} Terrain map <b>${pct}%</b></div><div class="dlrow">${ico(c.photoPlaces >= LM.length - 3 ? 'check' : 'download')} Landmark photos <b>${c.photoPlaces} of ${LM.length}</b></div><div class="dlrow">${ico(c.typePhotos >= c.typeTotal - 4 ? 'check' : 'download')} Food &amp; stay photos <b>${c.typePhotos} of ${c.typeTotal}</b></div><div class="dlrow">${ico(ocr ? 'check' : 'download')} Sign reader <b>${ocr ? 'ready' : 'not yet'}</b></div>`;
  S.dlAll = all; offlineBadge();
  return all;
}
$('btn-dl').onclick = async () => {
  if (!navigator.onLine) { $('dlstat').textContent = 'You need wifi for this one-time download.'; return; }
  $('btn-dl').disabled = true; $('btn-dl').textContent = 'Downloading… keep the app open';
  try { await window.OFFLINE.download((p) => { $('dlbar').style.width = Math.round(p.done / p.total * 100) + '%'; $('dlstat').textContent = `${p.msg} · ${p.done}/${p.total}${p.failed ? ' · ' + p.failed + ' skipped' : ''}`; }); } catch (e) {}
  $('btn-dl').disabled = false; dlStatus();
};
function setTheme(dark) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'; store.set('dark', dark); $('darkchk').checked = dark;
  if (S.view === 'ride') MapV.open();
}
$('darkchk').onchange = () => setTheme($('darkchk').checked);

// ---------- MAP ----------
const MapV = (() => {
  const cv = $('map'); let ctx, W = 0, H = 0, dpr = 1;
  const wx = (lng) => (lng + 180) / 360;
  const wy = (lat) => { const s = Math.sin(lat * RAD); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };
  const latOf = (y) => 90 - 360 * Math.atan(Math.exp((y - 0.5) * 2 * Math.PI)) / Math.PI;
  const segW = SEGS.map((s) => { const a = new Float64Array(s.length * 2); s.forEach((p, i) => { a[2 * i] = wx(p[1]); a[2 * i + 1] = wy(p[0]); }); return a; });
  const poiW = new Float64Array(P.length * 2); P.forEach((p, i) => { poiW[2 * i] = wx(p[1]); poiW[2 * i + 1] = wy(p[0]); });
  const v = { x: wx(127.9), y: wy(36.4), z: 7, follow: true, inited: false };
  const cats = new Set([0, 2, 3, 4, 5]);
  let terrainOn = store.get('terrain', true); $('terrainchk').checked = terrainOn;
  $('terrainchk').onchange = () => { terrainOn = $('terrainchk').checked; store.set('terrain', terrainOn); draw(); };
  document.querySelectorAll('#layers input[data-cat]').forEach((i) => { i.onchange = () => { i.checked ? cats.add(+i.dataset.cat) : cats.delete(+i.dataset.cat); draw(); }; });
  $('m-layers').onclick = () => { $('layers').classList.toggle('hidden'); $('m-layers').classList.toggle('active'); };
  const scale = () => 256 * Math.pow(2, v.z);
  const sx = (x) => (x - v.x) * scale() + W / 2, sy = (y) => (y - v.y) * scale() + H / 2;
  // keep the user's dot above the bottom sheet
  const yOff = () => -Math.min(110, H * 0.12);
  function resize() { dpr = window.devicePixelRatio || 1; W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function fitAll() { const x0 = wx(126.55), x1 = wx(129.05), y0 = wy(37.65), y1 = wy(35.05); v.x = (x0 + x1) / 2; v.y = (y0 + y1) / 2 + 0.0006; v.z = Math.log2(Math.min(W / (x1 - x0), (H - 300) / (y1 - y0)) * 0.9 / 256); v.follow = false; }
  let pending = false;
  function redrawSoon() { if (pending || S.view !== 'ride') return; pending = true; requestAnimationFrame(() => { pending = false; if (v.follow && here()) { v.x = wx(here().lng); v.y = wy(here().lat) - yOff() / scale(); } draw(); }); }
  const iconReady = () => redrawSoon();
  const visible = [];
  const dark = () => document.documentElement.dataset.theme === 'dark';
  function label(t, X, Y, col) { ctx.font = '600 12.5px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.lineWidth = 3.5; ctx.strokeStyle = dark() ? 'rgba(10,16,24,.9)' : 'rgba(255,255,255,.95)'; ctx.strokeText(t, X, Y); ctx.fillStyle = dark() ? '#e8eef5' : col; ctx.fillText(t, X, Y); }
  function draw() { try { drawInner(); } catch (e) { console.warn('map draw', e); } }
  function drawInner() {
    if (!ctx) return; visible.length = 0;
    ctx.fillStyle = dark() ? '#16201c' : '#eef2ee'; ctx.fillRect(0, 0, W, H);
    const sc = scale(), pad = 40;
    const tAlpha = v.z <= 12 ? 1 : v.z >= 14 ? 0 : 1 - (v.z - 12) / 2;
    if (terrainOn && window.TERRAIN && tAlpha > 0) {
      ctx.save(); ctx.globalAlpha = tAlpha; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      const tz = Math.max(7, Math.min(12, Math.round(v.z))), n = 2 ** tz, tp = sc / n;
      const x0 = Math.floor((v.x - W / 2 / sc) * n), x1 = Math.floor((v.x + W / 2 / sc) * n), y0 = Math.floor((v.y - H / 2 / sc) * n), y1 = Math.floor((v.y + H / 2 / sc) * n);
      if ((x1 - x0 + 1) * (y1 - y0 + 1) <= 48) for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        const dx = sx(x / n), dy = sy(y / n); const t = window.TERRAIN.get(tz, x, y, redrawSoon);
        if (t) { ctx.drawImage(t, dx, dy, tp + 0.6, tp + 0.6); continue; }
        for (let pz = tz - 1; pz >= 7; pz--) {
          const sh = tz - pz, px = x >> sh, py = y >> sh, p = window.TERRAIN.get(pz, px, py, redrawSoon);
          if (p) { const sub = p.width / (1 << sh); ctx.drawImage(p, (x - (px << sh)) * sub, (y - (py << sh)) * sub, sub, sub, dx, dy, tp + 0.6, tp + 0.6); break; }
        }
      }
      ctx.fillStyle = dark() ? 'rgba(8,14,22,.55)' : 'rgba(255,255,255,.12)'; ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    // bike path
    for (const pass of [0, 1]) {
      ctx.strokeStyle = pass ? '#1452b8' : (dark() ? 'rgba(76,141,255,.35)' : 'rgba(255,255,255,.95)');
      ctx.lineWidth = pass ? (v.z > 12 ? 5 : 3.5) : (v.z > 12 ? 10 : 7); ctx.lineJoin = ctx.lineCap = 'round';
      ctx.beginPath();
      for (const a of segW) { for (let i = 0; i < a.length; i += 2) { const X = (a[i] - v.x) * sc + W / 2, Y = (a[i + 1] - v.y) * sc + H / 2; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); } }
      ctx.stroke();
    }
    // POIs
    if (v.z >= 13) {
      const big = v.z >= 15; let n = 0;
      for (let i = 0; i < P.length && n < 700; i++) {
        const c = P[i][2]; if (!cats.has(c)) continue;
        const X = (poiW[2 * i] - v.x) * sc + W / 2, Y = (poiW[2 * i + 1] - v.y) * sc + H / 2;
        if (X < -pad || Y < -pad || X > W + pad || Y > H + pad) continue; n++;
        if (big) { const im = IC.mapIcon(CAT[c].i, CAT[c].col, 30, iconReady); if (im) ctx.drawImage(im, X - 13, Y - 13, 26, 26); }
        else { ctx.fillStyle = CAT[c].col; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X, Y, 4.5, 0, 7); ctx.fill(); ctx.stroke(); }
        visible.push({ X, Y, kind: 'poi', i });
        if (big && v.z >= 16.5) { ctx.textAlign = 'center'; label(String(P[i][3] || '').slice(0, 16), X, Y + 24, '#3c4a5b'); }
      }
    }
    // landmarks
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    LM.forEach((l, i) => {
      const X = sx(wx(l.lng)), Y = sy(wy(l.lat)); if (X < -pad || Y < -pad || X > W + pad || Y > H + pad) return;
      if (v.z < 8.3) return;
      const ph = !!PHOTO[l.en], s = v.z >= 9 ? 28 : 20; const im = IC.mapIcon(ph ? 'camera' : 'star', ph ? '#c2255c' : '#d39e00', 32, iconReady);
      if (im) ctx.drawImage(im, X - s / 2, Y - s / 2, s, s);
      if (v.z >= 11) label(l.en, X, Y + s / 2 + 10, '#6b4e00');
      visible.push({ X, Y, kind: 'lm', i });
    });
    // tonight
    const tn = store.get('tonight', null);
    if (tn) { const X = sx(wx(tn.lng)), Y = sy(wy(tn.lat)); const im = IC.mapIcon('bed', '#6741d9', 36, iconReady); if (im) ctx.drawImage(im, X - 16, Y - 16, 32, 32); if (v.z >= 10) label('Tonight', X, Y + 26, '#5a2fc2'); visible.push({ X, Y, kind: 'tonight' }); }
    // stops
    C.forEach((c, i) => {
      const X = sx(wx(c.lng)), Y = sy(wy(c.lat)); if (X < -pad || Y < -pad || X > W + pad || Y > H + pad) return;
      if (v.z < 8.3) { ctx.fillStyle = '#d93025'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y, 5, 0, 7); ctx.fill(); ctx.stroke(); visible.push({ X, Y, kind: 'stop', i }); return; }
      const r = v.z >= 9 ? 13 : 10;
      ctx.fillStyle = '#d93025'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `700 ${r > 10 ? 13 : 11}px -apple-system, sans-serif`; ctx.fillText(c.n, X, Y + 1);
      if (v.z >= 9) label(c.en, X, Y - r - 10, '#9b1c13');
      visible.push({ X, Y, kind: 'stop', i });
    });
    // guide line to target
    const hh = here();
    if (hh && S.target) {
      const X0 = sx(wx(hh.lng)), Y0 = sy(wy(hh.lat)), X1 = sx(wx(S.target.lng)), Y1 = sy(wy(S.target.lat));
      ctx.save(); ctx.setLineDash([8, 7]); ctx.strokeStyle = '#6741d9'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(X1, Y1); ctx.stroke(); ctx.restore();
      const im = IC.mapIcon('pin', '#6741d9', 36, iconReady); if (im) ctx.drawImage(im, X1 - 16, Y1 - 16, 32, 32);
    }
    // me
    const h = here();
    if (h) {
      const X = sx(wx(h.lng)), Y = sy(wy(h.lat));
      const accPx = (h.acc || 0) / 1000 / (40075 * Math.cos(h.lat * RAD)) * sc;
      if (accPx > 14) { ctx.fillStyle = 'rgba(20,82,184,.12)'; ctx.beginPath(); ctx.arc(X, Y, accPx, 0, 7); ctx.fill(); }
      ctx.save(); ctx.translate(X, Y);
      ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 6; ctx.beginPath(); ctx.arc(0, 0, 14, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#1452b8';
      if (S.heading != null) { ctx.rotate(S.heading * RAD); ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7.5, 8); ctx.lineTo(0, 4); ctx.lineTo(-7.5, 8); ctx.closePath(); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(0, 0, 9.5, 0, 7); ctx.fill(); }
      ctx.restore();
      visible.push({ X, Y, kind: 'me' });
    }
    // scale bar (bottom-left, above the sheet)
    const mpp = 40075016 * Math.cos(latOf(v.y) * RAD) / sc; let m = 100;
    for (const s of [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000]) if (s / mpp < 90) m = s;
    const px = m / mpp, by = H - 230; ctx.fillStyle = dark() ? '#e8eef5' : '#0d1b2a'; ctx.globalAlpha = .75;
    ctx.fillRect(14, by, px, 3); ctx.fillRect(14, by - 5, 2, 8); ctx.fillRect(14 + px - 2, by - 5, 2, 8);
    ctx.font = '600 11.5px -apple-system, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(m >= 1000 ? m / 1000 + ' km' : m + ' m', 14, by - 12); ctx.globalAlpha = 1;
  }
  // gestures
  const ptrs = new Map(); let start = null, moved = 0, lastTap = 0, pin = null;
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY }); moved = 0; start = { t: Date.now() }; if (ptrs.size === 2) pinchStart(); $('layers').classList.add('hidden'); $('m-layers').classList.remove('active'); if (RS.dataset.state !== 'peek') setSheet('peek'); });
  cv.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return; const old = ptrs.get(e.pointerId); const cur = { x: e.offsetX, y: e.offsetY }; ptrs.set(e.pointerId, cur);
    if (ptrs.size === 1) { const dx = cur.x - old.x, dy = cur.y - old.y; moved += Math.abs(dx) + Math.abs(dy); v.x -= dx / scale(); v.y -= dy / scale(); if (moved > 6) setFollow(false); draw(); }
    else if (ptrs.size === 2) pinchMove();
  });
  const end = (e) => {
    if (!ptrs.has(e.pointerId)) return; const was = ptrs.size; ptrs.delete(e.pointerId);
    if (was === 1 && moved < 8 && Date.now() - start.t < 400) { const now = Date.now(); if (now - lastTap < 300) { zoomAt(e.offsetX, e.offsetY, 1); lastTap = 0; } else { lastTap = now; tap(e.offsetX, e.offsetY); } }
    pin = null;
  };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  function pinchStart() { const [a, b] = [...ptrs.values()]; pin = { d: Math.hypot(a.x - b.x, a.y - b.y), z: v.z }; moved = 99; }
  function pinchMove() {
    if (!pin) return pinchStart(); const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const before = { x: v.x + (mx - W / 2) / scale(), y: v.y + (my - H / 2) / scale() };
    v.z = Math.max(6, Math.min(18, pin.z + Math.log2(d / pin.d)));
    v.x = before.x - (mx - W / 2) / scale(); v.y = before.y - (my - H / 2) / scale(); setFollow(false); draw();
  }
  function zoomAt(X, Y, dz) { const b = { x: v.x + (X - W / 2) / scale(), y: v.y + (Y - H / 2) / scale() }; v.z = Math.max(6, Math.min(18, v.z + dz)); v.x = b.x - (X - W / 2) / scale(); v.y = b.y - (Y - H / 2) / scale(); draw(); }
  cv.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.offsetX, e.offsetY, -e.deltaY / 300); }, { passive: false });
  function tap(X, Y) {
    let best = null, bd = 26;
    for (const f of visible) { const d = Math.hypot(f.X - X, f.Y - Y) - (f.kind === 'stop' ? 6 : f.kind === 'lm' ? 5 : 0); if (d < bd) { bd = d; best = f; } }
    if (!best) return;
    if (best.kind === 'stop') stopSheet(C[best.i]);
    else if (best.kind === 'lm') lmSheet(LM[best.i]);
    else if (best.kind === 'poi') { const p = P[best.i]; placeSheet({ name: p[3], ko: p[3], cat: p[2], lat: p[0], lng: p[1], phone: p[4] }); }
    else if (best.kind === 'tonight') $('tonightcard').onclick();
    else if (best.kind === 'me') setSheet('half');
  }
  function setFollow(f) { v.follow = f; $('m-me').classList.toggle('active', f); }
  $('m-in').onclick = () => { v.z = Math.min(18, v.z + 1); draw(); };
  $('m-out').onclick = () => { v.z = Math.max(6, v.z - 1); draw(); };
  $('m-me').onclick = () => { const h = here(); if (!h) return; v.z = Math.max(v.z, 14.5); v.x = wx(h.lng); v.y = wy(h.lat) - yOff() / scale(); setFollow(true); draw(); };
  $('m-all').onclick = () => { fitAll(); setFollow(false); draw(); };
  window.addEventListener('resize', () => { if (S.view === 'ride') { resize(); draw(); } });
  function open() {
    resize();
    if (!v.inited) { v.inited = true; const h = here(); if (h) { v.z = 14.5; v.x = wx(h.lng); v.y = wy(h.lat) - yOff() / scale(); setFollow(true); } else { fitAll(); setFollow(false); } }
    draw();
  }
  function goto(lat, lng, z) { resize(); v.inited = true; v.z = z || 14; v.x = wx(lng); v.y = wy(lat) - yOff() / scale(); setFollow(false); draw(); }
  let gotFix = false;
  function firstFix() { if (gotFix) return; gotFix = true; v.inited = true; const h = here(); if (h && nearestOnPath(h.lat, h.lng).d > 40) { resize(); fitAll(); setFollow(false); return; } v.z = 14.5; setFollow(true); }
  function follow() { const h = here(); if (!h) return; v.inited = true; v.z = Math.max(v.z, 14.5); setFollow(true); }
  return { open, goto, redrawSoon, follow, firstFix };
})();

// ---------- offline status ----------
function offlineBadge() {
  const b = $('netbadge');
  if (!S.appSaved) { b.textContent = navigator.onLine ? 'Saving app…' : 'Not saved'; b.className = 'netbadge warn'; }
  else if (!S.dlAll) { b.textContent = 'Downloads needed ›'; b.className = 'netbadge warn'; }
  else { b.textContent = '✓ Fully offline'; b.className = 'netbadge ok'; }
}
$('netbadge').onclick = (e) => { e.stopPropagation(); show('help'); setTimeout(() => $('dlcard').scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); };
const ASSETS = ['./', 'index.html', 'style.css', 'app.js', 'data.js', 'words.js', 'food.js', 'offline.js', 'icons.js', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
async function offlineStatus() {
  const b = $('netbadge');
  try {
    if (!('serviceWorker' in navigator) || !window.caches) { b.textContent = ''; return; }
    const keys = await caches.keys(); let have = 0;
    for (const a of ASSETS) { for (const k of keys) { if (await (await caches.open(k)).match(a)) { have++; break; } } }
    S.appSaved = have === ASSETS.length; offlineBadge();
    if (!S.appSaved) setTimeout(offlineStatus, 2500);
  } catch (e) { b.textContent = ''; }
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(offlineStatus).catch(() => offlineStatus());
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
} else offlineStatus();

// ---------- boot ----------
IC.hydrate();
setTheme(store.get('dark', false));
dirLabel();
renderWordList('');
renderTonight();
dlStatus();
const last = store.get('lastpos', null);
if (last) { S.pos = last; MapV.firstFix(); update(); setStatus('', 'Using your last known spot', 'Waiting for a fresh GPS fix'); }
drawArrow();
MapV.open();
startGPS();
})();
