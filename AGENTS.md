# Hinweise für KI-Assistenten (und Menschen), die an TourFuchs arbeiten

**Zuerst lesen:** `docs/roadmap-2026-H2.md`
- Abschnitt **1a „Nische zuerst"** – Prüffrage für jede Idee: *„Hilft das unseren
  10 Außendienstlern?"*
- Abschnitt **„Offene Themen mit Auslöser"** – Themen, die erst bei einem
  bestimmten Ereignis angegangen werden, aber nicht vergessen werden dürfen.
  Zu Beginn einer Sitzung prüfen und ansprechen, wenn der Auslöser eingetreten
  sein könnte (z. B. „Der Konzern will TourFuchs selbst betreiben" →
  Umzug ins Konzern-GitHub, siehe `docs/nutzungsnachweis.md`).
- Abschnitt **3 „Arbeitsweise (Definition of Done)"** – gilt für jeden PR.
- `docs/wettbewerb.md` – Wettbewerber, ihre wahrscheinlichen Züge und unsere
  Antworten. Neu ansehen, wenn dort genannte Auslöser eintreten.

**Grundsätze (nicht verhandelbar):**
- Lokal-first: Kundendaten verlassen das Gerät nicht; keine Cloud, kein Login.
- TourFuchs ruft keine KI auf – es bereitet Prompts nur vor (kopieren, Assistent öffnen).
- Jede neue externe Verbindung wird in `public/datenschutz.html` und README offengelegt.
- Nutzungszählung nur anonym und schmal (`docs/nutzungsnachweis.md`): keine eigenen
  Ereignisse, keine Kunden- oder Bediendaten.
- **Werbung, Filme, Texte:** Nie „kein Tracking“, „keine Statistik“ oder „wir
  zählen nichts“ schreiben – seit 03.10.2026 gibt es eine anonyme Zählung der
  Seitenaufrufe. Richtig und stärker ist die Aussage über die **Kundendaten**:
  „Kundendaten bleiben bei dir / lokal im Browser“.
- Sichtbare Beschriftungen stehen in `docs/guide-ki-wissensbasis.md`
  (abgesichert durch `tests/docsConsistency.test.js`).

**Prüfen vor dem Push:** `npm run build`, `npm test`; bei UI-Änderungen zusätzlich
`npm run attention-check` und `npm run smoke-check` (brauchen Playwright).
