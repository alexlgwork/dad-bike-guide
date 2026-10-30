// Romanize Korean names and guess what a place serves, from its name. Works offline.
(() => {
const I = ['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h'];
const V = ['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i'];
const F = ['','k','k','k','n','n','n','t','l','k','m','l','l','l','p','l','m','p','p','t','t','ng','t','t','k','t','p','t'];
// final consonant re-pronounced at the start of the next syllable when it begins with ㅇ
const FL = ['','g','kk','ks','n','nj','n','d','r','lg','lm','lb','ls','lt','lp','r','m','b','bs','s','ss','ng','j','ch','k','t','p','h'];
function romanize(str) {
  const chars = [...str], isH = (ch) => { const c = ch ? ch.charCodeAt(0) : 0; return c >= 0xAC00 && c <= 0xD7A3; };
  let out = '', carry = null;
  for (let i = 0; i < chars.length; i++) {
    if (!isH(chars[i])) { out += chars[i]; carry = null; continue; }
    const s = chars[i].charCodeAt(0) - 0xAC00, ini = Math.floor(s / 588), med = Math.floor((s % 588) / 28), fin = s % 28;
    out += (carry != null ? carry : I[ini]) + V[med]; carry = null;
    if (!fin) continue;
    const nx = chars[i + 1], nIni = isH(nx) ? Math.floor((nx.charCodeAt(0) - 0xAC00) / 588) : -1;
    if (nIni === 11 && fin !== 21) { carry = fin === 27 ? '' : FL[fin]; }
    else if (fin === 8 && nIni === 5) { out += 'l'; carry = 'l'; }
    else out += F[fin];
  }
  return out.replace(/(^|[\s(\[\/·-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
}

const CHAINS = [
  ['맥도날드', "McDonald's"], ['롯데리아', 'Lotteria (burgers)'], ['맘스터치', "Mom's Touch (chicken burgers)"], ['버거킹', 'Burger King'],
  ['서브웨이', 'Subway'], ['써브웨이', 'Subway'], ['설빙', 'Sulbing (shaved-ice desserts)'], ['씨유', 'CU (convenience store)'], ['삼진어묵', 'Samjin Eomuk (fish cakes)'], ['도미노', "Domino's Pizza"], ['피자헛', 'Pizza Hut'], ['파리바게뜨', 'Paris Baguette (bakery)'],
  ['파리바게트', 'Paris Baguette (bakery)'], ['뚜레쥬르', 'Tous les Jours (bakery)'], ['스타벅스', 'Starbucks'], ['이디야', 'Ediya Coffee'],
  ['투썸', 'A Twosome Place (café)'], ['메가커피', 'Mega Coffee'], ['MGC', 'Mega Coffee'], ['메가엠지씨', 'Mega Coffee'], ['컴포즈', 'Compose Coffee'],
  ['빽다방', "Paik's Coffee"], ['할리스', 'Hollys Coffee'], ['교촌', 'Kyochon Chicken'], ['비비큐', 'BBQ Chicken'], ['BBQ', 'BBQ Chicken'],
  ['굽네', 'Goobne Chicken'], ['네네치킨', 'NeNe Chicken'], ['bhc', 'bhc Chicken'], ['김밥천국', 'Gimbap Cheonguk (cheap Korean snacks)'],
  ['홍콩반점', 'Hong Kong Banjeom (Chinese-Korean)'], ['본죽', 'Bonjuk (rice porridge)'], ['이삭토스트', 'Isaac Toast (breakfast sandwiches)'],
  ['GS25', 'GS25 (convenience store)'], ['세븐일레븐', '7-Eleven'], ['이마트24', 'emart24 (convenience store)'], ['CU', 'CU (convenience store)'],
  ['미니스톱', 'Ministop (convenience store)'], ['하나로마트', 'Hanaro Mart (supermarket)']
];
// order matters: more specific first
const TYPES = [
  [/닭갈비|닭볶음|백숙|삼계탕|오리|닭한마리/, '🍗', 'Chicken or duck dishes (stew, grilled, ginseng soup)'],
  [/치킨|통닭/, '🍗', 'Korean fried chicken'],
  [/피자/, '🍕', 'Pizza'],
  [/버거/, '🍔', 'Burgers'],
  [/반점|중화|짜장|짬뽕|중국|차이나|마라|양꼬치|훠궈/, '🥟', 'Chinese-Korean (black-bean noodles, fried rice)'],
  [/횟집|회센터|활어|수산|물회|회타운|초장/, '🐟', 'Raw fish (sashimi) & seafood'],
  [/추어|어탕|매운탕|민물|메기|빠가/, '🍲', 'River-fish stew (spicy)'],
  [/곰장어|꼼장어|먹장어/, '🐟', 'Hagfish (spicy grilled, a Busan favourite)'],
  [/장어/, '🐟', 'Grilled eel'],
  [/갈비|고기|삼겹|정육|숯불|한우|돼지|생고기|구이|목살|막창|곱창|불고기|소금구이/, '🥩', 'Korean BBQ (grill meat at the table)'],
  [/국밥|순대|해장국|설렁탕|곰탕|감자탕|뼈|선지|육개장|갈비탕/, '🍲', 'Hot soup with rice'],
  [/염소/, '🍲', 'Goat stew'],
  [/칼국수|국수|냉면|막국수|우동|면옥|소바|수제비|라면/, '🍜', 'Noodles / noodle soup'],
  [/김밥|분식|떡볶이|토스트/, '🍙', 'Quick snacks: gimbap rolls, spicy rice cakes'],
  [/돈까스|돈가스|카츠/, '🍱', 'Pork cutlet (not spicy)'],
  [/초밥|스시|일식|라멘|돈부리|덮밥|이자카야|규동/, '🍣', 'Japanese food'],
  [/순두부|두부/, '🍲', 'Tofu dishes'],
  [/보리밥|비빔밥|쌈밥|한정식|백반|정식|밥상|집밥|기사식당/, '🍚', 'Korean home-style meals with side dishes'],
  [/찌개|전골|찜|생태|동태|탕/, '🍲', 'Korean soups & stews'],
  [/해물|조개|낙지|쭈꾸미|주꾸미|아구|아귀|게장|대게|꽃게|굴|생선/, '🦐', 'Seafood'],
  [/만두/, '🥟', 'Dumplings'],
  [/죽/, '🥣', 'Rice porridge (gentle on the stomach)'],
  [/꽈배기|와플|빙수|젤라|아이스크림|호두과자|붕어빵|디저트|케이크|마카롱/, '🍦', 'Desserts & sweet snacks'],
  [/어묵/, '🍢', 'Fish cakes (Busan snack)'],
  [/빵|베이커리|제과|브레드|도넛|베이글|베이크/, '🥐', 'Bakery'],
  [/카페|커피|다방|티하우스|coffee|cafe/i, '☕', 'Café'],
  [/호프|주점|포차|맥주|술집|비어|펍/, '🍺', 'Pub (drinks + bar food)'],
  [/파스타|레스토랑|이탈리|스테이크|양식|브런치/, '🍝', 'Western food'],
  [/쌀국수|베트남|타이|태국|인도|커리|카레/, '🍜', 'Asian (Vietnamese / Thai / Indian)'],
  [/가든|식당|한식|기사/, '🍚', 'Korean restaurant']
];
const STAY = [[/호텔/, 'Hotel'], [/모텔/, 'Motel'], [/펜션/, 'Pension (guesthouse, often with kitchen)'], [/민박/, 'Homestay / B&B'],
  [/게스트/, 'Guesthouse'], [/찜질|사우나|스파/, 'Sauna / jjimjilbang (cheap overnight)'], [/캠핑|야영/, 'Campground'], [/여관|여인숙/, 'Old-style inn (cheap)'], [/리조트/, 'Resort']];

function describe(name, cat) {
  name = String(name || '');
  const chain = CHAINS.find(([k]) => name.includes(k));
  let type = null, emoji = '';
  if (cat === 3) { const s = STAY.find(([r]) => r.test(name)); type = s ? s[1] : 'Place to stay'; emoji = '🛏'; }
  else if (cat === 0 || cat === 1) { const t = TYPES.find(([r]) => r.test(name)); if (t) { emoji = t[1]; type = t[2]; } else { emoji = cat === 1 ? '☕' : '🍽'; type = cat === 1 ? 'Café' : 'Restaurant (type not known)'; } }
  const en = chain ? chain[1] : romanize(name);
  return { en, type, emoji, chain: !!chain };
}
window.FOOD = { romanize, describe };
})();
