# Anpassungen: Import, Planung und Datenschutz

## Bedienung

- Kunden- und Gebietsbriefing bestätigen das erfolgreiche Kopieren ausdrücklich: „Prompt erfolgreich in die Zwischenablage kopiert“. Ein Hinweis bleibt im Dialog sichtbar; zusätzlich erscheint eine zehn Sekunden lange Meldung. Bei verweigertem Clipboard-Zugriff wird kein Erfolg behauptet, sondern manuelles Kopieren erklärt.
- „Alles auswählen“ und „Alle abwählen“ stehen oberhalb der Filterliste. Bei aktivem Suchbegriff beziehen sich beide Aktionen wie bisher auf die Treffer.
- Neue Desktop-Installationen starten in Profi/Gebietsplanung. Gespeicherte Basis-/Modusentscheidungen und eine ausdrücklich deaktivierte Gebietsplanung bleiben respektiert. Smartphone und hochkantige Tablet-Touransicht behalten den mobilen Außendienst-Einstieg.
- Die automatische Beispieldaten-Demo setzt den aktuellen Modus nicht mehr auf Außendienst zurück.
- Die Mini-Demos unter „Erste Schritte“ starten auf allen Geräten eingeklappt. Manuelles Aufklappen und gespeicherte Entscheidungen bleiben möglich.
- Der Datei-Auswahlbutton ist auf allen Geräten der erste, grün hervorgehobene Importweg. Tabellen-Einfügen bleibt daneben als Alternative verfügbar. Die Datei wird lokal gelesen, nicht hochgeladen.

## Kundentyp

Das optionale Importfeld `kundentyp` erscheint bei den wichtigen Zuordnungsfeldern. Automatisch erkannt werden u. a. „Kundentyp“, „Kundenart“, „Customer Type“ und „Account Type“. Kategorien werden getrimmt und als normaler Kundenfilter aktiviert, sobald mindestens ein Wert vorhanden ist. Auch eine einzige oder rein numerische Kategorie ist zulässig; leere Werte laufen unter „Ohne Zuordnung“.

Der Filter wirkt zusammen mit den bestehenden Bezirks-, Gruppen- und Umsatzfiltern. Der Wert liegt im Kundendatensatz und bleibt bei Speicherung, Datentransfer und Excel-Export erhalten. Er ist keine neue Gebietshierarchie und wird deshalb nicht als Ziel für Gebietszuweisungen angeboten. Die Excel-Vorlage enthält Beispiele.

## Datenschutz-FAQ

Unter Informationen stehen sechs einzeln aufklappbare Antworten. Die Formulierungen bilden die vorhandene Implementierung ab:

- `storage.js`: lokale IndexedDB, verschlüsseltes Dataset bei aktiviertem Tresor.
- `state.js`: Dataset umfasst Kunden, Gebietszuordnungen, eigene Orte, Serviceverträge und Einsätze.
- `config.js`, `geocode.js`, `routing.js`: externe Kartenkacheln sowie optionale Adress-/Koordinatenanfragen.
- `customerBriefing.js`, `areaBriefing.js`, `handoff.js`: lokale Prompt-Erstellung und Kopieren, kein automatisches Senden an eine KI.
- Der Tresor schützt nicht sämtliche separaten Einstellungen, Touren, Szenarien, Clipboard-Inhalte oder Exportdateien. Eine vollständige Verschlüsselung der gesamten Browser-Datenbank wird nicht behauptet.
- Betriebssysteme können die Zwischenablage unabhängig von der Webapp synchronisieren. Siehe [Microsoft: Verwenden der Zwischenablage](https://support.microsoft.com/de-de/windows/apps/using-the-clipboard).

Ein pauschales „Keine Daten verlassen jemals das Gerät“ oder eine garantierte Gleichwertigkeit mit Smartphone-Sicherheit wäre deshalb nicht zutreffend. Die FAQ erklärt stattdessen konkrete Schutzmaßnahmen und Übertragungswege.
