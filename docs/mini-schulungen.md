# Mini-Schulungen – geführte Live-Demos

Die Mini-Schulungen zeigen echte Bedienhandlungen direkt in TourFuchs. Sie sind keine Videodateien. Der Bereich „Erste Schritte“ startet weiterhin eingeklappt; alle Schulungen sind auch über die Informationen erreichbar.

## Bedienung

- **Pause / Fortsetzen** unterbricht die Wiedergabe. Eine bereits gestartete Kartenanimation kann noch zu Ende laufen; weitere Demo-Schritte warten.
- **Beenden** oder **Escape** bricht die Demo ab.
- **Tippen auf die Fläche** (auch in einem von der Vorführung geöffneten Fenster) hält an und fragt: **✋ Selbst ausprobieren** beendet die Vorführung, **▶ Weiter ansehen** setzt fort. Die Musik läuft während der Frage weiter; antwortet niemand, geht es nach acht Sekunden von selbst weiter (etwa bei einem versehentlichen Tipp am Messestand). Nach einem bewussten Pause-Knopf läuft nichts von selbst weiter. Der Tipp wird bewusst nicht an das Element darunter durchgereicht: Beim Beenden stellt die Vorführung den vorherigen Zustand wieder her, die angetippte Stelle gäbe es danach oft nicht mehr.
- **♫ Musik aus/ein** schaltet „Tropical Island House 2024“ von Sascha Ende aus oder wieder ein. Die Musik startet mit der ersten bewusst gestarteten Schulung; der Startknopf ist zugleich die dafür notwendige Nutzerinteraktion. Eine bewusste Ausschaltung gilt für weitere Schulungen der aktuellen Sitzung.
- Bei eingeschalteter Musik erscheint auf breiten Bildschirmen ein Lautstärkeregler in der Leiste (Standard 18 %, maximal 50 %); am Handy regeln die Lautstärketasten. Pause hält auch die Musik an.
- **Mit eigenen Daten am Schreibtisch:** Der Beispieldaten-Streifen verschwindet, die Demos bleiben trotzdem einen Klick entfernt – die Pille **🎬 Live-Demos** unten über der Karte öffnet die Übersicht und zeigt, wie viele Demos noch ungesehen sind („3 neu“). Am Handy gibt es sie nicht; dort bleibt die Info (ⓘ).
- **Begrüßung ohne eigene Daten:** Solange nur Beispieldaten laufen, bietet die Begrüßung bei jedem Start „▶ TourFuchs in Aktion sehen“ an. Das startet direkt die erste (noch nicht gesehene) Demo der Schleife. Ohne Bedienung startet sie nach zehn Sekunden von selbst; weil Browser Ton erst nach einem Tipp erlauben, dann zunächst ohne Musik – „♫ Musik ein“ in der Leiste holt sie dazu. Die erste Bedienung irgendwo in der App bricht den Selbststart ab.
- **Die Schulungen laufen in einer Schleife.** Nach jedem erfolgreich beendeten Film zählt im Abschlussfenster ein Kreis acht Sekunden herunter; dann startet die nächste Demo von selbst – zuerst noch nicht gesehene, sonst die folgende, nach der letzten wieder die erste („Alle Demos angesehen“ · „Wieder von vorn“). Tippen auf den Kreis startet sofort. Jede andere Bedienung im Fenster hält den Countdown an; der Kreis bleibt als ▶-Knopf stehen. Geht der Bildschirm aus oder wechselt der Tab, endet die Schleife ebenfalls. TourFuchs hält den Bildschirm bewusst nicht wach – für einen Messestand die Zeitsperre des Geräts verlängern. Nach einer hängengebliebenen Demo gibt es keinen Countdown.
- **Zwischen zwei Filmen läuft die Musik weiter.** Nach einem Film (auch nach einem hängengebliebenen) bleibt sie im Auswahlfenster an – bei 60 % der eingestellten Lautstärke, auch nach einem Wechsel in die Demo-Auswahl. Der nächste Film setzt dieselbe Aufnahme ohne Neustart fort und fährt auf volle Lautstärke hoch. Leiser und wieder lauter wird sie jeweils weich über 2,5 Sekunden (langsam anfangen, langsam ankommen), nicht abrupt. Oben rechts im Fenster schaltet **♫ Musik aus/ein** sie ab oder wieder an. Wer das Fenster verlässt („Für jetzt beenden“, „Später“, „TourFuchs verwenden“, Escape) oder eine Minute lang nichts darin bedient, lässt sie über zwei Sekunden ausklingen. Frisch über die Info geöffnet, startet die Auswahl keine Musik.
- Beenden und Escape während eines Films lassen die Musik ebenfalls über zwei Sekunden ausklingen; beim Verlassen des Tabs wird sie sofort stummgeschaltet. Zurück im sichtbaren Tab läuft sie nur bei aktiver, nicht pausierter Schulung oder in der Pause zwischen zwei Filmen weiter.
- Die Musik kommt vom TourFuchs-Server, nicht von externen Musikdiensten. Ohne verfügbare Datei oder bei blockierter Wiedergabe erscheint ein Hinweis; die Schulung bleibt ohne Musik benutzbar. Offline-Musik wird nicht zugesichert.
- Die Systemeinstellung „Bewegung reduzieren“ verkürzt Animationen, nicht die Lesedauer der Erklärungstexte.
- **Die Steuerleiste weicht aus.** Sie steht nicht fest oben, sondern sucht vor jedem Schritt den Platz, an dem sie am wenigsten verdeckt: Das gerade gezeigte Element und die Sprechblase bleiben immer frei, Überschriften, Felder und Knöpfe eines offenen Fensters möglichst auch. Geht ein Fenster auf, rückt die Leiste daneben, darüber oder darunter. Ist nirgends genug Platz – am Handy mit bildschirmfüllendem Fenster die Regel –, schrumpft sie zur Symbol-Pille (Fortschritt · ♫ · ❚❚/▶ · ✕). Umsetzung: `src/features/showcaseToolbar.js` (Platzwahl) und `placeToolbar()` in `src/ui/showcase.js` (Messen und Setzen).

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

## Excel-Liste importieren

„Deine Excel-Liste importieren“ (Desktop und Handy, ca. 40 s) zeigt den Weg einer echten Datei bis zur Spaltenzuordnung:

1. „Eigene Daten laden“ öffnen; der Knopf „Datei auswählen“ wird gezeigt, aber nicht geklickt (er öffnete den System-Dialog zur Dateiauswahl).
2. Eine im Speicher erzeugte Beispieldatei (`meine-kundenliste.xlsx`, sechs Kunden) geht in den echten Zuordnungsschritt.
3. Straße, PLZ, Ort, Vertriebsbezirk und Umsatz erkennt TourFuchs selbst; „Firmenbezeichnung“ nicht – der Zeiger ordnet sie dem Pflichtfeld Kundenname zu, die Beispielwerte erscheinen sofort.
4. Vor „Importieren“ bricht die Vorführung ab: Es wird nichts importiert, der Bestand bleibt unberührt – auch bei vorzeitigem Beenden.

Im Fenster „Eigene Daten laden“ steht die passende Demo direkt beim jeweiligen Weg: „▶ Wie läuft der Import ab?“ beim Excel-/CSV-Import, „▶ Wie geht das?“ bei der verschlüsselten `.tfsafe`-Datei (nur am Handy, wo es die Empfangs-Demo gibt). Von dort gestartet, gibt es danach keine Schleife: TourFuchs öffnet wieder „Eigene Daten laden“ – auch nach „Beenden“ oder „Selbst ausprobieren“. Nur eine hängengebliebene Demo zeigt ihren Hinweis.

## Routing und KI: klare Grenzen

Die Tour-Demo zeigt eine **Luftlinie** und erklärt lediglich, wo später die Straßenroute aktiviert werden kann. Sie setzt keine Routing-Zustimmung und schaltet nicht automatisch auf den externen OSRM-Dienst um. Außerhalb der Schulung gilt weiterhin der reguläre Zustimmungsdialog vor einer erstmaligen Straßenroutenanfrage.

Die Optimierung sucht eine kurze, sinnvolle Reihenfolge anhand von Luftlinienentfernungen; sie garantiert weder die global kürzeste Strecke noch die kürzeste Straßenroute.

Briefing-Schulungen erklären: Prompt prüfen → in die Zwischenablage kopieren → Kopierbestätigung beachten → im freigegebenen KI-Assistenten einfügen und selbst absenden → Antwort prüfen. Die Schulung ruft keinen KI-Bericht ab. Zugriff auf eigene Quellen setzt beim gewählten Assistenten passende Anbindungen und Berechtigungen voraus.

## Wartung und Prüfung

Story-Definitionen: `src/features/stories.js`. Wiedergabesteuerung: `src/features/showcasePlayback.js`. UI-Engine: `src/ui/showcase.js`.
Musiksteuerung: `src/features/showcaseMusic.js`; Quelldatei: `public/audio/tropical-island-house-2024.mp3`. Lizenzbelege unter `docs/licenses/tropical-island-house-2024/`; sichtbare Attribution in Informationen und `public/license.html`.

Nach Ablaufänderungen die angezeigten ungefähren Dauern nachmessen. Die Zeiten gelten ohne manuelle Pausen; Kartenladezeiten und Umfang des eigenen Bestands können sie verändern.

Relevante Tests: `tests/stories.test.js`, `tests/showcasePlayback.test.js`, `tests/demoRouteReveal.test.js`, `tests/showcaseOnboarding.test.js`, `tests/firstSteps.test.js`. Für echte Browser-Durchläufe: `npm run demo-check` (öffnet die Auswahl über „🎬 Alle Demos“ im Beispieldaten-Streifen).
