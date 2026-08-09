# TourFuchs Vertrieb - Bildanleitung und Bildkatalog

**Katalogstand:** 09.08.2026

**App-Version der Aufnahmen:** 3.3.0

**Datenschutz:** Alle Bilder stammen aus der tatsächlich laufenden TourFuchs-App. Sichtbar sind ausschließlich die integrierten Demo-Daten oder die eindeutig synthetischen Schulungsdaten aus `tools/fixtures/docs-screenshot-customers.tsv`. Es wurden keine echten Personen-, Kunden-, Adress-, Vertrags- oder Zugangsdaten verwendet.

## Bereitstellung und Verwendung

Die kanonischen PNG-Dateien und ihre kompakten WebP-Vorschauen liegen unter `public/docs/screenshots/` und werden über die bestehende TourFuchs-Anwendung öffentlich ausgeliefert. Für die zuverlässige Anzeige in der ChatGPT-Handy-App entnimmt der TourFuchs Guide den gewünschten Screenshot vorrangig der lokalen Wissensdatei `TourFuchs_KI-Agent_Wissensbasis.pdf` und gibt ihn über den Code-Interpreter mit `display(image)` als ChatGPT-eigenes Inline-Bild aus. Pro Antwort erscheint genau ein Bild; „Nächstes Bild“ führt die Folge fort. Nur wenn die native Ausgabe fehlschlägt, verwendet der Guide die öffentliche WebP-Vorschau mit separatem Vorschau- und Original-Link. Jeder Ablauf bleibt zusätzlich vollständig als Text erklärt.

## Zentraler Zusammenhang: Auswahl ist nicht Prompt

> Eine Geste um eine reale Region wird zur Auswahl mehrerer Kunden; TourFuchs erstellt daraus ein strukturiertes Gebiets-Briefing für den internen KI-Assistenten des Nutzers.

Das **Lasso erzeugt ausschließlich die Kundenauswahl**. Erst der bewusste Klick auf **„Briefing über alle"** öffnet das Gebiets-Briefing; dort bereitet TourFuchs den Prompt lokal vor und zeigt ihn zur Prüfung. TourFuchs kopiert ihn auf Klick und öffnet den gewählten Assistenten. Der Nutzer fügt den Prompt dort ein, prüft ihn erneut und sendet ihn selbst ab.

---

## BILD-IMPORT-01 - „Eigene Daten laden"

- **Dateipfad:** `../public/docs/screenshots/BILD-IMPORT-01-eigene-daten-laden.png`
- **Gerät / Ansicht:** Desktop, 1440 x 900; Basis/Profi-unabhängig
- **App-Version / Aufnahme:** 3.3.0 / 09.08.2026
- **Öffentliche Vorschau-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-IMPORT-01-eigene-daten-laden-preview.webp`
- **Öffentliche Original-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-IMPORT-01-eigene-daten-laden.png`
- **Sichtbarer Bereich:** Modal „Eigene Daten laden" über der Kundenkarte, mit Excel-/CSV- und verschlüsseltem Dateiweg.
- **Zweck:** Zeigt den geführten Einstieg für eine eigene Liste und den sicheren Geräteumzug.
- **Relevante Schaltflächen:** „Liste aus Excel einfügen", „Excel-/CSV-Datei auswählen", „Verschlüsselte Datei öffnen".
- **Klickpfad:** `Tab „Daten" -> „Eigene Daten laden"`.
- **Erwartetes Ergebnis:** Der Nutzer wählt den vorliegenden Dateityp oder den direkten Einfügeweg.
- **Hilft bei Fragen:** „Wo lade ich meine Liste?", „Kann ich Excel direkt einfügen?", „Wo öffne ich eine .tfsafe-Datei?"
- **Alternativtext:** TourFuchs-Desktop mit geöffnetem Dialog „Eigene Daten laden". Links stehen der direkte Einfügeweg und die Dateiauswahl für Excel oder CSV, rechts der Weg für eine verschlüsselte TourFuchs-Datei. Im Hintergrund ist die echte Kartenansicht mit sicheren Beispieldaten sichtbar.
- **Datenschutzstatus:** ausschließlich Demo-/synthetische Testdaten

## BILD-IMPORT-02 - Einmalige Berechtigungsbestätigung

- **Dateipfad:** `../public/docs/screenshots/BILD-IMPORT-02-berechtigung-bestaetigen.png`
- **Gerät / Ansicht:** Desktop, 1440 x 900; Basis/Profi-unabhängig
- **App-Version / Aufnahme:** 3.3.0 / 09.08.2026
- **Öffentliche Vorschau-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-IMPORT-02-berechtigung-bestaetigen-preview.webp`
- **Öffentliche Original-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-IMPORT-02-berechtigung-bestaetigen.png`
- **Sichtbarer Bereich:** Modal „Einmal kurz bestätigen" mit Lokal-first-Hinweis.
- **Zweck:** Erklärt die einmalige Zusicherung vor dem ersten eigenen Import.
- **Relevante Schaltflächen:** „Abbrechen", „Bestätigen und weiter".
- **Klickpfad:** `„Eigene Daten laden" -> Importweg wählen -> „Einmal kurz bestätigen"`.
- **Erwartetes Ergebnis:** Nach der Bestätigung setzt TourFuchs genau den zuvor gewählten Importweg fort.
- **Hilft bei Fragen:** „Warum muss ich bestätigen?", „Werden Daten hochgeladen?", „Muss ich das jedes Mal tun?"
- **Alternativtext:** Zentrierter TourFuchs-Dialog mit Fuchs- und Listen-Symbol. Er sagt, dass die Liste auf diesem Gerät bleibt, nennt die Berechtigung zur lokalen Verarbeitung und bietet Abbrechen oder „Bestätigen und weiter" an.
- **Datenschutzstatus:** ausschließlich Demo-/synthetische Testdaten

## BILD-IMPORT-03 - „Spalten zuordnen"

- **Dateipfad:** `../public/docs/screenshots/BILD-IMPORT-03-spalten-zuordnen.png`
- **Gerät / Ansicht:** Desktop, 1440 x 900; Basis/Profi-unabhängig
- **App-Version / Aufnahme:** 3.3.0 / 09.08.2026
- **Öffentliche Vorschau-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-IMPORT-03-spalten-zuordnen-preview.webp`
- **Öffentliche Original-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-IMPORT-03-spalten-zuordnen.png`
- **Sichtbarer Bereich:** Importdialog mit automatisch erkannten Feldern, Beispielen und eingeklappten weiteren Feldern.
- **Zweck:** Zeigt, wo automatische Zuordnungen vor dem Import kontrolliert werden.
- **Relevante Schaltflächen:** Auswahllisten je Feld, „Weitere Felder", „Importieren".
- **Klickpfad:** `Liste einfügen oder Datei wählen -> „Spalten zuordnen"`.
- **Erwartetes Ergebnis:** Nach Prüfung und „Importieren" wird die synthetische Liste lokal zur Kundenkarte.
- **Hilft bei Fragen:** „Wo ordne ich die PLZ zu?", „Was heißt automatisch erkannt?", „Wo sind optionale Felder?"
- **Alternativtext:** Breiter Zuordnungsdialog mit Tabellenzeilen für Kundenname, PLZ, Ort, Vertriebsbezirk, Vertriebsgruppe und Umsatz. Jede Zeile zeigt die erkannte Quellspalte und synthetische Beispielwerte; unten führt „Importieren" weiter.
- **Datenschutzstatus:** ausschließlich synthetische Testdaten

## BILD-LASSO-01 - Kartenansicht mit „Lasso ziehen"

- **Dateipfad:** `../public/docs/screenshots/BILD-LASSO-01-kartenansicht-mit-lasso.png`
- **Gerät / Ansicht:** Desktop, 1440 x 900; Basis
- **App-Version / Aufnahme:** 3.3.0 / 09.08.2026
- **Öffentliche Vorschau-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-LASSO-01-kartenansicht-mit-lasso-preview.webp`
- **Öffentliche Original-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-LASSO-01-kartenansicht-mit-lasso.png`
- **Sichtbarer Bereich:** Kundenkarte Köln mit fünf synthetischen Kunden und Karten-Knopfzeile.
- **Zweck:** Zeigt den Startpunkt des zentralen Lasso-Workflows.
- **Relevante Schaltflächen:** „Kunden in meiner Nähe", „Lasso ziehen".
- **Klickpfad:** `Außendienst -> Karte -> „Lasso ziehen"`.
- **Erwartetes Ergebnis:** Der sichtbare Zeichenmodus wird aktiviert; die Karte friert für die Flächengeste ein.
- **Hilft bei Fragen:** „Wo ist das Lasso?", „Warum sehe ich den Knopf nicht?", „Welche Ansicht brauche ich?"
- **Alternativtext:** TourFuchs-Desktop in Basis mit fünf synthetischen Kundenkarten rund um Köln. Unten über der Karte stehen die gleichrangigen Pillen „Kunden in meiner Nähe" und „Lasso ziehen".
- **Datenschutzstatus:** ausschließlich synthetische Testdaten

## BILD-LASSO-02 - Aktiver Zeichenmodus

- **Dateipfad:** `../public/docs/screenshots/BILD-LASSO-02-aktiver-zeichenmodus.png`
- **Gerät / Ansicht:** Desktop, 1440 x 900; Basis
- **App-Version / Aufnahme:** 3.3.0 / 09.08.2026
- **Öffentliche Vorschau-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-LASSO-02-aktiver-zeichenmodus-preview.webp`
- **Öffentliche Original-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-LASSO-02-aktiver-zeichenmodus.png`
- **Sichtbarer Bereich:** Karte während der echten Zeigergeste mit türkisfarbener Spur, Füllung und aktivem Rahmen.
- **Zweck:** Macht den Zustand „Fläche umfahren" eindeutig erkennbar.
- **Relevante Schaltflächen:** aktives „Ziehen …" beziehungsweise der aktive Lasso-Zustand; Escape beendet ihn ebenfalls.
- **Klickpfad:** `„Lasso ziehen" -> Zeiger gedrückt halten -> Fläche umfahren`.
- **Erwartetes Ergebnis:** Die Spur folgt dem Zeiger; noch ist kein Prompt erzeugt.
- **Hilft bei Fragen:** „Woran erkenne ich den Zeichenmodus?", „Muss ich klicken oder ziehen?", „Warum bewegt sich die Karte nicht?"
- **Alternativtext:** In der echten TourFuchs-Karte verläuft eine türkis umrandete, halbtransparente Fläche während des Zeichnens um mehrere synthetische Kundenmarker. Ein farbiger Kartenrahmen kennzeichnet den aktiven Lasso-Modus.
- **Datenschutzstatus:** ausschließlich synthetische Testdaten

## BILD-LASSO-03 - Geschlossene Fläche mit Kundentreffern

- **Dateipfad:** `../public/docs/screenshots/BILD-LASSO-03-geschlossene-flaeche.png`
- **Gerät / Ansicht:** Desktop, 1440 x 900; Basis
- **App-Version / Aufnahme:** 3.3.0 / 09.08.2026
- **Öffentliche Vorschau-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-LASSO-03-geschlossene-flaeche-preview.webp`
- **Öffentliche Original-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-LASSO-03-geschlossene-flaeche.png`
- **Sichtbarer Bereich:** Geschlossenes Polygon, hervorgehobene Kundentreffer und geöffnete Auswahlkarte.
- **Zweck:** Zeigt das unmittelbare Ergebnis der Geste: eine Auswahl, noch keinen Prompt.
- **Relevante Schaltflächen:** „Briefing über alle", „Auswahl aufheben".
- **Klickpfad:** `„Lasso ziehen" -> Fläche umfahren -> Zeiger loslassen`.
- **Erwartetes Ergebnis:** Die Form schließt sich, fünf Kunden werden hervorgehoben, die Auswahlkarte öffnet sich.
- **Hilft bei Fragen:** „Was erzeugt das Lasso?", „Sind die Kunden schon an KI gesendet?", „Wie sehe ich die Treffer?"
- **Alternativtext:** Türkis gefülltes, geschlossenes Lasso über Köln. Fünf synthetische Kundenkarten innerhalb der Fläche sind ausgewählt; darüber steht eine weiße Karte „5 Kunden ausgewählt". Das Bild verdeutlicht: Die Geste erzeugt eine Auswahl.
- **Datenschutzstatus:** ausschließlich synthetische Testdaten

## BILD-LASSO-04 - Auswahlkarte mit „Briefing über alle"

- **Dateipfad:** `../public/docs/screenshots/BILD-LASSO-04-auswahlkarte.png`
- **Gerät / Ansicht:** Desktop, 1440 x 900; Basis
- **App-Version / Aufnahme:** 3.3.0 / 09.08.2026
- **Öffentliche Vorschau-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-LASSO-04-auswahlkarte-preview.webp`
- **Öffentliche Original-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-LASSO-04-auswahlkarte.png`
- **Sichtbarer Bereich:** Auswahlkarte mit Anzahl, Fälligkeit, Umsatz, Ort und fünf Namen.
- **Zweck:** Zeigt den Prüfschritt zwischen Lasso-Auswahl und Gebiets-Briefing.
- **Relevante Schaltflächen:** „Briefing über alle", „Auswahl aufheben", „Schließen".
- **Klickpfad:** `geschlossene Lasso-Fläche -> Auswahl prüfen -> „Briefing über alle"`.
- **Erwartetes Ergebnis:** Erst der Klick auf „Briefing über alle" öffnet den Ablauf, der den Prompt vorbereitet.
- **Hilft bei Fragen:** „Wo prüfe ich die Auswahl?", „Wann erscheint Briefing über alle?", „Was mache ich bei falschen Treffern?"
- **Alternativtext:** Weiße Auswahlkarte über einer türkis markierten Kartenfläche. Sie nennt fünf ausgewählte, fällige Kunden, 563 T€ Umsatz und Köln, listet die fünf synthetischen Schulungskunden und bietet „Briefing über alle" oder „Auswahl aufheben".
- **Datenschutzstatus:** ausschließlich synthetische Testdaten

## BILD-LASSO-05 - Gebiets-Briefing mit Prompt-Vorschau

- **Dateipfad:** `../public/docs/screenshots/BILD-LASSO-05-gebietsbriefing-prompt.png`
- **Gerät / Ansicht:** Desktop, 1440 x 900; Basis
- **App-Version / Aufnahme:** 3.3.0 / 09.08.2026
- **Öffentliche Vorschau-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-LASSO-05-gebietsbriefing-prompt-preview.webp`
- **Öffentliche Original-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-LASSO-05-gebietsbriefing-prompt.png`
- **Sichtbarer Bereich:** Geöffnetes „Gebiets-Briefing" mit Gebiet, Datenschutzhinweis und aufgeklapptem vollständigem Prompt.
- **Zweck:** Belegt, dass der Prompt erst im Briefing-Ablauf entsteht und vor dem Kopieren lesbar ist.
- **Relevante Schaltflächen:** „Vollständigen Prompt ansehen", „Prompt kopieren & Microsoft 365 Copilot öffnen", „Schließen".
- **Klickpfad:** `Auswahlkarte -> „Briefing über alle" -> „Vollständigen Prompt ansehen"`.
- **Erwartetes Ergebnis:** Der lokale Prompt ist sichtbar; es wurde noch nichts übertragen.
- **Hilft bei Fragen:** „Wo sehe ich den Prompt?", „Welche Kunden stehen darin?", „Wann verlassen Daten das Gerät?"
- **Alternativtext:** TourFuchs-Dialog „Gebiets-Briefing" für die auf der Karte markierte Fläche. Er zeigt fünf von fünf Kunden, ausgeschlossene Datenarten und den aufgeklappten vollständigen Prompt mit synthetischen Namen und Nummern. Unten steht der bewusste Kopier- und Öffnen-Knopf.
- **Datenschutzstatus:** ausschließlich synthetische Testdaten

## BILD-LASSO-06 - Basis: Copilot-Ziel und bewusster Abschluss

- **Dateipfad:** `../public/docs/screenshots/BILD-LASSO-06-basis-copilot.png`
- **Gerät / Ansicht:** Desktop, 1440 x 900; Basis
- **App-Version / Aufnahme:** 3.3.0 / 09.08.2026
- **Öffentliche Vorschau-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-LASSO-06-basis-copilot-preview.webp`
- **Öffentliche Original-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-LASSO-06-basis-copilot.png`
- **Sichtbarer Bereich:** Kompaktes Gebiets-Briefing mit eingeklappter Prompt-Zeile und festem Microsoft-365-Copilot-Knopf.
- **Zweck:** Zeigt den Basis-Weg ohne Assistentenauswahl.
- **Relevante Schaltflächen:** „Vollständigen Prompt ansehen", „Prompt kopieren & Microsoft 365 Copilot öffnen".
- **Klickpfad:** `Basis -> Gebiets-Briefing prüfen -> Kopier-/Öffnen-Knopf`.
- **Erwartetes Ergebnis:** TourFuchs kopiert den Prompt und versucht, Copilot zu öffnen; der Nutzer fügt ein, prüft und sendet selbst.
- **Hilft bei Fragen:** „Welcher Assistent wird in Basis geöffnet?", „Wird automatisch gesendet?", „Was macht ein Popup-Blocker?"
- **Alternativtext:** Basis-Dialog „Gebiets-Briefing" mit Datenschutzangabe, eingeklapptem vollständigem Prompt und grünem Knopf „Prompt kopieren & Microsoft 365 Copilot öffnen". Es gibt keine Zielauswahl.
- **Datenschutzstatus:** ausschließlich synthetische Testdaten

## BILD-LASSO-07 - Profi: „Ziel: … · Anderen Assistenten wählen"

- **Dateipfad:** `../public/docs/screenshots/BILD-LASSO-07-profi-zielassistent.png`
- **Gerät / Ansicht:** Desktop, 1440 x 900; Profi
- **App-Version / Aufnahme:** 3.3.0 / 09.08.2026
- **Öffentliche Vorschau-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-LASSO-07-profi-zielassistent-preview.webp`
- **Öffentliche Original-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-LASSO-07-profi-zielassistent.png`
- **Sichtbarer Bereich:** Kundenbriefing im Profi-Modus mit eingeklappter Zielzeile.
- **Zweck:** Zeigt, wo Profis das Ziel für Kunden- und Gebiets-Briefings festlegen.
- **Relevante Schaltflächen:** „Ziel: Microsoft 365 Copilot", „Anderen Assistenten wählen", Kopier-/Öffnen-Knopf.
- **Klickpfad:** `Profi -> Kundenmarker -> „Briefing"`.
- **Erwartetes Ergebnis:** Der aktuell gewählte Assistent ist sichtbar; das Gebiets-Briefing verwendet dieselbe lokal gemerkte Wahl.
- **Hilft bei Fragen:** „Wo ändere ich den Assistenten?", „Warum gibt es die Wahl nicht in Basis?", „Gilt die Wahl auch fürs Gebiet?"
- **Alternativtext:** Profi-Kundenbriefing für den synthetischen Kunden „TourFuchs Schulung · Nord 0001". Unter dem Hinweis zum selbstständigen Absenden steht die Zeile „Ziel: Microsoft 365 Copilot" mit „Anderen Assistenten wählen".
- **Datenschutzstatus:** ausschließlich synthetische Testdaten

## BILD-LASSO-08 - Assistentenauswahl im Profi-Modus

- **Dateipfad:** `../public/docs/screenshots/BILD-LASSO-08-assistentenauswahl.png`
- **Gerät / Ansicht:** Desktop, 1440 x 900; Profi
- **App-Version / Aufnahme:** 3.3.0 / 09.08.2026
- **Öffentliche Vorschau-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-LASSO-08-assistentenauswahl-preview.webp`
- **Öffentliche Original-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-LASSO-08-assistentenauswahl.png`
- **Sichtbarer Bereich:** Aufgeklappte Assistentenauswahl im Kundenbriefing.
- **Zweck:** Zeigt alle tatsächlich verfügbaren Ziele und die Datenschutzgrenze.
- **Relevante Schaltflächen:** Microsoft 365 Copilot, Google Gemini, ChatGPT, Eigener Assistent.
- **Klickpfad:** `Profi -> „Briefing" -> „Anderen Assistenten wählen"`.
- **Erwartetes Ergebnis:** Die Wahl ändert die Zieladresse und Quellenzeile im Prompt; TourFuchs sendet nichts selbst.
- **Hilft bei Fragen:** „Welche Assistenten gibt es?", „Kann ich einen eigenen Assistenten nutzen?", „Was ändert die Auswahl?"
- **Alternativtext:** Aufgeklappter Profi-Bereich mit vier Optionsfeldern: Microsoft 365 Copilot, Google Gemini, ChatGPT und Eigener Assistent. Darunter steht, dass die Wahl nur das Öffnen des Fensters steuert und der Prompt erst beim eigenen Absenden übertragen wird.
- **Datenschutzstatus:** ausschließlich synthetische Testdaten

## BILD-LASSO-MOBIL-01 - Mobiler Einstieg

- **Dateipfad:** `../public/docs/screenshots/BILD-LASSO-MOBIL-01-kartenansicht.png`
- **Gerät / Ansicht:** Smartphone, 390 x 844; Basis
- **App-Version / Aufnahme:** 3.3.0 / 09.08.2026
- **Öffentliche Vorschau-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-LASSO-MOBIL-01-kartenansicht-preview.webp`
- **Öffentliche Original-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-LASSO-MOBIL-01-kartenansicht.png`
- **Sichtbarer Bereich:** Mobile Karte mit fester Basis-/Profi- und Karte-/Tour-Navigation, fünf Kunden und zwei schwebenden Kartenaktionen.
- **Zweck:** Zeigt, dass der Lasso-Workflow auf dem Smartphone unterstützt wird und wo er beginnt.
- **Relevante Schaltflächen:** „In der Nähe", „Lasso ziehen", „Karte", „Tour".
- **Klickpfad:** `Smartphone -> „Karte" -> „Lasso ziehen"`.
- **Erwartetes Ergebnis:** Das Bedienblatt bleibt unten, die Karte wird zum Zeichnen freigegeben.
- **Hilft bei Fragen:** „Gibt es Lasso mobil?", „Wo liegt der Knopf am Handy?", „Muss ich den Tour-Reiter öffnen?"
- **Alternativtext:** Smartphone-Ansicht von TourFuchs in Basis. Oben stehen Basis/Profi und Karte/Tour, auf der Köln-Karte fünf synthetische Kunden. Direkt über dem unteren Blatt liegen „In der Nähe" und „Lasso ziehen".
- **Datenschutzstatus:** ausschließlich synthetische Testdaten

## BILD-LASSO-MOBIL-02 - Echte Fingergeste auf dem Smartphone

- **Dateipfad:** `../public/docs/screenshots/BILD-LASSO-MOBIL-02-aktiver-zeichenmodus.png`
- **Gerät / Ansicht:** Smartphone, 390 x 844; Basis
- **App-Version / Aufnahme:** 3.3.0 / 09.08.2026
- **Öffentliche Vorschau-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-LASSO-MOBIL-02-aktiver-zeichenmodus-preview.webp`
- **Öffentliche Original-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-LASSO-MOBIL-02-aktiver-zeichenmodus.png`
- **Sichtbarer Bereich:** Mobile Karte während einer über Touch-Ereignisse eingespeisten echten Fingergeste.
- **Zweck:** Dokumentiert den mobilen Zeichenmodus mit `touch-action: none` und sichtbarer Spur.
- **Relevante Schaltflächen:** aktiver Lasso-Zustand; Hinweis zum Ziehen mit Finger oder Maus.
- **Klickpfad:** `„Lasso ziehen" -> Finger aufsetzen -> Fläche umfahren`.
- **Erwartetes Ergebnis:** Die Karte scrollt nicht; die Spur folgt dem Finger.
- **Hilft bei Fragen:** „Warum verschiebt sich die Karte nicht?", „Wie ziehe ich die Fläche am Handy?", „Ist das nur eine Animation?"
- **Alternativtext:** Smartphone-Karte mit türkis gefüllter Lasso-Fläche und aktivem Rahmen während einer echten Touch-Geste. Ein TourFuchs-Hinweis erklärt, mit Finger oder Maus eine Fläche um die Kunden zu ziehen.
- **Datenschutzstatus:** ausschließlich synthetische Testdaten

## BILD-LASSO-MOBIL-03 - Mobile Auswahlkarte

- **Dateipfad:** `../public/docs/screenshots/BILD-LASSO-MOBIL-03-auswahlkarte.png`
- **Gerät / Ansicht:** Smartphone, 390 x 844; Basis
- **App-Version / Aufnahme:** 3.3.0 / 09.08.2026
- **Öffentliche Vorschau-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-LASSO-MOBIL-03-auswahlkarte-preview.webp`
- **Öffentliche Original-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-LASSO-MOBIL-03-auswahlkarte.png`
- **Sichtbarer Bereich:** Vollständig sichtbare mobile Auswahlkarte über der geschlossenen Fläche.
- **Zweck:** Zeigt die mobile Anordnung mit klebenden Abschlussaktionen im sichtbaren Bereich.
- **Relevante Schaltflächen:** „Briefing über alle", „Auswahl aufheben", „Schließen".
- **Klickpfad:** `mobile Fläche schließen -> Auswahl prüfen -> „Briefing über alle"`.
- **Erwartetes Ergebnis:** Der gleiche Gebiets-Briefing-Ablauf wie am Desktop öffnet sich; die Auswahlkarte bleibt auf dem Smartphone bedienbar.
- **Hilft bei Fragen:** „Wo ist Briefing über alle mobil?", „Warum liegt die Karte oben?", „Wie breche ich die Auswahl ab?"
- **Alternativtext:** Smartphone mit weißer Karte „5 Kunden ausgewählt". Sie zeigt fünf fällige synthetische Kunden in Köln und hält „Briefing über alle" sowie „Auswahl aufheben" vollständig sichtbar über dem unteren Bedienblatt.
- **Datenschutzstatus:** ausschließlich synthetische Testdaten

## BILD-KUNDE-01 - Kundenmarker mit „Briefing"

- **Dateipfad:** `../public/docs/screenshots/BILD-KUNDE-01-marker-mit-briefing.png`
- **Gerät / Ansicht:** Desktop, 1440 x 900; Profi
- **App-Version / Aufnahme:** 3.3.0 / 09.08.2026
- **Öffentliche Vorschau-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-KUNDE-01-marker-mit-briefing-preview.webp`
- **Öffentliche Original-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-KUNDE-01-marker-mit-briefing.png`
- **Sichtbarer Bereich:** Kunden-Popup auf der Karte mit sicherer synthetischer Identität, Status und Aktionen.
- **Zweck:** Zeigt den passenden Einzelkundenweg, besonders wenn das Lasso nur einen Kunden trifft.
- **Relevante Schaltflächen:** „Als Start", „Als Ziel", „Zur Tour", „Briefing", „Heute besucht".
- **Klickpfad:** `Kundenmarker oder Suche -> Kundenkarte -> „Briefing"`.
- **Erwartetes Ergebnis:** Das Kundenbriefing für genau diesen Kunden öffnet sich.
- **Hilft bei Fragen:** „Was mache ich bei einem Kunden?", „Wo ist Briefing im Kunden-Popup?", „Welche Aktionen bietet Profi?"
- **Alternativtext:** Profi-Kundenpopup für „TourFuchs Schulung · Nord 0001" mit synthetischer Kundennummer, PLZ-Mitte, Umsatz, Besuchsstatus und den Aktionen „Als Start", „Als Ziel", „Zur Tour" und „Briefing".
- **Datenschutzstatus:** ausschließlich synthetische Testdaten

## BILD-TOUR-01 - Tourplanung

- **Dateipfad:** `../public/docs/screenshots/BILD-TOUR-01-tourplanung.png`
- **Gerät / Ansicht:** Desktop, 1440 x 900; Profi
- **App-Version / Aufnahme:** 3.3.0 / 09.08.2026
- **Öffentliche Vorschau-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-TOUR-01-tourplanung-preview.webp`
- **Öffentliche Original-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-TOUR-01-tourplanung.png`
- **Sichtbarer Bereich:** Tour-Reiter mit Kartenansicht, Bezirk, Nähe-Einstieg und den drei Planungsstufen.
- **Zweck:** Ordnet Startpunkt, Vorschläge und „Meine Tour" räumlich ein.
- **Relevante Schaltflächen:** „Was ist in meiner Nähe?", „1. Startpunkt", „2. Vorschläge", „3. Meine Tour".
- **Klickpfad:** `Außendienst -> Tab „Tour"`.
- **Erwartetes Ergebnis:** Der Nutzer öffnet schrittweise Start, Vorschläge und Tour; nichts wird ungefragt geplant.
- **Hilft bei Fragen:** „Wo starte ich die Tourplanung?", „Wo sind Vorschläge?", „Warum ist noch keine Tour da?"
- **Alternativtext:** TourFuchs-Desktop im Profi-Modus. Links zeigt der Tour-Reiter den Einstieg „Was ist in meiner Nähe?" und die eingeklappten Stufen Startpunkt, Vorschläge und Meine Tour; rechts liegen die fünf synthetischen Schulungskunden auf der Köln-Karte.
- **Datenschutzstatus:** ausschließlich synthetische Testdaten

## BILD-DATEN-01 - Export vor vollständigem Ersatz

- **Dateipfad:** `../public/docs/screenshots/BILD-DATEN-01-export-vor-ersatz.png`
- **Gerät / Ansicht:** Desktop, 1440 x 900; Profi
- **App-Version / Aufnahme:** 3.3.0 / 09.08.2026
- **Öffentliche Vorschau-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-DATEN-01-export-vor-ersatz-preview.webp`
- **Öffentliche Original-URL:** `https://tourfuchs.vercel.app/docs/screenshots/BILD-DATEN-01-export-vor-ersatz.png`
- **Sichtbarer Bereich:** Daten-Reiter mit Bestandszahlen, „Andere Excel- oder CSV-Liste laden", Export und Löschaktion.
- **Zweck:** Zeigt die Sicherung vor einem vollständigen Kundenbasis-Ersatz oder Löschen.
- **Relevante Schaltflächen:** „Andere Excel- oder CSV-Liste laden", „Als Excel exportieren", „Daten löschen".
- **Klickpfad:** `Tab „Daten" -> „Als Excel exportieren" -> erst danach neue vollständige Liste laden`.
- **Erwartetes Ergebnis:** Eine Sicherung des aktuellen Bestands liegt vor; ein späterer Vollimport zeigt zusätzlich „Was ändert sich?" und ersetzt erst nach Bestätigung.
- **Hilft bei Fragen:** „Wie sichere ich vor einem Ersatz?", „Ist ein Reimport ein Delta?", „Was muss ich vor Daten löschen tun?"
- **Alternativtext:** TourFuchs-Daten-Reiter mit fünf synthetischen Kunden, einem Bezirk und einer Gruppe. Unter den Bestandsangaben stehen „Andere Excel- oder CSV-Liste laden", „Als Excel exportieren" und die rote Aktion „Daten löschen"; die Karte bleibt rechts sichtbar.
- **Datenschutzstatus:** ausschließlich synthetische Testdaten

## Verbindliche Grenzen zum Bildsatz

- **„Briefing über alle" erscheint erst ab mindestens zwei echten Kunden.** Technisch markierte Demo-Kunden zählen dafür nicht.
- **Bei genau einem echten Kunden** ist das Kundenbriefing über den Kundenmarker der passende Weg; siehe BILD-KUNDE-01.
- **Reine Demo-Kunden erzeugen keinen echten Prompt** und öffnen keinen externen Assistenten.
- **TourFuchs bereitet den Prompt vor und kopiert ihn.** Der Nutzer fügt ihn im Assistenten ein, prüft ihn und sendet ihn selbst ab.
- **Ein Popup-Blocker kann das Öffnen verhindern.** Der Prompt kann trotzdem in der Zwischenablage liegen und bleibt im Dialog sichtbar.
- **Der dokumentierte Ablauf endet in TourFuchs.** Kein Bild zeigt eine geöffnete Copilot-, Gemini-, ChatGPT- oder interne Unternehmenssitzung.
