#!/bin/sh
# Writes server.cfg from the environment and starts the server.
set -eu
cat > /app/server.cfg <<CFG
name = ${SERVER_NAME:-WebOmsi server}
motd = ${SERVER_MOTD:-Welcome! Drive safely.}
map = ${SERVER_MAP:-maps/Demo/global.cfg}
time = ${SERVER_TIME:-09:00}
traffic = 0
timetable = 0
passengers = 0
port = 27015
web_port = 27025
max_players = ${MAX_PLAYERS:-16}
tunnel = 0
radius = 0
admin_password = ${ADMIN_PASSWORD:-}
share_positions = 1
vehicles = Vehicles/DemoBus/demo_city.bus; Vehicles/DemoBus/demo_mini.bus; Vehicles/DemoBus/demo_long.bus; Vehicles/DemoBus/demo_double.bus
CFG
exec /app/openomsi --root /app/public-pack --server /app/server.cfg
