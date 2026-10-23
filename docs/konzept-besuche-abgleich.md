# Konzept: Besuche zwischen Handy und Desktop – und eine Besuchsübersicht

**Stand:** 20.10.2026 · **Rolle:** Product Owner · **Status:** Teilweise umgesetzt. Am 20.10.2026 gebaut: sichtbarer Rückweg am Handy (#439), **Stufe 1** (Besuche beim `.tfsafe`-Empfang zusammenführen) und der **Abgleich-Knopf** („🔄 Abgleichen“, Weg B der Entscheidungsvorlage, Abschnitt 7). Stufen 3 und 4 bleiben zurückgestellt (PO 20.10.2026), Auslöser siehe Roadmap „Offene Themen mit Auslöser“.

---

## 1. Anlass

Feedback: „Die Datenbanken von Desktop und Handy laufen auseinander – der Besuch
ist auf dem Handy dokumentiert, aber nicht auf dem Desktop." Das Ziel dahinter
ist eine **Übersicht zum Drucken oder Exportieren**: wo welche Besuche
stattgefunden haben, gegebenenfalls mit Infos dazu.

## 2. Was es heute schon gibt (Befund aus dem Code)

| Baustein | Stand | Fundstelle |
|---|---|---|
| **Besuch** | nur ein Datum je Kunde (`customer.besuche = ['2026-10-20', …]`); keine Notiz, kein Ergebnis, keine Uhrzeit | `src/features/visits.js` |
| **Erfassen** | „✓ Heute" an einem Stopp, Tippen auf den Tour-Punkt (Handy), Kundenkarte | `tourPanel.js`, `map.js` |
| **Handy → Desktop** | ✅ vorhanden: **„📤 Besuche weitergeben"** erzeugt eine Excel-Datei (eine Zeile je Besuch). Am Desktop über „Eigene Daten laden" öffnen: TourFuchs erkennt den Besuchsbericht und **trägt nur die Besuche nach** (Kundennummer, additiv, nichts anderes ändert sich). | `visitReport.js`, `importWizard.js`; Guide 10.10.2 |
| **Desktop → Handy** | `.tfsafe`-Datei (ganzer Bestand, verschlüsselt) oder QR-Tour (nur Stopps, ohne Besuche) | `safeTransfer.js`, `tourShare.js` |
| **Reimport der Kundenliste** | bisherige Besuche bleiben (Vereinigung über Kundennummer bzw. Name + PLZ) | `carryOverVisits` in `datasetDiff.js` |
| **Ausgaben** | Kunden-Excel mit „Letzter Besuch", „Anzahl Besuche", „Alle Besuche"; Besuchsbericht (Excel); Feierabend-Rückblick als Text; Tagesplan-Druck nur mit letztem Besuch | `excel.js`, `dayReview.js`, `tourExport.js` |

**Zwei Lücken:**

1. **Der Rückweg ist da, aber war am Handy nicht zu finden** (PO-Prüfung
   20.10.2026: „finde ich nicht"). Am Handy gibt es mit Daten nur das
   Tour-Blatt (kein Daten-Tab); „📤 Besuche weitergeben" lag dort in „3. Meine
   Tour" im zugeklappten „Teilen & Exportieren" – und „3. Meine Tour" ist bei
   leerer Tour selbst zu. **Behoben 20.10.2026** (Teil von Stufe 2): Der Knopf
   steht im Tour-Blatt direkt unter „📷 Tour per QR übernehmen", sobald es neue
   Besuche gibt – Hin- und Rückweg nebeneinander. Dabei mitbehoben: Besuche
   aus einer empfangenen `.tfsafe`-Datei zählten als „noch weiterzugeben".
2. **Datenverlust beim Senden aufs Handy.** Empfängt das Handy eine neue
   `.tfsafe`-Datei vom Desktop, ersetzt sie den ganzen Bestand
   (`replaceCustomers`). Besuche, die auf dem Handy erfasst, aber noch nicht
   weitergegeben wurden, sind dann **weg**. Das Bestätigungsfenster warnt
   allgemein („nicht enthaltene Besuchs- … daten werden entfernt"), doch dem
   Außendienstler ist in dem Moment kaum klar, dass er seine eigenen Besuche
   von gestern verliert. Das ist ein Fehler, keine Funktionslücke.

Außerdem gibt es keine **Info zum Besuch** und keine **druckbare Übersicht**.

## 3. Leitplanken aus unserer Philosophie

Jeder Baustein muss diese Prüfung bestehen (`AGENTS.md`, `docs/positionierung.md`,
`docs/gestaltprinzip-aufmerksamkeit.md`):

- **Kein Sync-Server, keine Cloud.** Rote Linie 2: „Cloud-Synchronisation von
  Touren, Besuchen oder Tageslogs". Abgleich heißt bei uns: Der Nutzer
  **trägt eine Datei** von einem Gerät zum anderen, über die Wege seiner
  Organisation (Mail, Teams, OneDrive).
- **Jeder Abgleich ist eine bewusste Handlung.** Nichts läuft im Hintergrund,
  nichts wird automatisch gesendet (rote Linie 6: keine automatischen
  CRM-Schreibvorgänge).
- **Die Übersicht gehört dem Außendienstler.** Sie ist sein Notizbuch und sein
  Wochenbericht. Es gibt keine Manageransicht, kein Ranking und keine
  Aktivitätsquote (rote Linien 4 und 5). Weitergeben entscheidet er, wie heute
  beim Besuchsbericht.
- **Keine Telemetrie.** Rote Linie 7: kein Ereignis „Kunde besucht". Die
  anonyme Seitenzählung bleibt, wie sie ist (`docs/nutzungsnachweis.md`).
- **Das CRM bleibt führend.** TourFuchs hilft, Besuche dorthin zu bringen, und
  ersetzt es nicht.
- **Nische zuerst.** Die Frage lautet: „Hilft das unseren 10 Außendienstlern?"
  Ja – „Was habe ich diese Woche bei wem gemacht?" ist ihre Freitagsfrage.
- **Aufmerksamkeit.** Neue Elemente erscheinen erst, wenn sie gebraucht werden.

## 4. Die Bausteine

### A. Kein Verlust beim Empfang aufs Handy *(Fehlerbehebung)*

Beim Übernehmen einer `.tfsafe`-Datei werden die Besuche des empfangenden
Geräts mit denen der Datei **vereinigt**. Dafür gibt es schon die Funktion, die
beim Reimport seit Langem dasselbe tut (`carryOverVisits`). Besuche sind
Tatsachen und kommen nur hinzu; eine Vereinigung kann nichts Falsches
überschreiben.

- Das Bestätigungsfenster sagt dann ehrlich: „Deine Besuche auf diesem Gerät
  bleiben erhalten."
- Damit schließt sich der Kreis **ohne Server**: Handy → Desktop per
  Besuchsbericht, Desktop → Handy per `.tfsafe`. Beide Geräte kennen danach
  dieselben Besuche.
- Grenze: Einen Besuch zu löschen gibt es heute nicht. Sollte das kommen,
  braucht die Vereinigung eine Löschmarke. Heute ist das kein Thema.
- Aufwand klein: ein Aufruf, ein Satz im Fenster, Tests, ein Schritt im
  smoke-check. Als Fehler aus dem Nutzer-Feedback hat er nach Release 17
  Vorrang.

### B. Den Rückweg sichtbar machen *(Klarheit, kaum neuer Code)*

- **Erledigt 20.10.2026:** Knopf am Handy sichtbar im Tour-Blatt unter „📷
  Tour per QR übernehmen" (siehe Befund 1).
- **Handy:** Den Knopf „📤 Besuche weitergeben (n)" gibt es. Neu ist ein
  Hinweis, wenn **n ≥ 1** ist und Daten vom Desktop empfangen werden sollen:
  „Du hast 3 Besuche, die der Desktop noch nicht kennt – erst weitergeben?"
  Das ist derselbe Gedanke wie A, nur höflicher und als Rückweg für den Fall
  ohne A.
- **Desktop:** Im Tab Daten steht der Weg ausdrücklich da: **„📥 Besuche vom
  Handy übernehmen"**. Der Knopf öffnet die Dateiauswahl, den Rest macht der
  vorhandene Import, der den Bericht erkennt.
- Guide, Kurzanleitung und Schulung bekommen den Kreislauf als **ein Bild**:
  Handy erfasst → Bericht weitergeben → Desktop übernimmt → `.tfsafe` zurück.

### C. Besuchsübersicht drucken und exportieren *(neue Funktion)*

**„🗒️ Meine Besuche"** im Tab Daten auf Desktop und Handy, außerdem aus dem
Feierabend-Rückblick:

- **Zeitraum:** diese Woche · letzte Woche · dieser Monat · frei (von–bis).
- **Gliederung:** nach Datum (Standard, „mein Wochenbericht") oder nach Kunde
  („wer wie oft").
- **Inhalt je Zeile:** Datum, Kunde (Name, Nummer), Ort, Vertriebsbezirk,
  dazu die Notiz aus Baustein D, sobald es sie gibt. Oben stehen Summen
  (Besuche, Kunden, Tage). Darunter folgt **keine** Bewertung („gut",
  „zu wenig"): Die Zahlen gehören dem Nutzer, eine Note gibt es nicht.
- **Ausgabe:**
  - **Drucken/PDF** über den Druckdialog des Browsers, gebaut wie der
    Tagesplan-Druck (`printDayPlan`).
  - **Excel** = der vorhandene Besuchsbericht mit frei gewähltem Zeitraum. Es
    gibt also keine zweite Excel-Form, und dieselbe Datei kann am Desktop
    wieder übernommen werden.
  - **Optional später:** die Besuchskunden des Zeitraums auf der Karte („Wo
    war ich?"). Das ist die Idee „Besuchs-Zeitraffer" aus dem Backlog und
    kommt erst, wenn jemand danach fragt.
- **Datenschutz:** Die Übersicht enthält Kundennamen und bleibt lokal, bis der
  Nutzer sie druckt oder teilt. Sie geht nie ohne Zutun irgendwohin.

### D. Info zum Besuch *(neue Funktion, Datenmodell)*

Nach „✓ Heute" erscheint **eine** optionale Zeile „Notiz zum Besuch". Wer
nichts schreibt, merkt davon nichts, denn sie klappt nach ein paar Sekunden
wieder zu.

- **Datenmodell, abwärtskompatibel:** `besuche` bleibt eine Liste von Daten.
  Neu dazu kommt `besuchsNotizen: { '2026-10-20': 'Angebot Antriebe bis 15.11.' }`.
  Alte Bestände, Umzugsdateien und Tresore bleiben lesbar (17.0e).
- **Weitergabe:** Die Notiz wird zur Spalte **„Notiz"** im Besuchsbericht. Am
  Desktop wird sie mit übernommen (Vereinigung je Datum; bei zwei
  verschiedenen Texten bleiben beide, mit „ / " getrennt). Sie steht in der
  Übersicht (C) und in der Kunden-Excel.
- **Briefing:** Notizen gehen **nicht** in den Prompt. Das ist dieselbe Regel
  wie bei anderen Freitexten. Ein späteres Opt-in („letzte Notiz ins Briefing")
  wäre eine eigene Entscheidung.
- **Vorsicht, Freitext:** Notizen können Personenbezug haben („Herr X krank").
  Sie bleiben lokal (im Tresor verschlüsselt) und werden nur in Dateien
  geschrieben, die der Nutzer selbst erzeugt. Im Guide steht ein Hinweis:
  sachlich notieren, wie im CRM.
- **Offene PO-Frage:** freier Text oder feste Auswahl (z. B. „Termin
  vereinbart · Angebot · kein Bedarf · nicht angetroffen")? Eine feste Auswahl
  wäre leichter auszuwerten und datensparsamer, ein freier Text ist näher am
  Notizbuch. **Vorschlag:** freier Text, eine Zeile, höchstens 200 Zeichen.

### Bewusst nicht

| Idee | Warum nicht |
|---|---|
| Automatischer Abgleich (OneDrive-Ordner, Hintergrund, Push) | rote Linie 2; jeder Abgleich ist eine bewusste Handlung |
| Besuche per QR vom Handy zum Desktop | Desktops haben selten eine Kamera, und Teilen per Datei funktioniert schon |
| Team-Übersicht „Besuche aller Außendienstler" | rote Linien 4/5: das wäre zentrale Mitarbeiterkontrolle |
| Uhrzeit, Dauer oder Ort (GPS) zum Besuch | Bewegungsprofil; bringt dem Außendienstler nichts, was das Datum nicht schon sagt |
| Direkt ins CRM schreiben | rote Linie 6; der Weg bleibt Datei → CRM-Import oder Firmen-KI |

## 5. Reihenfolge und Aufwand

| Stufe | Inhalt | Art | Aufwand (geschätzt) | Voraussetzung |
|---|---|---|---|---|
| **1** | A – kein Verlust beim `.tfsafe`-Empfang | Fehlerbehebung | klein (½ Tag) | keine; hat nach Release 17 Vorrang |
| **2** | B – Rückweg sichtbar (Handy-Hinweis, Desktop-Knopf, Doku) | Klarheit | klein (½–1 Tag) | keine |
| **3** | C – „Meine Besuche": Druck + Excel mit Zeitraum | neue Funktion | mittel (1–2 Tage) | PO-Freigabe (Evaluierungsphase: „ohne neue Funktion") |
| **4** | D – Notiz zum Besuch, inkl. Bericht, Übernahme, Übersicht | neue Funktion, Datenmodell | mittel (2–3 Tage) | PO-Freigabe + Entscheidung freier Text oder Auswahl; Datenschutz- und Betriebsratsblick auf Freitext |

Stufe 1 und 2 ändern nichts an der Kategorie und lösen die Meldung schon zum
großen Teil. Mit Stufe 3 gibt es die gewünschte Übersicht, zunächst mit dem
Datum. Mit Stufe 4 kommen die Infos dazu.

## 6. Entscheidungen für den PO

1. Stufe 1 und 2 jetzt umsetzen? **Empfehlung: ja**, als Fehlerbehebung.
2. Stufe 3 und 4 während der Evaluierungsphase freigeben oder danach?
   **Empfehlung:** Stufe 3 freigeben, sie nutzt nur vorhandene Daten und
   bringt den Wochenbericht. Stufe 4 nach Rückmeldung der 10 Außendienstler,
   ob sie Notizen überhaupt in TourFuchs statt im CRM führen wollen.
3. Notiz: freier Text (Vorschlag) oder feste Auswahl?

## 7. Nachtrag 20.10.2026: Abgleich-Knopf (Weg B)

Nach dem Konzept hat der PO fünf Wege zur Synchronisierung verglichen
(Datei-Kreislauf, ein Knopf, OneDrive-Ordner, QR direkt, Server) und **A**
(= Stufe 1) und **B** freigegeben. Gebaut:

- **„🔄 Abgleichen"** auf Handy (Tour-Blatt unter „📷 Tour per QR übernehmen";
  ersetzt dort „📤 Besuche weitergeben") und Desktop (Daten → „Weitergeben").
  Ein Fenster: **Senden** (Abgleich-Datei teilen) und **Empfangen** (Datei vom
  anderen Gerät öffnen, nur ergänzen). Der Besuchsbericht (Excel fürs CRM/KI)
  bleibt als Link im selben Fenster und im Feierabend-Rückblick.
- **Datei `TourFuchs-Abgleich-JJJJ-MM-TT.txt`:** je Besuch nur Prüfsumme des
  Kunden (53 Bit, aus Kundennummer bzw. Name + PLZ) und Datum – keine Namen,
  keine Nummern. **Abweichung von der Entscheidungsvorlage:** Dort stand
  „verschlüsselt, einmal pro Gerätepaar koppeln". Gebaut ist die
  Prüfsummen-Variante, weil sie **kein Koppeln** braucht und trotzdem nichts
  Lesbares enthält. Ehrlich gesagt ist das Pseudonymisierung, keine
  Verschlüsselung: Wer die Kundenliste hat, kann zuordnen – genau das soll das
  andere Gerät können. Endung `.txt`, weil das Teilen-Menü der Handys nur
  bekannte Typen annimmt; erkannt wird die Datei am Inhalt.
  **PO-Entscheidung 23.10.2026: „Pseudonymisiert passt, so lassen."** Keine
  Verschlüsselung mit Koppeln nachbauen.
- **Gedächtnis:** „seit dem letzten Abgleich" = dasselbe Gedächtnis wie der
  Besuchsbericht; Empfangenes gilt als abgeglichen und wandert nicht zurück.
- Abgesichert: `tests/visitSync.test.js`, smoke-check („Abgleichen: Datei
  senden und wieder öffnen", „Empfang vom Desktop: eigene Besuche bleiben …" –
  schlägt ohne Stufe 1 an).

