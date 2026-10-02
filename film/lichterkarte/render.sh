#!/bin/sh
# Erzeugt die Werbefilme „Lichterkarte“:
#   film/tourfuchs-lichterkarte-whatsapp-status-9x16.mp4  (Handy, < 30 s)
#   film/tourfuchs-lichterkarte-desktop-16x9.mp4          (Desktop, Monitor)
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
node film/lichterkarte/record.mjs "$WORK" "$APP" phone
node film/lichterkarte/record.mjs "$WORK" "$APP" desktop
node film/lichterkarte/compose.mjs "$WORK/gfx" "$WORK/rec-phone" film/tourfuchs-lichterkarte-whatsapp-status-9x16.mp4 phone
node film/lichterkarte/compose.mjs "$WORK/gfx" "$WORK/rec-desktop" film/tourfuchs-lichterkarte-desktop-16x9.mp4 desktop
