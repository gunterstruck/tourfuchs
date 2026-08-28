# TourFuchs Vertrieb - Kurzanleitung

Stand: 09.08.2026 · App-Version 3.3.0

## 1. App starten

TourFuchs im Browser oder als installierte PWA öffnen.

Wichtig:

- Desktop: Daten, Gebiete, Cockpit, Simulation
- Smartphone: Karte und Tour

## 2. Daten laden

1. Tab Daten öffnen.
2. Excel-Liste hochladen.
3. Spaltenzuordnung prüfen.
4. Importieren.
5. Import-Ergebnis kontrollieren.

Pflichtfelder:

- Kundenname
- PLZ oder vorhandene Koordinaten

Der Vertriebsbezirk ist empfohlen. Ohne ihn läuft der Kunde unter „Ohne Zuordnung".

![Spaltenzuordnung mit synthetischen Beispieldaten](../public/docs/screenshots/BILD-IMPORT-03-spalten-zuordnen.png)

*BILD-IMPORT-03 - Zuordnungen und Beispielwerte prüfen, dann „Importieren".*

## 3. Karte nutzen

- Suche oben für Kunde, Ort, PLZ oder Kundennummer.
- Marker anklicken, um Kundendetails zu sehen.
- Kartenstil wechseln: Hell, Standard oder Satellit.
- Im Gebietsmodus Flächen nach Vertriebsbezirk oder Vertriebsgruppe einfärben.

## 4. Lasso und Gebiets-Briefing

> Eine Geste um eine reale Region wird zur Auswahl mehrerer Kunden; TourFuchs
> erstellt daraus ein strukturiertes Gebiets-Briefing für den internen
> KI-Assistenten des Nutzers.

![Karte mit dem Bedienelement Lasso ziehen](../public/docs/screenshots/BILD-LASSO-01-kartenansicht-mit-lasso.png)

*BILD-LASSO-01 - Auf der Karte „Lasso ziehen" wählen.*

1. `Karte -> „Lasso ziehen"`.
2. Fläche mit Finger oder Maus umfahren und loslassen.
3. Treffer in der Auswahlkarte prüfen.
4. **„Briefing über alle"** wählen.
5. Im Gebiets-Briefing den vollständigen Prompt prüfen.
6. Prompt kopieren und Assistent öffnen; dort selbst einfügen, prüfen und senden.

![Auswahlkarte mit Briefing über alle](../public/docs/screenshots/BILD-LASSO-04-auswahlkarte.png)

*BILD-LASSO-04 - Das Lasso erzeugt nur die Auswahl; erst dieser Knopf öffnet die Prompt-Vorbereitung.*

![Gebiets-Briefing mit sichtbarer Prompt-Vorschau](../public/docs/screenshots/BILD-LASSO-05-gebietsbriefing-prompt.png)

*BILD-LASSO-05 - Der Prompt entsteht lokal im Briefing und ist vor dem Kopieren lesbar.*

Wichtig:

- „Briefing über alle" erscheint ab mindestens zwei echten Kunden.
- Bei einem Kunden dessen Marker öffnen und „Briefing" wählen.
- Für reine Demo-Kunden gibt es keinen echten Prompt und keinen Assistenten-Start.
- Ein Popup-Blocker kann das Öffnen verhindern; der Prompt kann trotzdem in der Zwischenablage liegen.

## 4a. Basis und Profi beim Briefing

- **Basis:** festes Ziel Microsoft 365 Copilot.
- **Profi:** „Ziel: … · Anderen Assistenten wählen" im Kundenbriefing; die Wahl gilt auch für das Gebiets-Briefing.

![Profi-Briefing mit aufgeklappter Assistentenauswahl](../public/docs/screenshots/BILD-LASSO-08-assistentenauswahl.png)

*BILD-LASSO-08 - Copilot, Gemini, ChatGPT oder eigener HTTPS-Assistent; TourFuchs sendet nichts selbst.*

## 5. Gebiets-Cockpit

1. Modus Gebietsplanung wählen.
2. Tab Gebiete öffnen.
3. Gebiets-Cockpit öffnen.
4. KPI-Karten lesen:
   - Status
   - Top-Bezirk
   - Schwächster Bezirk
5. Tabelle lesen:
   - Standard: Top & Flop 3
   - Balken: relative Stärke zum stärksten sichtbaren Wert
   - Alle anzeigen: vollständige Liste

## 6. Was-wäre-wenn-Simulation

1. Ebene wählen, zum Beispiel Landkreise.
2. Gebiet suchen oder auswählen.
3. Ziel-Bezirk wählen.
4. Auswahl zuweisen.
5. Ergebnis prüfen.
6. Entweder Zuweisung übernehmen oder Simulation zurücksetzen.

Merksatz:

> Erst Zuweisung übernehmen schreibt dauerhaft.

## 7. Tour planen

Der Tourplaner öffnet zuerst als Übersicht: die drei Schritte **Startpunkt ·
Vorschläge · Meine Tour** eingeklappt. Ein Tipp auf einen Schritt zoomt hinein
(volle Fläche), „☰ Übersicht" führt zurück – auf Handy wie Desktop.

1. Modus Außendienst wählen.
2. Tab Tour öffnen. Unterwegs (Handy, Tablet hochkant) entfällt dieser Schritt:
   Dort ist die Tour der einzige Bereich – Blatt aufziehen genügt.
3. Startpunkt setzen. (Geplant wird über **alle Vertriebsbezirke** – nur wer
   einschränken will, tippt auf die Zeile „🗺️ Bezirk: Alle Bezirke · ändern ▸".)
4. Kunden im Umkreis oder entlang der Tour anzeigen.
5. Kunden zur Tour hinzufügen.
6. Reihenfolge optimieren.
7. Route anzeigen oder an Google Maps übergeben.

![Tour-Reiter mit Startpunkt, Vorschlägen und Meine Tour](../public/docs/screenshots/BILD-TOUR-01-tourplanung.png)

*BILD-TOUR-01 - Tourplanung erfolgt bewusst in drei Schritten.*

## 8. Mobile Nutzung

Auf dem Smartphone stehen Karte und Tour im Mittelpunkt.

- Bottom Sheet hochziehen oder minimieren; „Tour" zieht das Blatt ganz auf.
- Kunden antippen, um Details zu sehen.
- Tour zusammenstellen und navigieren.
- Die Tour ist ein Akkordeon aus **Startpunkt · Vorschläge · Meine Tour** –
  genau eine Gruppe ist offen und folgt dem Arbeitsfluss.
- Ein kleiner schwebender **Fuchs-Knopf** schlägt den nächsten Schritt vor:
  📍 Kunden in der Nähe → 🚩 Tour ab hier planen → 🗺️ Route auf die Karte.
- In **Meine Tour** sind die Stopps kompakte Ein-Zeilen-Karten mit grüner
  Tourlinie; Reihenfolge per **Halten & Ziehen** ändern.
- Eine eingeblendete Android/iOS-**System-Navigationsleiste** verdeckt das Blatt
  nicht mehr – Hinweise und Bedienelemente liegen darüber.

Gebietsmanagement und Service-Vertragsradar sind optionale Module. Sie werden
am Desktop unter **Profi → Optionale Profi-Module** einzeln aktiviert.

Karte, Kunden, Briefing und Tour bleiben der normale Basis-Ablauf. Komplexe
Gebietsplanung bitte am Desktop durchführen.

![Mobile Lasso-Auswahl mit vollständig sichtbaren Abschlussaktionen](../public/docs/screenshots/BILD-LASSO-MOBIL-03-auswahlkarte.png)

*BILD-LASSO-MOBIL-03 - Lasso und „Briefing über alle" funktionieren auch in der Smartphone-Kartenansicht.*

## 9. Warum die Oberfläche „aufräumt"

TourFuchs hält die Arbeitsfläche bewusst frei. Zwei Dinge, die auffallen und
kein Fehler sind:

- **Langes startet zugeklappt.** Der vollständige Briefing-Prompt, „Weitere
  Felder" bei der Spaltenzuordnung, der Datentresor: Die Kopfzeile sagt, was
  drinsteckt, ein Klick zoomt hinein. Nichts ist weg – nur einen Klick entfernt.
- **Angebote treten beim Arbeiten zurück.** Sobald Sie im Panel nach unten
  scrollen, weichen Kartenstil-Wähler und Beispieldaten-Streifen, und die
  „Erste Schritte"-Checkliste schrumpft auf eine Zeile. Wieder hochscrollen holt
  sie zurück, ein Tab- oder Moduswechsel ebenfalls; die Checkliste kommt mit
  einem Klick auf die Zeile zurück.

Auf Tabs mit wenig Inhalt bleibt alles stehen – dort wäre nichts gewonnen.

## 10. Datenschutz

- Kundendaten bleiben lokal im Browser.
- OSM-Geocoding sendet nur Adresse, PLZ und Ort.
- Google Maps erhält Daten erst bei bewusster Übergabe.
- Beim Briefing erzeugt und kopiert TourFuchs den Prompt lokal. Übertragen wird
  er erst, wenn der Nutzer ihn im Assistenten selbst einfügt und absendet.
- Vor Daten löschen bei Bedarf Excel-Export erstellen.

![Daten-Reiter mit Export und vollständigem Ersatzweg](../public/docs/screenshots/BILD-DATEN-01-export-vor-ersatz.png)

*BILD-DATEN-01 - Vor „Andere Excel- oder CSV-Liste laden" oder „Daten löschen" bei Bedarf „Als Excel exportieren".*

## 11. Häufige Probleme

### Keine Kunden sichtbar

- Filter prüfen.
- Bezirk prüfen.
- PLZ-Spalte prüfen.
- Karte herauszoomen.

### Keine Tourvorschläge

- Startpunkt setzen.
- Radius erhöhen.
- Bezirk prüfen.

### Alter PWA-Name

- Alte PWA entfernen.
- Seite neu laden.
- App neu installieren.
