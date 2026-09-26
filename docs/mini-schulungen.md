# Mini-Schulungen – geführte Live-Demos

Die Mini-Schulungen zeigen echte Bedienhandlungen direkt in TourFuchs. Sie sind keine Videodateien. Der Bereich „Erste Schritte“ startet weiterhin eingeklappt; alle Schulungen sind auch über die Informationen erreichbar.

## Bedienung

- **Pause / Fortsetzen** unterbricht die Wiedergabe. Eine bereits gestartete Kartenanimation kann noch zu Ende laufen; weitere Demo-Schritte warten.
- **Weiter** beendet die aktuelle Lesepause. Während einer Bedienhandlung ist die Schaltfläche deaktiviert, damit notwendige Schritte nicht übersprungen werden.
- **Beenden** oder **Escape** bricht die Demo ab.
- **♫ Musik an/aus** schaltet „Tropical Island House 2024“ von Sascha Ende freiwillig hinzu. Beim Neuladen ist Musik aus; die Auswahl gilt nur für die aktuelle Sitzung. Ohne Einschalten wird keine Musikdatei geladen.
- Bei eingeschalteter Musik erscheint ein Lautstärkeregler (Standard 18 %, maximal 50 %). Pause hält auch die Musik an. Beenden, Escape, Fehler und reguläres Ende stoppen sie; beim Verlassen des Tabs wird sie sofort stummgeschaltet. Zurück im sichtbaren Tab läuft sie nur bei aktiver, nicht pausierter Schulung weiter.
- Die Musik kommt vom TourFuchs-Server, nicht von externen Musikdiensten. Ohne verfügbare Datei oder bei blockierter Wiedergabe erscheint ein Hinweis; die Schulung bleibt ohne Musik benutzbar. Offline-Musik wird nicht zugesichert.
- Die Systemeinstellung „Bewegung reduzieren“ verkürzt Animationen, nicht die Lesedauer der Erklärungstexte.

## Gebietsübersicht

Bei aktivierter Gebietsplanung steht am Desktop „Mein Gebiet im Überblick“ an erster Stelle in der Auswahl und zusätzlich im aufgeklappten Bereich „Erste Schritte“. Die Schulung zeigt:

1. Landkreise und Vertriebsbezirke unterscheiden.
2. Alle Bezirke abwählen und einen Bezirk auswählen.
3. Umsatz von–bis filtern. Fehlende Umsatzangaben werden bei aktivem Umsatzfilter ausgeblendet; ein numerischer Umsatz von 0 ist dagegen ein gültiger Wert.
4. Auf das optionale Filterfeld Kundentyp hinweisen, sofern importiert.
5. Flächen erst ab einer Mindestzahl sichtbarer Kunden einfärben.
6. Eine Bezirkskachel groß öffnen, ins Gebiet zoomen und einen Kunden samt vorhandenem Umsatz ansehen.

Die Mindestzahl wird für die anschließende Detailansicht sichtbar wieder auf eins gesetzt, damit die Vorführung auch mit kleinen Kundenbeständen funktioniert. Die bisherigen Filter, Sichtbarkeitseinstellungen, Gebietsebene und Ansicht werden am Ende oder bei Abbruch wiederhergestellt. Die Demo überschreibt keine gespeicherten Filtereinstellungen und importiert keine neue Liste über einen bestehenden Bestand.

Die Simulation bleibt eine separate Schulung für Fortgeschrittene. Die Lasso-Schulung endet nach der bewussten Kundenauswahl; Startpunkt und Reihenfolge erklärt die separate Tour-Schulung.

## Routing und KI: klare Grenzen

Die Tour-Demo zeigt eine **Luftlinie** und erklärt lediglich, wo später die Straßenroute aktiviert werden kann. Sie setzt keine Routing-Zustimmung und schaltet nicht automatisch auf den externen OSRM-Dienst um. Außerhalb der Schulung gilt weiterhin der reguläre Zustimmungsdialog vor einer erstmaligen Straßenroutenanfrage.

Die Optimierung sucht eine kurze, sinnvolle Reihenfolge anhand von Luftlinienentfernungen; sie garantiert weder die global kürzeste Strecke noch die kürzeste Straßenroute.

Briefing-Schulungen erklären: Prompt prüfen → in die Zwischenablage kopieren → Kopierbestätigung beachten → im freigegebenen KI-Assistenten einfügen und selbst absenden → Antwort prüfen. Die Schulung ruft keinen KI-Bericht ab. Zugriff auf eigene Quellen setzt beim gewählten Assistenten passende Anbindungen und Berechtigungen voraus.

## Wartung und Prüfung

Story-Definitionen: `src/features/stories.js`. Wiedergabesteuerung: `src/features/showcasePlayback.js`. UI-Engine: `src/ui/showcase.js`.
Musiksteuerung: `src/features/showcaseMusic.js`; Quelldatei: `public/audio/tropical-island-house-2024.mp3`. Lizenzbelege unter `docs/licenses/tropical-island-house-2024/`; sichtbare Attribution in Informationen und `public/license.html`.

Nach Ablaufänderungen die angezeigten ungefähren Dauern nachmessen. Die Zeiten gelten ohne manuelle Pausen; Kartenladezeiten und Umfang des eigenen Bestands können sie verändern.

Relevante Tests: `tests/stories.test.js`, `tests/showcasePlayback.test.js`, `tests/demoRouteReveal.test.js`, `tests/showcaseOnboarding.test.js`, `tests/firstSteps.test.js`. Für echte Browser-Durchläufe: `npm run demo-check`.
