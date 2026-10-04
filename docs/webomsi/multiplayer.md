# Multiplayer in WebOmsi

Three ways to play together, all from the start screen under **Multiplayer**:

| | Who runs the game | You need | Good for |
|---|---|---|---|
| **Public list** | whoever listed their room or server | nothing | dropping in |
| **Room** (by code) | one player's *browser* | nothing: no server, no install | friends, a quick game |
| **Server** | a program on a computer | a computer that stays on | a community, a lasting place |

## Join

1. Open **Multiplayer**. The **Public** tab lists the rooms and servers that are open now (each with its map and number
   of players); press **Join**.
2. Or use **By code**: type the room code a friend gave you, or open the invite link they sent
   (`…/?room=ABC234`).
3. Or use **Server** and paste a server's address (`wss://…`).

The list is made by the hosts themselves and is **not checked**: join people you trust.

## Host a room (no server)

1. **Multiplayer → Host a room.** Your room gets a code.
2. Tick **Show my room in the public list** if you want strangers to find it, and give it a name.
3. Press **Play**, then send the invite link (**Copy invite link**) to your friends. A chip with the code and the number of
   players stays at the top right while you play (click it to copy the link again).

How it works: your browser is the server. The players' browsers connect to yours directly (WebRTC); only to open each
connection do two browsers pass each other a few hundred bytes through a free public relay. No game data goes through it.

Keep in mind:

* **Keep the tab open and visible.** A browser slows or stops a tab that is in the background, and the game stops with it.
  Put the game in its own window.
* A very strict network (some mobile and company networks) can block the direct connection; then try the other player's
  network or a server.
* The host's computer simulates the world for everybody; a phone is a weak host.

## Run a public server

A server is the game program running without a window. Players reach it over a WebSocket, which a page can only open
over TLS: the server needs a `wss://` address.

### With a domain and Docker (a VPS, Oracle Cloud's free VM, a Raspberry Pi…)

```sh
git clone https://github.com/LakoMoor/WebOmsi && cd WebOmsi
DOMAIN=play.example.com SERVER_NAME="My WebOmsi server" \
  docker compose -f deploy/docker-compose.yml up -d --build
```

The domain's DNS must point at the machine; ports 80 and 443 must be open. Caddy fetches the certificate by itself.
The `announce` container lists the server in the public list. Settings are in the compose file
(`SERVER_NAME`, `SERVER_MOTD`, `MAX_PLAYERS`, `ADMIN_PASSWORD`). The first build compiles the game and takes a while.

### On your own computer, with a free tunnel

No domain, no open ports: a Cloudflare quick tunnel gives you an `https://….trycloudflare.com` address.

```sh
cargo build --release -p omsi-app
tools/public/build.sh                                  # the demo content
OMSI_TRIMMED_PACK=1 target/release/openomsi --root public-pack --server server.cfg
```

In `server.cfg` set `map = maps/Demo/global.cfg` and `tunnel = 1`; the server prints the tunnel's address. To be listed
publicly, run `deploy/announce.sh https://<that address>` beside it. (The address changes each time the tunnel restarts.)

More settings (the map, the clock, the weather, the admin commands) are in [SERVER.md](../SERVER.md).

### Official servers

A list of servers that the site's owner vouches for can be put in `web/config.json`:
`"servers": [{ "name": "My server", "url": "wss://play.example.com/ws" }]`. They show first, marked *official*.

## If it does not connect

| Message | Meaning |
|---|---|
| "Nobody answered in this room" | wrong code, or the host closed the game, or the host's tab is in the background |
| "Could not connect to the host" | a strict network blocks the direct connection |
| "The room relay could not be reached" | the free relay is down or blocked on your network |
| nothing is listed under Public | nobody has listed a room right now: host one |
