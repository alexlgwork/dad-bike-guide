// Downloads terrain and landmark photos once (on wifi) and keeps them on the phone.
(() => {
const D = window.ROUTE_DATA;
const TCACHE = 'bk-terrain-v1', PCACHE = 'bk-photos-v1';
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
// Hand-picked Wikimedia Commons photos, chosen at build time (photos.js): LANDMARK_PHOTOS by landmark name,
// PLACE_PHOTOS near each stamp booth ('stop:N') and top-pick stay ('stay:<name>'). The download is this fixed list, so it always finishes.
const LP = window.LANDMARK_PHOTOS || {}, PP = window.PLACE_PHOTOS || {};
const LP_ALL = Object.values(LP).flat(), PP_ALL = Object.values(PP).flat();
async function pool(items, n, fn) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } })); }

const Off = {
  async counts() {
    const tl = tileList();
    const out = { tiles: 0, totalTiles: tl.length, lmPhotos: 0, lmTotal: LP_ALL.length, placePhotos: 0, placeTotal: PP_ALL.length };
    try {
      // the map also saves tiles it shows while riding, so count only the ones on the download list
      const tk = new Set((await (await caches.open(TCACHE)).keys()).map((r) => r.url));
      out.tiles = tl.filter((k) => { const [z, x, y] = k.split('/'); return tk.has(TILE_URL(z, x, y)); }).length;
      const have = new Set((await (await caches.open(PCACHE)).keys()).map((r) => r.url));
      out.lmPhotos = LP_ALL.filter((p) => have.has(p.src)).length;
      out.placePhotos = PP_ALL.filter((p) => have.has(p.src)).length;
    } catch (e) {}
    return out;
  },
  async download(onProgress) {
    if (Off.running) return; Off.running = true;
    try {
      const tiles = tileList(); const tc = await caches.open(TCACHE); const pc = await caches.open(PCACHE);
      let done = 0, failed = 0; const total = tiles.length + LP_ALL.length + PP_ALL.length + 1;
      const tick = (msg) => onProgress && onProgress({ done, total, failed, msg });
      await pool(tiles, 6, async (k) => {
        const [z, x, y] = k.split('/').map(Number), url = TILE_URL(z, x, y);
        try { if (!(await tc.match(url))) { const r = await fetch(url, { mode: 'cors' }); if (r.ok) await tc.put(url, r); else failed++; } } catch (e) { failed++; }
        done++; if (done % 5 === 0) tick('Terrain');
      });
      const photo = (msg) => async (p) => {
        try { if (!(await pc.match(p.src))) { const r = await fetch(p.src, { mode: 'cors' }); if (r.ok) await pc.put(p.src, r); else failed++; } } catch (e) { failed++; }
        done++; if (done % 4 === 0) tick(msg);
      };
      await pool(LP_ALL, 4, photo('Landmark photos'));
      await pool(PP_ALL, 4, photo('Stop & hotel photos'));
      // free the space used by photos an older version searched for on the phone
      const keep = new Set([...LP_ALL, ...PP_ALL].map((p) => p.src));
      for (const r of await pc.keys()) if (!keep.has(r.url)) await pc.delete(r);
      try { tick('Sign reader'); await Ocr.prepare(); } catch (e) { failed++; }
      done++; tick('Done');
      return { done, total, failed };
    } finally { Off.running = false; }
  },
  has: (key) => !!(LP[key] || PP[key] || []).length,
  // saved photos for a landmark or place as object URLs (offline), or straight from Commons when online and not saved yet
  async photos(key) {
    const list = LP[key] || PP[key] || [];
    const pc = await caches.open(PCACHE).catch(() => null); const out = [];
    for (const p of list) {
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
  // the .wasm.js build has the engine inside it; the plain .js build fetches a separate .wasm, which can't load from a blob URL
  core: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-lstm.wasm.js'
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
    // Tesseract treats a corePath not ending in "js" as a folder and adds a file name, so mark the blob URL as a .js file
    const workerPath = await blobUrlFor(OCR_FILES.worker), corePath = (await blobUrlFor(OCR_FILES.core)) + '#core.js';
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
window.OFFLINE = Off; window.TERRAIN = Terrain;
})();
