# 🦊 TourFuchs Vertrieb – Produkt-Roadmap H2/2026

**Stand:** 10.10.2026 · **Rolle:** Product Owner · **Status:** verbindliche Arbeitsgrundlage

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

### 1a. Nische zuerst *(Produktentscheidung, 03.10.2026)*

Erfolgreiche Produkte beginnen in einer Nische, die genau zu ihrer Stärke passt
(Amazon: Bücher – Millionen Titel, die kein Laden führen kann, jedes Exemplar
gleich), und wachsen erst von dort aus.

**Unsere Nische:** der einzelne **Außendienstler in einem größeren Unternehmen**
mit einer Excel-Kundenliste und Microsoft 365, der morgen eine Tour fahren will.

- **Sie passt zu unserer Stärke:** Browser, lokal, kein Konto, keine IT-Freigabe –
  ausprobieren am selben Abend, ohne jemanden zu fragen. Ein CRM-Projekt braucht
  dafür Monate.
- **Gleicher Schmerz bei allen:** Liste in Excel, Kunden im Kopf, Tour auf Zuruf.
- **Weitersagen funktioniert:** Außendienstler sitzen im Vertriebsmeeting
  nebeneinander.

**Erfolgsmaß:** **5–10 Außendienstler, die TourFuchs jede Woche nutzen** – nicht
die Zahl der Funktionen.

**Prüffrage für jede neue Idee:** *„Hilft das unseren 10 Außendienstlern?"*
Wenn nein → Backlog, egal wie gut sie ist. GeoFuchs, ServiceFuchs und der
Zeitraffer bleiben, wo sie sind, bis die Nische sie verlangt.

**Produktgrenze seit 07.10.2026:** TourFuchs ist ein Werkzeug **für** den
Mitarbeiter, keine zentrale Kontrollplattform **über** den Mitarbeiter. Kein
Hintergrund-GPS, kein Managerblick auf Wege oder Touren, keine
Mitarbeiterrankings und keine personenbezogene Bedienanalyse werden still als
„Teamfunktion" ergänzt. Jeder Vorschlag muss zusätzlich beantworten, ob die
Zusage „keine zentrale Leistungs-, Verhaltens- oder Standortauswertung" danach
noch wörtlich stimmt. Die vollständige Marktposition, Werbesprache und roten
Linien stehen in [Produktpositionierung](positionierung.md).

**Wettbewerb:** Wir konkurrieren nicht in Funktionen (CRM-Abgleich, Teams,
Verträge, Kaufkraftdaten sind das Heimspiel der Anbieter), sondern mit null
Hürde, „Tour und Gebiet in einem Werkzeug“, nachprüfbarem Vertrauen und
Emotion. Rückmeldung aus der Praxis (03.10.2026): Die Kunden als Lichter
darzustellen kommt sehr gut an. Wettbewerber, ihre wahrscheinlichen Züge
und unsere Antworten: [Wettbewerb](wettbewerb.md).

**Wachstum danach, Schritt für Schritt:** weitere Außendienst-Teams → andere
Branchen → angrenzende Rollen (z. B. Service-Techniker).

**Messen:** Nutzer fragen bleibt der Kern (Wie lange bis zu den eigenen Daten?
Woran ist es gescheitert? Was hat gefehlt?). Dazu kommt seit 03.10.2026 eine
**anonyme, cookielose Zählung der Seitenaufrufe** (Vercel Web Analytics) –
entschieden vom Verantwortlichen. Grund: Wird TourFuchs je im Unternehmen
betrieben, kostet Pflege Geld, und das Budget braucht einen neutralen Beleg, dass
das Werkzeug genutzt wird – ohne dass der Verdacht einer Mitarbeiterüberwachung
entsteht (Betriebsrat). Deshalb nur Seitenaufrufe, keine eigenen Ereignisse,
keine Kundendaten, „Do Not Track" wird respektiert. Merkblatt für Budget und
Betriebsrat: [Nutzungsnachweis](nutzungsnachweis.md).

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
| 4.4 | **Verschlüsselter Export mit QR-Schlüssel (Data in Transit)** | ✅ umgesetzt | „Sicherer Umzug": `.tfsafe`-Container (AES-256-GCM, Zufallsschlüssel) in `src/features/safeTransfer.js`; der Schlüssel reist getrennt per Bildschirm→Kamera. Seit 06.10.2026 wird die lokale Datenbank am Zielgerät nicht mehr zwangsweise verschlüsselt: ohne bestehenden Tresor werden die Daten direkt gespeichert und der freiwillige Tresor anschließend sichtbar angeboten. |

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
| 5.2 | **Zielassistent wählbar (Profi)** | ✅ umgesetzt | Microsoft 365 Copilot (Standard), Google Gemini, ChatGPT oder eigene https-Adresse. Die Wahl passt auch die Quellenzeile im Prompt an. Historischer Stand; seit 26.09.2026 ist die Zielwahl ohne Basis-/Profi-Umschalter verfügbar. |
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
| 10.10 | **Tour leeren ist ein sichtbarer Rückweg, das Ziel keine Warnung** | ✅ umgesetzt | „↺ Tour leeren“ steht direkt oben in „Meine Tour“ und bleibt mobil beim internen Scrollen erreichbar. Es entfernt Start, Ziel und Stopps, beendet den Tour-Fokus, klappt das mobile Blatt ein und zeigt wieder alle Kunden des unveränderten Planungsbereichs und der aktiven Filter. Das Ziel nutzt Violett statt Warnrot – auf Karte und Liste bleibt die Rolle eindeutig, ohne einen Fehlerzustand zu behaupten. |

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

### Release 11 – „Wo starte ich?" *(13.08.2026 umgesetzt, App 3.4.0)*

Anlass war die erste eigene Tour eines Nutzers: *„Für die Routenplanung kann ich
nur meinen Standort oder Kundenadressen nutzen. Ich brauche die nächste
SIXT-Station – oder ein Büro."*

Die Prüfung gab dem Befund recht und schärfte ihn: Der Startpunkt kannte zwei
Formen, GPS und Kunde (`state.tour.start`), das Ziel sogar nur eine. Wer seine
Tour an einer Mietwagenstation beginnt, musste den nächstgelegenen Kunden als
Start missbrauchen – das verschiebt Umkreisvorschläge und Streckenschätzung um
genau die Strecke, die einen erst zum Startpunkt bringt.

| # | Item | Status | Ergebnis |
|---|---|---|---|
| 11.1 | **Orte als Start und Ziel** | ✅ umgesetzt | `src/features/places.js`: Das **bestehende** Suchfeld nimmt zusätzlich Ortsnamen, Postleitzahlen und eingefügte Koordinaten an; Start **und** Ziel teilen sich dieselbe Suche (`wireTourPointSearch`). Aufgelöst wird gegen die ohnehin gebündelten ~8.300 PLZ-Zentroide – **kein neuer Netzaufruf**. |
| 11.2 | **Eigene Orte merken** | ✅ umgesetzt | „★ merken" am Start-/Zielchip macht aus einem gefundenen Punkt einen benannten Ort („SIXT Essen Hbf"), der ab dann in der Trefferliste oben steht. Kein Pflegedialog: gelöscht wird mit ✕ in derselben Liste. Deckel `CONFIG.tour.maxOwnPlaces = 20`. |
| 11.3 | **Orte liegen im Tresor** | ✅ umgesetzt | `state.places` reist im `datasetSnapshot()` mit und ist damit AES-verschlüsselt, sobald der Tresor aktiv ist. „Alle Daten löschen" löscht sie mit; beim sicheren Umzug werden sie **ergänzt statt überschrieben** (`mergeOwnPlaces`). |
| 11.4 | **Ersatzkoordinaten aus dem Verzeichnis halten** | ✅ umgesetzt | Beim Bauen des Index gefunden: 94 Postleitzahlen tragen im Quelldatensatz die geografische Mitte Deutschlands statt einer Lage (darunter „11011 Berlin"). Als Kundenposition ist das eine grobe Angabe, als **Ortsvorschlag** eine falsche Auskunft – „Berlin" hätte auf einem Acker bei Niederdorla gelegen. Solche Einträge kommen nicht ins Verzeichnis. |
| 11.5 | **Stufe 2 (Adresssuche) an ein Tor** | ⏳ offen | Siehe unten. Ausdrücklich **nicht** gebaut. |
| 11.6 | **Jede Trefferguppe bleibt im Bild** | ✅ umgesetzt *(13.08.2026)* | Nutzerbefund am eigenen Bestand: An „45136" hingen drei Kunden, und die Gruppe „Orte" rutschte damit unter die Faltkante – ausgerechnet die Antwort, wegen der man die Postleitzahl getippt hat. Sobald mehr als eine Gruppe Treffer hat, zeigt jede höchstens **3** Zeilen (`GROUP_LIMIT`), allein stehend **6**; die Kopfzeile nennt dann „Kunden (3 von 12)". |
| 11.7 | **Straße und Hausnummer am eigenen Ort** | ✅ umgesetzt *(13.08.2026)* | Nutzerwunsch. Beim Merken folgt eine **freiwillige** zweite Frage nach Straße und Hausnummer. Sie wird **nicht nachgeschlagen** – kein Netzaufruf –, sondern mitgeschrieben und an Google Maps übergeben; `packPoint()` trägt sie zusätzlich in die QR-Übergabe, `pointParam()` liest sie auf dem Handy wieder aus. Planung bleibt bei der Ortsmitte, die Navigation trifft die Tür. Das ist die Hälfte des Adress-Wunsches, die **ohne** Drittdienst zu haben ist; die andere Hälfte – eine Adresse *finden* – bleibt an 11.5. |

#### Drei Entscheidungen, die im Vorschlag noch offen waren

1. **Start *und* Ziel.** Wer an einer Station startet, gibt den Wagen abends dort
   wieder ab. Ein Ziel, das nur Kunden kennt, hätte die Hälfte des Bedarfs
   beantwortet – und ausgerechnet die Hälfte, die den Korridor-Modus trägt.
2. **Eigene Orte gehören in den Tresor.** Eine Büro- oder Hoteladresse ist ein
   Personenbezug auf dem Gerät. Sie folgen deshalb der Kundendaten-Regel, nicht
   der Einstellungs-Regel. Der Preis: Sie sind bei gesperrtem Tresor nicht
   lesbar. Das ist richtig so.
3. **Ein Feld, nicht zwei.** „Wo starte ich?" hatte mit Standort-Knopf und
   Kundensuche bereits zwei Angebote. Ein drittes wäre der Stapel aus Release 9
   gewesen (Prüffrage 2.4). Gemessen: `attention-check` meldet **Erstbild Handy
   14, Schreibtisch 33** – unverändert. Die Trefferliste erscheint erst beim
   Tippen, „★ merken" erst, wenn ein Ort ohne Kunden dahinter gewählt ist.

#### Das Tor für die Adresssuche (11.5)

Eine Freitextsuche über Nominatim würde „SIXT Flughafen Hamburg" hausgenau
finden. Sie ist nicht gebaut, und zwar aus zwei Gründen, die nichts mit Aufwand
zu tun haben:

- **Es wäre eine neue Drittdienst-Verbindung.** Bisher gehen an Nominatim
  ausschließlich die neutralen Adressfelder eigener Kunden. Freitext geht *als
  Freitext* hinaus – der Nutzer kann alles hineinschreiben. Das ist eine andere
  Zusage als die, die heute auf der Datenschutzseite steht (DoD Nr. 3).
- **Die OSM-Nutzungsrichtlinie verbietet Autocomplete.** Ein Suchfeld, das beim
  Tippen mitsucht, wäre ein Richtlinienbruch; erlaubt wäre nur „tippen → Enter →
  eine Anfrage". Das ist ein anderes Bedienmuster als das hier gebaute und
  gehört nicht als Nebensatz in dieses Release.

**Abbruchbedingung, vor der Auswertung notiert** (wie beim B3-Tor): Stufe 2 wird
gebaut, wenn bis zum **31.10.2026** in mindestens **drei** von zehn geplanten
Touren ein Startpunkt gebraucht wurde, den eigene Orte, Ortsname oder PLZ nicht
treffen konnten. Sonst stirbt sie und kommt in „Was wir weggelassen haben".
Ehrliche Einordnung: Bei einem Nutzer ist n = 1, daraus folgt nichts
Signifikantes. Der Wert liegt in der Selbstbindung gegen nachträgliches
Rechthaben.

**Verzichtszeile:** Ein Ort aus dem Verzeichnis ist ortsgenau, nicht hausgenau.
Für einen 25-km-Umkreis und die Streckenschätzung ist das ohne Bedeutung; wer die
Station hausgenau braucht, trägt sie einmal als eigenen Ort ein. Was fehlt, ist
das Finden einer fremden Adresse in einer fremden Stadt – genau das, was an
11.5 hängt.

### Nächste Kandidaten (bewertet, noch nicht terminiert)

> **Vorrang seit 10.10.2026:** Release 15 „Einmal verknüpfen, dann nur noch
> aktualisieren" (unten) kommt vor allen folgenden Kandidaten. 15.2 ist als
> „Datenquellen", 15.1 „Importvorlage merken" umgesetzt; offen bleibt die
> Praxisprüfung am Firmenrechner (15.3).


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

### UX-Durchgang 04.10.2026 (extern) – PO-Entscheidung und Reihenfolge

Ein externer Durchgang (Desktop + eingebaute mobile Vorschau, Beispieldaten)
fand keine Fehler, aber Reibung: viele Funktionen, der nächste sinnvolle Klick
tritt zu wenig hervor. Bewertet gegen Moment A („startklare Tagestour, ≤ 3
Interaktionen"):

1. **Briefing direkt am Tourstopp** – *04.10.2026 umgesetzt.* Der zentrale
   Nutzen brauchte einen Umweg über Marker und Popup. Desktop: „📋 Briefing"
   unter dem Kundennamen (nimmt dem Namen keine Breite); Handy: runder 📋-Knopf.
2. **Tour-Schritte dauerhaft beschriftet** („Start · Vorschläge · Meine Tour"
   statt „1"/„2") und nach der Startwahl den Vorschlags-Schritt hervorheben.
   *06.10.2026 umgesetzt:* Alle drei Bezeichnungen bleiben im Fokus sichtbar;
   kurze Übersetzungen halten die Leiste auch bei 390 px stabil. Der vorhandene
   aktive Zustand hebt nach der Startwahl weiterhin „Vorschläge" hervor.
3. **„Navigieren" als Hauptaktion**, Maps/QR/Druck/Kalender/Text/Rückblick unter
   „Teilen & Exportieren" bündeln. *06.10.2026 umgesetzt:* Google Maps ist die
   einzige hervorgehobene Hauptaktion; Kartenansicht, Übergabe und Ausgaben
   bleiben vollständig erhalten, liegen aber in einer übersetzten Klappgruppe.

Gemerkt, nicht terminiert (in dieser Reihenfolge):

4. **Nähe-Bezug benennen:** „Nahe Kartenmitte" bzw. „Nahe deinem Startpunkt"
   statt zweier gleich klingender Nähe-Logiken. Klein, reine Beschriftung.
5. **Vorschlagsliste kürzer:** erst wenige passende Vorschläge, größere
   Hinzufügen-Flächen, dann „Weitere anzeigen" (Berlin: 40 Treffer am Stück).
6. **Mobile Vorschau mit Karte/Suche/Tour starten**, nicht mit dem
   Datenverwaltungs-Panel, sobald Daten da sind.
7. **Demo-Einstieg kompakter:** Banner, Erweiterungen, Arbeitsbereich und
   Einstellungen nehmen vor der eigentlichen Aufgabe viel Platz.
8. **Demo-Briefing mit fiktivem, kopierbarem Beispielprompt** statt nur
   Erklärung – der Interessent soll „Kunde bekannt → Briefing fertig" erleben.
   Vorher prüfen, ob das Demo-Briefing (Release-Notiz zu den Briefing-Filmen)
   nicht schon einen Prompt zeigt und nur der Einstieg dorthin fehlt.
9. **GitHub-Homepage-Link** im Repository zeigt auf eine 404-Seite → auf die
   Vercel-Adresse umstellen (Repository-Einstellung, kein Code).

**Nachtrag 07.10.2026:** „⚡ Optimieren“ und „🗺️ Tour anzeigen“ stehen direkt nebeneinander. Anzeigen richtet die Karte auf die Tour aus und behält bei Wiederholung den Linienmodus; nur der separate Karten-Umschalter wechselt Luftlinie/Straßenroute. Ausgaben bleiben unter „Teilen & Exportieren“.

### Zur Diskussion: Mobile Hauptoberfläche „Kunde finden → Briefing oder Tour → Navigieren" *(Vorschlag 04.10.2026, nicht entschieden)*

**Idee:** Am Handy wird genau dieser Ablauf zur Hauptoberfläche; alles andere
tritt zurück.

| Änderung | So würde es aussehen |
|---|---|
| Drei dauerhaft sichtbare Bereiche | Unten: **Karte · Kunden · Meine Tour**. „Meine Tour" zeigt die Anzahl der Stopps. |
| Kundenauswahl räumt die Oberfläche auf | Suchtreffer antippen → Datenpanel schließen → Kundenkarte öffnen. Kein zusätzliches Einklappen nötig. |
| Kundenkarte auf die nächsten Aktionen ausrichten | Name, Adresse, Besuchsstatus; darunter große Schaltflächen **Briefing · Zur Tour · Navigieren**. Weitere Angaben aufklappbar. |
| Touraktionen ordnen | Stoppliste mit „Briefing" je Kunde und eine auffällige Schaltfläche **Tour starten**. Kalender, Drucken und Textkopie unter **„Teilen & Exportieren"**. |
| Datenverwaltung aus dem Arbeitsablauf nehmen | Import, Export, Tresor und Datenstatistik unter **Menü → Daten verwalten**. Ohne geladene Kunden erscheint der Import weiterhin direkt. |
| Standortfehler auffangen | Fehlt der Standort: **„Kartenmitte verwenden"** · **„Ort eingeben"** anbieten. |

**Desktop:** die drei Tour-Schritte immer vollständig beschriften –
**Startpunkt · Kundenvorschläge · Meine Tour**.

**Vorgeschlagene Reihenfolge:** zuerst nur zwei Dinge, weil beide konkret
beobachtete Umwege beheben:

1. dauerhaft sichtbarer Zugang zu **„Meine Tour"** (mit Stoppzahl),
2. **Datenpanel schließt bei Kundenauswahl** automatisch.

**Danach messen statt vermuten:** Freiwillige erledigen dieselben drei Aufgaben
– *Kunde suchen, Briefing öffnen, Tour starten*. Beobachtet wird, wo sie
suchen, zurückgehen oder nachfragen. Erst das zeigt, ob die Vereinfachung
tatsächlich hilft (dieselbe Lehre wie bei `face-check`: diese Fehlerklasse
findet nur das echte Gerät mit echten Menschen).

**Einordnung (Stand 04.10.2026, zur Diskussion):**

- **Schon da:** „Briefing" je Tourstopp (#347, am Handy runder 📋-Knopf);
  Briefing im Kunden-Popup; eine obere Navigation am Handy (`#mobile-topnav`)
  und der Knopf „nächster Schritt" auf der Karte (`#mobile-next-step`).
- **Überschneidung mit dem UX-Durchgang oben:** „Teilen & Exportieren" und
  „Tour starten" entsprechen Punkt 3, die Desktop-Beschriftung Punkt 2, die
  mobile Startansicht Punkt 6 – diese Punkte würden hier aufgehen.
- **Offene Fragen:**
  - Untere Leiste **statt** oder **zusätzlich zu** `#mobile-topnav`? Zwei
    Navigationen wären eine neue Aufmerksamkeits-Schuld (Release 9) und
    berühren die Grenze „Zwei Oberflächen, kein drittes" (Release 12).
  - Was heißt „Tour starten" genau – Google-Maps-Navigation zum ersten Stopp,
    Teilstrecken bei vielen Stopps (wie beim QR-Empfang) oder ein eigener
    Unterwegs-Modus?
  - „Navigieren" auf der Kundenkarte: direkt zum Kunden ab aktuellem
    Standort, ohne die Tour zu verändern?
  - Tresor unter „Daten verwalten": Das Schloss oben bleibt für Sperren/
    Entsperren sichtbar – nur Einrichtung und Verwaltung wandern ins Menü?
  - Wer sind die Freiwilligen, und wann? Ohne Termin bleibt der Messschritt
    ein Vorsatz.

### Release 12 – „Zwei Oberflächen, kein drittes" *(16.08.2026 umgesetzt)*

Anlass: eine Vorgabe des Product Owners, die Release 7 zu Ende führt. Dort wurde
die **Entscheidung** getroffen (hochkant = Touransicht, quer = Schreibtisch), aber
nicht jede Stelle nachgezogen. Der Befund beim Nachzählen: Das Produkt hielt die
Regel im Groben und brach sie im Kleinen.

| # | Item | Status | Ergebnis |
|---|---|---|---|
| 12.1 | **Der Tablet-Aufsatz im CSS ist weg** | ✅ umgesetzt | `@media (min-width: 769px) and (max-width: 1200px) and (orientation: portrait)` – genau die „eigene Regel für 769 bis 1200 Pixel im Hochformat". Sie trug eigene Blatt-Höhen (52px/52dvh statt 46px/68dvh), ein eigenes Griffmaß, einen eigenen Beispieldaten-Streifen (104px statt 100px) und eine Karten-Knopfzeile, die dort als einzigem Gerät **oben** stand. Vier Sondermaße und eine Sonderplatzierung – zusammen eine dritte Oberfläche. |
| 12.2 | **Die Schreibtisch-Abfrage ist die exakte Verneinung** | ✅ umgesetzt | `DESKTOP_FACE_MEDIA` in `src/core/viewport.js`. Vorher „ab 1201px oder ab 769px quer" – ein Handy quer (880×500) traf **beide** Listen und bekam Blatt-Geometrie mit Desktop-Regeln darüber. Ein Zwitter entsteht auch aus zwei Abfragen, die sich überlappen. |
| 12.3 | **Vier verirrte Schwellen auf die Gesichtsgrenze geholt** | ✅ umgesetzt | Kartenpopups und Marker (`map.css`), der Vorschau-Einstieg „Mobile Außendienst & Tour", die `.only-desktop`/`.only-mobile`-Texte und das Vertrags-Radar standen auf 768/769. Ein Tablet hochkant zeigte damit die mobile Geometrie **mit Desktop-Kartenpopups darin** – derselbe Befund wie in Release 7, nur eine Ebene tiefer. |
| 12.4 | **Touch-Ziele folgen dem Gesicht, nicht dem Finger** | ✅ umgesetzt | `@media (pointer: coarse)` vergrößerte Knöpfe auf **jedem** Berührgerät. Ein Tablet quer bekam dadurch den Schreibtisch mit größeren Knöpfen – weder die eine noch die andere Oberfläche. Die Regel liegt jetzt in der Touransicht. **Preis, ehrlich benannt:** Ein Tablet quer und ein Touch-Laptop haben Maus-Knopfgrößen. Das ist die Bedeutung von „quer ist Schreibtisch". |
| 12.5 | **Eine Zwischenstufe bei 1180px gestrichen** | ✅ umgesetzt | `.service-day-plan-settings` klappte unter 1180px Fensterbreite auf eine Spalte – eine vierte Schwelle, mitten in den Tablet-Breiten. Sie maß zusätzlich die falsche Größe: Die Felder stehen im Panel, dessen Breite frei ziehbar ist. Ersetzt durch `repeat(auto-fit, minmax(150px, 1fr))` – Platz statt Gerätestufe. |
| 12.6 | **`tests/faces.test.js` statt `tabletSheetLayout.test.js`** | ✅ umgesetzt | Die alte Datei bewachte den Tablet-Block, also genau das, was es nicht geben darf. Die neue wertet **jede** Medienabfrage aller Stylesheets aus: keine, die nur ein Tablet trifft; keine, die über die Gesichtsgrenze greift; keine, die eine Gesichtsschwelle mit eigenen Grenzen wiederholt. |
| 12.7 | **`face-check` prüft beide Hälften der Regel** | ✅ umgesetzt | Bis hierher gab es nur ein Referenzgerät (Smartphone), also nur die Prüfung „hochkant = Handy". „Quer = Schreibtisch" blieb Behauptung. Jetzt hat jedes Gesicht seine Referenz, drei Tablets stehen in beiden Haltungen im Feld, und alle sechs antworten in 15 von 15 Punkten wie ihr Maßstab. |

**Was die Regel nicht meint.** Innerhalb einer Oberfläche darf die Breite weiter
entscheiden – die Kurzfassung der Beschriftungen ab 560px, zweispaltige Kacheln
ab 480px. Das trifft ein großes und ein kleines Handy verschieden, so wie es ein
großes und ein kleines Tablet verschieden trifft: Textumbruch, kein zweites
Produkt. Verboten ist, eine der vier Gesichtsschwellen erneut hinzuschreiben
oder die Haltung des Geräts an einer zweiten Stelle auszuwerten.

### Release 13 – „Genau dieser Punkt" *(18.08.2026 umgesetzt, App 3.5.0)*

Anlass war der Nutzerwunsch nach einer wiederkehrenden Ladestation, die weder
aktueller GPS-Standort noch Kunde ist und nicht auf eine Postleitzahl-Mitte
reduziert werden darf.

| # | Item | Status | Ergebnis |
|---|---|---|---|
| 13.1 | **Karten-Pin im bestehenden Start-/Zielfeld** | ✅ umgesetzt | Das gemeinsame Suchfeld bietet als Ergebnis „Eigenen Ort auf der Karte setzen". Ein ausdrücklicher Modus lässt die Karte bedienbar; Stelle antippen oder Pin ziehen, Koordinate übernehmen. Kein zusätzlicher Suchschlitz und kein Netzaufruf. |
| 13.2 | **Benennen, merken, wiederverwenden** | ✅ umgesetzt | Ein kompaktes Bestätigungsblatt nimmt Name sowie freiwillig Straße, PLZ und Ort auf. „Diesen Ort für spätere Touren merken" ist vorausgewählt; bestehende Orte lassen sich über „📌 genauer" verschieben. |
| 13.3 | **Eigene Kartenebene statt Pseudo-Kunde** | ✅ umgesetzt | Gespeicherte Orte erscheinen im Tour-Kontext als violette Stern-Pins mit Aktionen für Start, Ziel, Position ändern und Löschen. Sie bleiben außerhalb des Kundenclusters und aller Kundenkennzahlen. |
| 13.4 | **Exakte Koordinate gewinnt** | ✅ umgesetzt | `coordinateSource: 'map-pin'` reist in der QR-Tour mit. `pointParam()` bevorzugt für diesen Typ immer Lat/Lng vor einer optionalen Adresse, damit Google Maps nicht erneut zu einer anderen Einfahrt geokodiert. |
| 13.5 | **Werkzeuge schließen sich aus** | ✅ umgesetzt | Beim Öffnen des Pin-Modus werden Lasso und dessen Auswahl beendet; auf der Auswahlkarte reagieren Kunden- und Gebietsmarker nicht versehentlich. Escape und „Abbrechen" führen zuverlässig zurück. |

**Produktentscheidung:** Ein Karten-Pin ist ein **gespeicherter Ort**, kein neuer
Kundentyp. Die existierende Regel aus Release 11 bleibt damit intakt: Kundenzahl,
Umsatz, Fälligkeit und Gebiete kennen den Punkt nicht; Tour und Navigation schon.

### Release 14 – „Spricht meine Sprache" *(05.10.2026 begonnen, dokumentierter Umfang umgesetzt)*

Anlass ist der Nutzerwunsch, TourFuchs bei englischer, französischer oder
spanischer Gerätesprache automatisch in derselben Sprache zu zeigen. Die
Umstellung erfolgt bewusst in kleinen, jeweils geprüften und einzeln
auslieferbaren Schritten, damit kein großer Übersetzungsumbau unkontrolliert in
`main` landet.

| # | Item | Status | Ergebnis |
|---|---|---|---|
| 14.1 | **Gerätesprache zuverlässig auflösen** | ✅ umgesetzt | Zentraler, rein lokaler Baustein erkennt `en-*`, `fr-*`, `es-*` und `de-*`, respektiert die Reihenfolge von `navigator.languages`, kennt eine gespeicherte manuelle Wahl und fällt für alles andere auf Deutsch zurück. Noch keine sichtbare Oberfläche wird gemischtsprachig umgestellt. |
| 14.2 | **Sicherer Übersetzungskatalog** | ✅ umgesetzt | Schlüsselbasierter Katalog mit deutschem Rückfall pro Text, Platzhaltern und ausdrücklich markierten DOM-Texten bzw. Textattributen. Katalogwerte werden nur als Text geschrieben, nie als ungeprüftes HTML. Die vier Sprachbezeichnungen sind vorbereitet; noch keine unvollständige Sprache wird automatisch aktiviert. |
| 14.3 | **Sprachwahl und App-Rahmen** | ✅ umgesetzt | `ⓘ Info → 🌐 Sprache`: Automatisch · Deutsch · Englisch · Französisch · Spanisch. Automatisch wertet nur lokal die Gerätesprachen aus; die bewusste Wahl bleibt lokal. App-Titel, Kopf, Suche, Hauptreiter und die Sprachwahl wechseln sofort. Noch nicht umgestellte Fachdialoge fallen sichtbar auf Deutsch zurück statt Texte zu erfinden. |
| 14.4 | **Erstnutzung und Import-Einstieg** | ✅ umgesetzt | Begrüßung, Demo-Hinweise, „Eigene Daten laden“, Einfügen, Berechtigungsbestätigung und die statische Spaltenzuordnung sind in allen vier Sprachen verfügbar. Automatische Onboarding-Statusmeldungen bleiben ebenfalls in der gewählten Sprache. Dynamische Importauswertung und Fachfeldnamen folgen separat. |
| 14.5 | **Dynamischer Kundenlisten-Import** | ✅ umgesetzt | Tabellenblatt, Kopfzeile, Feldnamen, Pflichtkennzeichnung, Einfügeschritte, Validierungsfehler, Speicherfehler und Importergebnis werden in DE/EN/FR/ES erzeugt. Bekannte Fehler aus Excel/CSV und Zwischenablage werden lokalisiert; Katalogtexte in Ergebnis-HTML werden maskiert. |
| 14.6 | **Karten-Pin und eigene Orte** | ✅ umgesetzt | Auswahlleiste auf der Karte, Benennungsdialog, Start-/Zielentscheidung, Speichern, Ändern, Löschen, Ortsmittenhinweise und die Popup-Aktionen sind in DE/EN/FR/ES verfügbar. Eingesetzte Ortsnamen werden vor Popup-HTML maskiert. |
| 14.7 | **Kundensuche und Kundenkarte** | ✅ umgesetzt | Globale Suchgruppen und Leermeldung, Kundenmarker, Kundensteckbrief, Besuchsrhythmus, Kontakte, Servicehinweise und direkte Kartenaktionen folgen DE/EN/FR/ES. Datum, relativer Besuch und Umsatz werden im Kundensteckbrief passend zur Sprache dargestellt; dynamische Texte werden vor Popup-HTML maskiert. |
| 14.8 | **Tourplaner-Kern** | ✅ umgesetzt | Start und Ziel, gemeinsame Orts-/Kundensuche, Umkreis- und Routenvorschläge, Stoppliste, Besuchsstatus, Reihenfolge, Streckenzusammenfassung, Routendarstellung und gespeicherte Touren folgen DE/EN/FR/ES. Ein Sprachwechsel rendert dynamische Tour- und Karteninhalte sofort neu; Nutzerdaten und Katalogtexte werden vor erzeugtem HTML maskiert. |
| 14.9 | **Navigation, Übergaben und Service-Tagesplan** | ✅ umgesetzt | QR-Teilen, Kamera-/Foto-Scan, Empfangszusammenfassung, Teilstrecken, Kalenderaktion und lokale Übernahme folgen DE/EN/FR/ES. Textübergabe, Kalenderexport und gedruckter Tagesplan verwenden die gewählte Sprache, ohne fachliche Werte zu verändern. In der erweiterten Service-Tagesplanung sind Bedienelemente, Ergebnisvorschau, Planungsgründe, Zielkonflikt, Ersetzen-Abfrage, Bestätigungszustand und alle Rückmeldungen bis zur Übernahme übersetzt. Auch Servicefilter-Ausnahmen sowie Zanobo-Hinweis und Anhören-Aktion an übernommenen Stopps wechseln mit der Sprache. Die vollständige Katalog- und Rückfallprüfung ist mit 14.10 umgesetzt. |
| 14.10 | **Französisch und Spanisch vollständig prüfen** | ✅ umgesetzt | Die CI sichert vollständige Katalogschlüssel, identische Platzhalter und ausdrücklich bestätigte sprachübergreifende Begriffe ab. Die mobile Karten-Hauptansicht ist für Französisch und Spanisch bei 390 × 844 Pixeln geprüft; Tresor-Einstieg, Nachtmodus, nächster Schritt, Lasso, Kartenbezeichnung und Kundenstapel sind übersetzt. Im Info-Dialog sind Live-Demo, Guide, Darstellung, exakte Adressverortung samt Status, Projektbeschreibung, Feedback, Datenschutz, Rechtliches und alle 15 Entscheidungen unter „Was wir weggelassen haben“ geprüft. Excel-Auswahl, Besuchsbericht und verschlüsselter Export folgen ebenfalls der Sprache. Ein Dokumenttest prüft automatische EN/FR/ES-Auswahl, deutschen Rückfall und den Vorrang einer gespeicherten Wahl. |

### Release 15 – „Einmal verknüpfen, dann nur noch aktualisieren" *(festgelegt 10.10.2026 – 15.1 und 15.2 umgesetzt 10.10.2026)*

**Anlass (PO, 10.10.2026):** Die Kolleginnen und Kollegen haben keine Lust,
regelmäßig eine Excel-Liste von Hand hochzuladen und jedes Mal Spalten
zuzuordnen. Wer nicht pflegt, hat veraltete Daten – und hört auf, TourFuchs zu
nutzen. Wunsch: einmal hinterlegen, wo die aktuellen Daten liegen, danach nur
noch **„Aktualisieren"** drücken; ein Fenster sagt, was sich geändert hat und
was nicht lesbar war. Nischen-Prüffrage: Ja – das nimmt den 10 Außendienstlern
die lästigste wiederkehrende Arbeit ab.

**Warum kein SharePoint-Link, den TourFuchs selbst abruft:** Anders als beim
Briefing (dort steht der Link nur im Prompt, die Firmen-KI sucht) müsste
TourFuchs die Datei selbst holen. Das bräuchte eine Microsoft-Anmeldung mit
App-Registrierung in der Firmen-IT (bricht „kein Login" und ist eine neue
externe Verbindung), scheitert ohne sie an der Browser-Sperre für fremde
Seiten (CORS), und ein „Jeder mit dem Link"-Freigabelink legte Kundendaten
offen. → bleibt beim offenen Thema „Konzern betreibt TourFuchs selbst".

**Der Weg stattdessen:** SharePoint-Bibliotheken sind auf Firmenrechnern über
OneDrive synchronisiert – die Datei liegt im Explorer als normale Datei.
OneDrive bringt die neue Fassung, TourFuchs liest sie lokal. Kein Netz, kein
Login, keine Cloud bei TourFuchs, nichts Neues für `datenschutz.html`.

| # | Item | Status | Inhalt |
|---|---|---|---|
| 15.1 | **Importvorlage merken** | ✅ umgesetzt 10.10.2026 | Nach bestätigter Zuordnung merkt sich TourFuchs Überschriften + Zuordnung als Vorlage (Name aus dem Dateinamen, höchstens 8, nur lokal). Gleiche Überschriften (Reihenfolge/Groß-Klein egal) → **ohne Dialog**, nur Ergebnisfenster „Liste aktualisiert": Kunden · geändert · neu · entfallen · Hinweise, Hinweise/Fehler aufklappbar, „✏️ Zuordnung prüfen". Änderungsbericht („Behalten/Entfernen") nur, wenn Kunden fehlen. Neue/fehlende Spalten (≥ 60 % gleich) → Zuordnung einmal zeigen, vorbelegt, mit Hinweis „neu: … – fehlt: …"; bewusst Abgewähltes bleibt abgewählt, neue Spalten erkennt die Automatik. Anderes Blatt/andere Überschriftenzeile der Vorlage → einmal so lesen. Unter „Daten": „🧩 Gemerkte Importvorlagen" mit „Vergessen". Wirkt auch mit „🔄 Aktualisieren" (15.2). |
| 15.2 | **Datenquellen: Link hinterlegen + „🔄 Aktualisieren"** | ✅ umgesetzt 10.10.2026 | PO: „Besser die Links hinterlegen unter Daten." Im Reiter Daten aufklappbar „🔄 Datenquellen & Aktualisieren": je Quelle Name + Link zur Ablage (z. B. SharePoint), höchstens 8. „↗ Ablage öffnen" öffnet den Link nur auf Klick in einem neuen Tab – TourFuchs ruft ihn nie selbst ab. „🔄 Aktualisieren" liest die neue Fassung über den gewohnten Import ein (Arbeitsmappe ohne Zuordnungsdialog, mit Ergebnisfenster); am PC (Edge/Chrome) merkt sich der Browser nach der ersten Auswahl den Dateizugriff im synchronisierten Ordner, danach genügt ein Klick (nach Browser-Neustart einmal „Zugriff erlauben?"). Ohne diese Browser-Funktion (Handy, Firefox, Safari) öffnet „Aktualisieren" die Dateiauswahl. Stand je Quelle („zuletzt 10.10.2026, 08:12 · verknüpft: …") und in der Überschrift. „Daten löschen" vergisst Dateiverweise und Zeitpunkte, die Links bleiben. Gespeichert nur Name, Link, Zeitpunkt (localStorage) und der Dateiverweis (IndexedDB). Offen: mehrere Quellen in einem Zug. Zuordnung merken: 15.1. |
| 15.3 | **Praxisprüfung Firmenrechner** | offen | Auf einem echten Firmenrechner mit Firmen-Edge prüfen, ob dauerhafter Dateizugriff erlaubt ist (IT-Richtlinien können ihn sperren) und ob der OneDrive-Ordner die Datei zuverlässig nachlädt. Ergebnis entscheidet, ob 15.2 so gebaut wird. |

**Zentrale Ablage (PO baut einen SharePoint auf):** Empfehlung, damit 15.1/15.2
reibungslos laufen:
- **ein** Ordner, **eine Datei je Liste** (Kundenstamm, Zuständigkeiten,
  Promotoren/Kontakte, Umsätze), **feste Dateinamen** – die neue Fassung
  überschreibt die alte statt „Kunden_neu_final2.xlsx";
- **Spaltenüberschriften nie umbenennen** – sie sind der Wiedererkennungsschlüssel
  der Vorlage; neue Spalten hinten anfügen ist unkritisch;
- Kundennummer in jeder Liste (Verknüpfung über „Kd-Nr.");
- Zugriffsrechte bewusst setzen: Wer den Ordner synchronisiert, hat alle Kunden
  darin auf dem Gerät. Brauchen Außendienstler nur ihr Gebiet, besser je
  Bezirk/Region eine Datei bzw. einen Ordner;
- den Ordner im Team per „Synchronisieren" bzw. „Verknüpfung zu Meine Dateien
  hinzufügen" einbinden.

**Bewusst nicht:** Abruf per Link oder über Microsoft Graph, automatisches
Aktualisieren im Hintergrund ohne Knopfdruck (der Nutzer entscheidet, wann sich
seine Daten ändern; laufende Tour bleibt geschützt).

### Release 16 – „Eine Datei, alles drin" (Vertriebs-Arbeitsmappe) *(festgelegt und begonnen 10.10.2026)*

**Anlass (PO, 10.10.2026):** Die zentrale Vertriebsdatei ist eine Excel-Mappe
mit fünf Blättern: „VBEZ Übersicht" (Kundenstamm mit Auftragseingang FY24–26,
Produktmix, VB alt/neu, CRM-Link), „Dateiübersicht" (Kontrollzahlen), „AE je
PCK" (Auftragseingang je Produktklasse), „SieSales Kontakte" (mit Einwilligung
und Sperrvermerken), „SieSales Opps". Nischen-Prüffrage: Ja – der
Außendienstler sieht am Kunden, wen er anrufen **darf**, welche Chance offen
ist, was der Kunde kauft und welche Kunden er neu übernimmt.

**PO-Entscheidungen:** Schlüssel ist der **Debitor**; bei Dubletten gilt die
spätere Zeile. Es gelten **VBEZ (Neu)** und **VB (Neu)** (Accountmanager).
Status „commit, gewonnen …", Phase 0–5, offen/geschlossen. Detailblätter hängen
über die IFA am Kunden.

**Kachel-Konzept (PO: „darf beim Öffnen nicht überfrachtet sein"):** Ebene 1
beim Öffnen – Name, Nummer, Anschrift, Umsatz, Zuordnung, eine Zeile Abzeichen
(z. B. 🔁 Übergabe). Ebene 2 – eine Knopfzeile (Zuständig · Kundenansprechpartner
· Promotoren · Opportunities · Produkte), Knöpfe nur mit Daten, genau ein Feld
offen, lange Felder scrollen in sich.

| # | Item | Status | Inhalt |
|---|---|---|---|
| 16.1 | **Arbeitsmappen-Import** | ✅ umgesetzt 10.10.2026 | Erkennung an den Blattnamen, alle Blätter in einem Zug ohne Zuordnungsdialog, Debitor-Schlüssel, Dublettenregel, Orders FY → Umsatzjahre, Kontrolle gegen „Dateiübersicht", Ergebnisfenster mit Zahlen und Hinweisen. **Nachtrag 10.10.2026:** Die 46-MB-Konzernliste („FY27_Alle_Bereiche_Gesamt"), aus der früher nur das Kundenblatt gelesen wurde, brach mit „zu groß für den Speicher" ab, weil nun alle Blätter mit allen Spalten gelesen wurden. Jetzt: Detailblätter nur mit den ausgewerteten Spalten (gehaltener Speicher gemessen 236 → 92 MB); bei Speichermangel automatisch zweiter Versuch nur mit dem Kundenblatt (wie früher, Hinweis im Ergebnis, bisherige Details bleiben); wurde die Seite verworfen, liest der nächste Versuch derselben Datei gleich schlank. |
| 16.2 | **Kontakte mit Sperrvermerken** | ✅ umgesetzt 10.10.2026 | DOI, „nicht anrufen", Werbesperre E-Mail, Opt-out; gesperrte Wege werden nicht angeboten; Löschvormerkung/inaktiv nicht übernommen; nicht im Briefing. |
| 16.3 | **Opportunities** | ✅ umgesetzt 10.10.2026 | Knopf in der Kachel, Filter „Opportunity"/„Opportunity-Phase", Briefing mit Name/Phase/Abschluss ohne Beträge und Freitexte. Vorrang in Tourvorschlägen: **zurückgestellt** (PO 10.10.2026), siehe „Offene Themen mit Auslöser". |
| 16.4 | **Produkte (AE je PCK) und Produktmix** | ✅ umgesetzt 10.10.2026 | Knopf mit Mix-Balken und Produktklassen je GJ, Filter „Produkt (PCK)". |
| 16.5 | **Übergaben alt → neu** | ✅ umgesetzt 10.10.2026 | Abzeichen „🔁 Übergabe von …" in der Kachel; Marker mit „🔁 Übergabe von …", gestrichelter violetter Rahmen nur bei aktivem Übergabe-Filter (PO 10.10.2026: sonst flächig violett); Filter „Übergabe" und „Übergabe von (VB alt)"; „🔁 Übergabeliste (Excel)" im Reiter Daten mit Blatt „Übergaben" (je Kunde) und „Übersicht je VB" (je Paar alt → neu, Kunden, Umsatz, offene Opps), folgt den Filtern. |
| 16.6 | **Cross-Selling-Hinweise** | ✅ umgesetzt 10.10.2026 | Produktklassen, die ≥ 40 % der vergleichbaren Kunden (Bezirk, bei < 5 Vergleichskunden Vertriebsgruppe) kaufen, dieser nicht – max. 3, mit Begründung „x von y Kunden in VBEZ …". Im Feld 📦 Produkte (Knopf „💡n"), Filter „Cross-Selling-Chance" für die Karte, Briefing mit Themennamen ohne Beträge. Bewusst Zählen statt Modell: erklärbar. |
| 16.7 | **Aktualisieren per Knopf** | ✅ umgesetzt 10.10.2026 (→ 15.2) | Die Mappe als Datenquelle hinterlegen, danach „🔄 Aktualisieren" – Import in einem Zug mit Ergebnisfenster. |
| 16.8 | **Tourvorschläge für Opportunities** | ⏸ zurückgestellt (PO 10.10.2026) – gemerkt | Kunden mit offener Opportunity (Phase, Abschluss bald) bevorzugt in Tourvorschläge/„In der Nähe" aufnehmen. Siehe „Offene Themen mit Auslöser". |

Keine neue externe Verbindung; der CRM-Link öffnet nur auf Klick einen Tab
(in `datenschutz.html` offengelegt).

### Release 17 – „Leiser Umbau": Code modern und effizient, ohne dass sich etwas ändert *(festgelegt 11.10.2026)*

**Ausgangslage:** Der Funktionsumfang ist für eine Evaluierungsphase von zwei
bis drei Monaten rund (PO 11.10.2026: „erstmal so bleiben, ohne neue
Funktion"). Eine Durchsicht des Codes (11.10.2026, nur gelesen) fand keine
Fehlkonstruktion. Der Code ist aber Feature für Feature gewachsen; dabei ist
viel Doppeltes und etwas Totes entstanden. Grob gezählt:

- rund 2.000–2.500 Zeilen App-Code und CSS (4–5 %) sind entbehrlich,
- rund 1.500–2.500 Testzeilen ebenso,
- das Hauptpaket der App (1,8 MB) wird beim Start unnötig groß geladen.

**Ziel:** Der Code wird modern und effizient: gemeinsame Bausteine statt
Kopien, Laden erst bei Bedarf, Farben als Design-Variablen, Tests prüfen das
Verhalten statt Quelltext. Für die Nutzer ändert sich **nichts**.

**Oberste Regel (PO 11.10.2026): Der heutige Stand muss weiter funktionieren.**
Daraus folgt:

- **Fehler aus dem Nutzer-Feedback haben immer Vorrang** vor dem Umbau.
- Kein Umbau-PR ändert sichtbares Verhalten. Ausnahme sind die unten
  benannten Fehlerkorrekturen, jede einzeln begründet.
- Entfernt wird Code nur, wenn belegt ist, dass niemand ihn nutzt.
- Im Zweifel bleibt der Code, wie er ist.

#### Doppelte Prüfung – gilt für jeden Umbau-PR

**Prüfung 1 – maschinell, vorher gegen nachher:**
- Alle bestehenden Prüfungen laufen grün: `build`, `test`, `attention-check`,
  `smoke-check` sowie `demo-check` mit allen Live-Demos.
- **Zuerst das Verhalten festhalten:** Bevor ein Modul umgebaut wird,
  bekommt es Verhaltenstests. Diese müssen **auf dem alten Code grün** sein,
  sonst halten sie das heutige Verhalten nicht fest. Danach folgt der Umbau,
  und die Tests müssen **unverändert** grün bleiben.
- **Import-Referenz (Golden Master, 17.0a):** Feste Beispieldateien
  durchlaufen den Import. Das Ergebnis muss vor und nach dem Umbau
  **bytegleich** sein.
- **Bildvergleich (17.0b):** Feste Ansichten in hell und dunkel, jeweils am
  Desktop und am Handy, werden **vorher gegen nachher** verglichen: Der
  Zielzweig (`main`) wird auf derselben Maschine im selben Lauf gebaut und
  aufgenommen – keine eingecheckten Referenzbilder, die an Schriften und
  Kantenglättung eines Rechners hängen. Pixelgleich, ohne Toleranz. Jede
  Abweichung blockiert den Merge. Gewollte Abweichungen (nur bei
  Fehlerkorrekturen) bekommen das PR-Label `optik-geaendert` mit Begründung
  im PR und eine Sichtprüfung durch den PO.

**Prüfung 2 – unabhängig:**
- Eine eigenständige Zweitprüfung des Diffs (separater Review-Lauf mit dem
  Auftrag: „Finde jede Verhaltensänderung"). Jeder Befund ist vor dem Merge
  geklärt.
- Bei Umbauten mit möglicher sichtbarer Wirkung (CSS, Karte, Dialoge,
  Import) kommt eine **PO-Stichprobe in der Vercel-Vorschau** dazu. Der PR
  enthält dafür eine Prüfliste mit 3–5 Klickschritten. Gemergt wird erst
  nach dem OK des PO.

**Zuschnitt und Ablauf:**
- PRs sind klein: ein Thema, höchstens etwa 400 geänderte Zeilen App-Code,
  einzeln rückgängig zu machen. Der Titel beginnt mit „Umbau:".
- **Nach jeder Phase folgt ein Beobachtungsfenster:** mindestens drei Tage
  normale Nutzung der Produktivversion, bevor die nächste Phase beginnt. Es
  gilt für Phasen, die App-Code ändern (PO, 11.10.2026): 17.0 hat nur
  Prüfwerkzeuge gebaut – in der Produktivversion gab es nichts zu beobachten,
  17.1 schloss deshalb direkt an.
- Taucht ein Fehler auf, wird zuerst der verursachende PR zurückgenommen
  (Revert) und erst danach die Ursache gesucht.

- **Nachtrag 11.10.2026 – Kundenkachel am Desktop im Handy-Format (PO):**
  „Das Format vom Handy gefällt mir besser, gerade von der Breite her –
  genauso für den Desktop." Die Desktop-Kachel ist jetzt wie am Handy
  höchstens 360 Pixel breit und kompakt; die Tour-Knöpfe zeigen das Symbol
  über der Beschriftung (die großen Desktop-Pillen vom 10.10. entfallen). Die
  Höhe folgt am Desktop weiter dem Platz auf der Karte. Handy unverändert
  (Bildvergleich: nur die beiden Desktop-Kacheln weichen ab).

- **Nachtrag 11.10.2026 – „bitte warten" bei Excel und Umzugsdatei (PO):**
  „Beim Laden oder Export kann es dauern. Der Nutzer denkt schon, alles ist
  eingefroren – vor allem auch für die tfsafe-Datei." Folge von 17.1b (Excel
  und QR laden bei Bedarf). Jetzt: Nach dem Start lädt TourFuchs Excel und
  QR im Leerlauf vor (der Service Worker hält sie ohnehin bereit – im
  Normalfall keine zusätzlichen Daten); wer schneller klickt, sieht „Excel wird vorbereitet …".
  Die Umzugsdatei zeigt jeden langsamen Schritt: „Umzugsdatei wird
  verschlüsselt …", „Datei wird entschlüsselt …", „Daten werden
  übernommen …", „Daten werden gespeichert …".

- **Nachtrag 11.10.2026 – Erstnutzer am Desktop: „Daten" nach Aufgaben (PO):**
  „Er erhält eine verschlüsselte tfsafe-Datei mit Schlüssel, startet TourFuchs
  und schaut in Daten – ganz unten findet er den Import. Der sichere Import
  ist für viele der normale Fall." Entschieden („1 ja, 2 ja, 3 ja"):
  (1) Ohne eigene Daten zeigt „Daten" am Desktop nur „Deine Daten holen" mit
  „🔐 Datei von Kollegen öffnen" vorne und „📊 Eigene Excel-/CSV-Liste
  laden"; mit eigenen Daten Gruppen laden · weitergeben · schützen · mehr ·
  löschen. (2) Die Willkommenskarte bekommt „🔐 Ich habe eine Datei von
  Kollegen"; der Selbststart der Vorführung hält an, solange die Maus auf der
  Karte liegt. (3) Erster Start am Desktop im Außendienst statt in GeoFuchs
  (eine gemerkte Wahl gewinnt). Handy: Daten-Tab unverändert bis auf den
  Tresor-Titel („🔐 Datentresor" statt „… & sicherer Umzug" – der Umzug
  stand am Handy schon immer außerhalb); die Willkommenskarte zeigt den
  Kollegen-Knopf auch dort (passt ohne Scrollen, 360×640 geprüft).
  Zweitprüfung fand: Panel blieb nach dem Empfang aus der Begrüßung zu
  (behoben, Smoke-Schritt), Kartenfarben beim Außendienst-Start ohne Demo
  (Vorgabe jetzt Kundenpunkte), Import-Hinweise und Verortung klappen
  „Mehr" auf. Leitfaden 7.0.

#### Phasen

| # | Phase | Inhalt | Status |
|---|---|---|---|
| 17.0 | **Sicherheitsnetz** (kein App-Code) | a) Import-Referenz (Golden Master) für Kundenliste, Vertriebs-Arbeitsmappe (synthetisch), Serviceverträge und Servicebesuche · b) `npm run visual-check` mit Referenzbildern · c) Bundle-Bericht mit Größenbudget im CI · d) **ein zentraler Netzwerk-Wächtertest:** prüft jeden `fetch`/`XMLHttpRequest`/`sendBeacon`/`WebSocket`/`window.open` in `src/` gegen die in `datenschutz.html` offengelegten Ziele. Er übersetzt den Grundsatz aus AGENTS.md direkt in einen Test; die verstreuten Einzelprüfungen bleiben, bis er steht. · e) **Umzugsdateien und Tresore aller Stände eingefroren** (PO 11.10.2026: „die bisherigen tfsafe-Dateien müssen weiterhin einlösbar sein"). | **e) umgesetzt 11.10.2026:** 6 Umzugsdateien (5 Stände + einer mit Kunde ohne Position) und 5 Tresore, jeweils mit dem Code eines historischen Stands erzeugt (erster Umzug 11.07. bis heute, alte 4-stellige PIN, Wiederherstellungscode). Doppelt geprüft: Logik-Tests (Inhalt bytegleich, vollständige Übernahme, Transportschäden, falsche Schlüssel/PIN) und echter Browser im smoke-check (einlösen und nach Neuladen behalten; Tresor am Sperrbildschirm öffnen). Durch eingebaute Fehler belegt, dass beide Prüfungen anschlagen. Herkunft: `tools/compat/README.md`. **d) umgesetzt 11.10.2026:** `tests/networkGuard.test.js` – abschließende Listen: wer selbst abruft (4 Module), eigene Daten nur vom eigenen Server, jedes externe Ziel (10, Abruf oder Link) in Datenschutzerklärung und README benannt, keine fremden Skripte/Stile in `index.html`. Fand eine Lücke: der Zanobo-Link stand nicht in der Datenschutzerklärung (jetzt Abschnitt 7). **a) umgesetzt 11.10.2026:** `npm run import-check` (CI) – 4 Szenarien über die echte Oberfläche (Kundenliste mit allen Spaltenarten, Reimport mit Änderungen, Vertriebs-Arbeitsmappe, Serviceverträge + -einsätze), gespeicherter Bestand bytegleich mit `tests/fixtures/import/*.erwartet.json`; neu einfrieren nur mit `--update` und Begründung. **c) umgesetzt 11.10.2026:** `npm run bundle-check` (CI) mit `tools/bundle-budget.json` (Stand + 1 %; Hauptpaket 1,8 MB roh / 570 KB gzip) – Wachstum und neue Pakete ohne Budget schlagen an. **b) umgesetzt 11.10.2026:** `npm run visual-check` (CI-Job `visual` bei jedem PR) – 8 Ansichten × Desktop/Handy × hell/dunkel = 32 Bilder, Zielzweig und PR im selben Lauf gebaut und pixelgleich verglichen (keine eingecheckten Referenzbilder). Zufallsquellen beseitigt statt toleriert: Karten-Kacheln grau aus dem Werkzeug, Animationen aus, einmalige Hinweise (Handy-Vorschau, Entdeck-Hinweis, Geokodier-Angebot) gelten als gesehen, feste Rasterung in Chromium. Gegenprobe: eine mit bloßem Auge unsichtbare Farbänderung (Rahmenfarbe um 1 Stufe) schlägt in allen 16 hellen Ansichten an. Bewusste Optikänderung: Label `optik-geaendert`. Dabei die Prüfstrecke selbst stabilisiert (smoke-check/import-check: zeitgesteuerte Einblendungen, zustandsbasiertes Warten statt fester Pausen). |
| 17.1 | **Fehler und Ladezeit** | a) Fehler aus der Durchsicht: `sidebar.js` liest den Browser-Speicher ungeschützt (bricht bei gesperrtem Speicher ab); der Kalender-Export gibt die Datei sofort nach dem Klick frei (leere Datei in manchen Browsern); die Lichterkarte meldet nach der Verortung nicht „Karte fertig" (Lasso zählt nicht neu); 6 Elemente ohne Dunkel-Design · b) Laden bei Bedarf: Die Excel-Bibliothek ist trotz Nachladens im Hauptpaket, weil `cockpit.js` und `contractRadar.js` sie fest importieren; dazu kommen QR-Bibliotheken, Live-Demo-Code und die Sprachen EN/FR/ES (Deutsch bleibt fest eingebaut). **Ziel:** Hauptpaket von 1,8 MB auf etwa 1,1 MB, danach als Budget festschreiben. | **a) Fehler umgesetzt 11.10.2026** (ohne Dunkel-Design, das folgt mit eigenem PR und Sichtprüfung): Gesperrter Browser-Speicher brach den **ganzen Start** ab (keine Karte, keine Beispieldaten) – nicht nur `sidebar.js`, auch Begrüßung und 20 Vorgabewerte; jetzt `core/safeStorage.js` und Absicherung an allen Stellen, belegt im Browser mit drei Sperrarten. Kalender-Export gibt die Datei erst nach 60 s frei. Lichterkarte meldet nach der Verortung „gezeichnet". Doppelt geprüft: Tests + neuer smoke-check-Schritt „Gesperrter Browser-Speicher"; Gegenprobe mit zurückgenommenen Korrekturen schlägt in beiden an. **Datenverlust beim Tresor behoben (11.10.2026):** Stand beim Deaktivieren kein Bestand im Arbeitsspeicher – weil das Nachladen nach dem Entsperren noch lief (großer Bestand, langsames Gerät) oder gescheitert war –, speicherte TourFuchs den leeren Stand im Klartext über die verschlüsselten Daten und verwarf den Schlüssel – nach dem Neuladen waren alle Kunden weg. Jetzt: warten auf das Nachladen, sonst die gespeicherten Daten nehmen; sind auch die nicht lesbar, bleibt der Tresor an. Gefunden über einen zeitweise roten smoke-check („0 Kunde(n) im Klartext", in #415 und #416). Der smoke-check stellt das Zeitfenster fest nach (Entschlüsseln großer Daten 3 s, Deaktivieren sofort); alter Code verliert dort jedes Mal, neuer nie. **Zweite Lücke behoben (23.10.2026):** Derselbe rote Schritt kam vereinzelt zurück (main #442, PR #445). Ursache diesmal der Speichertimer (400 ms): War er beim Sperren noch fällig und lief erst nach dem Entsperren, aber vor dem Nachladen, schrieb er den geleerten Arbeitsspeicher **verschlüsselt** über die Kunden – nach dem Neuladen waren sie weg, auch ohne Deaktivieren. Jetzt speichert der Timer nur einen geladenen Bestand (nach dem Sperren erst wieder nach dem Nachladen). Neuer smoke-check-Schritt streckt den Timer auf 2,5 s; alter Code verliert dort die Kunden, neuer nicht. **b) Teil 1 umgesetzt 11.10.2026 – Excel-Bibliothek aus dem Start:** Zwei feste Importe (`cockpit.js`, `contractRadar.js`) und die Beispieldaten-Erzeugung in `excel.js` zogen SheetJS (500 KB) beim Start mit. Jetzt lädt sie erst beim ersten Excel-Klick; die Beispieldaten wohnen in `services/demoCustomers.js` (unverändert verschoben). **Hauptpaket rund 1,84 → 1,31 MB roh, 0,59 → 0,41 MB gzip (−29 %)**, Budget gesenkt – kommt die Bibliothek zurück, schlägt der bundle-check an. Offline bleibt alles vorab gespeichert. **b) Teil 2 – QR-Bibliotheken bei Bedarf:** Leser (jsQR) erst vor Kamera- bzw. Foto-Scan, Erzeuger (qrcode) erst beim Senden – Hauptpaket weiter auf rund 1,16 MB roh / 0,36 MB gzip (seit Beginn von 17.1b −37 %). Neu im smoke-check: QR-Rundweg (Desktop erzeugt Datei + Schlüssel-QR, Handy liest das Bild per Foto und löst ein); ohne Nachladen des Lesers schlägt er an. **PO-Entscheidung 11.10.2026: b) damit abgeschlossen** – Ziel (etwa 1,1 MB) praktisch erreicht. Sprachen EN/FR/ES und Live-Demo-Code bleiben vorerst im Startpaket: Beide bräuchten einen asynchronen Start (Übersetzung bzw. Demo-Verdrahtung), viel Umbau für geschätzt 30–40 KB gzip. Neu bewerten, wenn eine weitere Sprache dazukommt oder die Ladezeit im Feld auffällt. **Dunkel-Design (Rest von a) umgesetzt 11.10.2026:** Der Generator `tools/aurora-tones.mjs` war seit mehreren Änderungen nicht mehr gelaufen – 30 Gegenregeln fehlten (u. a. „Live-Demos“-Knopf mit grünem statt violettem Symbol, Info-Knopf, Ladeanzeige, Wartehinweis beim Import, Knöpfe der Kundenkachel). Nur ergänzt; handabgestimmte Regeln bleiben. |
| 17.2 | **Doppeltes zusammenlegen, Totes entfernen** | Gemeinsame Bausteine `core/html.js` (`escapeHtml`, heute 30 Kopien), `core/dates.js`, `core/geo.js` (Entfernung, heute 5 Kopien), `core/prefs.js` (Browser-Speicher, 11 Kopien), Datei-Download; Dialoge zentral schließen; nachweislich ungenutzte Funktionen, Ereignisse, CSS-Klassen, Übersetzungsschlüssel, Demo-Helfer und IDs entfernen; Generator des Dunkel-Designs korrigieren (rund 250 wirkungslose Zeilen) und mit einem Test absichern, der Abweichungen zwischen erzeugter und eingecheckter Datei findet. Prüfwerkzeuge: gemeinsame Helfer in `tools/lib` (Vorschau-Server, Browserstart); dabei beenden **alle** Werkzeuge ihren Vorschau-Server mit der ganzen Prozessgruppe (smoke- und import-check tun es seit 17.0, attention-, demo-, face- und touch-check lassen noch je Lauf einen Server zurück). Etwa −900 Zeilen. | offen |
| 17.3 | **Tests auf Verhalten umstellen** | Heute lesen rund 35 % der Testprüfungen den Quelltext als Text. Sie brechen bei jeder Umbenennung, auch wenn das Verhalten gleich bleibt. **Pfadfinder-Regel:** Wer ein Modul umbaut, stellt dessen Quelltext-Tests im selben PR auf Verhaltenstests um. Dazu kommt ein gezielter Durchgang durch die 28 Testdateien, die zu über 80 % aus Quelltext-Prüfungen bestehen. **Ziel:** unter 10 % Quelltext-Prüfungen; übrig bleiben nur Wächter wie Datenschutz und Doku-Abgleich. | offen |
| 17.4 | **Großposten** | a) **Gemeinsamer Import-Baustein:** Spalten, Typen und Prüfungen werden je Liste nur noch beschrieben. Serviceverträge und Servicebesuche teilen sich Parser, State-Funktionen, Zuordnungsdialog und Dialog-Markup (etwa −500 Zeilen). Fehlercodes und Meldungen bleiben bytegleich, abgesichert durch die Import-Referenz. · b) **CSS mit Farbvariablen:** 8–10 neue Design-Variablen, eine gemeinsame Badge-Klasse und ein gemeinsamer Umschalter. Das Dunkel-Design schrumpft von 918 auf etwa 200 Zeilen, abgesichert durch den Bildvergleich. · c) **Kleine UI-Helfer:** Knöpfe eines Bereichs auf einmal verdrahten (nie ein globaler Handler – siehe die Lasso-Erfahrung), Text und Sichtbarkeit setzen, „eins aus N", ein PIN-Formular statt drei, ein QR-Scanner statt zwei. | offen |
| 17.5 | **Karte** | `map.js` (3.075 Zeilen) wird in Module aufgeteilt: Kern, Kachel-Rahmen, Kundenkachel (dann ohne Leaflet testbar), Kundenpunkte und Lichter, Flächen, Beschriftungen, Tour. Die beiden Aktualisierungswege (Stapel und Lichter) werden zu einem zusammengelegt. | offen |

#### Festgelegt (PO-Entscheidungen 11.10.2026)

- **Kein Framework, kein TypeScript, keine neue Laufzeit-Abhängigkeit.** Der
  Umbau nutzt kleine eigene Helfer. „Modern" heißt hier: zeitgemäßes
  Vanilla-JS mit ES-Modulen und dynamischem `import()`, CSS-Variablen und
  Verhaltenstests – nicht neue Werkzeuge.
- **Stapel erst ab 6 Kunden bleibt.** Es ist eine bewusste Produktentscheidung
  und Teil des Kartenbilds. Der Eingriff in markercluster stützt sich auf
  interne Funktionen der Bibliothek. Er wird in 17.5 in ein eigenes Modul
  gekapselt; die Version von markercluster wird **exakt** festgeschrieben, und
  ein Test schlägt an, wenn sie sich ändert. **Supercluster: nicht jetzt.**
  Auslöser für eine Neubewertung: Ein Update von markercluster wird nötig,
  oder einzelne Punkte neben Stapeln tauchen wieder auf.
- **Zahlen lesen:** Heute gibt es zwei Regeln. „1,234" ergibt beim normalen
  Import 1,234, in der Vertriebs-Arbeitsmappe 1234. Beim Zusammenführen
  (17.4a) bleibt das Verhalten **je Herkunft unverändert** (Modus-Schalter).
  Vereinheitlicht wird erst, wenn eine echte Datei zeigt, welche Schreibweise
  vorkommt.
- **Reihenfolge:** 17.0 → 17.1 → 17.2 → 17.3 → 17.4 → 17.5. 17.3 läuft nach
  der Pfadfinder-Regel ab 17.2 mit. Jede Phase endet mit dem
  Beobachtungsfenster.
- **Abbruchkriterium:** Kostet eine Phase mehr Stabilität, als sie bringt,
  etwa durch zwei Reverts in einer Phase, wird der Umbau angehalten und neu
  bewertet. Ein funktionierender Stand ist mehr wert als schönerer Code.

### Einstieg mit eigenen Daten: Kundenliste von der Firmen-KI ✅ (03.10.2026)

Die größte Hürde vor echter Nutzung ist nicht eine fehlende Funktion, sondern
der **erste eigene Datensatz**: Viele Vertriebsleute haben keinen Export zur
Hand – wohl aber Zugriff auf die KI ihres Unternehmens (z. B. Microsoft 365
Copilot), die CRM-Exporte und Excel-Listen lesen darf.

| # | Punkt | Status | Umsetzung |
|---|---|---|---|
| E.1 | **Prompt für die Firmen-KI** | ✅ umgesetzt | `"Eigene Daten laden"` → „🤖 Kein Export zur Hand? Liste von deiner Firmen-KI erstellen lassen". Der Prompt verlangt genau die Spaltenüberschriften, die die Spaltenerkennung exakt trifft (Test sichert das ab), verbietet Erfinden, fordert Quellenangabe und bei fehlendem Zugriff einen ehrlichen Hinweis, wo der Export liegt. |
| E.2 | **Kein neuer Weg hinein** | ✅ umgesetzt | Das Ergebnis kommt über „Ergebnis einfügen" (Einfügen-Dialog) oder „Excel-Datei der KI auswählen" – mit Berechtigungs-Zusicherung und Spaltenprüfung wie jede Liste. TourFuchs kopiert nur den Prompt und öffnet den Assistenten (gleiche Zielwahl wie beim Briefing); es ruft keine KI auf (Grundsatz 5.1). |

**Produktentscheidung – Baustopp:** Danach wird **nichts weiter angebaut**, bis
der Prompt mit einer echten Firmen-KI und echten Nutzern getestet ist. Erst die
Befunde (Liefert Copilot eine Datei oder eine Tabelle? Findet es die Kunden?
Wo hakt es?) entscheiden über den nächsten Schritt.

### Offene Themen mit Auslöser *(von jeder KI-Sitzung zuerst prüfen)*

Themen, die nicht gebaut werden, bis ihr Auslöser eintritt – aber nicht
vergessen werden dürfen. Wer (Mensch oder KI) an TourFuchs arbeitet, prüft
diese Liste und spricht ein Thema an, wenn der Auslöser eingetreten sein könnte.

| Thema | Auslöser | Stand | Details |
|---|---|---|---|
| **Umzug ins Konzern-GitHub** (Hosting + Nutzungszählung im Konzern) | Der Konzern entscheidet, TourFuchs selbst zu betreiben. | offen seit 03.10.2026 – bis dahin bleibt Vercel; die Besucherzahlen dort sind der Beleg für die Entscheidung. **Seit 23.10.2026 Vercel-Tarif Pro** für die private Erprobung (~3 Monate, ~15–20 Tester; Hobby nur nicht-gewerblich, DPA erst ab Pro); danach Umzug oder Abschalten. Merkblatt „Hosting und Datenschutz“ für die Rechtsabteilung liegt vor | [Nutzungsnachweis → Umzug ins Konzern-GitHub](nutzungsnachweis.md#umzug-ins-konzern-github-offenes-thema-stand-03102026): Optionen, technische To-dos, Fragen an die IT. Für die Zählung im Konzern vorgemerkt (16.10.2026): **Plausible Analytics**, selbst betrieben – gleiche schmale Zählung, Zahlen bleiben im Konzern. Erst dann denkbar: Daten direkt aus SharePoint per Microsoft-Anmeldung (Graph) statt über OneDrive-Synchronisation (Release 15). |
| **Praxistest Firmen-KI-Kundenliste** | Der Verantwortliche hat den Prompt mit einem echten Firmen-Copilot getestet. | offen seit 03.10.2026 – Baustopp bis dahin | Abschnitt „Einstieg mit eigenen Daten" oben; Befund entscheidet über den nächsten Schritt |
| **Tourvorschläge für Opportunities** (Release 16.8) | Der PO holt das Thema zurück – z. B. wenn Außendienstler mit der Arbeitsmappe fragen, welche Opportunity-Kunden sie auf der nächsten Tour mitnehmen sollen. | ⏸ zurückgestellt seit 10.10.2026 („zurückstellen, aber merken") | Idee: Kunden mit offener Opportunity in später Phase oder baldigem Abschluss in „In der Nähe" und Tourvorschlägen nach vorn; Begründung sichtbar („Opp. Phase 4, Abschluss 11/2026"). Daten liegen schon vor (16.3); bisher nur Filter „Opportunity"/„Opportunity-Phase". |
| **Vercel-Zählung prüfen** | Einige Tage nach dem Einschalten (03.10.2026). | 24-Stunden-Zwischenstand am 09.10.2026: 29 Besucher, 61 Aufrufe. **Stand 16.10.2026 (Dashboard, Production, letzte 30 Tage): 163 Besucher, 542 Aufrufe** seit dem Einschalten. Aus dem Tagesverlauf abgelesen (ca.): **rund 80 Besucher pro Woche** in beiden ersten Wochen (03.–09.10. und 10.–16.10.), werktags meist 15–20, am Wochenende um 8; Spitze 22 am 08.10. Ausgangswert damit notiert; enthält eigene Aufrufe und Demo-Neugierige. Nächster Blick: Verlauf über die folgenden Wochen | Besucher/Woche im Vercel-Dashboard ansehen; erster Wochenwert als Ausgangspunkt notieren. Der vom Verantwortlichen geteilte Screenshot belegt Interesse, noch keine regelmäßige Nutzung. |
| **Besuche Handy ↔ Desktop: Stufen 3, 4** ([Konzept](konzept-besuche-abgleich.md)) | Ein Außendienstler fragt nach einem Wochenbericht/einer Besuchsübersicht (→ Stufe 3) oder will Infos zum Besuch in TourFuchs statt im CRM notieren (→ Stufe 4). Für OneDrive als Briefkasten (Weg C): Praxisprüfung 15.3 bestanden. | ⏸ PO 20.10.2026: zurückgestellt. Umgesetzt am 20.10.2026: Rückweg sichtbar (#439), Stufe 1 (Besuche beim `.tfsafe`-Empfang zusammenführen) und „🔄 Abgleichen" (Weg B). | Stufe 3: „Meine Besuche" drucken/Excel mit Zeitraum. Stufe 4: Notiz zum Besuch – offen: freier Text oder feste Auswahl; die Abgleich-Datei könnte sie mittragen. |
| **LinkedIn-Serie 2 „Für die Vertriebsleitung“** (GeoFuchs) | Serie 1 (Lichterkarte · Tour planen · Firmen-KI-Liste) ist gelaufen, und die Besucherzahlen bzw. Kommentare zeigen Interesse. | **Filme, Titelbilder und Post-Texte produziert (03.10.2026)** – Veröffentlichen wartet auf den Auslöser | Woche 4 „Deine Bezirke. Im Griff.“ (Lichter → Bezirksflächen → Bezirkskarte → Cockpit), Woche 5 „Gebiete umverteilen. In Minuten.“ (Was-wäre-wenn: Augsburg → Stuttgart, Alt/Neu auf der Karte), Woche 6 „Die Entscheidung. Auf einem Blatt.“ (Entscheidungsvorlage ohne Kundennamen). Skripte: `record-bezirke.mjs`, `record-umverteilen.mjs`, `record-vorlage.mjs`. Botschaft gegen teure Fachsoftware: „kostenlos im Browser, auf denselben Daten wie der Außendienst“. Film-Werkzeuge: `film/lichterkarte/` (neuer `film`-Typ in `stage.html` + Aufnahmeskript). Hintergrund: [Wettbewerb](wettbewerb.md). |

### Backlog & Vision (bewusst NICHT jetzt)

- **POIs auf der Karte** (Ladestationen): nur als Opt-in – externe POI-Abfragen
  sind eine neue Drittdienst-Verbindung und unterliegen der Offenlegungspflicht
  (DoD Nr. 3). Der Teil „eigene Niederlassungen" ist mit **Release 11**
  beantwortet und aus diesem Eintrag herausgelöst: Er war hier als
  *Anzeige*-Frage abgelegt, gebraucht wurde er als *Planungs*-Frage – wo beginnt
  meine Tour. Was hier bleibt, ist das Zeichnen fremder Punkte auf die Karte,
  und das steht weiter hinten an.
- **KI-Assistent in der App:** Die Grundsatzentscheidung ist mit 5.1 gefallen und
  gilt in die andere Richtung: TourFuchs bindet **keine** KI an – weder per API
  noch per Anmeldung. Es bereitet den Prompt vor, mehr nicht. Ein lokales Modell
  bleibt theoretisch denkbar, steht aber auf keiner Liste.
- **Connector-Anleitungen** (Export-Leitfäden für CRM-Systeme): reine Dokumentation,
  geringer Aufwand – wird als Lückenfüller zwischen Releases mitgenommen. Teilweise
  abgelöst durch die Kundenliste von der Firmen-KI (s. o.): Die KI kennt das
  eigene CRM besser als jeder generische Leitfaden.
- Eigener OSRM-/Nominatim-Endpoint bzw. konfigurierbarer Routing-Server (F2) – erst
  relevant, wenn > ~5 regelmäßige Nutzer; bis dahin: Fallback + Opt-in reichen.
- Refactoring `map.js`/`sidebar.js`/`tourPanel.js` in Untermodule (F7) – seit
  11.10.2026 Teil von **Release 17 „Leiser Umbau"** (17.4c/17.5), mit doppelter Prüfung.
- **Zeitraffer „Geschäftsjahr bei Nacht"** *(Idee, 03.10.2026 – geparkt)*: Die
  Lichterkarte als Film über ein Geschäftsjahr. Jeder **Auftragseingang** blitzt
  an seinem Ort hell auf und verglimmt dann langsam; die Farbe zeigt die
  **Produktkategorie**, eine Uhr/ein Datum läuft mit (Vorbild: Zug-Zeitraffer
  wie „1603 trains running" – Tagesverlauf statt Geschäftsjahr).
  - *Warum überhaupt:* Ein Werkzeug darf schlicht **cool** sein. Menschen arbeiten
    lieber und länger mit Werkzeugen, die ihnen gefallen (vgl. Auto: A nach B
    schafft jedes, gekauft wird das, das sich gut anfühlt). Das wirkt indirekt –
    Akzeptanz, Weitererzählen, Vorführwert beim Chef und im Vertriebsmeeting –
    und ist trotzdem ein echter Produktwert. Die Lichterkarte hat das bestätigt.
  - *Haken:* Braucht **Auftragsdaten mit Datum** (und optional Kategorie) – eine
    neue, umfangreiche Importquelle. Verarbeitung bliebe lokal wie alles andere.
  - *Schlanker Einstieg (falls es je losgeht):* **„Besuchs-Zeitraffer"** mit Daten,
    die TourFuchs schon hat – die eingetragenen Besuche (`besuche`) leuchten im
    Zeitraffer auf. Kein neuer Import; testet, ob der Effekt trägt. Erst danach
    Auftragseingänge als optionale Importspalten (Datum, Kategorie, Wert).
  - *Bewertung:* hoher Wow-Faktor, kein Beitrag zu Moment A/B, Aufwand für die
    PWA derzeit nicht zu rechtfertigen → **bewusst nicht jetzt**.
- Weitere Kartenanbieter bleiben Backlog. Mehrsprachigkeit DE/EN/FR/ES ist mit Release 14 umgesetzt.
  (*Themes* sind seit 02.10.2026 da: Aurora hell/dunkel, Kartenstile „Nacht" und
  „✨ Lichterkarte" – siehe Wissensbasis 4.7/8.3.)

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
8. **Umbau-PRs** (Titel „Umbau: …", Release 17) ändern kein sichtbares
   Verhalten und durchlaufen die **doppelte Prüfung**: maschinell vorher gegen
   nachher (Verhaltenstests grün auf altem und neuem Code, Import-Referenz,
   Bildvergleich) und unabhängig (Zweitprüfung des Diffs, bei sichtbarer
   Wirkung PO-Stichprobe in der Vorschau). Details siehe Release 17.

---

## 4. Erfolgsmessung (Selbsttests und offengelegte anonyme Seitenaufrufe)

- **Moment A:** Vom App-Start bis zur startklaren Tagestour ≤ 30 s, ≤ 3 Interaktionen.
- **Moment B:** Von „Cockpit öffnen" bis exportierter Entscheidungsvorlage ≤ 10 min.
- **Vertrauen:** Jeder Satz auf der Datenschutzseite ist im Code nachweisbar wahr.
- **Einstieg (TTOD):** Sekunden vom ersten Öffnen bis zu den **eigenen** Kunden
  auf der Karte, Zielwert ≤ 60 s für 80 % der Erstnutzer. Herleitung, Diagnose
  und Maßnahmen stehen in **`docs/go-to-market.md`** – dieses Dokument
  beschreibt das Produkt, jenes den Weg zum Nutzer. Der Verweis steht hier,
  weil die Trennung von außen wie eine Lücke aussieht.

### Import-Rückmeldung bei großen Dateien (07.10.2026, umgesetzt)

Excel-/CSV-Einlesen läuft lokal im Web Worker. Ein Wartedialog ersetzt die Importauswahl, nennt Dateiname und Verarbeitungsschritt und ermöglicht Abbrechen oder Escape. Auch Blatt-/Kopfzeilenwechsel bleiben bedienbar; Fehler und Abbruch erhalten den bisherigen Stand. Kein Upload und keine neue externe Verbindung.

### Desktop-Sidebar bis 150 % verbreitern (07.10.2026, umgesetzt)

Am rechten Panelrand per Maus zwischen 340 und 600 Pixeln ziehen; Standardbreite 400 Pixel. Die lokal gespeicherte Breite wird nach dem Neuladen wiederhergestellt. Frei verschobene Panels verwenden dieselbe relative Ziehbewegung.

### Mobiler Planungsbereich statt Bezirks-Scroller (08.10.2026, umgesetzt)

Direktes Nutzerfeedback aus dem Smartphone-Praxistest: Der native Einzelauswahl-Scroller für mehrere tausend Bezirkswerte war nicht suchbar und fachlich zu eng. Das mobile Tourgesicht besitzt deshalb einen eigenen **„🗺️ Planungsbereich“** als Bottom-Sheet:

- Suche findet Werte und beim Vertriebsbezirk auch den zugehörigen VB-Namen.
- Mehrfachauswahl über die im Desktop-Filter eingeblendeten Kategorien; optionale Ebenen werden ausschließlich am Desktop aktiviert oder entfernt und lokal gespeichert. ODER innerhalb, UND zwischen Kategorien.
- Kartenflächen wahlweise automatisch, nach Channel, Vertriebsgruppe, Vertriebsbezirk oder ganz ohne Flächen; Kundenlichter und Route bleiben führend.
- Bestehende Tourstopps werden durch neue Filter nie still gelöscht, sondern als außerhalb des Planungsbereichs markiert.
- Filter und Kartenwahl bleiben lokal gespeichert. Desktop-Markup und Desktop-Bedienung bleiben unverändert.

### Ruhiger Desktop-Einstieg und Kunden-Kopie (09.10.2026, umgesetzt)

Die zentrale Startauswahl erhält die volle Kartenfläche; das Desktop-Panel bleibt geschlossen. Beim Umschauen, während/nach der Demo und nach erfolgreichem eigenem Kundenimport steht es automatisch bereit. Ein Klick auf die Kundennummer kopiert `[Kundennummer] Kundenname` mit der bisherigen Nullenkürzung. Beide Änderungen erleichtern den Einstieg bzw. die Weitergabe im Außendienst-Alltag.

### Kundennummer im Suchtreffer (09.10.2026, umgesetzt)

Die globale Suche zeigt je Kunde die vollständige Originalnummer in eckigen Klammern vor dem Namen. Das erleichtert die Unterscheidung gleichnamiger Kunden und macht Screenshots eindeutig. Kunden ohne Nummer bleiben mit Namen sichtbar; lange Angaben werden auf Desktop und Handy umgebrochen. Guide und Uploadunterlagen sind nachgezogen.


### Demo-Zugang und vollständige Lernwege (09.10.2026, umgesetzt)

„Live-Demos“ steht dauerhaft rechts im Desktop-Kopf mit grünem Filmsymbol. Die bisher nur mobile Empfangs-Demo zeigt jetzt auf beiden Geräten eine echte verschlüsselte Beispieldatei, den Schlüssel und die lokale Entschlüsselung ohne erneute Feldzuordnung. Die Briefing-Demos zeigen KI-Auswahl, vollständigen angepassten Prompt und die lokale Kopieraktion. Gespeicherte KI-Wahl und eigener Kundenbestand bleiben erhalten; keine externe KI wird geöffnet. Guide, PDF und Uploadunterlagen sind nachgezogen.

**Nachtrag 11.10.2026:** Kunden- und Mehrkunden-Briefing wählen in der Live-Demo
beispielhaft Microsoft 365 Copilot. ChatGPT bleibt in der regulären Auswahl.

### Promotoren, Kundenansprechpartner und Umsatz nach Geschäftsjahr (10.10.2026, umgesetzt)

Neben „👥 Zuständig" stehen in der Kundenkachel „📣 Promotoren" (Name, Thema, Telefon, E-Mail) und „🤝 Kundenansprechpartner" (Name, Abteilung, Telefon, E-Mail) als Knöpfe; ein Klick klappt das Feld auf. Beide kommen aus einer Kontaktliste über die Kundennummer – die Art steht in „Kontaktart" oder ergibt sich aus „Thema"/„Promotor". Neue Filterebenen „Promotor", „Promotor-Thema" und „Zuständig · VK/OM/…" (nach Namen, ohne Telefonnummer, ohne 80-Werte-Grenze). Umsatzspalten mehrerer Jahre („Umsatz 2024", „GJ 2025") werden erkannt: Der jüngste ist „der" Umsatz, der Knopf „📊 Jahre" zeigt vier Jahre als „GJ26", „GJ25" … mit Veränderung zum Vorjahr – benannt nach dem überwiegenden Jahr, wie die Firmen es selbst tun (unabhängig vom Startmonat, z. B. Okt.–Sep.). Das Kunden-Briefing nennt Promotoren mit Thema, Ansprechpartner mit Abteilung und die Umsatzentwicklung – ohne Telefon und E-Mail. Nischen-Prüffrage: Der Außendienstler sieht beim Kunden, wen er anrufen kann und wie sich der Kunde entwickelt; gefiltert wird nach „wer betreut wen", nicht nach Leistung. Keine neue externe Verbindung.

### Große Bestände: „Bitte warten", schnellere Filter, Verortung setzt sichtbar fort (10.10.2026, umgesetzt)

Anlass: Mit über 12.000 Kunden wirkte TourFuchs beim Start und nach Filterklicks eingefroren, und die adressgenaue Verortung schien nach jedem Neustart von vorn zu beginnen. Umgesetzt: Hinweis „Daten werden geladen" sofort beim Start (schon im HTML), „Karte wird aktualisiert – x von y Kunden" beim portionsweisen, abbrechbaren Kartenaufbau. Sichtbarkeitsprüfung überspringt Filterebenen ohne Abwahl; Zuständig-/Promotor-Ebenen suchen ihre Spalten einmal statt je Kunde; das Plandatum wird einmal je Durchlauf gelesen. Gemessen mit 12.500 Kunden: Start blockiert 0,9 statt 2,3 s, Filterklick im Außendienst 0,1 statt 0,46 s am Stück. Verortung: Bekanntes aus dem Adress-Speicher sofort übernehmen und nicht mitzählen, nicht gefundene Anschriften nicht erneut als offen zählen, Pille nennt „· n schon adressgenau". Keine neue externe Verbindung.

**Nachtrag 10.10.2026 – Zoomen ruckelte, Live-Demo hing:** Beim Rein- und Rauszoomen blockierte die Karte mit 12.500 Kunden 3,5–5 s, kurz standen Kundenpunkte und Gebietskacheln zugleich da. Behoben: Landkreis je Kunde gemerkt (Punkt-in-Polygon nur bei neuen Koordinaten), Kundenpunkte beim Überqueren der Zoomschwelle nur aus-/eingeblendet statt neu gebaut, Neuberechnung einmal nach dem letzten Mausrad-Schritt. Gemessen: Hineinzoomen ~1 s statt ~5 s (erstes Mal ~3 s), Herauszoomen ~0,6–2 s statt ~3,7 s. Live-Demo „Vom Bezirk zum Kunden" brach ab („Gebietskachel konnte nicht geöffnet werden"), wenn vorher die Karte verschoben worden war: Leaflet verwirft nach einem Ziehen Klicks bis zum nächsten Mausdruck – die Demo setzt das vor jedem Klick zurück. `npm run demo-check -- --file=… --drag` prüft genau das. Übergabe-Rahmen auf der Karte nur noch bei aktivem Übergabe-Filter.

**Nachtrag 10.10.2026 (abends) – Handy: Zoomen unruhig, einzelne Punkte neben Stapeln:** Gemessen in der Handy-Ansicht mit 12.500 Kunden: Nach Hinein- und wieder Herauszoomen (12 → 7) blieben bis zu 35 Kundenpunkte einzeln stehen, die auf der Stufe in einem Stapel steckten, und bis zu 20 Stapel einer vorigen Zoomstufe. Ursache: TourFuchs zeigt Gruppen unter 6 Kunden einzeln (eigener Eingriff in markercluster); beim Herauszoomen räumte markercluster diese Einzelpunkte und Teile der alten Stapel nicht ab. Behoben: Abgleich nach jeder Stapel-Animation (und nach der 300-ms-Warteschlange von markercluster) – Einzelpunkte in Stapeln ab 6 und Stapel anderer Stufen verschwinden, Fehlendes wird ergänzt. Jetzt auf jeder Stufe beim Heraus- wie beim Hineinzoomen dieselben Punkte und Stapel. Ruhiger: Beim Ebenenwechsel bleibt die alte Fläche stehen, bis die neue fertig ist (kein Leerblitzen), gebaute Flächen je Ebene werden wiederverwendet, Stapel außerhalb der Gebietsplanung zählen nur (ohne alle Kunden einzusammeln). Zoomschritt am Handy: ~0,33 s inkl. Animation, kaum blockierende Rechenzeit.

**Nachtrag 10.10.2026 (spät) – Kundenkachel verschwand nach 30–60 s, Karte „zuckte":** Ursache: Die adressgenaue Verortung meldet ihren Zwischenstand jede Minute; daraufhin baute die Karte alle Kundenpunkte neu (direkt und über die Seitenleiste, die dabei den Modus neu setzte) – die offene Kachel hing an einem der neu gebauten Punkte und schloss sich. Jetzt: Bei reinen Positionsänderungen rücken die vorhandenen Punkte an ihre neue Stelle, Seitenleiste und Modus bleiben unberührt, kein Neuaufbau. Ein Punkt mit offener Kachel wartet, bis sie geschlossen ist. Im Browser geprüft (Kachel bleibt offen, Punkt rückt nach dem Schließen nach).

**Nachtrag 10.10.2026 (Nacht) – Kundenkachel neu geordnet:** Wunsch des PO nach Praxisblick: Name allein, darunter eigene Zeile Kundennummer + „↗ SieSales"; Gebiet und Vertriebsbeauftragter je in eigener Zeile; Knöpfe (Ansprechpartner, Opportunities, Produkte) und Besuchsblock je in einer Zeile. Desktop: Kachel 480 statt 300 px Inhaltsbreite und so hoch, wie die Karte Platz hat – zugeklappt alles bis zu den Tour-Knöpfen ohne Scrollen sichtbar (vorher bei 380 px abgeschnitten). Tour-Knöpfe stehen fest unten, wenn ein aufgeklapptes Feld die Kachel scrollen lässt; wächst sie dabei oben aus dem Bild, schwenkt die Karte nach. Handy (eigenes Ermessen): volle Bildschirmbreite, etwas mehr Höhe (bis 60 % bzw. 460 px), Tour-Knöpfe ebenfalls fest unten, ein aufgeklapptes Feld rückt von selbst ins Bild – der Kundenpunkt bleibt unter der Kachel sichtbar. **Nachtrag:** In der Lichterkarte (Desktop) verschwand die Kachel weiterhin nach 30–60 s – dort wurden die Lichtpunkte bei jedem Verortungs-Zwischenstand (und bei jedem Zoomschritt) neu gebaut. Jetzt rücken sie an ihre Stelle bzw. wachsen mit, ohne Neuaufbau; ein Punkt mit offener Kachel wartet. Im Browser geprüft (alter Stand: Kachel schließt bei fremdem/eigenem Zwischenstand und Zoom; neu: bleibt offen). **Nachtrag:** Tour-Knöpfe am Desktop als richtige Pillen, doppelt so hoch (50 statt 25 px); Handy unverändert.

### Mobile Bedienung und Schlüsseldatei (12.10.2026, umgesetzt)

Nutzerfeedback: Mobiler Drawer-Griff bei eigenen Daten 32 Pixel höher und mit mindestens 44 Pixel Touchhöhe; farbige Gebietsflächen im mobilen Außendienst bleiben beim Herauszoomen auf PLZ 3. Kundennummer-Kopie nun `Kundenname [Kundennummer]`. Der sichere Empfang zeigt Datendatei und Schlüssel als zwei gleichwertige Schritte, unterstützt den Import einer Schlüssel-TXT und startet die Kamera nur auf Wunsch. Beim Export kann die passende Schlüssel-TXT heruntergeladen werden; die Empfangs-Live-Demo zeigt beide Dateien. Datei und Schlüssel bleiben getrennt zu übergeben.


### Firmen-KI-Auswahl vereinfacht (13.10.2026)

Umgesetzt: Kunden- und Mehrkunden-Briefings zeigen „Firmen-KI-Assistent“ mit Microsoft 365 Copilot als Standard und „Eigener Firmenassistent“ für einen freigegebenen HTTPS-Link. Frühere ChatGPT-/Gemini-Auswahlen fallen auf Copilot zurück; eigene Links bleiben erhalten. Keine konzernspezifische Voreinstellung. Live-Demos, Guide 3.24, Bildanleitung, PDF und Uploadpaket aktualisiert. Management-Folie bleibt unverändert.

### PO-Review: Tour-Zuverlässigkeit und Tresor-Erklärung (15.10.2026)

Umgesetzt auf ausdrücklichen PO-Auftrag; die laufende Erprobung mit Kollegen
bleibt unverändert:

- **Tour speichern:** Erfolg erst nach bestätigtem Schreibvorgang. Bei
  Speicherfehler oder gesperrtem Tresor bleiben Planung, Name und bisherige
  gespeicherte Touren erhalten; Fehlermeldung mit Wiederholen-/Export-Hinweis.
  Dasselbe gilt für das Löschen einer gespeicherten Tour.
- **Optimieren:** Eine neue Reihenfolge wird nur übernommen, wenn sie nach
  derselben Luftlinienbewertung einschließlich Ziel/Rückweg kürzer ist.
  Keine irreführende „bereits optimal“-Meldung mehr. Der Review-Gegenfall
  (113,0 statt verschlechterter 118,8 km) bleibt unverändert.
- **Tresor:** Datenschutz-FAQ in DE/EN/FR/ES, Datenschutzseite, README und
  Wissensbasis nennen den tatsächlichen Schutzumfang einschließlich Adress-Cache,
  gespeicherter Touren und Simulations-Szenarien sowie die Grenzen.
- **Absicherung:** Regressionstests für Speichererfolg, Schreibfehler,
  gesperrten Tresor, Wiederholen, Überschreiben/Löschen und nicht verschlechternde
  Optimierung; konkrete UI-Prüfschritte im PR. Kein weiterer Funktionsausbau.

### Nachprüfung: Touren mit „&amp;“-Kunden (16.10.2026)

Fehler aus #427 behoben: Bei Kunden ohne Kundennummer gehört der Name zum
Schlüssel gespeicherter Touren. Touren, die vor der Namensbereinigung
gespeichert wurden, trugen noch „&amp;“ im Schlüssel – nach dem Update fiel der
Kunde beim Laden aus der Tour („1 nicht mehr vorhandene Kunden ausgelassen“).
Der Schlüsselvergleich bereinigt den Namen jetzt auf beiden Seiten; die Tour
bleibt vollständig, auch nach Reimport. Regressionstest in `tests/savedTourKeys.test.js`.

Dasselbe für **Simulations-Szenarien** (16.10.2026): Sie speichern bewusst nur
Kunden-IDs. Nach einem Reimport bekommt ein solcher Kunde ohne Kundennummer
eine neue ID (aus dem bereinigten Namen); das Szenario meldete ihn als „gibt es
nicht mehr“ und ließ ihn beim Laden weg. Laden und Vergleichen ordnen alte IDs
jetzt über die bereinigte Schreibweise zu (`scenarioForCustomers`); das
gespeicherte Szenario bleibt unverändert. Tests in
`tests/simulationScenarios.test.js`. Größenbudget `index.js` (roh) dafür um
1 KB erhöht: Der Spielraum vom 11.10. war durch die Fehlerbehebungen seither
aufgebraucht (Release 17.0c: Erhöhung nur mit Begründung).

### Nutzer-Feedback: HTML-Reste in der Kundenkachel (16.10.2026)

In der Kachel stand unter „Zuständig · Account Manager“ und beim Account
wörtlich `<span style="white-space: nowrap;">Ute, Sander </span>`: Der
CRM-Bericht liefert Zellen mit HTML-Auszeichnung. Behoben: Import und Laden
entfernen bekannte HTML-Tags (span, b, br, div …) aus allen Texten des Kunden –
IDs bleiben unverändert, gespeicherte Bestände werden einmal bereinigt neu
gespeichert. Gleiche Stelle wie die „&amp;“-Bereinigung aus #427
(`src/features/customerName.js`); bei Kunden ohne Kundennummer ordnen
Touren und Szenarien über den bereinigten Namen zu. Echte spitze Klammern
(„Schmitt <KG>“) bleiben. Tests in `tests/customerName.test.js`.

Nachtrag (16.10.2026, zweiter Screenshot): Beim Account standen noch
`<hr style="…">`-Trennlinien – das CRM schreibt mehrere Werte in ein Feld
(„Musterchemie AG (RC-DE)“ und „Musterchemie Global“, „Regional“ und
„Corporate“). `<hr>` und `<li>` werden jetzt zu „ / “, Tabellenzellen zu
Leerzeichen. Größenbudget `index.js` (roh) dafür nochmals um 1 KB erhöht
(Release 17.0c, Begründung im Budget-Hinweis).

### Nutzer-Feedback: Nur bunte Bezirksflächen, ohne Kacheln (19.10.2026)

Wunsch aus der Gebietsarbeit: die Karte nur mit den farbigen
Vertriebsbezirken, ohne die Bezirkskacheln (Name, Kundenzahl, Umsatz) – etwa
für einen ruhigen Überblick oder einen Screenshot. Umgesetzt als Häkchen
**„Bezirkskacheln auf der Karte zeigen"** im Tab Gebiete unter „Anzeige“
(Standard: an, gemerkt). Kein neuer Modus, keine neue Verbindung; Live-Demos
zeigen die Kacheln weiterhin. Abgesichert durch einen Schritt in
`tools/smoke-check.mjs` (aus → keine Kacheln, Flächen bleiben, nach Neuladen
gemerkt, wieder an).

### PO-Wunsch: Promotoren mit TPE-Thema aus der Zuständigkeitsliste (19.10.2026)

Promotoren (Promotion-Kollegen, organisiert nach 3-stelligen PLZ) sollen ihre
Kunden auf der Karte sehen; je Kunde gibt es mehrere Promotoren mit je einem
TPE-Thema (Technologie-Portfolio-Element). Entscheidung: keine eigene Option à
la GeoFuchs und kein zweiter Knopf – die vorhandenen Promotoren („📣
Promotoren", Filter „Promotor" / „Promotor-Thema", Briefing) bekommen eine
zweite Quelle: nummerierte Spaltenpaare **„Promotor N" / „Promotor N
TPE-Thema"** in Kunden- oder Zuständigkeitsliste, beliebig viele. Die Zuordnung
PLZ-3 → Promotor macht die Liste selbst (z. B. per SVERWEIS). Reimport mit den
Spalten ersetzt die Spalten-Promotoren, Kontaktlisten-Promotoren bleiben.
Telefon/E-Mail vorerst nicht. Größenbudget `index.js` roh und gzip um je 1 KB
erhöht. Offen bleibt: Promotor-Flächen einfärben (Stufe 2) – nicht geplant.
Liefervorlage für die Promotion-Kollegen (PLZ-3 → Promotor + TPE-Thema, per
Formel auf die Kundenliste): `docs/vorlagen/TourFuchs_Promotoren_Vorlage.xlsx`
(gemerkt 20.10.2026, nicht in der App ausgeliefert).

### Nutzer-Feedback: Kundensuche „loew" (19.10.2026)

Meldung: Mit „loew" war „GEBR. LOEW GMBH & CO. KG" nicht zu finden. Mit
genau dieser Eingabe ließ es sich nicht nachstellen; gefunden und behoben
wurden drei Lücken, die zum Befund passen: (1) Die Kundensuche kannte nur die
abgestreifte Umlaut-Schreibweise – „Löw" fand „LOEW" nicht (die Ortssuche
konnte das längst). (2) Unsichtbare Zeichen aus CRM-Exporten (weiches
Trennzeichen, Nullbreite) zerteilten Namen. (3) Ohne Rangfolge entschied bei
knappem Platz (4 Kunden neben Ortsvorschlägen) die Bestandsreihenfolge. Jetzt:
beide Umlaut-Schreibweisen, Satzzeichen egal, Rangfolge Kundennummer →
Namensanfang → Wortanfang → im Wort → Ort/PLZ. Gleich schnell wie vorher
(≈ 15–30 ms bei 15.000 Kunden), Größenbudget eingehalten.

Nachtrag (19.10.2026, zweite Meldung): „loew" fand die Firma weiterhin nicht –
„KUNDEN (4 VON 24)", vorn „LÖWENHOF MUSTERSTADT" und „MEYER & LOEWEN".
Ursache: Namensanfang („Löwenhof") stand vor Wortanfang, und es gibt nur 4
Plätze. Jetzt zählt das **ganze Wort** zuerst: ganzes Wort am Namensanfang →
ganzes Wort → Namensanfang → Wortanfang → im Wort → Ort/PLZ.

Zugleich PO-Wunsch: Kundennamen aus dem CRM stehen durchgehend in
Großbuchstaben – auch in der Kundennummer-Kopie. Jetzt beim Import und Laden
lesbar geschrieben („Gebr. Loew GmbH & Co. KG"): Rechtsformen und kleine
Wörter nach Liste, Kürzel bis drei Buchstaben und Wörter mit Ziffern bleiben,
gemischt geschriebene Namen unverändert. IDs und Tour-Schlüssel hängen am
kleingeschriebenen Namen und ändern sich nicht. Größenbudget `index.js` roh
und gzip um je 2 KB erhöht (Release 17.0c, Begründung im Budget-Hinweis).

### PO-Entscheidung: Live-Demo dort, wo der Schritt ansteht (19.10.2026)

Anstoß: In Familienkreis zeigen leere Bereiche einen Link zum passenden
Kurzfilm. Geprüft für TourFuchs: Die Technik gibt es schon (Erste Schritte am
Handy, „Eigene Daten laden“); am Desktop fehlte seit dem Wegfall der Checkliste
(09.10.) jeder Weg vom Schritt zur Demo außer „Live-Demos“ oben rechts.
Entscheidung: **ja, sparsam** – nur zwei Stellen, an denen ein Neuling sicher
vorbeikommt und eine Demo genau diesen Schritt zeigt: leere Tour („Deine Tour,
Schritt für Schritt“) und Tresor einrichten („Deine Daten im Tresor“). Der Link
verschwindet, sobald der Schritt getan ist (Haken der Ersten Schritte), damit
er im Alltag keinen Platz kostet; während einer Demo ist er aus. Bewusst
nicht: QR-Übergabe (der Dialog *ist* der Schritt), Gebiets- und Service-Demos
(seltene Module, Nische zuerst). Wortlaut wie beim Import: „▶ Wie geht das?
Live-Demo ansehen“ – keine neuen Übersetzungen.


### Konzept: Besuche zwischen Handy und Desktop, Besuchsübersicht (20.10.2026)

Feedback: Handy und Desktop laufen auseinander – Besuche stehen auf dem Handy,
nicht auf dem Desktop; gewünscht ist eine druck- und exportierbare Übersicht
der Besuche mit Infos. Befund: Der Rückweg Handy → Desktop existiert
(„📤 Besuche weitergeben" → am Desktop öffnen, trägt nur Besuche nach), ist aber
schwer zu finden; beim `.tfsafe`-Empfang gehen noch nicht weitergegebene
Besuche des Zielgeräts verloren (Fehler). Konzept mit vier Stufen (Fehler
beheben, Rückweg sichtbar, „Meine Besuche" drucken/Excel, Notiz zum Besuch),
Leitplanken und offenen PO-Entscheidungen:
[`docs/konzept-besuche-abgleich.md`](konzept-besuche-abgleich.md).

Sofort behoben (20.10.2026, PO: „📤 Besuche weitergeben finde ich nicht"): Am
Handy gibt es mit Daten nur das Tour-Blatt; der Knopf lag in „3. Meine Tour"
(bei leerer Tour zugeklappt) und dort im zugeklappten „Teilen & Exportieren".
Jetzt steht er direkt unter „📷 Tour per QR übernehmen", sobald es neue Besuche
gibt. Mitbehoben: Besuche aus einer empfangenen `.tfsafe`-Datei zählten als
„noch weiterzugeben" (z. B. „Letzter Besuch" aus dem CRM). Abgesichert in
`tests/tourActions.test.js` und im smoke-check (neuer Schritt, schlägt auf dem
alten Stand an).

Umsetzung am 20.10.2026 (PO: „A und B umsetzen"): **A** – beim Empfang einer
`.tfsafe`-Datei werden die Besuche des Geräts mit denen der Datei vereinigt
statt ersetzt; das Bestätigungsfenster sagt das. **B** – „🔄 Abgleichen" auf
Handy und Desktop: Abgleich-Datei mit den Besuchen seit dem letzten Abgleich
senden bzw. öffnen, nur ergänzen; die Datei enthält nur Prüfsummen und Daten
(Abweichung von der Vorlage: kein Koppeln, dafür Pseudonymisierung statt
Verschlüsselung, siehe Konzept Abschnitt 7; vom PO am 23.10.2026 bestätigt:
„Pseudonymisiert passt, so lassen.“). Am Handy ersetzt „🔄 Abgleichen"
den Knopf „📤 Besuche weitergeben" im Tour-Blatt; der Besuchsbericht bleibt im
Fenster und im Feierabend-Rückblick. Größenbudget `index.js` roh +5 KB, gzip
+1 KB, `index.css` gzip +1 KB.


### PLZ-Zuständigkeit und Firmenlink (22.10.2026, umgesetzt)

Nutzerauftrag für Vertriebsassistenz und Neukundenanlage: eigene Auskunft ab
3 PLZ-Ziffern, Verfeinerung mit 4/5 Ziffern, führende Nullen, ungefilterter
Bestand. VBZ/Account Manager mit Kundenzahl, Umsatz, vorhandener Telefonnummer
und Teams-UPN; Zuordnung kopierbar. Alphabetische Ausgabe, keine Rangliste.
Explizite PLZ-Regeln separat, keine automatische Neukundenentscheidung.
Optionaler lokal konfigurierter HTTPS-Firmenlink mit DUVE-Vorlage neben SieSales,
nur auf Klick. Keine neue Laufzeitabhängigkeit. Guide 3.25 und Schulungen
nachgezogen. Externe Übergaben in README/Datenschutz erklärt; interner
DUVE-Zugriff bleibt ein Praxischeck im berechtigten Firmenbrowser.

### Kundennummer separat kopieren (22.10.2026, umgesetzt)

Kollegenwunsch: **⧉ Nur Nummer** steht neben dem bisherigen Kundennummer-Knopf
in derselben Zeile. Kopiert exakt die angezeigte Nummer ohne Name/Klammern,
einschließlich führender Nullen. Bisheriges Format `Kundenname [Nummer]`
unverändert. DE/EN/FR/ES, Erfolgs-/Fehler-Rückmeldung, Unit- und Browserprüfung.


### Praxisfeedback: DUVE, Kopierknöpfe und VBZ-Profil (22.10.2026, umgesetzt)

DUVE erscheint automatisch nur bei eigenen Kunden mit gültigem SieSales-Link
und Kundennummer; lokale Zieländerung und dauerhaftes Ausblenden bleiben möglich.
Kopierknöpfe eindeutig: „Nr. …“ kopiert nur die Nummer, „Name + Nr.“ das bisherige
Format. Die PLZ-Auskunft zeigt Vertriebsgruppe und häufigste Kundenart anhand
aller geladenen Kunden desselben VBZ und derselben Vertriebsgruppe. Anteile,
Gleichstände und fehlende Angaben sichtbar; keine Firmenkürzel-Tabelle.
Guide 3.26, Schulungen und externe Übergaben aktualisiert. Unit-, Browser- und
mobile Sichtprüfung gehören zur Freigabe.

### DUVE gezielt als Vorgangssuche öffnen (22.10.2026, umgesetzt)

Korrektur aus Nutzerfeedback: Die Adresse verwendet `clusterType=case`, exakt
wie im bestätigten Beispiel, mit der jeweiligen Kundennummer in `searchTerm`.
Die bisher mitgelieferte unveränderte DUVE-Vorlage wird auch aus lokal
gespeicherten Einstellungen automatisch korrigiert. Eigene andere Vorlagen
und die Deaktivierung bleiben erhalten. Guide 3.27, PDF und Uploadkopien
nachgezogen; exakter Beispiel-Link und bestehende Vorlagen abgesichert.

### Hosting: Vercel Pro für die Erprobung (23.10.2026)

Anlass: Die Rechtsabteilung prüft TourFuchs und fragte nach der Rolle von
Vercel (SaaS? KI-Training? Vertrag?). Antwort: Vercel liefert nur die
statischen Programmdateien aus, Kundendaten erreichen Vercel nie. Befund beim
Prüfen der Vercel-Unterlagen: Der kostenlose Hobby-Tarif ist nur für
nicht-gewerbliche Nutzung erlaubt, Vercels Auftragsverarbeitungsvertrag (DPA)
gilt erst ab Pro. **PO-Entscheidung:** für die Dauer der Erprobung Pro
(20 US-Dollar/Monat, monatlich kündbar), danach Umzug in den Konzern oder
Abschalten. GitHub Pages als Zwischenlösung verworfen (Tester-Daten an die
Web-Adresse gebunden, Zählung entfiele, zweiter Umzug). Datenschutzerklärung 4a
nennt den DPA. Details: [Nutzungsnachweis](nutzungsnachweis.md).


### Öffentliches Repo ohne echte Daten (23.10.2026)

Anlass: Bei der Frage der Rechtsabteilung nach GitHub fiel auf, dass beim
Beheben von Nutzer-Feedback echte Bruchstücke aus CRM-Exporten im Repo
gelandet waren – in Tests, Code-Kommentaren, Wissensbasis, Roadmap und
Commit-Texten (Firmennamen, Kundennummern, ein Vertriebsbezirk, zwei Namen mit
Handynummer). **PO-Entscheidung:** Das Repo bleibt öffentlich – Transparenz
ist Absicht, jeder soll den Code prüfen können. Dafür gilt: keine echten Daten,
nirgends. Umgesetzt: alles durch erfundene Daten ersetzt, die dasselbe prüfen
(z. B. die Umlaut-Suche „loew" ↔ „Löw" statt des echten Falls), Wissensbasis-PDF
neu erzeugt, Regel in `AGENTS.md`, neuer Test `tests/noRealData.test.js`
(lässt nur erfundene Handynummern zu). Danach die Git-Historie mit denselben
Ersetzungen umgeschrieben und alle Commit-Adressen des PO auf die öffentliche
Kontaktadresse tourfuchs@online.de gestellt (statt Firmen-, privater Mail- und
Rechneradresse); Restbestände auf alten PR-Seiten entfernt nur der
GitHub-Support (Antrag durch den PO).

### Nutzer-Feedback: Auftragseingang statt Umsatz (23.10.2026)

Meldung des PO: Die eingelesenen Zahlen je Geschäftsjahr sind Auftragseingang
(AE), nicht Umsatz. Besonders heikel im KI-Briefing: „Umsatz nach Geschäftsjahr"
lässt den Assistenten auf Rechnungen und Zahlungen schließen. **PO-Entscheidung:**
Die Bezeichnung folgt der eingelesenen Spalte – `AE …`, `Auftragseingang …`,
`Orders …` → überall „Auftragseingang" (eng: „AE"), sonst weiter „Umsatz"
(andere Nutzer, Beispieldaten, Live-Demos). Gemerkt am Kunden (`umsatzArt`), reist
mit Speicher, Tresor, Umzugsdatei und Reimport. Das Briefing sagt der KI
ausdrücklich „Auftragseingang, nicht Umsatz". Gerechnet wird wie vorher. Tests:
`tests/revenueTerm.test.js`; die Übergabeliste der Vertriebs-Arbeitsmappe
(„Orders FY26") heißt jetzt „Auftragseingang (jüngstes GJ)".
