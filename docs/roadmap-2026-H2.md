# 🦊 TourFuchs Vertrieb – Produkt-Roadmap H2/2026

**Stand:** 25.07.2026 · **Rolle:** Product Owner · **Status:** verbindliche Arbeitsgrundlage

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

### Release 3 – „Entscheidungsvorlage" · **WOW-Feature #2** *(~2 Wochen)*

Ziel: Moment B zu Ende denken. Die Simulation (PRs #44–#48) ist stark, aber ihr
Ergebnis „verpufft" im Dialog.

| # | Item | Akzeptanzkriterien |
|---|---|---|
| 3.1 | **Simulations-Report exportieren** | Ein Klick erzeugt aus der aktiven Simulation eine druckfertige Vorlage (HTML-Druckansicht → PDF): Kartenbild Alt/Neu, Kennzahlen-Tabelle je Bezirk (Kunden, Umsatz, Delta), Fairness-Kennzahl vorher/nachher, Aktionsliste. Zusätzlich Excel-Export der Umbuchungsliste. |
| 3.2 | **Ausgewogenheits-Assistent** | Button „Vorschlag: ausgleichen": Greedy-Heuristik schlägt Gebietsverschiebungen vor, die den Kunden-/Umsatz-Faktor Richtung ≤ 1,5 senken – als Simulation, die der Nutzer prüft, editiert, verwirft oder übernimmt. Keine Blackbox: jede vorgeschlagene Verschiebung ist einzeln begründet (Gebiet, Kunden, Umsatz). |
| 3.3 | **Benannte Simulations-Szenarien** | Simulation als Szenario speichern/laden (IndexedDB), z. B. „Variante Nord" vs. „Variante Süd" vergleichbar. |

### Release 4 – „Tresor" · High-End-Sicherheit *(~3 Wochen, nach Release 3)*

Ziel: Echte Kundendaten dürfen bedenkenlos auf dem privaten Handy liegen.
Verschlüsselung **at rest** und **in transit** – ohne das Lokal-first-Prinzip zu brechen.

| # | Item | Akzeptanzkriterien |
|---|---|---|
| 4.1 | **Lokaler App-Tresor (Data at Rest)** | Optional aktivierbar. Kundendaten in IndexedDB mit AES-256-GCM verschlüsselt; Schlüssel wird aus einer PIN abgeleitet (PBKDF2/Argon2, hohe Iterationszahl) und **nie gespeichert**. Sperrbildschirm beim App-Start und nach Inaktivität. Ohne PIN sind die Daten kryptografisch unlesbar. |
| 4.2 | **Biometrie-Unlock (Komfortstufe)** | Wo verfügbar (WebAuthn mit PRF-/largeBlob-Erweiterung) FaceID/Fingerabdruck statt PIN. Realistische Grenze: plattformabhängig, v. a. iOS-PWA eingeschränkt – **PIN bleibt der garantierte Weg**, Biometrie ist Zusatz, kein Ersatz. |
| 4.3 | **Auto-Wipe** | Nach N Fehlversuchen (konfigurierbar, Standard 10) werden die lokalen Daten gelöscht. Ehrliche Einordnung im UI: Abschreckung, kein Hardware-Schutz – der eigentliche Schutz ist die Verschlüsselung aus 4.1. |
| 4.4 | **Verschlüsselter Export mit QR-Schlüssel (Data in Transit)** | Datei-Export (Excel/JSON) optional AES-256-verschlüsselt; der Schlüssel wird **nicht** mit der Datei transportiert, sondern als QR-Code am Desktop angezeigt (Out-of-Band). Handy: Datei öffnen + QR scannen = lokal entschlüsselt. Datei allein (E-Mail, USB, Cloud) ist wertlos. |

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

### Nächste Kandidaten (bewertet, noch nicht terminiert)

1. **Weißfleck-Finder:** Gebiete mit Kunden, aber ohne Besuch seit N Monaten.
   Nutzt `visits.js` + `territory.js`, beides vorhanden.
2. **Vorher/Nachher-Slider über der Karte** (zieht aus Release 3 den Teil vor,
   der im Management-Meeting wirklich überzeugt).
3. **Haltbarkeit der lokalen Daten:** `navigator.storage.persist()` anfordern,
   Status ehrlich anzeigen, an Sicherung erinnern. Lokal-first ist nur dann ein
   Vorteil und kein Risiko, wenn dieser Punkt sichtbar beantwortet ist.
4. **Korridor-Modus als eigene Frage:** „Ich muss nach Hamburg – wen nehme ich
   mit?" Die Technik liegt bereits im OSRM-Korridor.

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

---

## 4. Erfolgsmessung (ohne Tracking – Selbsttest-Kriterien)

- **Moment A:** Vom App-Start bis zur startklaren Tagestour ≤ 30 s, ≤ 3 Interaktionen.
- **Moment B:** Von „Cockpit öffnen" bis exportierter Entscheidungsvorlage ≤ 10 min.
- **Vertrauen:** Jeder Satz auf der Datenschutzseite ist im Code nachweisbar wahr.
