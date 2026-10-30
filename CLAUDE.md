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
  the fixed photo list in photos.js, Tesseract OCR (Korean) from jsdelivr — use the core's `.wasm.js` build and a
  blob URL ending `#core.js` (plain `.js` core needs a separate .wasm that can't load from a blob). Nothing is searched for on the phone, so the
  download always finishes; it also deletes cached photos no longer on the list. Terrain % counts only the download's tiles.
- `photos.js` — hand-picked, free-licence Wikimedia Commons photos (credit shown in the app):
  `PLACE_PHOTOS` (61) near stamp booths (`stop:N`) and top-pick stays (`stay:<name>`), found by Commons geosearch;
  `LANDMARK_PHOTOS` (95, 27 of 35 landmarks) by landmark English name, from geosearch + name search, each checked by eye.
  No usable free photo exists for: Jeongseojin, Gangcheon Weir, Mungyeong Pottery Hall, Gyeongcheondae, Sangju Bicycle
  Museum, Bakjin, Nakdong Rail Park, Imgyeongdae — their sheets simply show no photos.
- `icons.js` — line icon set + canvas map icons. `sw.js` — service worker (bump `CACHE` version on every release).

## Data sources (keep attribution in Help)
- Route lines, booths, bike shops, toilets, sights: OpenStreetMap (ODbL) via github.com/HAGUANGHO/korea-bicycle-road-site.
- Restaurants/cafés/stores/lodging: Korean public data portal (business licence data). Names are Korean only.
- Hotel prices: `TOWN_BEDS` (booking-site listings 2024–26), `RIDER_STAYS` (Korea by Bike, rider-submitted 2023) and
  `TOP_STAYS` (3–4 shortlisted stays per overnight town, prices checked Oct 2026) in app.js. Every stay links to a Google Maps hotel search at its spot for tonight's prices
  (Google Hotels search by name failed for small motels).
- Food prices: `REGION_FOOD` = Korea Consumer Agency 참가격 survey (price.go.kr 외식비, 8 dishes × province), Sep 2026.
  Refresh: POST searchYear/searchMonth to the 외식비 page. Other food types (`FOODPRICE`): starting prices on
  Daangn menus in route towns, Jun–Oct 2026. Chains (`CHAINPRICE`): chain menus / price-change news, 2024–26.

## Constraints / decisions
- Must work fully offline after install; no API keys in the client (public site).
- The site and repo are public, so Google/Yelp/Naver photos and reviews must not be published in them (their terms
  forbid copying them out). The owner does want real place photos on Dad's phone before the trip — see Ideas below.
  Each place links out to Google Maps / Naver Map for live photos & reviews. Generic "what this type usually looks
  like" photos were removed from food/stay pages — the owner only wants real photos of the actual place.
- Real photos of *any* hotel are only available live (Google Maps button "Photos & tonight's price"); there is no
  storable source for all ~1,000 stays. Offline, every stay has a "How to check in" guide (`CHECKIN` in app.js:
  숙박 vs 대실, late check-in, bike, checkout) with phrase cards.
- Tracking Dad: use iPhone Find My → Share My Location (background, needs no app). The PWA can't track in the
  background; it has a "Text my location to my son" button (sms: link to the Help → Son's phone number).
- sw.js may only delete its own `bike-korea-*` caches on update; the `bk-*` caches hold Dad's downloaded maps/photos/OCR.
- Dad reads English; keep Korean text for showing locals and matching signs. UI: clean, map-first, Korean blue, line icons.
- Dad's phone is an iPhone Air (420 × 912 pt, 3x). Launch screen `icons/splash-1260x2736.png` (icon on navy). Home Screen
  mode keeps the clock/battery white over the page (black-translucent), so `#sbar` puts a navy band behind them.
  Tall screens (≥ 860 px) open the ride sheet at 298 px so the next stamp booth row shows in full.

## Ideas not done yet
- Real photos of hotels and restaurants, loaded on Dad's phone before the trip (he should not have to add anything):
  1. Korea Tourism Organization TourAPI (data.go.kr 15101578, KOGL type 1/3 images, free key) — fetch at build time,
     never put the key in the client.
  2. For places TourAPI misses: a private photo pack the owner fills by hand from Google Maps/Naver, kept off the
     public site (e.g. encrypted pack + code typed once on Dad's phone).

## Test locally
`python3 -m http.server 8765` in this folder, open http://localhost:8765 with a phone-sized window.
Help → Practice mode simulates being at any stop. After changes: bump `CACHE` in sw.js, commit, push.
