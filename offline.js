// Downloads terrain and landmark photos once (on wifi) and keeps them on the phone.
(() => {
const D = window.ROUTE_DATA;
const TCACHE = 'bk-terrain-v1', PCACHE = 'bk-photos-v1', META_URL = './_photos/meta.json';
const TILE_URL = (z, x, y) => `https://elevation-tiles-prod.s3.amazonaws.com/terrarium/${z}/${x}/${y}.png`;
const RAD = Math.PI / 180;
const tileOf = (lat, lng, z) => { const n = 2 ** z, s = Math.sin(lat * RAD); return [Math.floor((lng + 180) / 360 * n), Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n)]; };
function tileList() {
  const out = [];
  for (let z = 7; z <= 12; z++) {
    const S = new Set(); const b = z >= 11 ? 1 : 0;
    for (const s of D.segs) for (const p of s) { const [x, y] = tileOf(p[0], p[1], z); for (let i = -b; i <= b; i++) for (let j = -b; j <= b; j++) S.add(`${z}/${x + i}/${y + j}`); }
    S.forEach((k) => out.push(k));
  }
  return out;
}
// Search words for each landmark's photos (Korean Wikipedia first, then Wikimedia Commons).
const Q = {
  'Jeongseojin (Start Line)': ['정서진', 'Jeongseojin Incheon'], 'Ara Maru Sky Walk': ['아라마루', 'Ara Maru Gyeongin Ara canal'],
  'Seonyudo Park': ['선유도공원', 'Seonyudo Park'], "Jeoldusan Martyrs' Shrine": ['절두산 순교성지', 'Jeoldusan'],
  'Yeouido Hangang Park': ['여의도한강공원', 'Yeouido Hangang Park'], 'Seoul National Cemetery': ['국립서울현충원', 'Seoul National Cemetery'],
  'Floating Islands & Rainbow Fountain': ['세빛섬', 'Banpo Bridge Moonlight Rainbow Fountain'], 'Lotte World Tower': ['롯데월드타워', 'Lotte World Tower'],
  'Amsa-dong Prehistoric Village': ['서울 암사동 유적', 'Amsa-dong prehistoric settlement'], 'Dasan Jeong Yak-yong Historic Site': ['정약용 유적지', 'Jeong Yak-yong tomb Namyangju'],
  'Dumulmeori (Two Rivers Meet)': ['두물머리', 'Dumulmeori'], 'Pasaseong Fortress': ['여주 파사성', 'Pasaseong'],
  "King Sejong's Royal Tomb": ['여주 영릉', 'Yeongneung Sejong tomb'], 'Silleuksa Temple': ['신륵사', 'Silleuksa'],
  'Hangang Culture Center (Gangcheon Weir)': ['강천보', 'Gangcheon weir'], 'Chungju Goguryeo Stele': ['충주 고구려비', 'Chungju Goguryeo stele'],
  'Jungangtap Central Pagoda': ['충주 탑평리 칠층석탑', 'Jungangtap Chungju'], 'Tangeumdae': ['탄금대', 'Tangeumdae'],
  'Suju Palbong Rocks': ['수주팔봉', 'Suju Palbong'], 'Suanbo Hot Springs': ['수안보온천', 'Suanbo'],
  'Ihwaryeong Pass (Highest Point)': ['이화령', 'Ihwaryeong'], 'Mungyeong Saejae Park': ['문경새재', 'Mungyeong Saejae'],
  'Mungyeong Pottery Hall': ['문경 도자기', 'Mungyeong pottery'], 'Gyeongcheondae Lookout': ['경천대', 'Gyeongcheondae Sangju'],
  'Sangju Bicycle Museum': ['상주자전거박물관', 'Sangju Bicycle Museum'], 'Nakdong River Biology Museum': ['국립낙동강생물자원관', 'Nakdonggang National Institute of Biological Resources'],
  'Nakdan Weir Rock Buddha': ['낙단보', 'Nakdan weir'], 'Hill 303 Memorial (Waegwan)': ['303고지', 'Hill 303 Waegwan memorial'],
  'The ARC & Gangjeong Weir': ['디아크', 'The ARC Daegu Gangjeong weir'], 'Dodong Seowon Academy': ['도동서원', 'Dodong Seowon'],
  'Bakjin War Memorial': ['박진전쟁기념관', 'Bakjin Changnyeong'], 'Namji Canola Fields': ['남지 유채꽃', 'Namji canola Changnyeong'],
  'Nakdong Rail Park & Wine Cave': ['김해낙동강레일파크', 'Gimhae Nakdonggang Rail Park'], 'Imgyeongdae Pavilion': ['임경대', 'Imgyeongdae Yangsan'],
  'Nakdong Estuary Barrage (FINISH)': ['낙동강하굿둑', 'Nakdong River estuary barrage']
};
// What each kind of food / stay looks like (Korean Wikipedia article, then Commons search).
const TYPE_Q = {
  'Korean BBQ (grill meat at the table)': ['삼겹살', 'Samgyeopsal'], 'Korean fried chicken': ['프라이드 치킨', 'Korean fried chicken'],
  'Pizza': ['피자', 'Pizza Korea'], 'Burgers': ['햄버거', 'Hamburger'], 'Chinese-Korean (black-bean noodles, fried rice)': ['짜장면', 'Jajangmyeon'],
  'Raw fish (sashimi) & seafood': ['생선회', 'Hoe Korean raw fish'], 'River-fish stew (spicy)': ['추어탕', 'Chueo-tang'], 'Grilled eel': ['장어구이', 'Grilled eel Korea'],
  'Hot soup with rice': ['국밥', 'Gukbap'], 'Noodles / noodle soup': ['칼국수', 'Kalguksu'], 'Quick snacks: gimbap rolls, spicy rice cakes': ['김밥', 'Gimbap'],
  'Pork cutlet (not spicy)': ['돈가스', 'Donkatsu'], 'Japanese food': ['초밥', 'Sushi'], 'Tofu dishes': ['순두부찌개', 'Sundubu-jjigae'],
  'Korean home-style meals with side dishes': ['반찬', 'Banchan'], 'Korean soups & stews': ['김치찌개', 'Kimchi-jjigae'], 'Seafood': ['해물탕', 'Haemul-tang'],
  'Dumplings': ['만두', 'Mandu dumplings'], 'Rice porridge (gentle on the stomach)': ['전복죽', 'Juk porridge Korea'], 'Bakery': ['제과점', 'Bakery Korea'],
  'Café': ['카페', 'Cafe Korea'], 'Pub (drinks + bar food)': ['포장마차', 'Pojangmacha'], 'Western food': ['파스타', 'Pasta dish'],
  'Asian (Vietnamese / Thai / Indian)': ['쌀국수', 'Pho'], 'Korean restaurant': ['한정식', 'Hanjeongsik'], 'Chicken or duck dishes (stew, grilled, ginseng soup)': ['삼계탕', 'Samgyetang'],
  'Goat stew': ['흑염소', 'Korean stew'], 'Desserts & sweet snacks': ['빙수', 'Bingsu'], 'Fish cakes (Busan snack)': ['어묵', 'Eomuk'],
  'Motel': ['모텔', 'Motel room South Korea'], 'Hotel': ['호텔', 'Hotel room Korea'], 'Pension (guesthouse, often with kitchen)': ['펜션', 'Pension Korea accommodation'],
  'Homestay / B&B': ['민박', 'Minbak Korea'], 'Guesthouse': ['게스트하우스', 'Guesthouse Korea'], 'Sauna / jjimjilbang (cheap overnight)': ['찜질방', 'Jjimjilbang'],
  'Campground': ['야영장', 'Campground South Korea'], 'Old-style inn (cheap)': ['여관', 'Yeogwan Korea'], 'Resort': ['리조트', 'Resort South Korea'], 'Place to stay': ['모텔', 'Motel room South Korea']
};
const BAD = /(logo|map|지도|위치|icon|flag|emblem|seal|symbol|locat|문장|signature|coat_of_arms|diagram|plan|도면|svg|기호|약도|route|노선)/i;
const strip = (h) => String(h || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
async function j(url) { const r = await fetch(url, { mode: 'cors' }); if (!r.ok) throw new Error(r.status); return r.json(); }
function pickFiles(pages, have) {
  const out = [];
  Object.values(pages || {}).forEach((p) => {
    const ii = p.imageinfo && p.imageinfo[0]; if (!ii || !ii.thumburl) return;
    if (!/jpe?g/i.test(ii.mime || '')) return;
    if ((ii.width || 0) < 500 || BAD.test(p.title)) return;
    if (have.some((h) => h.src === ii.thumburl)) return;
    const em = ii.extmetadata || {};
    out.push({ src: ii.thumburl, credit: strip(em.Artist && em.Artist.value) || 'Unknown author', lic: strip(em.LicenseShortName && em.LicenseShortName.value), page: ii.descriptionurl || '' });
  });
  return out;
}
const II = 'prop=imageinfo&iiprop=url|mime|size|extmetadata&iiurlwidth=900&iiextmetadatafilter=Artist|LicenseShortName';
async function findPhotos(en, qq, max) {
  const [ko, cq] = qq || Q[en] || [en, en]; let photos = [];
  try {
    const s = await j(`https://ko.wikipedia.org/w/api.php?action=query&format=json&origin=*&list=search&srsearch=${encodeURIComponent(ko)}&srlimit=1&srnamespace=0`);
    const title = s.query && s.query.search && s.query.search[0] && s.query.search[0].title;
    if (title) {
      const r = await j(`https://ko.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&titles=${encodeURIComponent(title)}&generator=images&gimlimit=40&${II}`);
      photos = pickFiles(r.query && r.query.pages, photos);
    }
  } catch (e) {}
  if (photos.length < 4) {
    try {
      const r = await j(`https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=12&gsrsearch=${encodeURIComponent(cq + ' filetype:bitmap')}&${II}`);
      photos = photos.concat(pickFiles(r.query && r.query.pages, photos));
    } catch (e) {}
  }
  return photos.slice(0, max || 5);
}
async function pool(items, n, fn) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } })); }

const Off = {
  status: { terrain: 0, terrainTotal: 0, photos: 0, photosTotal: D.landmarks.length, running: false },
  async counts() {
    const out = { tiles: 0, totalTiles: tileList().length, photoPlaces: 0, typePhotos: 0, typeTotal: Object.keys(TYPE_Q).length };
    try {
      const tc = await caches.open(TCACHE); out.tiles = (await tc.keys()).length;
      const meta = await Off.meta(); out.photoPlaces = Object.entries(meta).filter(([k, a]) => !k.startsWith('type:') && a.length).length; out.typePhotos = Object.entries(meta).filter(([k, a]) => k.startsWith('type:') && a.length).length; out.typeTotal = Object.keys(TYPE_Q).length;
    } catch (e) {}
    return out;
  },
  async meta() { try { const c = await caches.open(PCACHE); const r = await c.match(META_URL); return r ? await r.json() : {}; } catch (e) { return {}; } },
  async download(onProgress) {
    if (Off.status.running) return; Off.status.running = true;
    const tiles = tileList(); const tc = await caches.open(TCACHE); const pc = await caches.open(PCACHE);
    let done = 0, failed = 0; const total = tiles.length + D.landmarks.length + Object.keys(TYPE_Q).length + 1;
    const tick = (msg) => onProgress && onProgress({ done, total, failed, msg });
    await pool(tiles, 6, async (k) => {
      const [z, x, y] = k.split('/').map(Number), url = TILE_URL(z, x, y);
      try { if (!(await tc.match(url))) { const r = await fetch(url, { mode: 'cors' }); if (r.ok) await tc.put(url, r); else failed++; } } catch (e) { failed++; }
      done++; if (done % 5 === 0) tick('Terrain');
    });
    const meta = await Off.meta();
    await pool(D.landmarks, 3, async (l) => {
      try {
        let photos = meta[l.en];
        if (!photos || !photos.length) { photos = await findPhotos(l.en); meta[l.en] = photos; }
        for (const p of photos) { if (!(await pc.match(p.src))) { const r = await fetch(p.src, { mode: 'cors' }); if (r.ok) await pc.put(p.src, r); } }
      } catch (e) { failed++; }
      done++; tick('Photos');
    });
    await pool(Object.keys(TYPE_Q), 3, async (t) => {
      try {
        const key = 'type:' + t; let photos = meta[key];
        if (!photos || !photos.length) { photos = await findPhotos(t, TYPE_Q[t], 2); meta[key] = photos; }
        for (const p of photos) { if (!(await pc.match(p.src))) { const r = await fetch(p.src, { mode: 'cors' }); if (r.ok) await pc.put(p.src, r); } }
      } catch (e) { failed++; }
      done++; if (done % 4 === 0) tick('Food & stay photos');
    });
    try { tick('Sign reader'); await Ocr.prepare(); } catch (e) { failed++; }
    await pc.put(META_URL, new Response(JSON.stringify(meta), { headers: { 'Content-Type': 'application/json' } }));
    done++; Off.status.running = false; tick('Done');
    return { done, total, failed };
  },
  // photos for one landmark as object URLs (offline), or live if online and not saved
  async photos(en, type) {
    const key = type ? 'type:' + type : en;
    const meta = await Off.meta(); let list = meta[key];
    if ((!list || !list.length) && navigator.onLine && (!type || TYPE_Q[type])) { try { list = type ? await findPhotos(type, TYPE_Q[type], 2) : await findPhotos(en); } catch (e) { list = []; } }
    const pc = await caches.open(PCACHE).catch(() => null); const out = [];
    for (const p of list || []) {
      let src = null;
      try { const r = pc && await pc.match(p.src); if (r) src = URL.createObjectURL(await r.blob()); } catch (e) {}
      if (!src && navigator.onLine) src = p.src;
      if (src) out.push({ ...p, url: src });
    }
    return out;
  }
};

// ---------- terrain rendering (hillshade + height colors) ----------
const mem = new Map(), loading = new Set();
const STOPS = [[-50, [168, 203, 232]], [-1, [168, 203, 232]], [0, [214, 232, 205]], [60, [198, 225, 180]], [200, [214, 222, 168]], [400, [222, 205, 160]], [700, [200, 175, 140]], [1100, [176, 150, 125]], [1600, [235, 235, 235]]];
function colorFor(e) {
  for (let i = 1; i < STOPS.length; i++) { if (e <= STOPS[i][0]) { const [e0, c0] = STOPS[i - 1], [e1, c1] = STOPS[i]; const t = Math.max(0, Math.min(1, (e - e0) / (e1 - e0))); return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t]; } }
  return STOPS[STOPS.length - 1][1];
}
async function shade(blob, z, y) {
  const bmp = await createImageBitmap(blob); const W = bmp.width, H = bmp.height;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d'); ctx.drawImage(bmp, 0, 0);
  const src = ctx.getImageData(0, 0, W, H).data, el = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) el[i] = src[4 * i] * 256 + src[4 * i + 1] + src[4 * i + 2] / 256 - 32768;
  const lat = 90 - 360 * Math.atan(Math.exp(((y + 0.5) / 2 ** z - 0.5) * 2 * Math.PI)) / Math.PI;
  const px = 40075016 * Math.cos(lat * RAD) / (256 * 2 ** z) * (256 / W);
  const out = ctx.createImageData(W, H), o = out.data, az = 315 * RAD, alt = 45 * RAD, ex = 1.6;
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
    const g = (a, b) => el[Math.min(H - 1, Math.max(0, b)) * W + Math.min(W - 1, Math.max(0, a))];
    const dzdx = ((g(xx + 1, yy - 1) + 2 * g(xx + 1, yy) + g(xx + 1, yy + 1)) - (g(xx - 1, yy - 1) + 2 * g(xx - 1, yy) + g(xx - 1, yy + 1))) / (8 * px) * ex;
    const dzdy = ((g(xx - 1, yy + 1) + 2 * g(xx, yy + 1) + g(xx + 1, yy + 1)) - (g(xx - 1, yy - 1) + 2 * g(xx, yy - 1) + g(xx + 1, yy - 1))) / (8 * px) * ex;
    const slope = Math.atan(Math.hypot(dzdx, dzdy)), aspect = Math.atan2(dzdy, -dzdx);
    let hs = Math.sin(alt) * Math.cos(slope) + Math.cos(alt) * Math.sin(slope) * Math.cos(az - Math.PI / 2 - aspect);
    hs = 0.55 + 0.6 * Math.max(0, hs);
    const e = el[yy * W + xx], col = colorFor(e), i = 4 * (yy * W + xx), k = e < -1 ? 1 : hs;
    o[i] = Math.min(255, col[0] * k); o[i + 1] = Math.min(255, col[1] * k); o[i + 2] = Math.min(255, col[2] * k); o[i + 3] = 255;
  }
  ctx.putImageData(out, 0, 0); return c;
}
const Terrain = {
  get(z, x, y, onReady) {
    const k = `${z}/${x}/${y}`; if (mem.has(k)) { const v = mem.get(k); mem.delete(k); mem.set(k, v); return v; }
    if (!loading.has(k)) {
      loading.add(k);
      (async () => {
        const url = TILE_URL(z, x, y); let r = null;
        try { const tc = await caches.open(TCACHE); r = await tc.match(url); if (!r && navigator.onLine) { const f = await fetch(url, { mode: 'cors' }); if (f.ok) { await tc.put(url, f.clone()); r = f; } } } catch (e) {}
        let cv = false; try { if (r) cv = await shade(await r.blob(), z, y); } catch (e) { cv = false; }
        mem.set(k, cv); if (mem.size > 120) mem.delete(mem.keys().next().value);
        loading.delete(k); if (cv) onReady && onReady();
      })();
    }
    return undefined;
  }
};

// ---------- sign reader engine (Tesseract OCR, runs on the phone) ----------
const OCACHE = 'bk-ocr-v1';
const OCR_FILES = {
  lib: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
  worker: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
  core: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-lstm.js'
};
let ocrWorker = null, ocrBusy = null;
async function blobUrlFor(url) {
  const c = await caches.open(OCACHE); let r = await c.match(url);
  if (!r) { const f = await fetch(url, { mode: 'cors' }); if (!f.ok) throw new Error('fetch ' + f.status); await c.put(url, f.clone()); r = f; }
  return URL.createObjectURL(new Blob([await r.blob()], { type: 'text/javascript' }));
}
async function ocrReady() {
  if (ocrWorker) return ocrWorker;
  if (ocrBusy) return ocrBusy;
  ocrBusy = (async () => {
    if (!window.Tesseract) {
      const u = await blobUrlFor(OCR_FILES.lib);
      await new Promise((ok, bad) => { const s = document.createElement('script'); s.src = u; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
    }
    const workerPath = await blobUrlFor(OCR_FILES.worker), corePath = await blobUrlFor(OCR_FILES.core);
    ocrWorker = await window.Tesseract.createWorker('kor', 1, { workerPath, corePath, workerBlobURL: false });
    return ocrWorker;
  })();
  try { return await ocrBusy; } finally { ocrBusy = null; }
}
const Ocr = {
  async available() { try { const c = await caches.open(OCACHE); return !!(await c.match(OCR_FILES.core)); } catch (e) { return false; } },
  async read(file) {
    const w = await ocrReady();
    const bmp = await createImageBitmap(file); const max = 1600, k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const { data } = await w.recognize(c);
    return (data && data.text || '').trim();
  },
  async prepare() { await ocrReady(); }
};
window.OCR = Ocr;
Off.hasType = (t) => !!TYPE_Q[t];
window.OFFLINE = Off; window.TERRAIN = Terrain;
})();
