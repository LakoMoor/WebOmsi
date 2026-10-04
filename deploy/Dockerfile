# A public WebOmsi server: the game program hosting a session with no window, on the demo content.
#   docker build -f deploy/Dockerfile -t webomsi-server .
FROM rust:1.97-bookworm AS build
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential pkg-config libasound2-dev libudev-dev libgtk-3-dev libxkbcommon-dev \
      libwayland-dev libssl-dev clang lld python3 zip && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY . .
RUN cargo build --release --locked -p omsi-app && tools/public/build.sh

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      libasound2 libudev1 libgtk-3-0 libxkbcommon0 libwayland-client0 libssl3 ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /src/target/release/openomsi /app/openomsi
COPY --from=build /src/public-pack /app/public-pack
COPY deploy/entrypoint.sh /app/entrypoint.sh
ENV OMSI_TRIMMED_PACK=1
EXPOSE 27025
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD curl -fsS http://127.0.0.1:27025/status >/dev/null || exit 1
ENTRYPOINT ["/app/entrypoint.sh"]
