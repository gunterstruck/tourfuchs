#!/bin/zsh
set -euo pipefail

FFMPEG="${FFMPEG_PATH:-/opt/homebrew/bin/ffmpeg}"
PYTHON="${PYTHON_PATH:-/opt/homebrew/bin/python3}"
OUT="film/tourfuchs-shorts-9x16-mobile-ohne-musik.mp4"

"$PYTHON" film/render-linkedin.py --with-agent --mobile-view

# Die echte Mobile-PWA wird mit sechs unterschiedlichen Bildern pro Sekunde
# aufgenommen. Sanfte Zwischenbilder schließen die letzten Schritte zu
# konstanten 30 fps, ohne das Handybild zu beschneiden oder umzubauen.
"$FFMPEG" -y -hide_banner -loglevel error \
  -start_number 1 -framerate 6 -i film/work-linkedin/frames/final-%04d.jpg \
  -vf "minterpolate=fps=30:mi_mode=blend,tpad=stop_mode=clone:stop_duration=1,fps=30,scale=in_range=full:out_range=tv,format=yuv420p" \
  -t 69 -r 30 -fps_mode cfr -c:v libx264 -preset medium -crf 18 \
  -pix_fmt yuv420p -color_range tv -movflags +faststart "$OUT"

"$FFMPEG" -y -hide_banner -loglevel error -ss 00:00:36 -i "$OUT" -frames:v 1 \
  film/tourfuchs-shorts-9x16-mobile-vorschaubild.jpg

echo "$OUT"
