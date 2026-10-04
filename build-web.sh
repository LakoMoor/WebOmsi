#!/bin/bash
# Build the browser version: web/pkg (the game as WASM). Usage: ./build-web.sh [web-dev|web]
set -e
P=${1:-web-dev}
cd "$(dirname "$0")"
RUSTFLAGS='--cfg getrandom_backend="wasm_js"' cargo +1.97.1 rustc --profile "$P" --lib -p omsi-app --target wasm32-unknown-unknown --crate-type cdylib -j "$(getconf _NPROCESSORS_ONLN 2>/dev/null || nproc)"
wasm-bindgen "target/wasm32-unknown-unknown/$P/openomsi_game.wasm" --out-dir web/pkg --target web --no-typescript $( [ "$P" = web-dev ] && echo --keep-debug )
ls -la web/pkg
