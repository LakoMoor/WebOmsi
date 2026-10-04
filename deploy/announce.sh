#!/bin/sh
# Lists a running WebOmsi server in the public list of the start screen: every 30 seconds it
# posts the server's status (name, map, players) to the shared lobby topic. The page shows it as
# a server with a Join button.
#
#   deploy/announce.sh https://my-server.example.com            (or the https://….trycloudflare.com
#                                                                 address a tunnel gave you)
#   STATUS_URL=http://server:27025/status deploy/announce.sh wss://my-server.example.com/ws
#
# The address must be reachable from the players' browsers over TLS (wss://): a domain behind a
# reverse proxy (see docker-compose.yml) or a Cloudflare tunnel (`tunnel = 1` in server.cfg).
set -u
url="${1:?usage: announce.sh https://your-server-address [status url]}"
status="${2:-${STATUS_URL:-http://127.0.0.1:27025/status}}"
topic="${LOBBY_TOPIC:-webomsi-lobby-v1}"
case "$url" in
  https://*) ws="wss://${url#https://}" ;;
  wss://*) ws="$url" ;;
  *) echo "the address must start with https:// or wss:// (a page on https cannot use anything else)" >&2; exit 2 ;;
esac
ws="${ws%/}"
case "$ws" in */ws) ;; *) ws="$ws/ws" ;; esac
clean() { printf '%s' "$1" | tr -d '"\\\r\n' | cut -c1-32; }
while true; do
  if s="$(curl -fsS -m 5 "$status" 2>/dev/null)"; then
    name="$(clean "$(printf '%s' "$s" | sed -n 's/.*"name":"\([^"]*\)".*/\1/p')")"
    map="$(printf '%s' "$s" | sed -n 's/.*"map":"\([^"]*\)".*/\1/p' | sed 's#.*maps/##; s#/.*##')"
    players="$(printf '%s' "$s" | sed -n 's/.*"players":\([0-9]*\).*/\1/p')"
    max="$(printf '%s' "$s" | sed -n 's/.*"max_players":\([0-9]*\).*/\1/p')"
    body="$(printf '{"v":1,"k":"s","n":"%s","m":"%s","p":%s,"x":%s,"t":%s000,"u":"%s"}' "${name:-WebOmsi server}" "$(clean "$map")" "${players:-0}" "${max:-16}" "$(date +%s)" "$ws")"
    curl -fsS -m 10 -d "$body" "https://ntfy.sh/$topic" >/dev/null 2>&1 || echo "announce: the relay did not take it" >&2
  else
    echo "announce: no status from $status (is the server running?)" >&2
  fi
  [ "${ONCE:-}" = 1 ] && exit 0
  sleep 30
done
