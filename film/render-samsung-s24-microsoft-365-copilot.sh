#!/bin/zsh
set -euo pipefail

FFMPEG="${FFMPEG_PATH:-/opt/homebrew/bin/ffmpeg}"
PYTHON="${PYTHON_PATH:-/opt/homebrew/bin/python3}"
OUT="film/tourfuchs-samsung-s24-microsoft-365-copilot-ohne-musik.mp4"

"$PYTHON" film/render-linkedin.py --with-agent --s24-view --m365-copilot

FRAME_COUNT=$(find film/work-linkedin/frames -name 'final-*.jpg' | wc -l | tr -d ' ')
DURATION=$(awk -v frames="$FRAME_COUNT" 'BEGIN { printf "%.3f", frames / 6 }')

# Gerätegetreue S24-Fassung mit konkret benanntem Microsoft-365-Copilot-
# Beispiel. TourFuchs bleibt technisch unverbunden: Der Film zeigt nur den
# bewussten Übergang über die Zwischenablage.
"$FFMPEG" -y -hide_banner -loglevel error \
  -start_number 1 -framerate 6 -i film/work-linkedin/frames/final-%04d.jpg \
  -vf "minterpolate=fps=30:mi_mode=blend,tpad=stop_mode=clone:stop_duration=1,fps=30,scale=in_range=full:out_range=tv,format=yuv420p" \
  -t "$DURATION" -r 30 -fps_mode cfr -c:v libx264 -preset medium -crf 18 \
  -pix_fmt yuv420p -color_range tv -movflags +faststart "$OUT"

"$FFMPEG" -y -hide_banner -loglevel error -ss 00:00:45 -i "$OUT" -frames:v 1 \
  film/tourfuchs-samsung-s24-microsoft-365-copilot-vorschaubild.jpg

echo "$OUT"
