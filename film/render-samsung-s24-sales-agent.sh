#!/bin/zsh
set -euo pipefail

FFMPEG="${FFMPEG_PATH:-/opt/homebrew/bin/ffmpeg}"
PYTHON="${PYTHON_PATH:-/opt/homebrew/bin/python3}"
OUT="film/tourfuchs-samsung-s24-1080x2340-ohne-musik.mp4"

"$PYTHON" film/render-linkedin.py --with-agent --s24-view

# Native S24-Ausgabe: 360 × 780 CSS-Pixel bei DPR 3 ergeben 1080 × 2340.
# Sechs echte App-Zustände pro Sekunde werden sanft auf konstante 30 fps
# ergänzt; es findet kein Beschnitt auf das kürzere 9:16-Format statt.
"$FFMPEG" -y -hide_banner -loglevel error \
  -start_number 1 -framerate 6 -i film/work-linkedin/frames/final-%04d.jpg \
  -vf "minterpolate=fps=30:mi_mode=blend,tpad=stop_mode=clone:stop_duration=1,fps=30,scale=in_range=full:out_range=tv,format=yuv420p" \
  -t 69 -r 30 -fps_mode cfr -c:v libx264 -preset medium -crf 18 \
  -pix_fmt yuv420p -color_range tv -movflags +faststart "$OUT"

"$FFMPEG" -y -hide_banner -loglevel error -ss 00:00:38 -i "$OUT" -frames:v 1 \
  film/tourfuchs-samsung-s24-vorschaubild.jpg

echo "$OUT"
