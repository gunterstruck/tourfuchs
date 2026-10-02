#!/bin/sh
# Erzeugt den Werbefilm „Lichterkarte“ (WhatsApp-Status, 9:16, < 30 s):
#   film/tourfuchs-lichterkarte-whatsapp-status-9x16.mp4
# Voraussetzungen: Node.js mit Playwright (Chromium), ffmpeg (libx264, aac).
# Die App muss laufen (z. B. `npx vite --port 5173`); Adresse als 1. Argument.
# Hinter einem TLS-prüfenden Proxy zusätzlich FILM_PROXY und FILM_PROXY_CA setzen
# (sonst fehlen die Kartenkacheln).
# Aufruf im Repository-Stamm: sh film/lichterkarte/render.sh [http://localhost:5173/]
set -e
cd "$(dirname "$0")/../.."
APP="${1:-http://localhost:5173/}"
WORK="${WORK:-$(mktemp -d)}"
node film/lichterkarte/render-graphics.mjs "$WORK/gfx"
node film/lichterkarte/record.mjs "$WORK" "$APP"
node film/lichterkarte/compose.mjs "$WORK/gfx" "$WORK/rec" film/tourfuchs-lichterkarte-whatsapp-status-9x16.mp4
