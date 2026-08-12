# 🦊 TourFuchs Vertrieb – Produkt-Roadmap H2/2026

**Stand:** 12.08.2026 · **Rolle:** Product Owner · **Status:** verbindliche Arbeitsgrundlage

---

## 1. Produktvision (North Star)

TourFuchs ist die PWA, die zwei Momente perfekt macht:

> **Moment A – Außendienst, morgens, 07:30:**
> „Ich öffne TourFuchs und habe in **30 Sekunden** meinen fertig optimierten Tagesplan –
> überfällige Kunden zuerst, Route steht, ein Tipp und Google Maps navigiert."

> **Moment B – Vertriebsleitung, Gebietsreform:**
> „Ich simuliere eine Umverteilung in **10 Minuten**, sehe Alt/Neu auf der Karte mit
> Umsatzwirkung und exportiere eine **fertige Entscheidungsvorlage** fürs Management."

Alles, was auf keinen der beiden Momente einzahlt, ist Backlog – nicht Sprint.

**Leitplanken (nicht verhandelbar):**
- **Lokal-first bleibt das Alleinstellungsmerkmal.** Keine Cloud, kein Login, keine Kundendaten auf fremden Servern ohne ausdrückliches, informiertes Opt-in.
- **Mobile ist der primäre Formfaktor** für Moment A, Desktop für Moment B.
- Jede Übermittlung an Drittdienste (Nominatim, OSRM) ist offengelegt und abschaltbar.

---

## 2. Release-Plan

### Release 1 – „Vertrauen & Fundament" *(sofort, ~1 Woche)*

Ziel: Die Datenschutz-Zusage stimmt wieder mit dem Verhalten überein, und die
Kernlogik ist gegen Regressionen abgesichert. Kein neues Feature, bevor das steht.

| # | Item | Akzeptanzkriterien |
|---|---|---|
| 1.1 | **OSRM-Routing transparent & opt-in** (Finding F1) | Datenschutzseite nennt OSRM-Routing als Drittdienst inkl. übermittelter Daten (Koordinaten von Start/Stopps). Straßenroute ist eine bewusste Nutzerentscheidung (Schalter, Standard: aus oder erste Nutzung mit Hinweis bestätigen). Luftlinie funktioniert vollständig ohne externe Calls. |
| 1.2 | **Test-Fundament + CI-Gate** (F3) | Vitest eingerichtet. Unit-Tests für reine Logik: `visits.js` (Fälligkeit), `territory.js` (Aggregation), Cockpit-Simulationsrechnung (Umsatz-Dedup, Undo-Snapshot), vollständige Datensatz-Ersetzung. GitHub Action: `build` + `test` müssen grün sein, bevor gemergt wird. Kein Selbst-Merge unter 5 Minuten ohne grünen Check. |
| 1.3 | **Kunden-Index statt linearem `find`** (F4) | `getCustomer()` O(1) über Map-Index; Cockpit mit 5.000 Demo-Kunden flüssig (< 200 ms Re-Render). |
| 1.4 | **KPI-Karten-Label dynamisch** (F5) | „Top-/Schwächster Bezirk" folgt dem gewählten Zuweisungs-Attribut (Bezirk/Gruppe/Channel). |
| 1.5 | **Eine Umsatz-Darstellungsregel** (F6) | Verbindlich: ab 10 T€ immer `Σ x T€` (gerundet), voller Betrag im Tooltip; Cockpit und Karte identisch. |

### Release 2 – „Mein Tag" · **WOW-Feature #1** *(~2–3 Wochen)*

Ziel: Moment A. Aus vorhandenen Bausteinen (Besuchsrhythmus/`visitStatus`,
Tourenoptimierung, Umkreis/Korridor) wird ein **Ein-Klick-Tagesplaner**:

> Button **„Plane meinen Tag"** → TourFuchs schlägt automatisch eine Tagestour vor:
> überfällige/fällige Kunden des eigenen Bezirks, gewichtet nach Fälligkeit, Umsatz
> und Fahrstrecke, optimiert als Route ab GPS-Standort.

> **Produktentscheidung 10.07.2026 (Nutzerfeedback):** Die Tour plant der Nutzer
> **manuell** – so wie bisher. Ein automatischer Tourvorschlag (ursprünglich 2.1)
> ist **gestrichen**; die Wochen-Vorschau (2.2) und der Morgen-Startscreen (2.3)
> sind **zurückgestellt**, bis der Bedarf erneut validiert ist. Automatik unterstützt
> nur dort, wo sie nichts vorwegnimmt: Zeiten, Termine, Übergabe.

| # | Item | Status | Akzeptanzkriterien |
|---|---|---|---|
| 2.1 | ~~Tagesplan-Vorschlag (automatisch)~~ | ❌ gestrichen | Nutzerentscheidung: manuelle Planung bleibt der Weg. Logik in Git-Historie erhalten. |
| 2.2 | Wochen-Vorschau | ⏸ zurückgestellt | Nur nach erneuter Validierung mit Nutzern. |
| 2.3 | Morgen-Startscreen (Mobile) | ⏸ zurückgestellt | Nur nach erneuter Validierung mit Nutzern. |
| 2.4 | **Besuch abhaken unterwegs** | ✅ umgesetzt | War bereits gebaut und im Status-Feld übersehen: „✓ Heute" je Stopp, am Handy Tipp auf den Tour-Punkt, zusätzlich „Heute besucht" im Karten-Popup. `besuche[]` und Fälligkeitsstatus aktualisieren sich sofort. Ergänzt am 25.07.2026 um den **Feierabend-Rückblick**, der das Abhaken erst belohnt (siehe 5.6). |
| 2.5 | **Route aufs Handy per QR-Code** | ✅ umgesetzt | Am Desktop geplante Tour als QR-Code anzeigen (nur die notwendigen Daten). Handy-PWA scannt per Kamera und übernimmt die Tour – ohne Netzwerk, ohne Datei, ohne Server. Es wird nie die Kundendatenbank übertragen, nur die Tour. |
| 2.6 | **Plan-Einstellungen für Termine** | ✅ umgesetzt | Datum, Startzeit und Besuchsdauer (Standard 45 min) sind wählbar und steuern Tagesplan-Druck und Outlook-Kalendertermine (.ics, ein Termin je Besuch inkl. Fahrzeit). |

**Der WOW-Moment von Release 2** ist die QR-Übergabe (2.5): Bildschirm zeigen,
scannen, losfahren – Lokal-first in Reinform. Die manuelle Planung bleibt dabei
vollständig in der Hand des Nutzers.

### Release 3 – „Entscheidungsvorlage" · **WOW-Feature #2** *(3.1 und 3.3 umgesetzt, 3.2 offen)*

Ziel: Moment B zu Ende denken. Die Simulation (PRs #44–#48) ist stark, aber ihr
Ergebnis „verpufft" im Dialog.

| # | Item | Status | Ergebnis |
|---|---|---|---|
| 3.1 | **Simulations-Report exportieren** | ✅ umgesetzt *(12.08.2026)* | `src/features/simulationReport.js`: Druckansicht mit Kennzahlen je Einheit (Kunden, Umsatz, Δ – vorher **und** nachher), Ausgewogenheit vorher/nachher, Aktionsliste und betroffenen Gebieten; dazu der Excel-Export der Umbuchungsliste (`exportReassignments`). **Ohne Kartenbild** – siehe 3.1b. |
| 3.2 | **Ausgewogenheits-Assistent** | ⏳ offen | Button „Vorschlag: ausgleichen": Greedy-Heuristik schlägt Gebietsverschiebungen vor, die den Kunden-/Umsatz-Faktor Richtung ≤ 1,5 senken – als Simulation, die der Nutzer prüft, editiert, verwirft oder übernimmt. Keine Blackbox: jede vorgeschlagene Verschiebung ist einzeln begründet (Gebiet, Kunden, Umsatz). |
| 3.3 | **Benannte Simulations-Szenarien** | ✅ umgesetzt | Nachgeholt als Item 6.8 in Release 8 (`src/features/simulationScenarios.js`). Speichern, Laden, Vergleichen; nur Zuordnungen, keine Kundendaten. |
| 3.1b | **Kartenbild Alt/Neu in der Vorlage** | ⏸ zurückgestellt | Bewusst aus 3.1 herausgeschnitten, Begründung unten. |

#### Zwei Adressaten, zwei Dokumente (3.1)

Die Vorlage ist **aggregiert und nennt keinen Kundennamen**; die namentliche
Umbuchungsliste gibt es getrennt als Excel-Datei. Das ist keine Bequemlichkeit,
sondern die Anwendung der eigenen Leitplanke auf ein Papier: Eine
Entscheidungsvorlage wird in einer Sitzung herumgereicht und kopiert. Wer die
Kundenliste hineinlegt, verteilt sie an einen Kreis, der über Zuschnitte
entscheidet und dafür keine Namen braucht. Die Person, die die Umbuchung
anschließend ausführt, braucht sie – und bekommt sie als eigene Datei.

Zweite Festlegung: Die Vorlage zeigt **beide Stände**, nicht nur den
Zielzustand. Eine Vorlage, die nur zeigt, was danach ist, ist keine
Entscheidungsgrundlage, sondern eine Werbung für die Variante, die gerade offen
ist – und sie lädt zu genau der Zahlenauswahl ein, gegen die das B3-Tor
geschrieben wurde.

#### Warum das Kartenbild nicht mitkommt (3.1b)

Das Kartenbild stand in den Akzeptanzkriterien vom 25.07. und ist der einzige
Punkt daraus, der nicht gebaut wurde. Der Grund ist nicht Aufwand:

1. **Es braucht eine neue Abhängigkeit** (html2canvas oder leaflet-image), um
   eine Leaflet-Karte zu rastern. Das Projekt hat fünf Laufzeit-Pakete.
2. **Es rastert fremde Kacheln in eine Datei, die weitergegeben wird.** Damit
   wird aus einer Kartenanzeige eine Weitergabe von Kartenmaterial – eine
   Lizenzfrage an OpenStreetMap-Kacheln, keine Programmierfrage. DoD Nr. 3
   verlangt für Drittdienste eine ausdrückliche Entscheidung, und die gehört
   nicht als Nebensatz in ein Export-Feature.
3. **Canvas-Tainting:** Kacheln von einem fremden Host machen das Canvas
   unlesbar, sofern der Server nicht CORS-Header liefert – der Weg ist also
   nicht einmal technisch geradlinig.

Was stattdessen bleibt: Die Karte selbst kann die Simulation längst zeigen
(„Simulation auf Karte prüfen", 13.6). Der Bildschirm-Hinweis im Fenster der
Vorlage sagt das und wird **nicht mitgedruckt** – ein Blatt in einer Sitzung
soll nicht erklären, was ihm fehlt.

Der bessere Ort für das visuelle Argument ist ohnehin der bereits bewertete
Kandidat 2 (**Vorher/Nachher-Slider über der Karte**): live und vergleichend
statt als eingefrorenes Bild. Kommt 3.1b zurück, dann über die
Drittdienst-Frage – nicht über „wäre schön".

### Release 4 – „Tresor" · High-End-Sicherheit *(umgesetzt, vorgezogen vor Release 3)*

Ziel: Echte Kundendaten dürfen bedenkenlos auf dem privaten Handy liegen.
Verschlüsselung **at rest** und **in transit** – ohne das Lokal-first-Prinzip zu brechen.

| # | Item | Status | Ergebnis |
|---|---|---|---|
| 4.1 | **Lokaler App-Tresor (Data at Rest)** | ✅ umgesetzt | `src/services/vault.js` + `src/services/crypto.js`: AES-256-GCM, DEK aus PIN über PBKDF2 abgeleitet, DEK **nur im Arbeitsspeicher**. Persistiert werden ausschließlich Salt, gewrappter DEK und Fehlversuchszähler. Sperrbildschirm (`src/ui/lockVault.js`) beim Start und nach Inaktivität (`DEFAULT_AUTOLOCK_MS`, 5 min). |
| 4.2 | **Biometrie-Unlock (Komfortstufe)** | ✅ umgesetzt | `src/services/biometric.js`: WebAuthn mit PRF-Erweiterung als **zusätzliche Tür** neben PIN und Wiederherstellungscode. Ohne Unterstützung meldet der Service das sauber, die App läuft ohne Biometrie normal weiter – die vorab notierte Grenze („PIN bleibt der garantierte Weg") ist eingehalten. |
| 4.3 | **Auto-Wipe** | ✅ umgesetzt | `DEFAULT_MAX_ATTEMPTS = 10`, konfigurierbar über `setup()`. Nach Erreichen löscht `wipe()` Tresor und lokalen Datensatz. |
| 4.4 | **Verschlüsselter Export mit QR-Schlüssel (Data in Transit)** | ✅ umgesetzt | „Sicherer Umzug": `.tfsafe`-Container (AES-256-GCM, Zufallsschlüssel) in `src/features/safeTransfer.js`; der Schlüssel reist getrennt per Bildschirm→Kamera. Am Zielgerät folgt das erzwungene Tresor-Setup. |

**Nachtrag 12.08.2026 – warum das hier so spät steht:** Release 4 war zum
Zeitpunkt dieser Zeile längst ausgeliefert und in der Wissensbasis vollständig
beschrieben (Kapitel 14.1–14.7), abgesichert durch `tests/vault.test.js`,
`tests/crypto.test.js`, `tests/safeTransfer.test.js` und
`tests/vaultOverview.test.js`. Nur **hier** stand weiterhin ein Plan im Futur.

Das ist derselbe Fehler wie 6.1, nur in die andere Richtung: Dort beschrieb die
Wissensbasis ein Verhalten falsch, hier beschreibt die Roadmap ein
ausgeliefertes Release als offen. Die Folge ist dieselbe – eine externe
Bewertung vom 12.08.2026 las den Tresor als „offen, strategisch wichtig" und
empfahl mittelfristig zu bauen, was seit Monaten im Produkt ist. Ein
Statusfeld, das nur bei Misserfolg falsch sein kann, wäre harmlos; eines, das
Fertiges als offen führt, verschiebt Prioritäten.

`tests/docsConsistency.test.js` deckt diesen Fall nicht ab: Es prüft
Beschriftungen und Konstanten gegen `docs/guide-ki-wissensbasis.md`, nicht
Statusfelder gegen den Code. Ein Tor dafür ist bewusst **nicht** gebaut – ein
Test, der „ist Feature X ausgeliefert?" beantworten müsste, ist eine Heuristik
über Dateinamen und wird selbst zur Fehlerquelle. Stattdessen die Regel: **Wer
ein Roadmap-Item baut, trägt es im selben PR hier ein** (siehe DoD Nr. 7).

**Abgrenzung zu 2.5:** Die QR-Tour-Übergabe (Release 2) überträgt wenige, bewusst
ausgewählte Daten direkt Bildschirm→Kamera und braucht keine Verschlüsselung.
Release 4 sichert den Fall ab, dass die **ganze Datenbank** als Datei den Rechner
verlässt oder dauerhaft auf dem Gerät liegt.

### Release 5 – „Vertrauen & Einstieg" *(25.07.2026 umgesetzt)*

Zwei Befunde aus dem Produkt-Review: Der Einstieg scheitert nicht an der
Spaltenzuordnung, sondern am Weg zur Datei – und die App war technisch eine
Website mit Offline-Cache, nicht eine App, die im System verankert ist.

| # | Item | Status | Ergebnis |
|---|---|---|---|
| 5.1 | **Automatische Copilot-Anbindung entfernen** | ✅ umgesetzt | Grundsatzentscheidung: TourFuchs ist kein KI-Werkzeug. Der Entra-/Graph-Weg (Anmeldung mit Arbeitskonto, Copilot-Antwort im Dialog) verlangte IT-Freigaben, band an einen Anbieter und stand quer zum Lokal-first-Versprechen. Es bleibt: Prompt lokal bauen, kopieren, Assistent öffnen, Nutzer sendet selbst. MSAL ist aus dem Projekt entfernt. |
| 5.2 | **Zielassistent wählbar (Profi)** | ✅ umgesetzt | Microsoft 365 Copilot (Standard), Google Gemini, ChatGPT oder eigene https-Adresse. Die Wahl passt auch die Quellenzeile im Prompt an. Basis bleibt ein Knopf ohne Entscheidung. |
| 5.3 | **Kundenliste einfügen statt exportieren** | ✅ umgesetzt | Strg+C in Excel, Strg+V in TourFuchs. Erkennt Tab/Semikolon/Komma anhand der gleichmäßigsten Tabelle. Ab der Spaltenzuordnung identisch zum Datei-Import. |
| 5.4 | **PWA ins Betriebssystem einhängen** | ✅ umgesetzt | Datei-Handler (.xlsx/.xls/.csv), Teilen-Ziel (Android, lokal im Service Worker), Icon-Kurzbefehle, Screenshot fürs Install-UI. Das Installations-Angebot kommt erst, wenn eigene Daten geladen und eine Tour geplant ist. |
| 5.6 | **Feierabend-Rückblick** | ✅ umgesetzt | Der Tag in Zahlen: Besuche, geschätzte Strecke, abgearbeitete Überfällige, offen Gebliebenes – als Text kopierbar. Schließt die eigentliche Lücke hinter 2.4: Erfasst wurde schon, zurückgemeldet nichts. |
| 5.5 | **Änderungsbericht beim Reimport** | ✅ umgesetzt | „Was ändert sich?" mit neu/entfallen/Bezirkswechsel, Summen und Wirkung je Bezirk – und übernimmt zugleich die Bestätigung. Macht aus der monatlichen Pflichtübung den Grund, die App regelmäßig zu öffnen. |

### Release 6 – „Defekte und Messgeräte" *(01.08.2026 umgesetzt, App 3.1.0)*

Anlass war eine externe Produktanalyse. Vier ihrer sechs Vorschläge waren
richtig, einer war **bereits gebaut** (nur in der Wissensbasis falsch
beschrieben), einer unterschätzte den Ist-Stand. Dieses Release enthält
ausdrücklich **kein neues Produktversprechen** – es beseitigt Defekte und baut
ein Messgerät.

| # | Item | Status | Ergebnis |
|---|---|---|---|
| 6.1 | **Wissensbasis 5.5 richtiggestellt** | ✅ umgesetzt | Kapitel 5.5 beschrieb „Erste Schritte" Punkt 1 und 4 falsch. Der Guide erteilte damit nachweislich falsche Auskunft an echte Nutzer. Kein Produkteingriff. |
| 6.2 | **Eine Quelle für die Fairness-Schwelle** | ✅ umgesetzt | 1,5 stand doppelt hartcodiert (`cockpit.js`, `importInsight.js`) und steht jetzt in `CONFIG.territory.balancedMaxRatio`. |
| 6.3 | **Fairness-Schwelle als Setzung ausgewiesen** | ✅ umgesetzt | Die Status-Karte nennt Grenze und Herkunft: „Ausgewogen bis Faktor 1,5 – gesetzte Konvention, keine Messung." Wer weiß, dass jemand die Grenze gewählt hat, kann ihr widersprechen. |
| 6.4 | **„Wieder vor" (Redo)** | ✅ umgesetzt | Simulation und Gebiets-Editor hatten 30 Schritte zurück und keinen nach vorn. Eine neue Zuweisung verwirft die zurückgenommene Zukunft. |
| 6.5 | **Verzichtszeile im Service-Tagesvorschlag** | ✅ umgesetzt | Der Vorschlag nennt in einem Satz, was er maximiert und was er dafür liegen lässt. Kein neuer Rechenweg – die Gründe liefert der Planer ohnehin; neu ist, dass der Preis **neben** dem Gewinn steht statt eingeklappt darunter. |
| 6.6 | **Tageslog** | ✅ umgesetzt | Sechs Zahlen je Tag, **keine Kunden-IDs**, `localStorage`. Aufgezeichnet wird bei jeder Tour-/Besuchsänderung, nicht beim Öffnen des Rückblicks – sonst entstünde genau die Stichprobe, die hinterher jede Behauptung bestätigt. |
| 6.7 | **Doku-Tor im Test** | ✅ umgesetzt | `tests/docsConsistency.test.js`: sichtbare Beschriftungen und normative Konstanten müssen wörtlich in der Wissensbasis stehen. Schließt die Lücke, durch die 6.1 überhaupt entstehen konnte – `demo-check` und `touch-check` lesen keinen Text. |

#### Das Tor für „drei Tage zur Wahl" (B3)

Der einzige Vorschlag der Analyse mit echtem Produktrisiko: morgens drei
Tagesvarianten mit unterschiedlicher Zielfunktion statt einer Tour, die man
baut. Er ist **nicht gebaut und nicht im Backlog** – er steht an einem Tor.

Der Grund für die Härte: B3 will genau die Funktion wiederbeleben, die als
**Item 2.1 am 10.07.2026 nach Nutzerfeedback gestrichen** wurde. Ein
zurückkehrender Vorschlag braucht ein Kriterium, an dem er ein zweites Mal
scheitern kann – sonst ist „zurückgestellt" nur ein längeres Wort für
„unsterblich".

Beide Abbruchbedingungen sind **vor** der Auswertung festgeschrieben (Details
und Kennzahlen in Kapitel 26.3 der Wissensbasis):

1. **Zu wenig Signal:** weniger als 15 Tage mit Besuch bis zum **15.09.2026**
   → tot, ohne Auswertung.
2. **Die Tage gleichen einander:** kaum Streuung in `ueberfaelligAnteil` und
   `kmProStopp` → tot.

Ehrliche Einordnung: Bei einem Nutzer ist n = 1, daraus folgt nichts
Signifikantes. Der Wert des Kriteriums liegt in der **Selbstbindung gegen
nachträgliches Rechthaben** – ohne vorher notierte Zahl wird jede Datenlage
hinterher so gelesen, dass sie die Lieblingsvariante stützt.

Stirbt B3 am Tor, gehört es auf die Liste „Was wir weggelassen haben" (6.9).

#### Basislinie `state.ui.depth` (Stand 01.08.2026)

Basis/Profi ist die teuerste Verzweigung im Produkt: Sie multipliziert UI-Pfade
und nimmt vorweg, wer der Nutzer ist. Sie wird **nicht entfernt** – das wäre ein
Quartalsprojekt mit Regressionsrisiko, nach dem niemand gefragt hat. Sie wird
eingefroren:

> **Regel ab sofort:** Kein neues Feature führt eine weitere `depth`-Verzweigung
> ein. Wer eine braucht, begründet sie im PR.

Damit die Regel überprüfbar ist statt geglaubt, hier der Ausgangswert:

| Maß | Wert am 01.08.2026 |
|---|---|
| Verzweigungen (Vergleich gegen `'profi'`/`'basis'`) | **24** |
| Lesezugriffe auf `state.ui.depth` | **27** |
| Dateien mit `depth`-Bezug | **12** |

Reproduzierbar mit:
`grep -rn "depth[^a-zA-Z]*===\s*'\(profi\|basis\)'\|depth[^a-zA-Z]*!==\s*'\(profi\|basis\)'" src/ --include=*.js | wc -l`

Nächste Zählung: 01.02.2027. Eine Regel, die nichts verbietet, das man später
nachweisen könnte, hat Fitness null.

**Zwischenmessung 12.08.2026** (nach den Releases 7–10, also nach vier
ausgelieferten Releases): Verzweigungen **24**, Lesezugriffe **27** – beide
Werte **unverändert**. Die Einfrier-Regel hält nachweislich, und zwar durch den
Zeitraum, in dem am meisten an der Oberfläche geändert wurde. Das ist der
eigentliche Test; eine Sperrklinke, die nur in ruhigen Wochen gehalten hat,
hätte nichts gezeigt.

Ein Vorbehalt zur dritten Zeile: Die Dateizahl hängt am Zählverfahren. Der
Verzweigungs-Grep trifft 10 Dateien, ein Grep auf `ui.depth` ebenfalls 10
(nicht deckungsgleich), ein Grep auf das bloße Wort `depth` 15 – darunter
`mapLevel.js`, wo es um Kartentiefe geht und nicht um Basis/Profi. Die „12" von
oben ist ohne Kommandozeile notiert und deshalb nicht reproduzierbar. Für die
Zählung am 01.02.2027 gelten die **beiden oberen Zahlen** als Maß; die
Dateizeile ist nachrichtlich.

### Sprint 2 – festgelegt, noch nicht gebaut

| # | Item | Warum genau so |
|---|---|---|
| 6.8 | **Benannte Simulations-Szenarien** (= 3.3) | `snapshotSimulation()` erzeugt das Szenario-Tripel bereits 30-mal pro Sitzung für den Undo-Stack und wirft es weg. Ein benanntes Szenario ist ein Snapshot mit Namen. Der Objektstore ist schemalos – keine Migration. |
| 6.9 | **„Was wir weggelassen haben"** | Statische Seite aus vorhandenem Material. **Bedingung: Item 2.1 muss darin stehen.** Eine Liste, die nur die Tode zeigt, auf die man stolz ist, ist Marketing. Stirbt B3 am Tor, kommt B3 dazu. |
| 6.10 | **Channel-Legacy-Pfad entfernen** | Eine Hilfshypothese: existiert nur, um Altbestände zu halten, verteuert jede Änderung an `assignableDims`/`targetValues`/`attrLabel`. **Nicht nebenbei:** einziger Punkt der Liste, der Nutzerdaten irreversibel anfasst – erst Export-Empfehlung, dann Migration, dann Eintrag in Kapitel 26. Die App-eigene Regel gilt auch für uns. |

**Sprint 3, bedingt:** Briefing-Zuschnitte **und** Rückkanal – als Paket oder gar
nicht. Zwei Prompt-Varianten ohne Rückmeldesignal sind kein Experiment, sondern
ein Einstellungsschalter; erst beides zusammen ist eine vollständige Schleife.
Bedingt, weil keine zweite Lernschleife startet, bevor 6.6 gezeigt hat, dass aus
lokalen Signalen etwas Lesbares wird.

### Release 7 – „Zwei Gesichter" *(01.08.2026 umgesetzt, App 3.2.0)*

Anlass: erste echte Tablet-Nutzung (Galaxy Tab S6 Lite). Zwei Befunde, einer
davon ein Defekt, den keine Überlegung am Schreibtisch gefunden hätte.

| # | Item | Status | Ergebnis |
|---|---|---|---|
| 7.1 | **Eine Definition von „mobil"** | ✅ umgesetzt | `src/core/viewport.js` als einzige Quelle. Vorher vier unabhängige Schwellen (560, 768/769, 900/901, eigene Blatt-Abfrage). Das CSS ist wortgleich an dieselbe Zeichenkette gebunden. |
| 7.2 | **Hochkant = Touransicht, quer = Schreibtisch** | ✅ umgesetzt | Nimmt Item aus #193 vom 31.07. zurück (siehe unten). Im Browser nachgemessen: Tablet hochkant (800×1333) und Handy (390×844) antworten in allen geprüften Punkten gleich. |
| 7.3 | **Kein eigener Tablet-Einstieg** | ✅ umgesetzt | Hochkant startete im Reiter „Tour" statt „Karte" – ein drittes Verhalten. Weg. |
| 7.4 | **Drehen setzt die Darstellung zurück, nicht die Arbeit** | ✅ umgesetzt | Modus, Reiter, Tiefe, Geometrie werden neu gesetzt; Datensatz, Tour und Bezirk bleiben. |
| 7.5 | **Geerbte Orientierungssperre lösen** | ✅ umgesetzt | `screen.orientation.unlock()` beim Start befreit vor dem 26.07. installierte PWAs. |
| 7.6 | **Tor gegen eine fünfte Definition** | ✅ umgesetzt | `tests/viewport.test.js` prüft zehn Quelldateien plus die CSS/JS-Deckung. |

#### Zurückgenommen: „hochkant voller Funktionsumfang" (#193, 31.07.2026)

Die Entscheidung von gestern lautete: *„Gesperrt wird bewusst nichts …
Drehen ändert nur die Geometrie."* Sie wird hiermit umgedreht, und der Grund
gehört ins Protokoll: **Sie wurde am Schreibtisch getroffen, und am Gerät hielt
sie nicht.** Die Begründung damals war „Platz ist da". Das Kriterium ist aber
nicht Platz, sondern Wiedererkennbarkeit – ein Gerät, das hochkant etwas
anderes zeigt als ein Handy und etwas anderes als quer, verlangt drei Layouts
im Kopf statt zwei.

Behalten wird aus #193 die Sorge, die richtig war: dass eine Drehung keine
Arbeit verwerfen darf. Deshalb 7.4 statt des vom Nutzer zunächst gewünschten
harten Sitzungs-Neustarts – eine Drehung passiert oft unabsichtlich, und die
halbfertige Tour liegt nur im Speicher.

Ergänzung zur Arbeitsweise: Diese Klasse Fehler findet **kein** Unit-Test und
keine Überlegung, sondern nur ein echtes Gerät. Der Zwitter war seit Tagen im
Produkt und niemandem aufgefallen.

### Release 8 – „Sprint 2" *(01.08.2026 umgesetzt, App 3.3.0)*

| # | Item | Status | Ergebnis |
|---|---|---|---|
| 6.8 | **Benannte Simulations-Szenarien** (= 3.3) | ✅ umgesetzt | Speichern, Laden, Vergleichen. Nur Zuordnungen, keine Kundendaten. Laden ist über den Rückgängig-Stapel umkehrbar; ein Szenario aus einem anderen Datenbestand fragt vorher nach und nennt die Zahlen. |
| 6.9 | **„Was wir weggelassen haben"** | ✅ umgesetzt | Sieben Einträge mit Datum und Begründung im Info-Dialog. **Bedingung erfüllt:** Item 2.1 steht drin, und die Rücknahme der Tablet-Ansicht vom 01.08. auch. Ein Test erzwingt beides. |
| 7.7 | **`npm run face-check`** | ✅ umgesetzt | Dritte Prüfstrecke: sechs Gerätemaße, erwartetes Gesicht je Format, und der Punkt-für-Punkt-Vergleich jedes Touransicht-Formats gegen das Smartphone. |
| 6.10 | Channel-Legacy entfernen | ⏳ offen | Bewusst **nicht** in diesem Release – siehe unten. |

#### Warum 6.10 nicht mitgeht

Es ist der einzige Punkt der Liste, der **Nutzerdaten irreversibel anfasst**.
Die App verlangt vor jeder Datensatz-Ersetzung eine Export-Empfehlung und eine
Bestätigung; dieselbe Regel gilt für uns. 6.10 gehört in einen eigenen PR mit
eigener Prüfung, nicht als vierter Punkt in einen risikofreien Sprint.

Reihenfolge dort: Export-Empfehlung anzeigen → Migration „Channel wird zu
Gruppe" → Eintrag in Kapitel 26 → erst dann den Legacy-Pfad aus
`assignableDims`, `targetValues` und `attrLabel` entfernen.

### Release 9 – „Aufmerksamkeit" *(01.08.2026 umgesetzt)*

Anlass war ein eingereichtes Gestaltungsmanifest („Die App als Spiegel der
Aufmerksamkeit"). Die Prüfung ergab: Es beschreibt **kein neues Produkt**,
sondern die Regel, nach der TourFuchs an seinen besten Stellen längst gebaut
ist – Zoom-Automatik der Karte, eingeklapptes Tour-Akkordeon, Zurücktreten der
Angebote. Ohne Namen ließ sie sich nicht prüfen und beim nächsten Feature nicht
verteidigen.

Dieses Release gibt ihr einen Namen, ein Messgerät und drei Grenzen. Es enthält
**kein neues Produktversprechen**.

| # | Item | Status | Ergebnis |
|---|---|---|---|
| 9.1 | **Gestaltprinzip schriftlich** | ✅ umgesetzt | `docs/gestaltprinzip-aufmerksamkeit.md`: vier Prüffragen für die Definition of Done, drei ausdrückliche Grenzen. Prüfregel, kein Umbauauftrag. |
| 9.2 | **`npm run attention-check`** | ✅ umgesetzt | Vierte Prüfstrecke. Zählt sichtbare Bedienelemente in der gebauten App: Erstbild, Rahmen, je Reiter nach Tiefe und Modus. Prüft zwei Regeln: Die Übersicht zeigt den Prozess, nicht die Inhalte – und Verdrängung lässt den Rückweg stehen. Budgets = Ist-Stand plus Luft, als Sperrklinke. |
| 9.3 | **Eine Frage zur Zeit im Erstbild** | ✅ umgesetzt | Erster Befund des neuen Werkzeugs (siehe unten). Erstbild Schreibtisch 39 → 33 Bedienelemente, Panel 24 → 18. |
| 9.4 | **Lasso-Knopf auf dem Tablet erreichbar** | ✅ umgesetzt | Offener `touch-check`-Befund, älter als dieses Release: Hochkant lag der Lasso-Knopf hinter der Basis/Profi-Pille. Dieselbe Ursache wie 9.3 – zwei richtige Entscheidungen, ein Platz (siehe unten). |
| 9.7 | **Modal-Inventur, ein Defekt behoben** | ✅ umgesetzt | Alle 22 Dialoge gegen Prüffrage 2.2 befragt. **18 sind zu Recht modal** – die Inventur hat kein Aufräumprojekt gefunden, sondern einen Defekt: Der Gebiets-Editor verdeckte mit seinem Vorhang genau die Karte, auf der die Antwort steht („welchem Bezirk gebe ich diese Kunden?"). Er ist jetzt angedockt statt daraufgelegt; die Karte bleibt schiebbar, und ein Klick auf das nächste Gebiet füllt ihn neu. Drei Verdächtige wurden ausdrücklich entlastet – darunter der vorab benannte Kandidat Nummer eins (Kunden-Briefing). |
| 9.6 | **CI auf gepflegte Laufzeiten** | ✅ umgesetzt | Actions auf ihre aktuellen Hauptversionen (checkout v7, setup-node v7, cache v6) und Build/Test auf **Node 24**. Node 20 war aus dem Support gelaufen; eine Laufzeit ohne Sicherheits-Updates ist kein Fundament für eine App, die Kundendaten im Browser verschlüsselt. Vor dem Wechsel gegen eine echte 24er-Installation geprüft – dabei fiel ein Wettlauf im neuen Messgerät auf (siehe 9.5). |
| 9.5 | **`attention-check` in die CI** | ✅ umgesetzt | Eigener Job, rund eine Minute. Die einzige der vier Strecken, die dorthin gehört: Ihr Gegner ist **schleichendes** Anwachsen, und dagegen hilft kein Tor, das erst vor dem Release gezogen wird – bis dahin weiß niemand mehr, welcher der zwanzig PRs die Ansicht gefüllt hat. Zeitbasierte Strecken (`demo-check`, `touch-check`) bleiben draußen; ein flackerndes Tor ist schlimmer als keines. Ergänzt um eine Vollständigkeitsprüfung: Wer nichts misst, überschreitet auch kein Budget – ein solcher Lauf ist jetzt rot statt grün. **Sie hat sich sofort bezahlt gemacht:** Beim Node-24-Vorlauf (9.6) meldete sie 11 von 12 Ansichten. Ursache war kein Befund über die Oberfläche, sondern ein Wettlauf mit ihr – ein Wechsel von Tiefe oder Modus baut die Reiterleiste neu auf, und der Klick traf ein Element, das gerade ersetzt wurde. Die Strecke wartet jetzt auf das **Ergebnis** („dieses Panel ist aktiv") statt auf den Klick. Ohne den Riegel wäre der Lauf grün gewesen, mit einer stillschweigend übersprungenen Ansicht. |

#### Der Befund, und warum ihn niemand sehen konnte

Am Schreibtisch standen im allerersten Bild **drei Angebote gleichzeitig**:
Willkommenskarte, Beispieldaten-Streifen und ausgeklappte Erste-Schritte-
Checkliste. Alle drei beantworteten dieselbe Frage – *was ist das hier, und wie
komme ich an meine Daten?* – und zwei davon mit **demselben Knopf** („📂 Eigene
Daten laden").

Keines war ein Fehler. Jedes ist einzeln entstanden, jedes mit gutem Grund; die
Checkliste klappte sich beim automatischen Erscheinen der Beispielkunden sogar
ausdrücklich auf, weil es die Willkommenskarte damals noch nicht gab. **Erst
zusammen wurden sie zum Stapel** – und genau diese Sorte Überfrachtung findet
kein Review, weil jeder Teil für sich begründet ist. Sie wird nur sichtbar, wenn
jemand das fertige Bild zählt.

Aus dem Stapel wurde eine Reihenfolge: erst die Karte, die den Zustand erklärt;
nach dem Quittieren die Checkliste, die den nächsten Schritt anbietet. Der
Hinweis „das sind Demo-Kunden" bleibt stehen – er ist die Ehrlichkeit des
Streifens, nur sein doppeltes Angebot tritt zurück.

#### Was das Werkzeug zuerst widerlegt hat

Die Analyse, die zu diesem Release führte, nannte den Tour-Reiter überladen:
105 Knöpfe. Gezählt war Markup in `index.html`, nicht Oberfläche. Die Messung
sagt **5 bis 9**. Der Befund war falsch, die Frage richtig – und bis dahin
unbeantwortbar. Dieselbe Lehre wie bei `face-check`: Quelltext lesen ist keine
Messung.

#### Derselbe Fehler, zweimal: der Lasso-Knopf (9.4)

`touch-check` meldete seit längerem, dass der Lasso-Knopf auf dem hochkanten
Tablet verdeckt und nicht antippbar ist – ein offener Befund, der nicht zu
diesem Release gehörte. Beim Nachsehen war es **dieselbe Ursache wie 9.3**.

Zwei Entscheidungen hatten unabhängig voneinander denselben Platz beansprucht:

- Der schwebende **Kopf-Streifen** (Basis/Profi, Reiter) wurde nach oben
  gezogen, damit Tiefe und Bereich immer sichtbar bleiben.
- Die **Karten-Knopfzeile** wurde hochkant nach oben gezogen, weil unten das
  Blatt steht und sie dort verschwände.

„Oben ist frei" stimmte für beide – aber nur einzeln. Die Knopfzeile rechnete
gegen `--topbar-height` und landete damit genau hinter der Basis/Profi-Pille.

Behoben, indem die Unterkante des Streifens **gemessen** statt geschätzt wird
(`syncTopnavMetrics()` in `src/ui/sidebar.js`, veröffentlicht als
`--mobile-topnav-bottom`; ein `ResizeObserver` hält den Wert nach). Eine feste
Zahl im CSS wäre nur so lange richtig gewesen, bis jemand eine Zeile ergänzt –
der Streifen ist mal ein-, mal zweizeilig und im Onboarding gar nicht da. Das
Blatt rechnet in `tourSheetHeight()` längst genauso.

**Die Lehre, die über beide Befunde hinausgeht:** Diese Sorte Fehler entsteht
nicht durch eine falsche Entscheidung, sondern durch zwei richtige, die
niemand nebeneinandergelegt hat. Ein Review findet sie nicht, weil jeder Teil
für sich begründet ist. Nur eine Messung am fertigen Bild findet sie.

#### Drei Grenzen (nicht verhandelbar)

Das Manifest schlägt eine KI vor, die „Architekt der Aufmerksamkeit" wird und
die Oberfläche an den Denkprozess anpasst. Das wird **nicht gebaut**:

1. **Keine Oberfläche, die sich selbst umbaut.** Moment A („07:30, in 30
   Sekunden zum Tagesplan") funktioniert, weil der Knopf jeden Morgen an
   derselben Stelle liegt. Die Zoom-Automatik ist kein Gegenbeispiel, sondern
   der Beleg: Sie ist deterministisch, nutzerausgelöst und umkehrbar.
2. **Kein KI-Aufmerksamkeitsmodell.** Es bräuchte Telemetrie oder einen
   API-Aufruf. Release 5.1 hat die Copilot-Anbindung ausdrücklich ausgebaut.
   Lokal-first ist die härteste Leitplanke, und hier gäbe es keine zulässige
   Datengrundlage. Dazu liegt ein Nutzervotum vor: Item 2.1, gestrichen am
   10.07.2026 – „Automatik unterstützt nur dort, wo sie nichts vorwegnimmt."
   Für die Oberfläche gilt derselbe Satz.
3. **Zoom ist nicht die einzige Denkbewegung.** Moment B ist Vergleich –
   Nebeneinander, nicht Tiefe. Wer alles auf Zoom reduziert, hat für die
   Gebietssimulation keine Geste mehr.

Sollte Punkt 1 oder 2 je wiederkommen, gilt dasselbe wie beim B3-Tor: Ein
zurückkehrender Vorschlag braucht ein Kriterium, an dem er ein zweites Mal
scheitern kann.

### Release 10 – „Ein Bereich" *(11.08.2026 umgesetzt)*

Anlass war eine Beobachtung aus der Hand: „Der Unterschied zwischen Karte und
Tour ist gar nicht so groß – kann man sich den Knopf sparen?" Die Prüfung im
Code gab der Beobachtung recht, und zwar schärfer als vermutet.

| # | Item | Status | Ergebnis |
|---|---|---|---|
| 10.1 | **Der Reiter „Karte \| Tour" ist gestrichen** | ✅ umgesetzt | Er war kein Bereichswechsel: `activateTab('karte')` setzte `sidebarOpen = false`, jeder andere Reiter setzte es auf `true`. „Karte" hieß „Blatt zu", „Tour" hieß „Blatt auf" – dasselbe, was der Griff und „☰" tun. Drei Bedienelemente für einen booleschen Zustand, zum Preis einer Pillenzeile am knappsten Rand des Geräts. Erstbild am Handy **16 → 14** Bedienelemente (`attention-check`), der Kopf-Streifen ist einzeilig. |
| 10.2 | **„In der Nähe" wird eine Klappkarte über dem Prozess** | ✅ umgesetzt | Der einzige eigene Inhalt des alten Reiters, jetzt im Gewand der Tourschritte: zugeklappt „12 · ab 1,1 km", aufgeklappt Bezugspunkt, fünf Kunden, „Alle N zeigen". Bewusst **keine** `.tour-acc` – sie steht über dem Prozess (1 · 2 · 3), nicht darin, und liegt außerhalb von `#tour-planner`, weil man „wer ist hier?" vor der Bezirkswahl beantwortet. Kostet netto null Bedienelemente: Sie ersetzt den Knopf „Was ist in meiner Nähe?". |
| 10.3 | **Ein Tipp auf den Griff klappt ein und aus** | ✅ umgesetzt | Fund beim Nachmessen am gebauten Bild, nicht im Entwurf: Am Handy tat ein Tipp auf den Griff **nichts** (`if (!moved) { if (!isSheetUi()) toggleSheet(); }`) – obwohl der Griff selbst „Ziehen: Größe · Tippen: ein-/ausklappen" verspricht. Solange der Reiter danebenstand, fiel das nicht auf; er war der beschriftete Tipp-Weg. Ohne ihn wäre der auffälligste Griff der Oberfläche stumm gewesen. |
| 10.4 | **Prüfstrecke ohne Reiterleiste** | ✅ umgesetzt | `attention-check` maß Reiter. Ohne Leiste hätte sie **null** Ansichten gemessen und wäre grün gewesen – genau der Fall, gegen den Item 9.5 die Vollständigkeitsprüfung eingezogen hat. Sie misst jetzt ersatzweise das aktive Panel; erwartete Messungen am Handy 4 → 2, Budget „karte" entfällt. |
| 10.5 | **Kein Tipp läuft ins Leere: die Willkommenskarte tritt zurück** | ✅ umgesetzt | Nutzerbefund („ich tippe auf einen Stapel und nichts passiert"), beim Nachmessen bestätigt und **älter als dieses Release**: Der Rahmen um die Hinweiskarte lässt Klicks durch (`pointer-events: none`), die Karte selbst nicht – und sie steht mittig über Deutschland, wo die Kundenstapel liegen. Gemessen: Schreibtisch **8 von 11**, Tablet hochkant 6 von 8, Handy **3 von 3** Stapeln nicht antippbar. Jetzt quittiert ein Tipp auf die Karte den Hinweis; der zweite Tipp zoomt. Bewusst **kein** Durchreichen des Tipps an den Stapel darunter – ein synthetischer Zweitklick, den es nur in einem Zustand gibt, wäre der nächste unsichtbare Griff. |
| 10.6 | **Basis/Profi bleibt – die offene Frage ist beantwortet** | ✅ entschieden | Seit dem 02.08.2026 stand im Info-Dialog: „Die Frage dahinter bleibt offen: ob es ihn auf dem Handy überhaupt braucht." Mit dem Wegfall des Reiters ist sie entscheidbar geworden, weil sich die Lage geändert hat: Der Schalter ist jetzt die **einzige** Zeile im Kopf-Streifen. Er bleibt. Die Begründung gegen ihn war immer der Platz, nie die Sache – und der Platz ist da. Ein Schalter, der wenig freischaltet, aber jederzeit zeigt, in welcher Tiefe man arbeitet, ist kein Ballast. Damit ist der Eintrag im Info-Dialog von einer offenen Frage zu einem Nachtrag geworden. |

| 10.7 | **Die Vorführung klopft nicht mehr auf einen Stapel ein, der sich nicht öffnet** | ✅ umgesetzt | Nutzerbefund vom eigenen Telefon: In der ersten Live-Demo tippt der Cursor viermal auf denselben Kundenstapel, und es tut sich nichts. Nicht reproduzierbar im Emulator – wohl aber zwei Ursachen im Code, die genau dieses Bild erzeugen. **Erstens:** Wie viele Ebenen nötig sind, hing an einer festen Zahl (vier), während es tatsächlich am Bestand und am Gerät hängt – mobil bündelt die Karte mit bis zu 124 px statt 104. Ging die Wette nicht auf, sprach der nächste Satz von Kundenkacheln, die nicht dastanden. Jetzt entscheidet die **Wirkung**: Nach jedem Tipp wird nachgesehen, ob sich die Karte bewegt hat; zwei folgenlose Tipps beenden den Versuch, und die Zusage wird per Flug auf einen einzelnen Kunden trotzdem eingelöst. **Zweitens:** Zwischen Anvisieren und Klick liegen rund 800 ms Cursor-Weg. Leaflet baut Kundenstapel bei jeder Bewegung neu auf – der gemerkte Knoten hängt dann nicht mehr im Dokument, und der Klick geht lautlos ins Leere. Auf einem echten Telefon ist das wahrscheinlicher als im Emulator. `clickEl` schlägt deshalb unmittelbar vor dem Klick noch einmal nach. |
| 10.8 | **Der Tourprozess zählt in jeder Tiefe drei Stufen** | ✅ umgesetzt | In Profi stand „1. Startpunkt · **3.** Vorschläge · **4.** Meine Tour": Die 2 gehörte dem optionalen Ziel, das im Startpunkt-Block sitzt und zugeklappt nicht zu sehen ist. In der Übersicht las sich das als Lücke. Eine Nummer, die auf etwas Verborgenes zeigt, erklärt nichts – sie lässt suchen. Das Ziel ist eine Beigabe zu Schritt 1, keine eigene Stufe, und trägt deshalb keine Nummer mehr. |
| 10.9 | **Vorwarnung statt roter Wand beim Systemprompt** | ✅ umgesetzt | Der Custom-GPT-Systemprompt darf 7.900 Zeichen haben und lag nach der Doku-Runde bei 7.861 – 39 Zeichen Luft. Eine harte Grenze meldet sich erst, wenn es zu spät ist. `docs:check` warnt jetzt ab 7.700 sichtbar vor (Hinweis, kein Befund: knapp ist nicht falsch), und der Prompt wurde auf 7.845 gekürzt. |

**Was das Muster daran ist:** Der Reiter war nicht falsch entworfen. Er war
einmal richtig – und blieb stehen, als der Griff das Gleiche lernte. Diese Sorte
Doppelung findet kein Review des einzelnen Features, sondern nur die Frage
„was tut das hier eigentlich noch?" am fertigen Bild. Dieselbe Lehre wie bei den
zwei richtigen Entscheidungen auf demselben Platz (9.4).

**Und eine Lücke in den Prüfstrecken (10.5):** `demo-check` prüft, ob der
Geister-Cursor sein Ziel **trifft** – Abweichung in Pixeln, im Bild, ganz
sichtbar. Ob der Treffer etwas **bewirkt**, prüft es nicht. Genau dort lag der
Befund zur Willkommenskarte: 28 von 28 Durchläufen „alle sauber", während ein
Tipp auf einen verdeckten Kundenstapel folgenlos blieb. Ein Messgerät, das nur
die Geste misst und nicht die Antwort, ist gegen diese Fehlerklasse blind.

### Nächste Kandidaten (bewertet, noch nicht terminiert)

1. **Weißfleck-Finder:** Gebiete mit Kunden, aber ohne Besuch seit N Monaten.
   Nutzt `visits.js` + `territory.js`, beides vorhanden.
2. **Vorher/Nachher-Slider über der Karte** – seit 12.08.2026 der Erbe von
   3.1b: Die Entscheidungsvorlage liefert die Zahlen, das visuelle Argument
   fehlt ihr. Ein Slider löst es **live auf der Karte** statt als gerastertes
   Bild in einer Datei und wirft damit keine Kachel-Lizenzfrage auf.
3. **Haltbarkeit der lokalen Daten:** `navigator.storage.persist()` anfordern,
   Status ehrlich anzeigen, an Sicherung erinnern. Lokal-first ist nur dann ein
   Vorteil und kein Risiko, wenn dieser Punkt sichtbar beantwortet ist.
4. **Korridor-Modus als eigene Frage:** „Ich muss nach Hamburg – wen nehme ich
   mit?" Die Technik liegt bereits im OSRM-Korridor.
5. **Barrierefreiheit: gebaut, aber nicht gemessen und nicht zugesagt.**
   Gezählt am 12.08.2026: 78 `aria-label`, 42 `role=`, 11 `aria-live`,
   13 `prefers-reduced-motion`-Regeln, `<html lang="de">`. Es ist also mehr da,
   als eine Bewertung von außen sehen kann – aber **kein** Dokument und **kein**
   Test nennt Barrierefreiheit, Screenreader oder Kontrast, und
   `prefers-contrast` kommt null-mal vor, `focus-visible` viermal.
   Das ist genau das Muster, das dieses Projekt schon zweimal benannt hat:
   vorhandene Qualität ohne Messgerät ist bei der nächsten Änderung weg, ohne
   dass es jemand merkt (9.2 für die Aufmerksamkeit, 6.7 für die Doku).
   Ehrliche Einordnung: Attribute zählen ist **keine** Prüfung – ob ein
   Screenreader die Tour vorlesen kann, weiß niemand, weil es nie jemand
   versucht hat. Erster Schritt wäre deshalb ein Durchlauf mit einem echten
   Screenreader an Moment A, nicht eine fünfte Prüfstrecke. Dieselbe Lehre wie
   bei `face-check` und beim Tablet-Zwitter: Diese Fehlerklasse findet nur das
   echte Gerät.

### Backlog & Vision (bewusst NICHT jetzt)

- **POIs auf der Karte** (Ladestationen, eigene Niederlassungen): nur als Opt-in –
  externe POI-Abfragen sind eine neue Drittdienst-Verbindung und unterliegen der
  Offenlegungspflicht (DoD Nr. 3). Eigene Niederlassungen alternativ als lokale
  Importdatei (kein externer Call) – das zuerst.
- **KI-Assistent in der App:** Die Grundsatzentscheidung ist mit 5.1 gefallen und
  gilt in die andere Richtung: TourFuchs bindet **keine** KI an – weder per API
  noch per Anmeldung. Es bereitet den Prompt vor, mehr nicht. Ein lokales Modell
  bleibt theoretisch denkbar, steht aber auf keiner Liste.
- **Connector-Anleitungen** (Export-Leitfäden für CRM-Systeme): reine Dokumentation,
  geringer Aufwand – wird als Lückenfüller zwischen Releases mitgenommen.
- Eigener OSRM-/Nominatim-Endpoint bzw. konfigurierbarer Routing-Server (F2) – erst
  relevant, wenn > ~5 regelmäßige Nutzer; bis dahin: Fallback + Opt-in reichen.
- Refactoring `map.js`/`sidebar.js`/`tourPanel.js` in Untermodule (F7) – opportunistisch
  im Zuge von Release 2/3, kein eigenes Projekt.
- Mehrsprachigkeit, Themes, weitere Kartenanbieter: kein Beitrag zu Moment A/B.

---

## 3. Arbeitsweise (Definition of Done)

Ab Release 1 gilt für jeden PR:
1. `npm run build` **und** `npm test` grün (CI-Check, kein Merge ohne).
2. Neue oder geänderte **reine Logik** hat Unit-Tests; UI-Verhalten ist im PR-Text mit
   konkreten Prüfschritten dokumentiert (wie bisher – das Niveau der PR-Beschreibungen
   #44–#50 ist gut und bleibt Standard).
3. Jede neue externe Netzwerkverbindung wird im selben PR in `datenschutz.html`
   und README offengelegt – sonst kein Merge.
4. Mobile-Check (schmaler Viewport) gehört zur Prüfung jedes UI-PRs.
5. **Sichtbare Beschriftungen und normative Konstanten stehen in der
   Wissensbasis** – abgesichert durch `tests/docsConsistency.test.js`. Wer ein
   Label oder eine Schwelle ändert, zieht `docs/guide-ki-wissensbasis.md` im
   selben PR nach. Anlass: Kapitel 5.5 war über mehrere Releases still falsch,
   und keine der beiden Playwright-Strecken liest Text.
6. **Keine neue `depth`-Verzweigung** ohne Begründung im PR (siehe Basislinie
   in Release 6).
7. **Wer ein Roadmap-Item baut, trägt den Status im selben PR in
   `docs/roadmap-2026-H2.md` ein.** Anlass: Release 4 („Tresor") stand nach der
   Auslieferung monatelang als offener Plan in diesem Dokument und wurde von
   einer externen Bewertung folgerichtig als fehlend gelesen. Ein Statusfeld,
   das dem Code hinterherhinkt, ist schlimmer als keines – es lenkt
   Priorisierung.

---

## 4. Erfolgsmessung (ohne Tracking – Selbsttest-Kriterien)

- **Moment A:** Vom App-Start bis zur startklaren Tagestour ≤ 30 s, ≤ 3 Interaktionen.
- **Moment B:** Von „Cockpit öffnen" bis exportierter Entscheidungsvorlage ≤ 10 min.
- **Vertrauen:** Jeder Satz auf der Datenschutzseite ist im Code nachweisbar wahr.
- **Einstieg (TTOD):** Sekunden vom ersten Öffnen bis zu den **eigenen** Kunden
  auf der Karte, Zielwert ≤ 60 s für 80 % der Erstnutzer. Herleitung, Diagnose
  und Maßnahmen stehen in **`docs/go-to-market.md`** – dieses Dokument
  beschreibt das Produkt, jenes den Weg zum Nutzer. Der Verweis steht hier,
  weil die Trennung von außen wie eine Lücke aussieht.
