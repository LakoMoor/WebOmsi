Error.stackTraceLimit = 80;
// The page. It finds the game's pack (cached in the browser, downloaded, or picked from the
// player's disk), then hands it to the game. Every path is relative: the page works from
// any folder, for example https://<user>.github.io/<repo>/.
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const touchDevice = (matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0) || params.get('touch') === '1';
if (touchDevice) document.body.classList.add('touch');

// ---- text ------------------------------------------------------------------------------------
const T = {
  en: {
    tagline: 'A bus simulator in your browser', solo: 'Single player', multi: 'Multiplayer', pick_bus: 'Choose a bus',
    name: 'Your name', name_ph: 'Driver', quality: 'Graphics', q_high: 'High', q_low: 'Light (weaker devices)',
    server: 'Server address', play: 'Play', controls: 'Controls', close: 'Close', engine: 'About the engine',
    forget: 'Clear saved files', pick_pack: 'Choose pack.zip…', rotate: 'Turn your phone sideways',
    pack_note: 'The pack is made from your own copy of OMSI 2 and stays in your browser.',
    help: 'Controls', fullscreen: 'Full screen', exit: 'Back to menu',
    s_engine: 'Game engine', s_pack: 'Game files', s_world: 'Map and bus',
    dl: 'Downloading', starting: 'Starting…', loading_engine: 'Loading the engine…', saving: 'Saving the files in your browser…',
    reading: 'Reading', not_zip: 'That is not a zip archive.', picked: 'File chosen', need_pack: 'Choose pack.zip (the game files).',
    broken: 'The game file is damaged.', no_gpu: 'This browser has no WebGPU. Open the page in Chrome or Edge (on a phone: Chrome for Android).',
    joined: 'Server', len: 'm', kw: 'kW', confirm_exit: 'Back to the menu?',
    kb: [['W / S', 'gas / brake'], ['A / D', 'steering'], ['Space', 'parking brake'], ['Shift+U', 'start the bus'], ['Shift+1', 'doors'], ['H', 'horn'], ['Z / X / C', 'indicators / hazards'], ['F1', 'cameras'], ['Esc', 'game menu'], ['Mouse', 'look round, press cab buttons']],
    ts: [['Wheel', 'drag the steering wheel, left'], ['Pedals', 'BRAKE and GAS, right'], ['R N D', 'gearbox buttons'], ['P', 'parking brake'], ['Finger', 'look round; two fingers zoom']],
  },
  ru: {
    tagline: 'Автобусный симулятор в браузере', solo: 'Одиночная игра', multi: 'Мультиплеер', pick_bus: 'Выберите автобус',
    name: 'Ваше имя', name_ph: 'Водитель', quality: 'Графика', q_high: 'Высокая', q_low: 'Лёгкая (слабые устройства)',
    server: 'Адрес сервера', play: 'Играть', controls: 'Управление', close: 'Закрыть', engine: 'О движке',
    forget: 'Удалить сохранённые файлы', pick_pack: 'Выбрать pack.zip…', rotate: 'Поверните телефон горизонтально',
    pack_note: 'Пак делается из вашей копии OMSI 2 и остаётся в браузере.',
    help: 'Управление', fullscreen: 'На весь экран', exit: 'В меню',
    s_engine: 'Движок игры', s_pack: 'Файлы игры', s_world: 'Карта и автобус',
    dl: 'Загрузка', starting: 'Запуск…', loading_engine: 'Загружаю движок…', saving: 'Сохраняю файлы в браузере…',
    reading: 'Читаю', not_zip: 'Это не zip-архив.', picked: 'Файл выбран', need_pack: 'Выберите pack.zip (файлы игры).',
    broken: 'Файл игры повреждён.', no_gpu: 'В этом браузере нет WebGPU. Откройте страницу в Chrome или Edge (на телефоне: Chrome для Android).',
    joined: 'Сервер', len: 'м', kw: 'кВт', confirm_exit: 'Выйти в меню?',
    kb: [['W / S', 'газ / тормоз'], ['A / D', 'руль'], ['Space', 'стояночный тормоз'], ['Shift+U', 'запустить автобус'], ['Shift+1', 'двери'], ['H', 'гудок'], ['Z / X / C', 'поворотники / аварийка'], ['F1', 'камеры'], ['Esc', 'меню игры'], ['Мышь', 'осмотреться, нажимать кнопки кабины']],
    ts: [['Руль', 'ведите по рулю, слева'], ['Педали', 'BRAKE и GAS, справа'], ['R N D', 'кнопки коробки передач'], ['P', 'стояночный тормоз'], ['Палец', 'осмотреться; двумя пальцами - приблизить']],
  },
};
let lang = localStorage.getItem('omsi.lang') || (/^ru|^uk|^be/.test(navigator.language) ? 'ru' : 'en');
const t = (k) => (T[lang][k] ?? T.en[k] ?? k);

function keysTable(rows) {
  const d = document.createElement('div'); d.className = 'keys';
  for (const [a, b] of rows) {
    const x = document.createElement('span');
    const parts = a.split(' / ');
    parts.forEach((part, i) => {
      const k = document.createElement('kbd'); k.textContent = part; x.append(k);
      if (i < parts.length - 1) x.append(' ');
    });
    const y = document.createElement('span'); y.textContent = b;
    d.append(x, y);
  }
  return d;
}
function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((e) => { e.textContent = t(e.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach((e) => { e.placeholder = t(e.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-title]').forEach((e) => { e.title = t(e.dataset.i18nTitle); });
  $('lang').textContent = lang === 'ru' ? 'EN' : 'RU';
  for (const id of ['how-kbd', 'help-kbd']) $(id).replaceChildren(keysTable(T[lang].kb));
  for (const id of ['how-touch', 'help-touch']) $(id).replaceChildren(keysTable(T[lang].ts));
  if (config.title) $('subtitle').textContent = t('tagline') + ' · ' + config.title;
  renderSteps(currentStep);
  renderServers();
  renderBuses();
}
$('lang').addEventListener('click', () => { lang = lang === 'ru' ? 'en' : 'ru'; localStorage.setItem('omsi.lang', lang); applyLang(); });

// ---- configuration -----------------------------------------------------------------------------
// config.json (next to this page): { packUrl, map, title, buses: [{file, name, info, color, stripe, length, kw}], servers: [] }
let config = {};
const configName = (params.get('config') || 'config.json').replace(/[^A-Za-z0-9_.-]/g, '');
try { const r = await fetch('./' + configName, { cache: 'no-cache' }); if (r.ok) config = await r.json(); } catch (_) {}
const MAP = config.map || 'maps/Demo/global.cfg';
const packUrl = params.get('pack') || config.packUrl || './demo-pack.zip';
const CACHE = 'omsi-pack-v1';
const KEY = './__pack__/' + encodeURIComponent(packUrl);
document.title = 'WebOmsi' + (config.title ? ' - ' + config.title : '');

// ---- bus pictures ------------------------------------------------------------------------------
const NS = 'http://www.w3.org/2000/svg';
function busArt(color = '#ecbe28', stripe = '#be2824', length = 10.6) {
  const w = 40 + Math.round((length - 7) * 12);          // a longer bus is a longer picture
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w + 20} 62`);
  const el = (n, a) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); svg.append(e); return e; };
  el('rect', { x: 8, y: 6, width: w, height: 38, rx: 7, fill: color });
  el('rect', { x: 8, y: 31, width: w, height: 7, fill: stripe });
  el('rect', { x: 14, y: 13, width: w - 22, height: 15, rx: 3, fill: '#173047' });
  const n = Math.max(3, Math.round((w - 30) / 22));
  for (let i = 1; i < n; i++) el('rect', { x: 14 + ((w - 22) / n) * i - 1.2, y: 13, width: 2.4, height: 15, fill: color });
  el('rect', { x: w - 12, y: 13, width: 14, height: 15, rx: 3, fill: '#2a5a7c' });
  for (const cx of [26, w - 18]) { el('circle', { cx, cy: 46, r: 8, fill: '#15171c' }); el('circle', { cx, cy: 46, r: 3.4, fill: '#9aa3ad' }); }
  return svg;
}
const buses = config.buses || [];
const first = buses[0] || {};
const artOf = (b) => $('art-bus').replaceChildren(busArt((b || first).color, (b || first).stripe, (b || first).length || 10.6));
let chosen = params.get('bus') || localStorage.getItem('omsi.bus') || first.file;
if (!buses.some((b) => b.file === chosen)) chosen = first.file;
function renderBuses() {
  $('buses').replaceChildren(...buses.map((b) => {
    const label = document.createElement('label'); label.className = 'bus';
    const input = Object.assign(document.createElement('input'), { type: 'radio', name: 'bus', value: b.file, checked: b.file === chosen });
    input.addEventListener('change', () => { chosen = b.file; artOf(b); });
    const text = document.createElement('div');
    const name = document.createElement('b'); name.textContent = b.name;
    const info = document.createElement('span'); info.className = 'info'; info.textContent = b.info || '';
    const tags = document.createElement('div'); tags.className = 'tags';
    if (b.length) tags.append(Object.assign(document.createElement('span'), { className: 'tag', textContent: `${b.length} ${t('len')}` }));
    if (b.kw) tags.append(Object.assign(document.createElement('span'), { className: 'tag', textContent: `${b.kw} ${t('kw')}` }));
    text.append(name, info, tags);
    label.append(input, busArt(b.color, b.stripe, b.length), text);
    return label;
  }));
}
artOf(buses.find((b) => b.file === chosen));

// ---- fields ----------------------------------------------------------------------------------------
$('name').value = localStorage.getItem('omsi.name') || '';
$('server').value = params.get('server') || localStorage.getItem('omsi.server') || '';
$('quality').value = params.get('quality') || localStorage.getItem('omsi.quality') || (touchDevice ? 'low' : 'high');
let multi = !!params.get('server');
function setMode(m) {
  multi = m; $('tab-solo').classList.toggle('on', !m); $('tab-multi').classList.toggle('on', m);
  $('multi').hidden = !m;
}
$('tab-solo').addEventListener('click', () => setMode(false));
$('tab-multi').addEventListener('click', () => setMode(true));
setMode(multi);
function renderServers() {
  const box = $('server-list'); box.replaceChildren();
  for (const s of config.servers || []) {
    const c = document.createElement('button'); c.className = 'chip'; c.textContent = s.name || s.url || s;
    c.onclick = () => { $('server').value = s.url || s; };
    box.append(c);
  }
}

// ---- the pack ----------------------------------------------------------------------------------------
async function cachedPack() {
  try { const c = await caches.open(CACHE); const r = await c.match(KEY); return r ? new Uint8Array(await r.arrayBuffer()) : null; } catch (_) { return null; }
}
async function storePack(bytes) {
  try { const c = await caches.open(CACHE); await c.put(KEY, new Response(bytes, { headers: { 'content-type': 'application/zip' } })); } catch (e) { console.warn('pack not cached', e); }
}
async function download(url, onProgress) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  const total = +r.headers.get('content-length') || 0;
  const reader = r.body.getReader();
  const chunks = []; let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length;
    onProgress(got, total);
  }
  const all = new Uint8Array(got); let o = 0;
  for (const c of chunks) { all.set(c, o); o += c.length; }
  return all;
}
const looksLikeZip = (b) => b && b.length > 100 && b[0] === 0x50 && b[1] === 0x4b;
let picked = null;
async function havePackUrl() {
  try { const r = await fetch(packUrl, { method: 'HEAD' }); return r.ok && !/text\/html/.test(r.headers.get('content-type') || ''); } catch (_) { return false; }
}
const hasCached = !!(await cachedPack().then((b) => b && b.length));
const hasUrl = await havePackUrl();
$('packbox').hidden = hasUrl || hasCached;
$('forget').hidden = !hasCached; $('forget-sep').hidden = !hasCached;
$('packfile').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  $('progress').hidden = false; say(`${t('reading')} ${f.name}…`);
  const b = new Uint8Array(await f.arrayBuffer());
  if (!looksLikeZip(b)) { fail(t('not_zip')); return; }
  $('error').hidden = true; picked = b; say(`${t('picked')}: ${(b.length / 1e6).toFixed(0)} MB`);
});
$('forget').addEventListener('click', async () => { await caches.delete(CACHE); location.reload(); });

async function getPack() {
  if (picked) { say(t('saving')); await storePack(picked); return picked; }
  const c = await cachedPack();
  if (looksLikeZip(c)) return c;
  if (!hasUrl) throw new Error(t('need_pack'));
  const bytes = await download(packUrl, (got, total) => {
    progress(total ? got / total : null);
    say(`${t('dl')}: ${(got / 1e6).toFixed(1)}${total ? ' / ' + (total / 1e6).toFixed(1) : ''} MB`);
  });
  if (!looksLikeZip(bytes)) throw new Error(t('broken'));
  await storePack(bytes);
  return bytes;
}

// ---- progress, errors ---------------------------------------------------------------------------------
const STEPS = ['s_engine', 's_pack', 's_world'];
let currentStep = -1;
function renderSteps(now) {
  $('steps').replaceChildren(...STEPS.map((k, i) => {
    const li = document.createElement('li'); li.textContent = t(k);
    li.className = i < now ? 'done' : (i === now ? 'now' : ''); return li;
  }));
}
function step(n) { currentStep = n; renderSteps(n); progress(null); }
function progress(f) {
  const tr = $('track');
  if (f == null) tr.classList.add('busy'); else { tr.classList.remove('busy'); $('fill').style.width = `${(100 * f).toFixed(1)}%`; }
}
const say = (s) => { $('status').textContent = s; };
function fail(s) { $('error').hidden = false; $('error').textContent = s; }
function toast(s, ms = 2500) { const e = $('toast'); e.textContent = s; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { e.hidden = true; }, ms); }

// ---- full screen, toolbar --------------------------------------------------------------------------------
async function fullscreen() {
  const el = document.documentElement;
  try {
    if (document.fullscreenElement) { await document.exitFullscreen(); return; }
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape').catch(() => {});
  } catch (_) {}
}
$('b-fs').addEventListener('click', fullscreen);
$('b-help').addEventListener('click', () => { $('help').hidden = false; });
$('help-close').addEventListener('click', () => { $('help').hidden = true; $('game').focus(); });
$('b-exit').addEventListener('click', () => { if (confirm(t('confirm_exit'))) location.reload(); });
document.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('resize', () => { const c = $('game'); c.style.width = innerWidth + 'px'; c.style.height = innerHeight + 'px'; });

// ---- start -------------------------------------------------------------------------------------------------------
async function play() {
  $('error').hidden = true;
  if (!navigator.gpu) { fail(t('no_gpu')); return; }
  $('go').disabled = true; $('progress').hidden = false;
  const name = $('name').value.trim(); const server = multi ? $('server').value.trim() : '';
  const quality = $('quality').value;
  localStorage.setItem('omsi.name', name); localStorage.setItem('omsi.server', $('server').value.trim());
  localStorage.setItem('omsi.bus', chosen); localStorage.setItem('omsi.quality', quality);
  if (touchDevice) fullscreen();
  try {
    step(0); say(t('loading_engine'));
    const game = await import('./pkg/openomsi_game.js');
    await game.default();
    step(1);
    const pack = await getPack();
    step(2); say(t('starting'));
    const args = ['--map', MAP, '--bus', chosen, '--no-menu'];
    if (name) args.push('--lan-name', name);
    if (server) args.push('--lan-join', server);
    $('menu').classList.add('gone');
    document.body.classList.add('playing');
    $('bar').hidden = false; $('rotate').hidden = false;
    $('game').focus();
    if (server) toast(`${t('joined')}: ${server}`, 3500);
    await game.start('game', pack, args, quality);
  } catch (e) {
    console.error(e);
    $('menu').classList.remove('gone'); document.body.classList.remove('playing');
    $('bar').hidden = true; $('rotate').hidden = true;
    $('go').disabled = false; $('progress').hidden = true;
    fail(String((e && e.message) || e));
  }
}
$('go').addEventListener('click', play);
applyLang();
