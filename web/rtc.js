// Peer-to-peer rooms for the page: one player's browser hosts the game, the others join with a
// room code. The game's datagrams go over WebRTC data channels, browser to browser. Only to
// open the channel do two players need to pass each other a few hundred bytes (the "offer" and
// the "answer"); that goes through a free public relay (ntfy.sh) under a topic named after the
// room. No game traffic goes through it, and nothing of ours has to run anywhere.

const RELAY = 'https://ntfy.sh/';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';    // no 0/O, 1/I

export const DEFAULT_ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];

export function newRoomCode() {
  const r = crypto.getRandomValues(new Uint8Array(6));
  return [...r].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}
export const cleanCode = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
const topic = (code, part) => `webomsi-${cleanCode(code).toLowerCase()}-${part}`;

// ---- small, URL-safe packing of a JSON object (SDP compresses well) ----------------------------
async function pipe(bytes, stream) {
  const w = stream.writable.getWriter(); w.write(bytes); w.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}
async function pack(obj) {
  const z = await pipe(new TextEncoder().encode(JSON.stringify(obj)), new CompressionStream('deflate-raw'));
  let s = ''; for (const b of z) s += String.fromCharCode(b);
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
async function unpack(text) {
  const b64 = text.trim().replaceAll('-', '+').replaceAll('_', '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const z = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(await pipe(z, new DecompressionStream('deflate-raw'))));
}

// ---- the relay -----------------------------------------------------------------------------------
async function publish(name, text) {
  const r = await fetch(RELAY + name, { method: 'POST', body: text });
  if (!r.ok) throw new Error(`relay ${r.status}`);
}

/** Calls `onMessage(text, id)` for each message of the topic (also the ones of the last minutes). */
function subscribe(name, onMessage, since = '3m') {
  const stop = new AbortController();
  let seen = new Set();
  (async () => {
    while (!stop.signal.aborted) {
      try {
        const r = await fetch(`${RELAY}${name}/json?since=${since}`, { signal: stop.signal });
        const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, i); buf = buf.slice(i + 1);
            if (!line.trim()) continue;
            let ev; try { ev = JSON.parse(line); } catch (_) { continue; }
            if (ev.event === 'message' && !seen.has(ev.id)) { seen.add(ev.id); onMessage(ev.message, ev.id); }
          }
        }
      } catch (e) { if (stop.signal.aborted) return; }
      await new Promise((res) => setTimeout(res, 1500));     // the stream ended: again
    }
  })();
  return { close: () => stop.abort() };
}

function gathered(pc, ms = 4000) {
  return new Promise((res) => {
    if (pc.iceGatheringState === 'complete') return res();
    const done = () => { pc.removeEventListener('icegatheringstatechange', check); res(); };
    const check = () => { if (pc.iceGatheringState === 'complete') done(); };
    pc.addEventListener('icegatheringstatechange', check);
    setTimeout(done, ms);                                   // enough candidates by then
  });
}
const config = (iceServers) => ({ iceServers: iceServers && iceServers.length ? iceServers : DEFAULT_ICE });

// ---- hosting: a page that answers whoever joins the room ---------------------------------------------
/**
 * `onPeer(channel)` is called with each player's open data channel. Returns { close() }.
 * `onError(message)` hears about offers that could not be answered.
 */
export function host(code, { iceServers, onPeer, onError = () => {} }) {
  const peers = new Set();
  const sub = subscribe(topic(code, 'h'), async (text) => {
    try {
      const { id, offer } = await unpack(text);
      const pc = new RTCPeerConnection(config(iceServers));
      peers.add(pc);
      pc.ondatachannel = (e) => {
        const ch = e.channel;
        const open = () => onPeer(ch, pc);
        if (ch.readyState === 'open') open(); else ch.onopen = open;
      };
      pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) peers.delete(pc); };
      await pc.setRemoteDescription({ type: 'offer', sdp: offer });
      await pc.setLocalDescription(await pc.createAnswer());
      await gathered(pc);
      await publish(topic(code, 'a-' + id), await pack({ answer: pc.localDescription.sdp }));
    } catch (e) { onError(String((e && e.message) || e)); }
  });
  return { close() { sub.close(); peers.forEach((p) => p.close()); } };
}

// ---- joining: a page that opens a channel to the host of the room ------------------------------------------
/** Resolves with the open data channel to the host of room `code`. */
export async function join(code, { iceServers, timeout = 30000, onStatus = () => {} } = {}) {
  code = cleanCode(code);
  if (code.length < 4) throw new Error('room code');
  const id = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALPHABET[b % ALPHABET.length]).join('').toLowerCase();
  const pc = new RTCPeerConnection(config(iceServers));
  const channel = pc.createDataChannel('game', { ordered: false, maxRetransmits: 0 });
  channel.binaryType = 'arraybuffer';
  try {
    onStatus('offer');
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc);
    const answered = new Promise((resolve) => {
      const sub = subscribe(topic(code, 'a-' + id), async (text) => {
        try { const { answer } = await unpack(text); sub.close(); resolve(answer); } catch (_) {}
      });
    });
    await publish(topic(code, 'h'), await pack({ id, offer: pc.localDescription.sdp }));
    onStatus('waiting');
    const answer = await Promise.race([answered, new Promise((_, rej) => setTimeout(() => rej(new Error('nohost')), timeout))]);
    onStatus('connecting');
    await pc.setRemoteDescription({ type: 'answer', sdp: answer });
    await new Promise((resolve, reject) => {
      if (channel.readyState === 'open') return resolve();
      channel.onopen = () => resolve();
      setTimeout(() => reject(new Error('noconnect')), timeout);
    });
    return channel;
  } catch (e) { pc.close(); throw e; }
}

// ---- the public lobby ------------------------------------------------------------------------------------------------
// Hosts that want to be found announce themselves on one shared relay topic every half minute (a
// browser room by its code, a dedicated server by its wss:// address); the page lists the
// announcements of the last minute and a half. Anybody can post there, so what is read is checked
// and shown as unverified: names are plain text, an address must be a wss:// one.
export const LOBBY = 'webomsi-lobby-v1';
export const LOBBY_TTL = 90000;
const text = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

/** Announce a room: { kind: 'room', code } or a server: { kind: 'server', url }. */
export async function announce({ kind, code, url, name, map, players, max }) {
  const e = { v: 1, k: kind === 'server' ? 's' : 'r', n: text(name, 32) || 'WebOmsi', m: text(map, 24), p: players | 0, x: max | 0 || 16, t: Date.now() };
  if (e.k === 'r') e.c = cleanCode(code); else e.u = text(url, 120);
  await publish(LOBBY, JSON.stringify(e));
}

function readAnnouncement(raw) {
  let e; try { e = JSON.parse(raw); } catch (_) { return null; }
  if (!e || e.v !== 1 || typeof e.t !== 'number') return null;
  const out = { name: text(e.n, 32) || 'WebOmsi', map: text(e.m, 24), players: Math.max(0, Math.min(99, e.p | 0)), max: Math.max(1, Math.min(99, e.x | 0 || 16)), t: Math.min(e.t, Date.now()) };
  if (e.k === 'r') { const c = cleanCode(e.c); if (c.length < 4) return null; out.kind = 'room'; out.code = c; out.id = 'r:' + c; }
  else if (e.k === 's') {
    const u = text(e.u, 120);
    if (!/^wss:\/\/[a-z0-9.-]+(:\d{2,5})?\/ws$/i.test(u)) return null;
    out.kind = 'server'; out.url = u; out.id = 's:' + u.toLowerCase();
  } else return null;
  return out;
}

/** Calls `onChange(list)` with the live announcements (newest data per host), now and then. Returns { close() }. */
export function lobby(onChange) {
  const live = new Map();
  const emit = () => {
    const now = Date.now();
    for (const [id, e] of live) if (now - e.t > LOBBY_TTL) live.delete(id);
    onChange([...live.values()].sort((a, b) => b.players - a.players || b.t - a.t));
  };
  const sub = subscribe(LOBBY, (raw) => {
    const e = readAnnouncement(raw);
    if (e && Date.now() - e.t < LOBBY_TTL) { live.set(e.id, e); emit(); }
  }, '2m');
  const tick = setInterval(emit, 5000);
  return { close() { sub.close(); clearInterval(tick); } };
}
