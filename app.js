(() => {
'use strict';
const D = window.ROUTE_DATA, C = D.centers, LM = D.landmarks, P = D.pois, SEGS = D.segs, TOTAL = D.totalKm;
const CAT = {
  0: { e: '🍜', n: 'Food', ko: '식당', col: '#d9480f' }, 1: { e: '☕', n: 'Café', ko: '카페', col: '#8d5524' },
  2: { e: '🏪', n: 'Convenience store', ko: '편의점', col: '#2b8a3e' }, 3: { e: '🛏', n: 'Place to sleep', ko: '숙소', col: '#7048e8' },
  4: { e: '🔧', n: 'Bike shop', ko: '자전거 수리점', col: '#e67700' }, 5: { e: '🚻', n: 'Toilet', ko: '화장실', col: '#1971c2' },
  6: { e: '⭐', n: 'Landmark', ko: '명소', col: '#e0a000' }
};
const $ = (id) => document.getElementById(id);
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
const ARROWS = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'];
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
    if (s.length === 1) { const d = hav(lat, lng, s[0][0], s[0][1]); if (d < best) { best = d; bl = s[0][0]; bn = s[0][1]; } }
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
const S = { pos: null, sim: null, heading: null, toBusan: store.get('toBusan', true), info: null, view: 'where', nearCat: 0, wake: null };
const here = () => S.sim || S.pos;

// ---------- tabs ----------
function show(v) {
  S.view = v;
  document.querySelectorAll('.view').forEach((e) => e.classList.toggle('active', e.id === 'v-' + v));
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  window.scrollTo(0, 0);
  if (v === 'map') MapV.open();
  if (v === 'near') renderNear();
  if (v === 'route') renderRoute();
}
document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => show(b.dataset.v)));

// ---------- sheets ----------
function sheet(html) { $('sheet-body').innerHTML = html; $('sheet').classList.remove('hidden'); }
function closeSheet() { $('sheet').classList.add('hidden'); }
$('sheet-x').onclick = closeSheet;
$('sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });
function showCard(ko, en) { $('show-ko').textContent = ko; $('show-en').textContent = en || ''; $('show').classList.remove('hidden'); }
$('show-x').onclick = () => $('show').classList.add('hidden');

const omMap = (lat, lng, name) => `om://map?v=1&ll=${lat.toFixed(6)},${lng.toFixed(6)}&n=${encodeURIComponent(name || 'Here')}`;
const omSearch = (q) => { const h = here(); const ll = h ? `cll=${h.lat.toFixed(5)},${h.lng.toFixed(5)}&` : ''; return `om://search?${ll}query=${encodeURIComponent(q)}&locale=en`; };

function placeSheet(o) {
  // o: {name, ko, cat, lat, lng, phone, desc, km}
  const h = here();
  let rel = '';
  if (h) {
    const d = hav(h.lat, h.lng, o.lat, o.lng), b = bearing(h.lat, h.lng, o.lat, o.lng);
    rel = `<p class="mid">${ARROWS[card8(b)]} ${fmtD(d)} ${DIRS[card8(b)]}</p>`;
  }
  const km = o.km != null ? o.km : kmAt(o.lat, o.lng);
  const off = nearestOnPath(o.lat, o.lng).d;
  const catLine = CAT[o.cat] ? `${CAT[o.cat].e} ${CAT[o.cat].n}` : '';
  sheet(`<div class="lbl">${catLine}</div><h3>${esc(o.name)}</h3>${o.ko && o.ko !== o.name ? `<div class="ko">${esc(o.ko)}</div>` : ''}
    ${rel}<div class="sub">≈ km ${Math.round(km)} of the route${off > 0.15 ? ` · ${fmtD(off)} off the bike path` : ' · right by the bike path'}</div>
    ${o.desc ? `<p class="desc">${esc(o.desc)}</p>` : ''}
    ${o.phone ? `<a class="btn" href="tel:${esc(o.phone.replace(/[^0-9+]/g, ''))}">📞 Call ${esc(o.phone)}</a>` : ''}
    <button class="btn primary" data-act="maphere">🗺 Show on map</button>
    <button class="btn" data-act="showko">🗣️ Show a local: "I want to go here"</button>
    <a class="btn" href="${omMap(o.lat, o.lng, o.ko || o.name)}">Open in Organic Maps (streets)</a>`);
  $('sheet-body').querySelector('[data-act=maphere]').onclick = () => { closeSheet(); show('map'); MapV.goto(o.lat, o.lng, 15); };
  $('sheet-body').querySelector('[data-act=showko]').onclick = () => showCard(`${o.ko || o.name}\n여기에 가고 싶어요. 어느 쪽이에요?`, `"${o.name}" — I want to go here. Which way is it?`);
}
function stopSheet(c) {
  const lms = LM.filter((l) => l.km >= c.km && l.km < (C[c.n] ? C[c.n].km : 9999));
  const near = c.near || {};
  placeSheet({ name: `Stop ${c.n}: ${c.en}`, ko: c.ko + ' 인증센터', cat: -1, lat: c.lat, lng: c.lng, km: c.km,
    desc: `${c.staffed ? 'STAFFED booth: buy/certify your bike passport here. ' + (c.hours ? 'Hours: ' + c.hours + '. ' : '') : 'Self-service red stamp booth. '}Within 2 km: ${near[0] || 0} restaurants, ${near[2] || 0} convenience stores, ${near[3] || 0} places to sleep.${lms.length ? ' Next landmarks: ' + lms.map((l) => l.en).join(', ') + '.' : ''} Address: ${c.addr}`,
    phone: c.phone });
}

// ---------- GPS ----------
let watchId = null;
function startGPS() {
  if (!('geolocation' in navigator)) { setStatus('err', 'No GPS in this browser', ''); return; }
  $('btn-startgps').classList.add('hidden');
  watchId = navigator.geolocation.watchPosition((p) => {
    S.pos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, t: p.timestamp };
    store.set('lastpos', S.pos);
    update();
  }, (err) => {
    if (err.code === 1) {
      setStatus('err', 'Location is turned off for this app', 'iPhone Settings → Privacy & Security → Location Services → turn on, and allow "While Using". Then come back.');
      $('btn-startgps').classList.remove('hidden');
    } else if (!S.pos) setStatus('off', 'Looking for GPS signal…', 'Go outside, away from tall buildings. This can take a minute.');
  }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
}
$('btn-startgps').onclick = startGPS;
function setStatus(cls, a, b) { const g = $('gpsbox'); g.className = 'card status ' + cls; $('st-line').textContent = a; $('st-sub').textContent = b; }

// ---------- compass ----------
$('btn-compass').onclick = async () => {
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') return;
    }
    window.addEventListener('deviceorientation', (e) => {
      let h = e.webkitCompassHeading; if (h == null && e.absolute && e.alpha != null) h = 360 - e.alpha;
      if (h != null) { S.heading = h; drawArrow(); MapV.redrawSoon(); }
    }, true);
    $('btn-compass').textContent = '🧭 Compass on — hold phone flat';
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
  return { h, np, km, prev, nxt, nextStop, nextLm };
}
let lastClosest = 0;
function update() {
  const I = S.info = compute(); if (!I) return;
  const { h, np, km } = I;
  const acc = (h.acc || 10) / 1000;
  const onPath = np.d <= Math.max(0.06, acc * 0.8);
  if (S.sim) setStatus(onPath ? 'on' : 'off', (onPath ? '✅ On the path' : '⚠️ Off the path') + ' (practice)', 'Pretending you are at ' + S.simName + '. Turn off in Help.');
  else setStatus(onPath ? 'on' : 'off', onPath ? '✅ You are on the bike path' : '⚠️ You are off the bike path', `GPS accuracy ±${Math.round(h.acc || 0)} m`);
  $('path-dist').textContent = onPath ? 'On it ✓' : fmtD(np.d) + ' away';
  if (onPath) $('path-dir').textContent = I.nextStop ? `Follow it ${S.toBusan ? 'toward Busan' : 'toward Seoul'}. Watch for signs saying ${I.nextStop.ko}.` : 'You made it! 🎉';
  else { const b = bearing(h.lat, h.lng, np.lat, np.lng); $('path-dir').textContent = `Head ${DIRS[card8(b)]} ${ARROWS[card8(b)]} to reach it`; }
  drawArrow();
  $('between').innerHTML = `${I.prev.n}. ${esc(I.prev.en)} → ${I.nxt.n}. ${esc(I.nxt.en)}`;
  $('progbar').style.width = (km / TOTAL * 100).toFixed(1) + '%';
  const done = S.toBusan ? km : TOTAL - km, left = TOTAL - done;
  $('km-done').textContent = `≈ ${Math.round(km)} km from start`;
  $('km-left').textContent = `${Math.round(TOTAL - km)} km (${mi(TOTAL - km)} mi) to Busan`;
  const ns = I.nextStop;
  if (ns) {
    $('next-lbl').textContent = `Next stamp booth (${S.toBusan ? 'toward Busan' : 'toward Seoul'})`;
    $('next-name').textContent = `Stop ${ns.n}: ${ns.en}`; $('next-ko').textContent = ns.ko;
    $('next-km').textContent = `≈ ${fmtD(Math.abs(ns.km - km))} along the path (${mi(Math.abs(ns.km - km))} mi)${ns.staffed ? ' · staffed' : ''}`;
  } else { $('next-name').textContent = 'Finished! 🎉'; $('next-ko').textContent = ''; $('next-km').textContent = ''; }
  const nl = I.nextLm;
  if (nl) { $('lm-name').textContent = '⭐ ' + nl.en; $('lm-sub').textContent = `${nl.ko} · ≈ ${fmtD(Math.abs(nl.km - km))} ahead${nl.off > 0.3 ? ' · ' + fmtD(nl.off) + ' off the path' : ''}`; }
  else { $('lm-name').textContent = '—'; $('lm-sub').textContent = ''; }
  const now = Date.now();
  if (now - lastClosest > 8000 || S.sim) { lastClosest = now; renderClosest(); }
  $('gps-meta').textContent = S.sim ? '' : `Last GPS fix ${new Date(h.t || now).toLocaleTimeString()}`;
  if (S.view === 'map') MapV.redrawSoon();
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
  const html = [2, 0, 5, 3].map((cat) => {
    const r = nearestOf(cat, 1, h)[0];
    return `<div data-cat="${cat}"><b>${CAT[cat].e} ${r ? fmtD(r.d) : '—'}</b>${CAT[cat].n}</div>`;
  }).join('');
  $('closest').innerHTML = html;
  $('closest').querySelectorAll('div').forEach((d) => d.onclick = () => { S.nearCat = +d.dataset.cat; setChip(); show('near'); });
}
$('nextcard').onclick = () => S.info?.nextStop && stopSheet(S.info.nextStop);
$('lmcard').onclick = () => { const l = S.info?.nextLm; if (l) placeSheet({ name: l.en, ko: l.ko, cat: 6, lat: l.lat, lng: l.lng, desc: l.desc, km: l.km }); };
$('btn-stops').onclick = () => show('route');
$('btn-dir').onclick = () => { S.toBusan = !S.toBusan; store.set('toBusan', S.toBusan); dirLabel(); update(); };
function dirLabel() { $('btn-dir').textContent = S.toBusan ? 'Busan (south) — tap to switch' : 'Seoul (north) — tap to switch'; }
$('btn-showlocal').onclick = () => {
  const ns = S.info?.nextStop;
  const ko = `저는 자전거로 ${S.toBusan ? '부산' : '서울'}까지 가는 여행자예요.\n국토종주 자전거길로 ${ns ? ns.ko + '까지 ' : ''}가려면 어느 쪽으로 가야 해요?`;
  showCard(ko, `"I'm a traveler riding my bike to ${S.toBusan ? 'Busan' : 'Seoul'}. Which way is the cross-country bike path${ns ? ' to ' + ns.en : ''}?"`);
};
$('btn-om').onclick = () => { const h = here(); location.href = h ? omMap(h.lat, h.lng, 'Me') : 'om://map?v=1'; };
$('btn-wake').onclick = async () => {
  try {
    if (S.wake) { await S.wake.release(); S.wake = null; $('btn-wake').textContent = '🔆 Keep screen on'; return; }
    S.wake = await navigator.wakeLock.request('screen'); $('btn-wake').textContent = '🔆 Screen stays on (tap to stop)';
  } catch (e) { $('btn-wake').textContent = 'Not supported on this phone'; }
};
document.addEventListener('visibilitychange', async () => {
  if (S.wake && document.visibilityState === 'visible') { try { S.wake = await navigator.wakeLock.request('screen'); } catch (e) {} }
});

// ---------- arrow ----------
function drawArrow() {
  const cv = $('arrow'), ctx = cv.getContext('2d'), W = cv.width, I = S.info;
  ctx.clearRect(0, 0, W, W);
  ctx.beginPath(); ctx.arc(W / 2, W / 2, W / 2 - 3, 0, 7); ctx.fillStyle = '#f1f5f9'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#cfd8e3'; ctx.stroke();
  if (!I) return;
  const onPath = I.np.d <= Math.max(0.06, (I.h.acc || 10) / 1000 * 0.8);
  if (onPath) {
    ctx.fillStyle = '#1b8a3a'; ctx.beginPath(); ctx.arc(W / 2, W / 2, W / 2 - 14, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(W * .3, W * .52); ctx.lineTo(W * .45, W * .66); ctx.lineTo(W * .72, W * .36); ctx.stroke();
    return;
  }
  const b = bearing(I.h.lat, I.h.lng, I.np.lat, I.np.lng);
  const rot = (S.heading != null ? b - S.heading : b) * RAD;
  // north tick when no compass
  if (S.heading == null) { ctx.fillStyle = '#5b6875'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('N', W / 2, 20); }
  ctx.save(); ctx.translate(W / 2, W / 2); ctx.rotate(rot);
  ctx.fillStyle = '#d62828'; ctx.beginPath(); ctx.moveTo(0, -W * .36); ctx.lineTo(W * .2, W * .1); ctx.lineTo(W * .06, W * .06); ctx.lineTo(W * .06, W * .3); ctx.lineTo(-W * .06, W * .3); ctx.lineTo(-W * .06, W * .06); ctx.lineTo(-W * .2, W * .1); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ---------- nearby ----------
function setChip() { document.querySelectorAll('#chips .chip').forEach((c) => c.classList.toggle('on', +c.dataset.cat === S.nearCat)); }
document.querySelectorAll('#chips .chip').forEach((c) => c.onclick = () => { S.nearCat = +c.dataset.cat; setChip(); renderNear(); });
let lastNear = 0;
function miniArrow(b) { return `<span style="display:inline-block;transform:rotate(${Math.round(S.heading != null ? b - S.heading : b)}deg);font-size:26px">⬆</span>`; }
function renderNear(auto) {
  if (auto && Date.now() - lastNear < 10000) return; lastNear = Date.now();
  const h = here(), cat = S.nearCat, list = $('nearlist');
  if (cat === 9) {
    $('nearhead').textContent = '';
    list.innerHTML = `<div class="card sos"><h2>🏥 Hospital / clinic</h2>
      <p>Hurt badly or very sick? <b>Call 119</b>. The ambulance comes to you and takes you to the right hospital. It's free.</p>
      <a class="btn big red" href="tel:119">🚑 Call 119</a>
      <a class="btn big" href="tel:+8221330">📞 1330 English interpreter</a>
      <a class="btn big primary" href="${omSearch('hospital')}">🔎 Find hospitals in Organic Maps</a>
      <a class="btn" href="${omSearch('pharmacy')}">💊 Find a pharmacy in Organic Maps</a>
      <button class="btn" id="hosp-card">🗣️ Show a local: "Take me to a hospital"</button>
      <p class="fine">Organic Maps works offline once the South Korea map is downloaded. Words on signs: 병원 = hospital, 응급실 = emergency room, 약국 = pharmacy, 의원 = clinic.</p></div>`;
    $('hosp-card').onclick = () => showCard('몸이 안 좋아요.\n가장 가까운 병원에 데려다 주세요.', '"I feel unwell. Please take me to the nearest hospital."');
    return;
  }
  if (!h) { $('nearhead').textContent = 'Waiting for GPS… (or use Practice mode in Help)'; list.innerHTML = ''; return; }
  let items;
  if (cat === 6) items = LM.map((l) => ({ name: l.en, ko: l.ko, lat: l.lat, lng: l.lng, desc: l.desc, km: l.km, cat: 6, d: hav(h.lat, h.lng, l.lat, l.lng) })).sort((a, b) => a.d - b.d).slice(0, 25);
  else items = nearestOf(cat, 40, h).map(({ p, d }) => ({ name: p[3], ko: p[3], lat: p[0], lng: p[1], phone: p[4], cat, d }));
  const myKm = S.info ? S.info.km : 0;
  $('nearhead').textContent = `${CAT[cat].n} closest to you (straight-line distance). Tap one for details.`;
  list.innerHTML = items.map((o, i) => {
    const b = bearing(h.lat, h.lng, o.lat, o.lng), k = o.km != null ? o.km : kmAt(o.lat, o.lng);
    const diff = (k - myKm) * (S.toBusan ? 1 : -1);
    const rel = Math.abs(diff) < 1 ? 'right around you' : diff > 0 ? `≈ ${Math.round(diff)} km ahead on route` : `≈ ${Math.round(-diff)} km behind you`;
    return `<div class="place" data-i="${i}"><div class="pa">${miniArrow(b)}<div>${DIRS[card8(b)].replace('north', 'N').replace('south', 'S').replace('east', 'E').replace('west', 'W')}</div></div>
      <div class="pn"><b>${esc(o.name)}</b><span>${rel}</span></div><div class="pd">${fmtD(o.d)}</div></div>`;
  }).join('') || '<p class="fine">Nothing in the list near here.</p>';
  list.querySelectorAll('.place').forEach((e) => e.onclick = () => placeSheet(items[+e.dataset.i]));
}

// ---------- route ----------
const CLIMBS = [
  [238, 'Sojoryeong Pass — first mountain climb (≈ 390 m high). Take it slow.'],
  [249, 'Ihwaryeong Pass — the BIGGEST climb, about 5 km uphill to ≈ 530 m. Rest area & café at the top.'],
  [312, 'Short steep hills around Gyeongcheondae lookout.'],
  [478, 'Steep hill right after Hapcheon-Changnyeong Weir. Walking up is fine.'],
  [513, 'Steep hills (Bakjin / Yeongaji passes) before Namji. Walking up is fine.']
];
function renderRoute() {
  drawElev();
  const myKm = S.info ? S.info.km : null;
  let html = '', placedMe = false;
  C.forEach((c, i) => {
    const nk = C[i + 1] ? C[i + 1].km : 99999;
    if (myKm != null && !placedMe && myKm < c.km) { html += `<div class="youhere">📍 You are here · ≈ km ${Math.round(myKm)}</div>`; placedMe = true; }
    const passed = myKm != null && (S.toBusan ? c.km < myKm - 0.5 : c.km > myKm + 0.5);
    const lms = LM.filter((l) => l.km >= c.km && l.km < nk && !(l.off === 0 && l.km === c.km && l.en.includes(c.en.split(' ')[0])));
    const near = c.near || {};
    html += `<div class="stop${passed ? ' passed' : ''}" data-i="${i}"><div class="t"><b>${c.n}. ${esc(c.en)}</b><span>km ${c.km}</span></div>
      <div class="ko">${esc(c.ko)}</div>
      <div class="meta">${c.staffed ? '🟥 Staffed booth (passport) · ' : ''}within 2 km: 🍜${near[0] || 0} 🏪${near[2] || 0} 🛏${near[3] || 0}${C[i + 1] ? ` · next stop in ${C[i + 1].km - c.km} km` : ''}</div>
      ${lms.length ? `<div class="lms">${lms.map((l) => `⭐ ${esc(l.en)} (km ${l.km})`).join('<br>')}</div>` : ''}</div>`;
    CLIMBS.filter(([k]) => k >= c.km && k < nk).forEach(([k, t]) => { html += `<div class="climb">⛰️ km ${k}: ${t}</div>`; });
  });
  if (myKm != null && !placedMe) html += `<div class="youhere">📍 You are here · ≈ km ${Math.round(myKm)}</div>`;
  $('stoplist').innerHTML = html;
  $('stoplist').querySelectorAll('.stop').forEach((e) => e.onclick = () => stopSheet(C[+e.dataset.i]));
}
function drawElev() {
  const cv = $('elev'), dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 340, H = 170;
  cv.width = W * dpr; cv.height = H * dpr; const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
  const E = D.ele, maxE = 560, pad = 40, X = (km) => pad + (km / TOTAL) * (W - pad - 6), Y = (e) => H - 18 - (Math.max(0, e) / maxE) * (H - 34);
  ctx.fillStyle = '#e7f0fa'; ctx.strokeStyle = '#1f78c8'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(X(0), Y(0)); E.forEach((e, i) => ctx.lineTo(X(i * 0.5), Y(e))); ctx.lineTo(X(E.length * 0.5), Y(0)); ctx.closePath(); ctx.fill();
  ctx.beginPath(); E.forEach((e, i) => i ? ctx.lineTo(X(i * 0.5), Y(e)) : ctx.moveTo(X(0), Y(e))); ctx.stroke();
  ctx.fillStyle = '#5b6875'; ctx.font = '11px sans-serif'; ctx.textAlign = 'right';
  [0, 250, 500].forEach((m) => { ctx.fillText(m + 'm', pad - 2, Y(m) + 4); });
  ctx.textAlign = 'center';
  C.forEach((c) => { ctx.fillStyle = '#d62828'; ctx.fillRect(X(c.km) - 1, H - 18, 2, 6); });
  [0, 100, 200, 300, 400, 500, 600].forEach((k) => { ctx.fillStyle = '#5b6875'; ctx.fillText(k, X(k), H - 2); });
  if (S.info) { ctx.strokeStyle = '#d62828'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X(S.info.km), 8); ctx.lineTo(X(S.info.km), H - 18); ctx.stroke(); }
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
  // distances like "12km"
  const dists = []; const re = /(\d+(?:\.\d+)?)\s*(km|㎞|킬로미터|킬로|k\b)/gi; let m;
  while ((m = re.exec(text))) dists.push(+m[1]);
  return { hits, dists };
}
function renderSign() {
  const text = $('signtext').value.trim(), out = $('signresult');
  if (!text) { out.innerHTML = ''; return; }
  const { hits, dists } = readSign(text);
  const myKm = S.info ? S.info.km : null;
  const seen = new Set();
  let html = hits.filter((h) => { const key = h.d.k + h.d.e; if (seen.has(key)) return false; seen.add(key); return true; }).map(({ d }) => {
    let cls = d.cat === 'warn' ? 'warn' : d.cat === 'food' ? 'food' : (d.cat === 'stop' || d.cat === 'town') ? 'plc' : '';
    let more = '';
    if (d.km != null) {
      if (myKm != null) {
        const diff = (d.km - myKm) * (S.toBusan ? 1 : -1);
        more = Math.abs(diff) < 2 ? '📍 You are right about here.' : diff > 0 ? `📍 About ${Math.round(diff)} km AHEAD of you — keep going this way.` : `📍 About ${Math.round(-diff)} km BEHIND you — you already passed it.`;
      } else more = `📍 About km ${d.km} of the route (from the start in Incheon).`;
    }
    return `<div class="hit ${cls}"><div class="k">${esc(d.k)}</div><div class="e">${esc(d.e)}</div>${more ? `<div class="m">${more}</div>` : ''}</div>`;
  }).join('');
  if (dists.length) html += `<div class="hit"><div class="e">The numbers with "km" are distances: ${dists.map((x) => x + ' km (' + (Math.round(x * 6.21) / 10) + ' mi)').join(', ')}.</div></div>`;
  if (!hits.length) html = `<div class="hit warn"><div class="e">No words I know. Try scanning closer, or open the Translate app → Camera for a full translation.</div></div>`;
  out.innerHTML = html;
}
$('btn-read').onclick = renderSign;
$('signtext').addEventListener('input', () => { clearTimeout(renderSign.t); renderSign.t = setTimeout(renderSign, 400); });
$('btn-clear').onclick = () => { $('signtext').value = ''; $('signresult').innerHTML = ''; $('signtext').focus(); };
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

// ---------- help ----------
['name', 'phone', 'hotel'].forEach((k) => { const el = $('c-' + k); el.value = store.get('c_' + k, ''); el.addEventListener('input', () => store.set('c_' + k, el.value)); });
$('btn-showson').onclick = () => {
  const ph = $('c-phone').value.trim(), nm = $('c-name').value.trim();
  showCard(`제 아들${nm ? ' (' + nm + ')' : ''}에게 전화해 주세요.\n${ph || '(번호를 먼저 입력하세요)'}\n미국 번호예요.`, `"Please call my son${nm ? ' ' + nm : ''}: ${ph || '— add the number in Help first'}. It's a US number."`);
};
$('btn-showhotel').onclick = () => {
  const ht = $('c-hotel').value.trim();
  showCard(ht ? `여기로 가고 싶어요:\n${ht}` : '(먼저 Help에 숙소 주소를 입력하세요)', ht ? '"I want to go here." (your hotel)' : 'Type or paste tonight\'s hotel address in Help first.');
};
$('btn-hosp').onclick = () => { S.nearCat = 9; setChip(); show('near'); };
$('phrases').innerHTML = window.PHRASES.map((g, gi) => `<div class="card"><h2>${esc(g.group)}</h2>${g.items.map(([k, e], i) => `<div class="phr" data-g="${gi}" data-i="${i}"><div class="k">${esc(k.replace('{next}', '…'))}</div><div class="e">${esc(e.replace('{nextEn}', 'the next stop'))}</div></div>`).join('')}<p class="fine">Tap a phrase to show it big.</p></div>`).join('');
$('phrases').querySelectorAll('.phr').forEach((e) => e.onclick = () => {
  const [k, en] = window.PHRASES[+e.dataset.g].items[+e.dataset.i];
  const ns = S.info?.nextStop || C[1];
  showCard(k.replace('{next}', ns.ko), en.replace('{nextEn}', ns.en));
});
// practice mode
const simSel = $('sim');
simSel.innerHTML = '<option value="">— Real GPS —</option>' + C.map((c, i) => `<option value="s${i}">Stop ${c.n}: ${esc(c.en)}</option>`).join('') + '<option value="off">Demo: lost, 600 m off the path near Yeoju</option>';
simSel.onchange = () => {
  const v = simSel.value;
  if (!v) { S.sim = null; update(); if (!S.pos) setStatus('', 'Finding you…', ''); return; }
  if (v === 'off') { S.sim = { lat: 37.3263662 + 0.0055, lng: 127.6052106 - 0.0015, acc: 8 }; S.simName = 'a spot near Yeoju, off the path'; }
  else { const c = C[+v.slice(1)]; S.sim = { lat: c.lat + 0.0003, lng: c.lng + 0.0003, acc: 8 }; S.simName = 'Stop ' + c.n + ' ' + c.en; }
  lastClosest = 0; update(); show('where');
};
$('btn-simoff').onclick = () => { simSel.value = ''; simSel.onchange(); };

// ---------- MAP ----------
const MapV = (() => {
  const cv = $('map'); let ctx, W = 0, H = 0, dpr = 1;
  const wx = (lng) => (lng + 180) / 360;
  const wy = (lat) => { const s = Math.sin(lat * RAD); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };
  const lngOf = (x) => x * 360 - 180;
  const latOf = (y) => 90 - 360 * Math.atan(Math.exp((y - 0.5) * 2 * Math.PI)) / Math.PI;
  const segW = SEGS.map((s) => { const a = new Float64Array(s.length * 2); s.forEach((p, i) => { a[2 * i] = wx(p[1]); a[2 * i + 1] = wy(p[0]); }); return a; });
  const poiW = new Float64Array(P.length * 2); P.forEach((p, i) => { poiW[2 * i] = wx(p[1]); poiW[2 * i + 1] = wy(p[0]); });
  const v = { x: wx(127.9), y: wy(36.4), z: 7, follow: false, inited: false };
  const cats = new Set([0, 2, 3, 4, 5]);
  document.querySelectorAll('#maplegend input').forEach((i) => i.onchange = () => { i.checked ? cats.add(+i.dataset.cat) : cats.delete(+i.dataset.cat); draw(); });
  const scale = () => 256 * Math.pow(2, v.z);
  const sx = (x) => (x - v.x) * scale() + W / 2, sy = (y) => (y - v.y) * scale() + H / 2;
  function resize() { dpr = window.devicePixelRatio || 1; W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function fitAll() { const x0 = wx(126.55), x1 = wx(129.05), y0 = wy(37.65), y1 = wy(35.05); v.x = (x0 + x1) / 2; v.y = (y0 + y1) / 2; v.z = Math.log2(Math.min(W / (x1 - x0), H / (y1 - y0)) * 0.9 / 256); v.follow = false; }
  let pending = false; function redrawSoon() { if (pending || S.view !== 'map') return; pending = true; requestAnimationFrame(() => { pending = false; if (v.follow && here()) { v.x = wx(here().lng); v.y = wy(here().lat); } draw(); }); }
  const visible = []; // for taps
  function draw() {
    if (!ctx) return; visible.length = 0;
    ctx.fillStyle = '#eef3ee'; ctx.fillRect(0, 0, W, H);
    const sc = scale(), pad = 40;
    // path
    for (const pass of [0, 1]) {
      ctx.strokeStyle = pass ? '#1f78c8' : '#ffffff'; ctx.lineWidth = pass ? (v.z > 12 ? 5 : 3.5) : (v.z > 12 ? 9 : 6.5); ctx.lineJoin = ctx.lineCap = 'round';
      ctx.beginPath();
      for (const a of segW) { for (let i = 0; i < a.length; i += 2) { const X = (a[i] - v.x) * sc + W / 2, Y = (a[i + 1] - v.y) * sc + H / 2; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); } }
      ctx.stroke();
    }
    // POIs
    if (v.z >= 13) {
      const big = v.z >= 15; ctx.font = (big ? 18 : 13) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let n = 0;
      for (let i = 0; i < P.length && n < 900; i++) {
        const c = P[i][2]; if (!cats.has(c)) continue;
        const X = (poiW[2 * i] - v.x) * sc + W / 2, Y = (poiW[2 * i + 1] - v.y) * sc + H / 2;
        if (X < -pad || Y < -pad || X > W + pad || Y > H + pad) continue; n++;
        if (big || v.z >= 14) { ctx.fillText(CAT[c].e, X, Y); }
        else { ctx.fillStyle = CAT[c].col; ctx.beginPath(); ctx.arc(X, Y, 4, 0, 7); ctx.fill(); }
        visible.push({ X, Y, kind: 'poi', i });
        if (big && v.z >= 16.5) { ctx.fillStyle = '#14202b'; ctx.font = '12px sans-serif'; ctx.fillText(P[i][3].slice(0, 14), X, Y + 16); ctx.font = '18px sans-serif'; }
      }
    }
    // landmarks
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    LM.forEach((l, i) => {
      const X = sx(wx(l.lng)), Y = sy(wy(l.lat)); if (X < -pad || Y < -pad || X > W + pad || Y > H + pad) return;
      ctx.font = (v.z >= 9 ? 22 : 15) + 'px sans-serif'; ctx.fillText('⭐', X, Y);
      if (v.z >= 11) { label(l.en, X, Y + 20, '#6b4e00'); }
      visible.push({ X, Y, kind: 'lm', i });
    });
    // stops
    C.forEach((c, i) => {
      const X = sx(wx(c.lng)), Y = sy(wy(c.lat)); if (X < -pad || Y < -pad || X > W + pad || Y > H + pad) return;
      const r = v.z >= 9 ? 13 : 9;
      ctx.fillStyle = '#d62828'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `bold ${r > 10 ? 13 : 10}px sans-serif`; ctx.fillText(c.n, X, Y + 1);
      if (v.z >= 9) label(c.en, X, Y - r - 10, '#8a1414');
      visible.push({ X, Y, kind: 'stop', i });
    });
    // me
    const h = here();
    if (h) {
      const X = sx(wx(h.lng)), Y = sy(wy(h.lat));
      const accPx = (h.acc || 0) / 1000 / (40075 * Math.cos(h.lat * RAD)) * sc;
      if (accPx > 12) { ctx.fillStyle = 'rgba(31,120,200,.15)'; ctx.beginPath(); ctx.arc(X, Y, accPx, 0, 7); ctx.fill(); }
      if (S.heading != null) { ctx.save(); ctx.translate(X, Y); ctx.rotate(S.heading * RAD); ctx.fillStyle = 'rgba(31,120,200,.45)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 38, -Math.PI / 2 - 0.45, -Math.PI / 2 + 0.45); ctx.closePath(); ctx.fill(); ctx.restore(); }
      ctx.fillStyle = '#1f78c8'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(X, Y, 10, 0, 7); ctx.fill(); ctx.stroke();
      visible.push({ X, Y, kind: 'me' });
    }
    // scale bar
    const mpp = 40075016 * Math.cos(latOf(v.y) * RAD) / sc; let m = 100; const steps = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
    for (const s of steps) { if (s / mpp < 110) m = s; }
    const px = m / mpp; ctx.fillStyle = '#14202b'; ctx.fillRect(12, H - 60, px, 4); ctx.font = '12px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(m >= 1000 ? m / 1000 + ' km' : m + ' m', 12, H - 70);
    ctx.textAlign = 'right'; ctx.font = 'bold 14px sans-serif'; ctx.fillText('N ⬆', W - 70, H - 64);
  }
  function label(t, X, Y, col) { ctx.font = 'bold 13px sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.strokeText(t, X, Y); ctx.fillStyle = col; ctx.fillText(t, X, Y); }
  // gestures
  const ptrs = new Map(); let start = null, moved = 0, lastTap = 0;
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY }); moved = 0; start = { t: Date.now() }; if (ptrs.size === 2) pinchStart(); });
  cv.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return; const old = ptrs.get(e.pointerId); const cur = { x: e.offsetX, y: e.offsetY }; ptrs.set(e.pointerId, cur);
    if (ptrs.size === 1) { const dx = cur.x - old.x, dy = cur.y - old.y; moved += Math.abs(dx) + Math.abs(dy); v.x -= dx / scale(); v.y -= dy / scale(); if (moved > 6) v.follow = false; draw(); }
    else if (ptrs.size === 2) pinchMove();
  });
  const end = (e) => {
    if (!ptrs.has(e.pointerId)) return; const was = ptrs.size; ptrs.delete(e.pointerId);
    if (was === 1 && moved < 8 && Date.now() - start.t < 400) {
      const now = Date.now();
      if (now - lastTap < 300) { zoomAt(e.offsetX, e.offsetY, 1); lastTap = 0; } else { lastTap = now; tap(e.offsetX, e.offsetY); }
    }
    pin = null;
  };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  let pin = null;
  function pinchStart() { const [a, b] = [...ptrs.values()]; pin = { d: Math.hypot(a.x - b.x, a.y - b.y), z: v.z }; moved = 99; }
  function pinchMove() {
    if (!pin) return pinchStart(); const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const before = { x: v.x + (mx - W / 2) / scale(), y: v.y + (my - H / 2) / scale() };
    v.z = Math.max(6, Math.min(18, pin.z + Math.log2(d / pin.d)));
    v.x = before.x - (mx - W / 2) / scale(); v.y = before.y - (my - H / 2) / scale(); v.follow = false; draw();
  }
  function zoomAt(X, Y, dz) { const b = { x: v.x + (X - W / 2) / scale(), y: v.y + (Y - H / 2) / scale() }; v.z = Math.max(6, Math.min(18, v.z + dz)); v.x = b.x - (X - W / 2) / scale(); v.y = b.y - (Y - H / 2) / scale(); draw(); }
  cv.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.offsetX, e.offsetY, -e.deltaY / 300); }, { passive: false });
  function tap(X, Y) {
    let best = null, bd = 26;
    for (const f of visible) { const d = Math.hypot(f.X - X, f.Y - Y) - (f.kind === 'stop' ? 6 : f.kind === 'lm' ? 4 : 0); if (d < bd) { bd = d; best = f; } }
    if (!best) return;
    if (best.kind === 'stop') stopSheet(C[best.i]);
    else if (best.kind === 'lm') { const l = LM[best.i]; placeSheet({ name: l.en, ko: l.ko, cat: 6, lat: l.lat, lng: l.lng, desc: l.desc, km: l.km }); }
    else if (best.kind === 'poi') { const p = P[best.i]; placeSheet({ name: p[3], ko: p[3], cat: p[2], lat: p[0], lng: p[1], phone: p[4] }); }
    else if (best.kind === 'me') show('where');
  }
  $('m-in').onclick = () => { v.z = Math.min(18, v.z + 1); draw(); };
  $('m-out').onclick = () => { v.z = Math.max(6, v.z - 1); draw(); };
  $('m-me').onclick = () => { const h = here(); if (!h) return; v.x = wx(h.lng); v.y = wy(h.lat); v.z = Math.max(v.z, 14); v.follow = true; draw(); };
  $('m-all').onclick = () => { fitAll(); draw(); };
  window.addEventListener('resize', () => { if (S.view === 'map') { resize(); draw(); } });
  function open() {
    resize();
    if (!v.inited) { v.inited = true; const h = here(); if (h) { v.x = wx(h.lng); v.y = wy(h.lat); v.z = 14; v.follow = true; } else fitAll(); }
    draw();
  }
  function goto(lat, lng, z) { resize(); v.inited = true; v.x = wx(lng); v.y = wy(lat); v.z = z || 14; v.follow = false; draw(); }
  return { open, goto, redrawSoon };
})();

// ---------- offline status ----------
const ASSETS = ['./', 'index.html', 'style.css', 'app.js', 'data.js', 'words.js', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
async function offlineStatus() {
  const b = $('netbadge');
  try {
    if (!('serviceWorker' in navigator) || !window.caches) { b.textContent = navigator.onLine ? 'Online' : 'Offline'; return; }
    const keys = await caches.keys(); let have = 0;
    for (const a of ASSETS) { for (const k of keys) { if (await (await caches.open(k)).match(a)) { have++; break; } } }
    if (have === ASSETS.length) { b.textContent = '✅ Offline ready'; b.classList.add('ok'); }
    else { b.textContent = navigator.onLine ? '⏳ Saving for offline…' : '⚠️ Not saved yet'; setTimeout(offlineStatus, 2500); }
  } catch (e) { b.textContent = navigator.onLine ? 'Online' : 'Offline'; }
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(offlineStatus).catch(() => offlineStatus());
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
} else offlineStatus();

// ---------- boot ----------
dirLabel();
renderWordList('');
const last = store.get('lastpos', null);
if (last) { S.pos = last; update(); setStatus('off', 'Using last known spot…', 'Waiting for a fresh GPS fix.'); }
drawArrow();
startGPS();
})();
