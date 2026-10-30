// Line icon set (24×24, stroke = currentColor). Drawn for this app.
(() => {
const P = {
  nav: '<path d="M12 2.8 19.5 20.5 12 16.6 4.5 20.5Z"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  translate: '<path d="M4 5h9M8.5 3v2M6.2 5c.9 3.8 3.6 6.8 6.8 8M10.8 5c-.9 3.8-3.6 6.8-6.8 8M13 21l4-9 4 9M14.4 18h5.2"/>',
  flag: '<path d="M5 21V4M5 4h12l-2.5 4L17 12H5"/>',
  help: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.6"/><path d="m5.6 5.6 3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9"/>',
  food: '<path d="M6.5 3v7.5M4.5 3v5a2 2 0 0 0 4 0V3M6.5 10.5V21M17.5 3c-2.2 1.2-3.5 4-3.5 8h3.5v10"/>',
  bed: '<path d="M3 6v14M3 16h18v4M21 16v-3.5A3.5 3.5 0 0 0 17.5 9H11v7"/><circle cx="7" cy="12" r="1.8"/>',
  wrench: '<path d="M14.3 6.2a4.3 4.3 0 0 1 5.6-2.4l-2.7 2.7.3 2 2 .3 2.7-2.7a4.3 4.3 0 0 1-5.8 5.4L8.2 19.7a2.1 2.1 0 0 1-3-3l8.2-8.2"/>',
  wc: '<circle cx="7" cy="4.8" r="1.6"/><circle cx="17" cy="4.8" r="1.6"/><path d="M5 8.5h4V14H8v6H6v-6H5ZM15.2 8.5h3.6L20.5 15H18.6v5h-3.2v-5h-1.9ZM12 3v18"/>',
  store: '<path d="M4 9.5 5.5 4h13L20 9.5M4.5 9.5V20h15V9.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M10 20v-5h4v5"/>',
  coffee: '<path d="M4 8h12v5.5a5.5 5.5 0 0 1-5.5 5.5h-1A5.5 5.5 0 0 1 4 13.5ZM16 10h1.8a2.2 2.2 0 0 1 0 4.4H16M8 3.5v2M12 3.5v2"/>',
  camera: '<path d="M4 8h3.2L9 5.3h6L16.8 8H20v11H4Z"/><circle cx="12" cy="13.2" r="3.4"/>',
  star: '<path d="m12 3.2 2.7 5.7 6.2.7-4.6 4.2 1.3 6.1L12 16.8l-5.6 3.1 1.3-6.1-4.6-4.2 6.2-.7Z"/>',
  bike: '<circle cx="5.5" cy="16.5" r="3.6"/><circle cx="18.5" cy="16.5" r="3.6"/><path d="m5.5 16.5 3.6-7.5h6.2l3.2 7.5M9.1 9l3.1 7.5L15.3 9M7.5 6h3.2"/>',
  locate: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.6"/><path d="M12 1.8v2.7M12 19.5v2.7M1.8 12h2.7M19.5 12h2.7"/>',
  layers: '<path d="m12 3.5 9 4.8-9 4.8-9-4.8Z"/><path d="m3 12.4 9 4.8 9-4.8M3 16.4l9 4.8 9-4.8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  route: '<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8.2 18H15a3.2 3.2 0 0 0 0-6.4H9A3.2 3.2 0 0 1 9 5.2h6.8"/>',
  phone: '<path d="M5.5 3.5h3.3l1.8 4.6-2.3 1.4a11.5 11.5 0 0 0 6.2 6.2l1.4-2.3 4.6 1.8v3.3a2 2 0 0 1-2.1 2A16.6 16.6 0 0 1 3.5 5.6a2 2 0 0 1 2-2.1Z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  chev: '<path d="m9 5.5 6.5 6.5L9 18.5"/>',
  mountain: '<path d="m2.5 20 6.5-11 4.2 6.5 2.8-4.3 5.5 8.8Z"/>',
  speech: '<path d="M4 4.5h16v11H10l-5 4v-4H4Z"/><path d="M8 9h8M8 12h5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
  moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z"/>',
  hospital: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M12 8v8M8 12h8"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1Z"/>',
  swap: '<path d="M7 20V4M3.5 7.5 7 4l3.5 3.5M17 4v16M13.5 16.5 17 20l3.5-3.5"/>',
  download: '<path d="M12 3.5v11.5M7 10.5l5 5 5-5M4.5 20h15"/>',
  pin: '<path d="M12 21.5s7-6.4 7-12a7 7 0 0 0-14 0c0 5.6 7 12 7 12Z"/><circle cx="12" cy="9.5" r="2.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  alert: '<path d="M12 3.5 2.5 20h19Z"/><path d="M12 10v4.2M12 17.2v.3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.7 3.8 5.7 3.8 9s-1.2 6.3-3.8 9c-2.6-2.7-3.8-5.7-3.8-9S9.4 5.7 12 3Z"/>',
  dot: '<circle cx="12" cy="12" r="4"/>'
};
const svg = (name, extra) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra || ''}>${P[name] || P.dot}</svg>`;
function hydrate(root) { (root || document).querySelectorAll('i[data-i]').forEach((el) => { if (!el.firstChild) el.innerHTML = svg(el.dataset.i); }); }
// white-on-color icon images for the map canvas
const imgCache = {};
function mapIcon(name, bg, size, onload) {
  const k = name + bg + size; if (imgCache[k]) return imgCache[k].complete ? imgCache[k] : null;
  const s = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14.5" fill="${bg}" stroke="#fff" stroke-width="2.5"/><g transform="translate(7.5 7.5) scale(.71)" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${P[name]}</g></svg>`;
  const im = new Image(); im.onload = () => onload && onload(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s); imgCache[k] = im; return null;
}
window.ICONS = { svg, hydrate, mapIcon };
})();
