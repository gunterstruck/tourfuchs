# Thorsten für die Live-Schulungen

Die MP3-Dateien unter `public/audio/thorsten/` sind künstlich erzeugte
Sprachaufnahmen der festen TourFuchs-Schulungstexte. Sie wurden lokal mit
Piper und dem Modell `de_DE-thorsten-high` erzeugt (length_scale 1.02,
sentence_silence 0.26, MP3 mono 22.050 Hz / 64 kbit/s).

Stimme: **Thorsten Müller / Thorsten-Voice**.
Das Projekt stellt seine Sprachdaten unter CC0 1.0 bereit:
[Projekt und Lizenz](https://github.com/thorstenMueller/Thorsten-Voice),
[Aufnahmen](https://www.thorsten-voice.de/en/about/recordings/),
[Piper-Modellkarte](https://huggingface.co/rhasspy/piper-voices/blob/v1.0.0/de/de_DE/thorsten/high/MODEL_CARD).

Verwendetes Modell, SHA-256:
`9df1c43c61149ef9b39e618e2b861fbe41e1fcea9390b2dac62e8761573ea4f1`.
Piper und das Modell werden nicht an App-Nutzer ausgeliefert. Die App ruft
keinen Sprachdienst auf. Sie lädt nur die festen MP3-Dateien vom eigenen Host.
Kundennamen und andere importierte Inhalte werden nicht vertont.

Neu erzeugen: `PIPER_BIN`, `PIPER_MODEL` und optional `FFMPEG_PATH` setzen,
dann `node tools/build-showcase-speech.mjs`. Der Generator erfasst alle festen
Sätze aus den Stories und den Helfern; der Konsistenztest erkennt neue oder
geänderte Texte ohne Aufnahme. `.speech-build/` bleibt lokal.
