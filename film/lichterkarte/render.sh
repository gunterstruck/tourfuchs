#!/bin/sh
# Erzeugt die Werbefilme (LinkedIn-Serie und WhatsApp-Status):
#   film/tourfuchs-lichterkarte-whatsapp-status-9x16.mp4    (Woche 1, Handy, < 30 s)
#   film/tourfuchs-lichterkarte-desktop-16x9.mp4            (Woche 1, Querformat)
#   film/tourfuchs-tour-planen-linkedin-16x9.mp4            (Woche 2, Querformat)
#   film/tourfuchs-firmen-ki-kundenliste-linkedin-16x9.mp4  (Woche 3, Querformat)
# Serie 2 „Für die Vertriebsleitung“ (GeoFuchs):
#   film/tourfuchs-s2-bezirke-linkedin-16x9.mp4             (Woche 4)
#   film/tourfuchs-s2-umverteilen-linkedin-16x9.mp4         (Woche 5)
#   film/tourfuchs-s2-vorlage-linkedin-16x9.mp4             (Woche 6)
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
node film/lichterkarte/render-graphics.mjs "$WORK/gfx-tour" tour
node film/lichterkarte/record-tour.mjs "$WORK" "$APP"
node film/lichterkarte/compose.mjs "$WORK/gfx-tour" "$WORK/rec-tour" film/tourfuchs-tour-planen-linkedin-16x9.mp4 desktop
node film/lichterkarte/render-graphics.mjs "$WORK/gfx-kiliste" kiliste
node film/lichterkarte/record-kiliste.mjs "$WORK" "$APP"
node film/lichterkarte/compose.mjs "$WORK/gfx-kiliste" "$WORK/rec-kiliste" film/tourfuchs-firmen-ki-kundenliste-linkedin-16x9.mp4 desktop
for f in bezirke umverteilen vorlage; do
    node film/lichterkarte/render-graphics.mjs "$WORK/gfx-$f" "$f"
    node film/lichterkarte/record-$f.mjs "$WORK" "$APP"
    node film/lichterkarte/compose.mjs "$WORK/gfx-$f" "$WORK/rec-$f" "film/tourfuchs-s2-$f-linkedin-16x9.mp4" desktop
done
