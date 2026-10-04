// Reads what a zip holds, without unpacking it: the maps and buses of an OMSI-style folder.
// A download of a mod usually wraps everything in a folder (`OMSI 2/Vehicles/...`); the game
// takes that folder as the root by itself, so the paths here are given without it.

const FOLDERS = ['vehicles', 'maps', 'sceneryobjects', 'splines', 'texture', 'fonts', 'humans', 'weather', 'sounds', 'drivers', 'money', 'trains', 'situations', 'plugins', 'ticketpacks'];

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const u64 = (b, o) => u32(b, o) + u32(b, o + 4) * 4294967296;

function decodeName(raw, utf8) {
  try { if (utf8) return new TextDecoder('utf-8', { fatal: true }).decode(raw); } catch (_) {}
  try { return new TextDecoder('utf-8', { fatal: true }).decode(raw); } catch (_) {}
  return new TextDecoder('windows-1252').decode(raw);
}

/** The entries of a zip: [{name, method, size, packed, header}]. Throws when it is no zip. */
export function entries(bytes) {
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (u32(bytes, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip archive');
  let count = u16(bytes, eocd + 10), cdOffset = u32(bytes, eocd + 16);
  if (eocd >= 20 && u32(bytes, eocd - 20) === 0x07064b50) {           // ZIP64
    const z = u64(bytes, eocd - 20 + 8);
    if (u32(bytes, z) === 0x06064b50) { count = u64(bytes, z + 32); cdOffset = u64(bytes, z + 48); }
  }
  const out = [];
  let p = cdOffset;
  for (let n = 0; n < count && p + 46 <= bytes.length && u32(bytes, p) === 0x02014b50; n++) {
    const flags = u16(bytes, p + 8), method = u16(bytes, p + 10);
    const packed = u32(bytes, p + 20), size = u32(bytes, p + 24);
    const nameLen = u16(bytes, p + 28), extraLen = u16(bytes, p + 30), commentLen = u16(bytes, p + 32);
    const header = u32(bytes, p + 42);
    const name = decodeName(bytes.subarray(p + 46, p + 46 + nameLen), flags & 0x800).replaceAll('\\', '/');
    out.push({ name, method, size, packed, header });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** The text of one entry (stored or deflated), or '' when it cannot be read. */
export async function readText(bytes, e) {
  try {
    const h = e.header;
    if (u32(bytes, h) !== 0x04034b50) return '';
    const start = h + 30 + u16(bytes, h + 26) + u16(bytes, h + 28);
    const data = bytes.subarray(start, start + e.packed);
    let raw = data;
    if (e.method === 8) {
      const ds = new DecompressionStream('deflate-raw');
      const w = ds.writable.getWriter(); w.write(data); w.close();
      raw = new Uint8Array(await new Response(ds.readable).arrayBuffer());
    } else if (e.method !== 0) return '';
    try { return new TextDecoder('utf-8', { fatal: true }).decode(raw); } catch (_) { return new TextDecoder('windows-1252').decode(raw); }
  } catch (_) { return ''; }
}

/** The folder name in front of the content folders (`OMSI 2/`), or ''. */
function wrapper(names) {
  for (const n of names) {
    const parts = n.split('/');
    const i = parts.findIndex((s) => FOLDERS.includes(s.toLowerCase()));
    if (i > 0) return parts.slice(0, i).join('/') + '/';
    if (i === 0) return '';
  }
  return '';
}

/**
 * What the zip offers: { maps: [{ name, file }], buses: [{ file, folder, label }], folders: [...] }
 * `file` is the path the game is given (relative to the root, `/` separators).
 */
export async function scan(bytes) {
  const list = entries(bytes);
  const names = list.map((e) => e.name);
  const pre = wrapper(names);
  const rel = (n) => (pre && n.startsWith(pre) ? n.slice(pre.length) : n);
  const maps = [], buses = [];
  const folders = new Set();
  for (const e of list) {
    const r = rel(e.name);
    const parts = r.split('/');
    if (FOLDERS.includes(parts[0].toLowerCase())) folders.add(parts[0]);
    let m;
    if ((m = r.match(/^maps\/([^/]+)\/global\.cfg$/i))) maps.push({ name: m[1], file: r });
    else if ((m = r.match(/^vehicles\/([^/]+)\/([^/]+\.bus)$/i))) buses.push({ file: r, folder: m[1], label: m[2].replace(/\.bus$/i, ''), entry: e });
  }
  // friendly names: [friendlyname] holds the maker, the type and the paint, one per line
  await Promise.all(buses.slice(0, 24).map(async (b) => {
    const text = await readText(bytes, b.entry);
    const at = text.search(/^\[friendlyname\]\r?$/m);
    if (at >= 0) {
      const lines = text.slice(at).split(/\r?\n/).slice(1, 4).map((s) => s.trim()).filter(Boolean);
      if (lines.length >= 2) b.label = `${lines[0]} ${lines[1]}`.trim();
    }
  }));
  buses.forEach((b) => delete b.entry);
  maps.sort((a, b) => a.name.localeCompare(b.name));
  buses.sort((a, b) => a.label.localeCompare(b.label));
  return { maps, buses, folders: [...folders], files: list.length };
}
