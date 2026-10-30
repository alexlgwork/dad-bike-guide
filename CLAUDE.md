# Bike Korea — offline iPhone guide for Dad's Seoul → Busan ride

Installable web app (PWA) for the 국토종주 cross-country bike route (Incheon → Busan, ~633 km).
Hosted on GitHub Pages: https://alexlgwork.github.io/dad-bike-guide/ — Dad adds it to his iPhone
Home Screen once on wifi; after that it must work with no signal.

## Files
- `index.html` — layout: Ride (full-screen map + nav banner + bottom sheet), Search, Signs, Route, Help.
- `app.js` — all app logic (GPS, map canvas, search, sheets, route timeline, sign reader, help).
- `data.js` — generated route data: 26 stamp booths, 35 landmarks, ~22k POIs `[lat, lng, cat, name, phone?]`
  (cat 0 food, 1 café, 2 convenience, 3 lodging, 4 bike shop, 5 toilet), path segments, elevation, `riders` indexes.
- `words.js` — Korean sign dictionary, towns with km, stop aliases, phrase cards.
- `food.js` — Hangul romanization + food/lodging type guessed from the Korean name; chain names.
- `offline.js` — one-time downloads to Cache Storage: terrain tiles (AWS Terrarium, z7–12 along the route),
  Wikimedia Commons photos for landmarks and for each food/lodging *type*, Tesseract OCR (Korean) from jsdelivr.
- `icons.js` — line icon set + canvas map icons. `sw.js` — service worker (bump `CACHE` version on every release).

## Data sources (keep attribution in Help)
- Route lines, booths, bike shops, toilets, sights: OpenStreetMap (ODbL) via github.com/HAGUANGHO/korea-bicycle-road-site.
- Restaurants/cafés/stores/lodging: Korean public data portal (business licence data). Names are Korean only.
- Hotel prices: `TOWN_BEDS` (booking-site listings 2024–26) and `RIDER_STAYS` (Korea by Bike, rider-submitted 2023) in app.js.

## Constraints / decisions
- Must work fully offline after install; no API keys in the client (public site).
- Don't copy Google/Yelp/Naver photos or reviews into the app (their terms forbid storing them). Each place links
  out to Google Maps / Naver Map for live photos & reviews instead. Type photos are labelled "not this exact place".
- Dad reads English; keep Korean text for showing locals and matching signs. UI: clean, map-first, Korean blue, line icons.

## Ideas not done yet
- "Save photos to this place" (Dad attaches his own screenshots/camera photos; store in IndexedDB).
- Verified shortlist of 3–4 stays per overnight town (still open, price, bikes allowed, rating, link).

## Test locally
`python3 -m http.server 8765` in this folder, open http://localhost:8765 with a phone-sized window.
Help → Practice mode simulates being at any stop. After changes: bump `CACHE` in sw.js, commit, push.
