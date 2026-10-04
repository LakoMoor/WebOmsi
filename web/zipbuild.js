// Files in, a zip out (in memory, stored without compression): the game reads its content from one
// archive, so a folder of files - downloaded one by one from a site, or picked from the player's
// disk - is put together into one here.

const TABLE = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
export function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = TABLE[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

/** Deflates `data` with the browser's own compressor. */
async function deflate(data) {
  return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
}
const INCOMPRESSIBLE = /\.(png|jpe?g|ogg|mp3|zip|7z|rar|gz)$/i;

/** One entry of a zip: deflated when that makes it smaller (big text, meshes, bitmaps, wav). */
export async function entry(name, data) {
  const crc = crc32(data);
  if (data.length >= 2048 && !INCOMPRESSIBLE.test(name) && typeof CompressionStream !== 'undefined') {
    const z = await deflate(data);
    if (z.length < data.length * 0.95) return { name, data: z, size: data.length, crc, method: 8 };
  }
  return { name, data, size: data.length, crc, method: 0 };
}

/** files: [{ name, data }] or entries made by `entry` -> Uint8Array (a zip) */
export function buildZip(files) {
  const enc = new TextEncoder();
  const names = files.map((f) => enc.encode(f.name.replaceAll('\\', '/')));
  let size = 22;
  files.forEach((f, i) => { size += 30 + names[i].length + f.data.length + 46 + names[i].length; });
  const out = new Uint8Array(size), dv = new DataView(out.buffer);
  const offsets = [];
  let p = 0;
  files.forEach((f, i) => {
    offsets.push(p);
    const n = names[i], crc = f.crc ?? crc32(f.data), method = f.method ?? 0, usize = f.size ?? f.data.length;
    dv.setUint32(p, 0x04034b50, true); dv.setUint16(p + 4, 20, true); dv.setUint16(p + 6, 0x800, true); dv.setUint16(p + 8, method, true);
    dv.setUint32(p + 10, 0, true); dv.setUint32(p + 14, crc, true); dv.setUint32(p + 18, f.data.length, true); dv.setUint32(p + 22, usize, true);
    dv.setUint16(p + 26, n.length, true); dv.setUint16(p + 28, 0, true);
    out.set(n, p + 30); out.set(f.data, p + 30 + n.length);
    p += 30 + n.length + f.data.length;
  });
  const cd = p;
  files.forEach((f, i) => {
    const n = names[i], crc = f.crc ?? crc32(f.data), method = f.method ?? 0, usize = f.size ?? f.data.length;
    dv.setUint32(p, 0x02014b50, true); dv.setUint16(p + 4, 20, true); dv.setUint16(p + 6, 20, true); dv.setUint16(p + 8, 0x800, true); dv.setUint16(p + 10, method, true);
    dv.setUint32(p + 12, 0, true); dv.setUint32(p + 16, crc, true); dv.setUint32(p + 20, f.data.length, true); dv.setUint32(p + 24, usize, true);
    dv.setUint16(p + 28, n.length, true); dv.setUint32(p + 42, offsets[i], true);
    out.set(n, p + 46);
    p += 46 + n.length;
  });
  dv.setUint32(p, 0x06054b50, true); dv.setUint16(p + 8, files.length, true); dv.setUint16(p + 10, files.length, true);
  dv.setUint32(p + 12, p - cd, true); dv.setUint32(p + 16, cd, true);
  return out;
}

/**
 * Downloads `files` ([[path, size], ...]) from `base` with `parallel` requests at a time and
 * calls onProgress({ done, total, bytes, totalBytes, name }). Returns the zip.
 */
export async function downloadAsZip(base, files, onProgress, parallel = 8) {
  const out = new Array(files.length);
  const totalBytes = files.reduce((a, f) => a + (f[1] || 0), 0);
  let next = 0, done = 0, bytes = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= files.length) return;
      const [path, size] = files[i];
      const r = await fetch(base + path.split('/').map(encodeURIComponent).join('/'));
      if (!r.ok) throw new Error(`${path}: ${r.status}`);
      const data = new Uint8Array(await r.arrayBuffer());
      out[i] = await entry(path, data);
      done++; bytes += size || data.length;
      onProgress({ done, total: files.length, bytes, totalBytes, name: path });
    }
  }
  await Promise.all(Array.from({ length: Math.min(parallel, files.length) }, worker));
  return buildZip(out);
}

/** Files picked from the disk ([{ name, file }]) -> a zip; progress as above. */
export async function filesToZip(list, onProgress) {
  const totalBytes = list.reduce((a, f) => a + f.file.size, 0);
  const out = []; let bytes = 0;
  for (const [i, f] of list.entries()) {
    out.push(await entry(f.name, new Uint8Array(await f.file.arrayBuffer())));
    bytes += f.file.size;
    onProgress({ done: i + 1, total: list.length, bytes, totalBytes, name: f.name });
  }
  return buildZip(out);
}

/** The files of a dropped folder (or files): [{ name: relative path, file }]. */
export async function readDropped(items) {
  const out = [];
  async function walk(entry, prefix) {
    if (entry.isFile) {
      const file = await new Promise((res, rej) => entry.file(res, rej));
      out.push({ name: prefix + entry.name, file });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      for (;;) {
        const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        for (const e of batch) await walk(e, prefix + entry.name + '/');
      }
    }
  }
  // (the browser lets go of the dropped entries when the event ends: take them all first)
  const entries = [...items].map((it) => it.webkitGetAsEntry && it.webkitGetAsEntry()).filter(Boolean);
  for (const e of entries) await walk(e, '');
  return out;
}
