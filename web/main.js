Error.stackTraceLimit = 80;
// Sound: a browser starts an audio context paused unless it is made right at a click, and the
// game makes its own after the files are loaded. Every context is remembered here and woken at the
// first key, tap or click (and again whenever the tab comes back).
const audioContexts = [];
{
  const Native = window.AudioContext || window.webkitAudioContext;
  if (Native) {
    window.AudioContext = class extends Native { constructor(...a) { super(...a); audioContexts.push(this); } };
    if (window.webkitAudioContext) window.webkitAudioContext = window.AudioContext;
  }
  const wake = () => audioContexts.forEach((c) => { if (c.state !== 'running' && c.state !== 'closed') c.resume().catch(() => {}); });
  for (const ev of ['pointerdown', 'keydown', 'touchstart', 'click']) addEventListener(ev, wake, { capture: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  setInterval(wake, 1500);              // a paused context is woken as soon as the browser allows
}
// The page. It finds the game's pack (cached in the browser, downloaded, or picked from the
// player's disk), then hands it to the game. Every path is relative: the page works from
// any folder, for example https://<user>.github.io/<repo>/.
import { scan } from './zipscan.js';
import * as rtc from './rtc.js';
import { downloadAsZip, filesToZip, readDropped } from './zipbuild.js';
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
    map: 'Map', own_title: 'Your own files', own_lead: 'Add a zip with a map, a bus or a whole OMSI folder. It stays in your browser.',
    own_drop: 'Drop zip files here or tap to choose', own_hint: 'maps, buses, mods; several files at once', own_how: 'How do I make a zip?',
    how_title: 'Playing with your own files', guide_full: 'Full guide on GitHub', maps_n: 'maps', buses_n: 'buses', files_n: 'files',
    added: 'Added', removed: 'Removed', bad_zip: 'is not a readable zip', nothing: 'nothing the game can use was found in', big: 'This is very large; the browser may run out of memory.',
    your_buses: 'your files', no_base: 'Add a zip with a map and a bus (open "Your own files").',
    guide: [
      ['h', 'What can I add?'],
      ['p', 'Any zip with OMSI-style folders: a map (`maps/MapName/` with a `global.cfg`), a bus (`Vehicles/BusName/` with a `.bus` file), scenery (`Sceneryobjects`, `Splines`, `Texture`...). A mod as you downloaded it works as it is, also inside a wrapper folder such as `OMSI 2/Vehicles/...`.'],
      ['h', 'How'],
      ['ol', ['Open **Your own files** on the start screen and drop the zip (or tap the box and choose it). Several at once are fine.', 'The page reads the zip and lists the maps and buses in it. Pick the map above the list and the bus from the cards.', 'Press **Play**. The files are saved in your browser: next time they are there already. The red button removes one.']],
      ['h', 'A map needs everything it uses'],
      ['p', 'The game finds files across all your zips as if they were one folder. A map zip should hold its `Sceneryobjects`, `Splines` and `Texture` folders, or you add them as another zip. A bus that borrows scripts or textures of another add-on (the log says `...\\OtherBus\\script...`) needs that add-on in a zip too.'],
      ['h', 'Make a small zip from your OMSI 2 (on a computer)'],
      ['ol', ['Install Python 3 and download this project.', 'Run `OMSI2="/path/to/OMSI 2" tools/pack/make_pack.py Grundorf Vehicles/MB_O305/O305_E2H_84.bus` (a map name, then one or more buses).', 'It writes `web/pack.zip` (a few hundred MB instead of 8 GB). Add that file here.']],
      ['h', 'Good to know'],
      ['p', 'The files never leave your device: the page reads them locally and keeps them in the browser\'s own storage. Keep the total under about 1 GB: the browser holds them in memory. A white building or bus part is a missing texture; a bus that will not move is usually missing scripts. Press F12 and look at the red lines in the console.'],
      ['p', 'Please add only content you have the right to use. OMSI 2\'s files and most mods are not for sharing with others.'],
    ],
    mp_join: 'Join a room', mp_host: 'Host a room', mp_server: 'Server', room_code: 'Room code', your_room: 'Your room',
    join_note: 'Ask the host for the code or the invite link.', host_note: 'Your browser is the server: friends join with the code. Keep this tab open and visible while you play.',
    copy_link: 'Copy invite link', copied: 'Invite link copied', room: 'Room', players: 'players',
    c_offer: 'Preparing the connection…', c_waiting: 'Waiting for the host to answer…', c_connecting: 'Connecting to the host…',
    e_nohost: 'Nobody answered in this room. Check the code, and that the host has the game open.', e_noconnect: 'Could not connect to the host (a strict network may block direct connections).',
    e_code: 'Enter the room code.', e_relay: 'The room relay could not be reached.', hosting: 'Room open',
    mp_public: 'Public', pub_empty: 'Nobody is hosting right now. Host a room (and list it) or join by code.', pub_note: 'The list is made by the hosts themselves and is not checked: join people you trust.',
    list_public: 'Show my room in the public list', room_name_ph: 'Room name', join_btn: 'Join', kind_room: 'browser room', kind_server: 'server', verified: 'official',
    files_n2: 'Files', loading_files: 'Downloading the game files', pick_folder: 'Choose a folder', own_drop2: 'Drop zip files or a folder here, or tap to choose', building: 'Putting the files together…', theme_classic: 'Classic', theme_modern: 'Modern', menu_title: 'WebOmsi - Main menu',
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
    map: 'Карта', own_title: 'Свои файлы', own_lead: 'Добавьте zip с картой, автобусом или целой папкой OMSI. Он остаётся в вашем браузере.',
    own_drop: 'Перетащите zip сюда или нажмите и выберите', own_hint: 'карты, автобусы, моды; можно несколько файлов', own_how: 'Как сделать zip?',
    how_title: 'Игра со своими файлами', guide_full: 'Полная инструкция на GitHub', maps_n: 'карт', buses_n: 'автобусов', files_n: 'файлов',
    added: 'Добавлено', removed: 'Удалено', bad_zip: 'не читается как zip', nothing: 'ничего подходящего для игры не найдено в', big: 'Файл очень большой, браузеру может не хватить памяти.',
    your_buses: 'ваши файлы', no_base: 'Добавьте zip с картой и автобусом (раздел «Свои файлы»).',
    guide: [
      ['h', 'Что можно добавить?'],
      ['p', 'Любой zip с папками в стиле OMSI: карта (`maps/ИмяКарты/` с файлом `global.cfg`), автобус (`Vehicles/ИмяАвтобуса/` с файлом `.bus`), объекты (`Sceneryobjects`, `Splines`, `Texture`...). Мод в том виде, как вы его скачали, работает как есть, в том числе внутри обёртки вроде `OMSI 2/Vehicles/...`.'],
      ['h', 'Как'],
      ['ol', ['Откройте **Свои файлы** на стартовом экране и перетащите zip (или нажмите на рамку и выберите файл). Можно несколько сразу.', 'Страница прочитает архив и покажет карты и автобусы в нём. Карту выберите над списком, автобус среди карточек.', 'Нажмите **Играть**. Файлы сохраняются в браузере: в следующий раз они уже на месте. Красная кнопка удаляет файл.']],
      ['h', 'Карте нужно всё, чем она пользуется'],
      ['p', 'Игра ищет файлы во всех ваших архивах, как в одной папке. В zip карты должны быть её папки `Sceneryobjects`, `Splines` и `Texture`, или добавьте их другим zip. Автобусу, который берёт скрипты или текстуры другого дополнения (в журнале видно `...\\ДругойАвтобус\\script...`), нужно и это дополнение в zip.'],
      ['h', 'Сделать небольшой zip из своего OMSI 2 (на компьютере)'],
      ['ol', ['Установите Python 3 и скачайте этот проект.', 'Выполните `OMSI2="/путь/к/OMSI 2" tools/pack/make_pack.py Grundorf Vehicles/MB_O305/O305_E2H_84.bus` (имя карты, затем один или несколько автобусов).', 'Получится `web/pack.zip` (несколько сотен МБ вместо 8 ГБ). Добавьте этот файл сюда.']],
      ['h', 'Полезно знать'],
      ['p', 'Файлы не покидают ваше устройство: страница читает их локально и хранит в собственном хранилище браузера. Держите общий объём до 1 ГБ: браузер держит их в памяти. Белое здание или деталь автобуса - не найдена текстура; автобус, который не едет, чаще всего остался без скриптов. Нажмите F12 и посмотрите красные строки в консоли.'],
      ['p', 'Добавляйте только то, что вам можно использовать. Файлы OMSI 2 и большинство модов не предназначены для передачи другим.'],
    ],
    mp_join: 'Войти в комнату', mp_host: 'Создать комнату', mp_server: 'Сервер', room_code: 'Код комнаты', your_room: 'Ваша комната',
    join_note: 'Попросите у хозяина код или ссылку-приглашение.', host_note: 'Ваш браузер - сервер: друзья заходят по коду. Держите эту вкладку открытой и видимой, пока играете.',
    copy_link: 'Скопировать ссылку', copied: 'Ссылка скопирована', room: 'Комната', players: 'игроков',
    c_offer: 'Готовлю соединение…', c_waiting: 'Жду ответа хозяина…', c_connecting: 'Подключаюсь к хозяину…',
    e_nohost: 'В этой комнате никто не ответил. Проверьте код и что у хозяина открыта игра.', e_noconnect: 'Не удалось соединиться с хозяином (строгая сеть может блокировать прямые соединения).',
    e_code: 'Введите код комнаты.', e_relay: 'Не удалось связаться с релеем комнат.', hosting: 'Комната открыта',
    mp_public: 'Публичные', pub_empty: 'Сейчас никто не хостит. Создайте комнату (и покажите её в списке) или войдите по коду.', pub_note: 'Список составляют сами хосты, он не проверяется: заходите к тем, кому доверяете.',
    list_public: 'Показывать мою комнату в публичном списке', room_name_ph: 'Название комнаты', join_btn: 'Войти', kind_room: 'комната в браузере', kind_server: 'сервер', verified: 'официальный',
    files_n2: 'Файлы', loading_files: 'Загрузка файлов игры', pick_folder: 'Выбрать папку', own_drop2: 'Перетащите сюда zip или папку, либо нажмите и выберите', building: 'Собираю файлы вместе…', theme_classic: 'Классика', theme_modern: 'Современный', menu_title: 'WebOmsi - Главное меню',
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
// the look: the classic one (in the manner of OMSI 2's menus) or the modern one
let theme = localStorage.getItem('omsi.theme') || 'classic';
function applyTheme() {
  document.body.classList.toggle('classic', theme === 'classic');
  $('theme').textContent = theme === 'classic' ? t('theme_modern') : t('theme_classic');
  document.querySelector('meta[name=theme-color]').content = theme === 'classic' ? '#1b2a44' : '#0e1116';
}
$('theme').addEventListener('click', () => { theme = theme === 'classic' ? 'modern' : 'classic'; localStorage.setItem('omsi.theme', theme); applyTheme(); });
function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((e) => { e.textContent = t(e.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach((e) => { e.placeholder = t(e.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-title]').forEach((e) => { e.title = t(e.dataset.i18nTitle); });
  $('lang').textContent = lang === 'ru' ? 'EN' : 'RU';
  applyTheme();
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
// the site's own content: a folder of files and a manifest (listed with their sizes), downloaded one
// by one with a progress bar; or, for a site that has it that way, one zip
const packDir = params.get('packdir') || config.packDir || '';
let manifest = null;
if (packDir) { try { const r = await fetch(packDir.replace(/\/?$/, '/') + 'manifest.json', { cache: 'no-cache' }); if (r.ok) manifest = await r.json(); } catch (_) {} }
const CACHE = 'omsi-pack-v1';
const KEY = './__pack__/' + (manifest ? 'dir-' + manifest.id : encodeURIComponent(packUrl));
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
const baseBuses = config.buses || [];
// the player's own zips: [{ id, name, size, maps, buses }] (their bytes are in the cache)
const MODS_KEY = 'omsi.mods';
let mods = [];
try { mods = JSON.parse(localStorage.getItem(MODS_KEY) || '[]'); } catch (_) { mods = []; }
const saveMods = () => { try { localStorage.setItem(MODS_KEY, JSON.stringify(mods)); } catch (_) {} };
const allBuses = () => [
  ...baseBuses,
  ...mods.flatMap((m) => m.buses.map((b) => ({ file: b.file, name: b.label, info: m.name, color: '#9aa5b1', stripe: '#3d4652', length: 11, custom: true }))),
];
const first = baseBuses[0] || {};
const artOf = (b) => $('art-bus').replaceChildren(busArt((b || first).color, (b || first).stripe, (b || first).length || 10.6));
let chosen = params.get('bus') || localStorage.getItem('omsi.bus') || first.file;
function renderBuses() {
  const buses = allBuses();
  if (!buses.some((b) => b.file === chosen)) chosen = (buses[0] || {}).file;
  artOf(buses.find((b) => b.file === chosen));
  $('buses').replaceChildren(...buses.map((b) => {
    const label = document.createElement('label'); label.className = 'bus';
    const input = Object.assign(document.createElement('input'), { type: 'radio', name: 'bus', value: b.file, checked: b.file === chosen });
    input.addEventListener('change', () => { chosen = b.file; artOf(b); });
    const text = document.createElement('div');
    const name = document.createElement('b'); name.textContent = b.name;
    const info = document.createElement('span'); info.className = 'info'; info.textContent = b.info || '';
    const tags = document.createElement('div'); tags.className = 'tags';
    if (b.custom) tags.append(Object.assign(document.createElement('span'), { className: 'tag', textContent: t('your_buses') }));
    if (b.length && !b.custom) tags.append(Object.assign(document.createElement('span'), { className: 'tag', textContent: `${b.length} ${t('len')}` }));
    if (b.kw) tags.append(Object.assign(document.createElement('span'), { className: 'tag', textContent: `${b.kw} ${t('kw')}` }));
    text.append(name, info, tags);
    label.append(input, busArt(b.color, b.stripe, b.length), text);
    return label;
  }));
}

// ---- fields ----------------------------------------------------------------------------------------
$('name').value = localStorage.getItem('omsi.name') || '';
$('server').value = params.get('server') || localStorage.getItem('omsi.server') || '';
$('quality').value = params.get('quality') || localStorage.getItem('omsi.quality') || (touchDevice ? 'low' : 'high');
function renderMaps() {
  const sel = $('map');
  const opts = [{ v: MAP, l: config.title || MAP }, ...mods.flatMap((m) => m.maps.map((x) => ({ v: x.file, l: `${x.name} · ${m.name}` })))];
  const want = params.get('map') || localStorage.getItem('omsi.map') || MAP;
  sel.replaceChildren(...opts.map((o) => Object.assign(document.createElement('option'), { value: o.v, textContent: o.l })));
  sel.value = opts.some((o) => o.v === want) ? want : MAP;
  $('map-field').hidden = opts.length < 2;
}
let mpMode = params.get('server') ? 'server' : (params.get('room') ? 'join' : 'public');
let multi = !!params.get('server') || !!params.get('room');
// the Play button: always, except on the public list (it has a Join button on every line)
function updateGo() { $('go').hidden = multi && mpMode === 'public'; }
function setMode(m) {
  multi = m; $('tab-solo').classList.toggle('on', !m); $('tab-multi').classList.toggle('on', m);
  $('multi').hidden = !m;
  updateGo();
  if (m && mpMode === 'public') watchLobby();
}
$('tab-solo').addEventListener('click', () => setMode(false));
$('tab-multi').addEventListener('click', () => setMode(true));
setMode(multi);

// ---- multiplayer: join a room, host a room, or a server's address ----------------------------------------
let hostCode = rtc.newRoomCode();
const inviteLink = (code) => `${location.origin}${location.pathname}?room=${code}`;
const roomParam = rtc.cleanCode(params.get('room'));
if (roomParam) $('room').value = roomParam;
function setMp(mode) {
  mpMode = mode;
  document.querySelectorAll('#mp-mode button').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
  $('mp-public').hidden = mode !== 'public'; $('mp-join').hidden = mode !== 'join'; $('mp-host').hidden = mode !== 'host'; $('mp-server').hidden = mode !== 'server';
  updateGo();
  if (mode === 'public') watchLobby();
}

// ---- the public list ------------------------------------------------------------------------------------------------
let lobbyWatch = null, lobbyItems = [];
function watchLobby() {
  if (lobbyWatch) return;
  lobbyWatch = rtc.lobby((list) => { lobbyItems = list; renderLobby(); });
}
function renderLobby() {
  const official = (config.servers || []).filter((s) => s.url).map((s) => ({ kind: 'server', url: s.url, name: s.name || s.url, map: '', players: s.players | 0, max: 16, official: true, id: 'o:' + s.url }));
  const all = [...official, ...lobbyItems.filter((e) => !official.some((o) => o.url && e.url && o.url.toLowerCase() === e.url.toLowerCase()))];
  $('lobby-empty').hidden = all.length > 0;
  $('lobby-list').replaceChildren(...all.map((e) => {
    const li = document.createElement('li');
    const name = document.createElement('b'); name.textContent = e.name;
    const small = document.createElement('small');
    small.textContent = [e.kind === 'room' ? t('kind_room') : t('kind_server'), e.map, `${e.players}/${e.max} ${t('players')}`].filter(Boolean).join(' · ');
    if (e.official) { const tag = document.createElement('span'); tag.className = 'tag ok'; tag.textContent = t('verified'); small.append(' ', tag); }
    const btn = document.createElement('button'); btn.textContent = t('join_btn');
    btn.onclick = () => {
      if (e.kind === 'room') { $('room').value = e.code; setMp('join'); } else { $('server').value = e.url; setMp('server'); }
      play();
    };
    li.append(name, small, btn); return li;
  }));
}
document.querySelectorAll('#mp-mode button').forEach((b) => b.addEventListener('click', () => setMp(b.dataset.mode)));
function renderRoom() { $('room-new').textContent = hostCode; }
async function copyInvite() {
  try { await navigator.clipboard.writeText(inviteLink(hostCode)); toast(t('copied')); } catch (_) { prompt(t('copy_link'), inviteLink(hostCode)); }
}
$('room-copy').addEventListener('click', copyInvite);
$('room-public').addEventListener('change', (e) => { $('room-name').hidden = !e.target.checked; });
$('room-name').value = localStorage.getItem('omsi.roomname') || '';
$('room-again').addEventListener('click', () => { hostCode = rtc.newRoomCode(); renderRoom(); });
$('room').addEventListener('input', (e) => { e.target.value = rtc.cleanCode(e.target.value); });
setMp(mpMode); renderRoom(); renderLobby();

let hosting = null;
function startHosting(game) {
  const chip = $('b-room');
  const show = (n) => { chip.textContent = `${t('room')} ${hostCode} · ${n}`; };
  chip.hidden = false; show(0); chip.onclick = copyInvite;
  hosting = rtc.host(hostCode, {
    iceServers: config.iceServers,
    onPeer: (ch) => { show(game.rtc_add_peer(ch)); },
    onError: (e) => console.warn('room:', e),
  });
  setInterval(() => show(game.rtc_peers()), 2000);
  if ($('room-public').checked) {
    const name = $('room-name').value.trim() || `${$('name').value.trim() || 'Driver'}'s room`;
    const post = () => rtc.announce({ kind: 'room', code: hostCode, name, map: $('map').selectedOptions[0]?.textContent || '', players: game.rtc_peers() + 1, max: 16 }).catch(() => {});
    post(); setInterval(post, 25000);
  }
  toast(`${t('hosting')}: ${hostCode}`, 5000);
}
function friendly(e) {
  const msg = String((e && e.message) || e);
  if (msg === 'nohost') return t('e_nohost');
  if (msg === 'noconnect') return t('e_noconnect');
  if (msg === 'room code') return t('e_code');
  if (/relay|Failed to fetch|NetworkError/i.test(msg)) return t('e_relay');
  return msg;
}
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
async function havePackUrl() {
  try { const r = await fetch(packUrl, { method: 'HEAD' }); return r.ok && !/text\/html/.test(r.headers.get('content-type') || ''); } catch (_) { return false; }
}
const hasCached = !!(await cachedPack().then((b) => b && b.length));
const hasUrl = manifest ? true : await havePackUrl();
$('forget').hidden = !hasCached; $('forget-sep').hidden = !hasCached;
$('forget').addEventListener('click', async () => { await caches.delete(CACHE); mods = []; saveMods(); location.reload(); });

// ---- your own zips --------------------------------------------------------------------------------
const MOD_PREFIX = './__mod__/';
const fmtMB = (n) => (n >= 1e9 ? (n / 1e9).toFixed(2) + ' GB' : (n / 1e6).toFixed(n < 1e7 ? 1 : 0) + ' MB');
async function modBytes(m) {
  try { const c = await caches.open(CACHE); const r = await c.match(MOD_PREFIX + m.id); return r ? new Uint8Array(await r.arrayBuffer()) : null; } catch (_) { return null; }
}
// one thing the player added, as the bytes of a zip: read what is in it, keep it in the browser
async function keepMod(name, bytes) {
  if (bytes.length > 1.5e9) toast(t('big'), 4500);
  if (!looksLikeZip(bytes)) throw new Error(`${name}: ${t('bad_zip')}`);
  const info = await scan(bytes);
  if (!info.maps.length && !info.buses.length && !info.folders.length) throw new Error(`${t('nothing')} ${name}`);
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const c = await caches.open(CACHE);
  await c.put(MOD_PREFIX + id, new Response(bytes, { headers: { 'content-type': 'application/zip' } }));
  mods.push({ id, name, size: bytes.length, maps: info.maps, buses: info.buses, files: info.files });
  saveMods();
  toast(`${t('added')}: ${name}`);
}
const finishAdding = () => { $('progress').hidden = true; say(''); renderMods(); renderBuses(); renderMaps(); };
async function addFiles(files) {
  $('error').hidden = true;
  for (const f of files) {
    try {
      say(`${t('reading')} ${f.name}…`); $('progress').hidden = false; progress(null);
      await keepMod(f.name, new Uint8Array(await f.arrayBuffer()));
    } catch (e) { fail(String((e && e.message) || e)); }
  }
  finishAdding();
}
// loose files or a folder (the ones of a folder the player picked or dropped): put together into a zip
async function addLoose(list, label) {
  $('error').hidden = true;
  if (!list.length) return;
  try {
    $('progress').hidden = false; $('track').classList.remove('busy');
    const bytes = await filesToZip(list, showFiles);
    say(t('building'));
    await keepMod(label, bytes);
  } catch (e) { fail(String((e && e.message) || e)); }
  finishAdding();
}
async function removeMod(id) {
  try { const c = await caches.open(CACHE); await c.delete(MOD_PREFIX + id); } catch (_) {}
  mods = mods.filter((m) => m.id !== id); saveMods();
  renderMods(); renderBuses(); renderMaps();
}
function renderMods() {
  $('own-list').replaceChildren(...mods.map((m) => {
    const li = document.createElement('li');
    const name = document.createElement('b'); name.textContent = m.name;
    const small = document.createElement('small');
    small.textContent = `${fmtMB(m.size)} · ${m.maps.length} ${t('maps_n')} · ${m.buses.length} ${t('buses_n')}`;
    const x = document.createElement('button'); x.textContent = '×'; x.title = t('removed'); x.onclick = () => removeMod(m.id);
    li.append(name, small, x); return li;
  }));
  const n = mods.length; $('own-count').hidden = !n; $('own-count').textContent = n;
  if (n) $('own').open = true;
}
$('ownfile').addEventListener('change', (e) => { addFiles([...e.target.files]); e.target.value = ''; });
$('ownfolder').addEventListener('change', (e) => {
  const list = [...e.target.files].map((f) => ({ name: f.webkitRelativePath || f.name, file: f }));
  const label = (list[0] && list[0].name.split('/')[0]) || 'folder';
  e.target.value = ''; addLoose(list, label);
});
for (const ev of ['dragenter', 'dragover']) document.addEventListener(ev, (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); $('own').open = true; $('drop').classList.add('over'); } });
for (const ev of ['dragleave', 'drop']) document.addEventListener(ev, (e) => { if (ev === 'dragleave' && e.relatedTarget) return; $('drop').classList.remove('over'); });
document.addEventListener('drop', async (e) => {
  if (!e.dataTransfer || !e.dataTransfer.files.length) return;
  e.preventDefault();
  const items = [...e.dataTransfer.items];
  const hasFolder = items.some((i) => i.webkitGetAsEntry && i.webkitGetAsEntry() && i.webkitGetAsEntry().isDirectory);
  if (hasFolder) {
    const names = items.map((i) => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean).map((x) => x.name);
    addLoose(await readDropped(items), names[0] || 'folder');
  } else addFiles([...e.dataTransfer.files].filter((f) => /\.zip$/i.test(f.name)));
});

// ---- the guide ----------------------------------------------------------------------------------------
function fmt(text) {
  const frag = document.createDocumentFragment();
  text.split(/(`[^`]+`|\*\*[^*]+\*\*)/).forEach((part) => {
    if (part.startsWith('`')) { const c = document.createElement('code'); c.textContent = part.slice(1, -1); frag.append(c); }
    else if (part.startsWith('**')) { const b = document.createElement('b'); b.textContent = part.slice(2, -2); frag.append(b); }
    else frag.append(part);
  });
  return frag;
}
function renderGuide() {
  const body = $('own-help-body'); body.replaceChildren();
  for (const [kind, v] of T[lang].guide) {
    if (kind === 'h') { const h = document.createElement('h4'); h.textContent = v; body.append(h); }
    else if (kind === 'p') { const p = document.createElement('p'); p.append(fmt(v)); body.append(p); }
    else { const ol = document.createElement('ol'); v.forEach((it) => { const li = document.createElement('li'); li.append(fmt(it)); ol.append(li); }); body.append(ol); }
  }
  $('guide-link').href = 'https://github.com/LakoMoor/WebOmsi/blob/main/docs/webomsi/own-content' + (lang === 'ru' ? '.ru' : '') + '.md';
}
$('own-how').addEventListener('click', () => { renderGuide(); $('own-help').hidden = false; });
$('own-help-close').addEventListener('click', () => { $('own-help').hidden = true; });

// The base pack (the demo, or what the site is configured with) and the player's zips. A site
// without a base pack plays the first zip of the player as the base.
async function getPack() {
  const extras = [];
  for (const m of mods) { const b = await modBytes(m); if (b) extras.push(b); }
  let base = await cachedPack();
  if (!looksLikeZip(base)) {
    if (hasUrl) {
      if (manifest) {
        $('track').classList.remove('busy');
        base = await downloadAsZip(packDir.replace(/\/?$/, '/'), manifest.files, showFiles);
      } else {
        base = await download(packUrl, (got, total) => {
          progress(total ? got / total : null);
          say(`${t('dl')}: ${(got / 1e6).toFixed(1)}${total ? ' / ' + (total / 1e6).toFixed(1) : ''} MB`);
        });
      }
      if (!looksLikeZip(base)) throw new Error(t('broken'));
      await storePack(base);
    } else if (extras.length) {
      base = extras.shift();
    } else {
      $('own').open = true;
      throw new Error(t('no_base'));
    }
  }
  return { base, extras };
}

// the progress of a download of many files: a bar by bytes, and what is going on
function showFiles(p) {
  progress(p.totalBytes ? p.bytes / p.totalBytes : p.done / p.total);
  say(`${t('loading_files')}: ${p.done} / ${p.total} · ${fmtMB(p.bytes)} / ${fmtMB(p.totalBytes)}\n${p.name}`);
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
  const mode = multi ? mpMode : 'solo';
  const server = mode === 'server' ? $('server').value.trim() : '';
  const code = rtc.cleanCode($('room').value);
  if (mode === 'public') return;
  if (mode === 'join' && code.length < 4) { fail(t('e_code')); return; }
  const name = $('name').value.trim();
  const quality = $('quality').value;
  localStorage.setItem('omsi.name', name); localStorage.setItem('omsi.server', $('server').value.trim()); localStorage.setItem('omsi.roomname', $('room-name').value.trim());
  localStorage.setItem('omsi.bus', chosen); localStorage.setItem('omsi.quality', quality); localStorage.setItem('omsi.map', $('map').value);
  if (touchDevice) fullscreen();
  try {
    step(0); say(t('loading_engine'));
    const game = await import('./pkg/openomsi_game.js');
    await game.default();
    step(1);
    const { base, extras } = await getPack();
    const args = ['--map', $('map').value || MAP, '--bus', chosen, '--no-menu'];
    if (name) args.push('--lan-name', name);
    if (mode === 'join') {
      // open the channel to the host first: the game's session starts on it
      step(2); progress(null);
      const ch = await rtc.join(code, { iceServers: config.iceServers, onStatus: (s) => say(t('c_' + s)) });
      game.rtc_set_server(ch);
      args.push('--lan-join', 'rtc:');
    } else if (mode === 'host') args.push('--lan-host', '0');
    else if (server) args.push('--lan-join', server);
    step(2); say(t('starting'));
    $('menu').classList.add('gone');
    document.body.classList.add('playing');
    $('bar').hidden = false; $('rotate').hidden = false;
    $('game').focus();
    if (server) toast(`${t('joined')}: ${server}`, 3500);
    if (mode === 'join') toast(`${t('room')}: ${code}`, 3500);
    await game.start('game', base, args, quality, extras);
    if (mode === 'host') startHosting(game);
  } catch (e) {
    console.error(e);
    $('menu').classList.remove('gone'); document.body.classList.remove('playing');
    $('bar').hidden = true; $('rotate').hidden = true;
    $('go').disabled = false; $('progress').hidden = true;
    fail(friendly(e));
  }
}
$('go').addEventListener('click', play);
renderMods(); renderMaps();
applyLang();
