# 🦊 TourFuchs Vertrieb

**Kundenlisten aus Excel auf der Deutschlandkarte – Gebiets-, Besuchs- und Servicevertragsplanung.**

> Installierbare Web-App (PWA) · Lokal nutzbar · Briefing-Prompts für Ihren KI-Assistenten – ohne Anmeldung, ohne API-Aufruf

> ⚠️ **Privates Projekt, unentgeltlich, ohne Gewähr.** Quellcode unter [MIT](./LICENSE) – Weitergabe und Anpassung ausdrücklich erlaubt, Namensnennung vorausgesetzt. Kein Support, keine Haftung. Was das genau heißt, steht in [NOTICE](./NOTICE).

---

## Was macht TourFuchs Vertrieb?

TourFuchs beantwortet die zwei Kernfragen im Vertriebsalltag:

1. **„Welcher Vertriebsbezirk betreut welche Kunden?“** – Excel-Liste hochladen, fertig.
   Kunden erscheinen auf der Deutschlandkarte, Gebiete werden nach Vertriebsbezirken eingefärbt.
2. **„Wen besuche ich als Nächstes?“** – Startpunkt wählen, Umkreis-Vorschläge erhalten,
   Tour zusammenstellen, Reihenfolge optimieren lassen und direkt in Google Maps navigieren.

### Funktionen im Überblick

| Bereich | Funktion |
|---|---|
| 🎬 **Onboarding & Live-Demos** | Ruhiger Erststart: leere Deutschlandkarte, die Beispielkunden erscheinen von selbst mit „Klick-mich-an"-Hinweis. Solange Beispieldaten laufen, liegt eine ruhige, nicht-blockierende Hinweiskarte mittig über der Karte („Das sind Beispieldaten" · eigene Daten laden · Live-Demos · Quittung „Verstanden"). Mehrere geführte **Live-Demos** (Geister-Cursor bedient die echte App, je ~30–60 s); die erste führt am Schreibtisch gleich den schnellsten Weg zu eigenen Daten vor – Liste aus Excel einfügen, ohne dabei echte Daten anzufassen und eine mitlaufende **„Erste Schritte"-Checkliste**, die einklappt, sobald der Nutzer erkennbar arbeitet |
| 📄 **Daten** | Excel-/CSV-Import per Klick, Drag & Drop oder **direktes Einfügen** (Strg+C in Excel, Strg+V in TourFuchs – ohne Datei zu speichern; am Schreibtisch der vorgeschlagene Weg). Eingefügt werden können auch **Markdown-Tabellen und Tabellen mitten im Fließtext** – etwa aus einem Chat-Assistenten, einem Wiki oder einer Mail; TourFuchs schneidet den Tabellenblock selbst heraus. Nach dem ersten eigenen Import sagt TourFuchs, **was in der Liste steckt** (Bezirke, Ungleichverteilung, überfällige Kunden, nicht verortete Zeilen); automatische Spaltenerkennung mit Prüf-Dialog; eine neue Kundenliste ersetzt den bisherigen Bestand erst nach einem **Änderungsbericht** (neu · entfallen · Bezirkswechsel, Wirkung je Bezirk mit Umsatzdelta) und Bestätigung, reine Kontakt-/Gebietsdateien ergänzen ihn gezielt |
| 🛡️ **Sichere Demo** | Eindeutig markierte Beispielkunden, reservierte Drama-Rufnummern und `example.com`-Adressen; Telefon, E-Mail und Briefing werden lokal simuliert, Exporte als Demo gekennzeichnet |
| 📍 **Verortung** | Sofort über PLZ-Koordinaten (offline, ohne API-Schlüssel); optional adressgenau über OpenStreetMap/Nominatim |
| 🗺️ **Gebiete** | Landkreise (400 Kreise & Städte) **und** PLZ-Ebenen (1-, 2-, 3- und 5-stellig); Flächen primär nach **Vertriebsbezirk** einfärbbar, optional nach Vertriebsgruppe (mit Label und Umsatzsumme); Klick zeigt Kunden & Bezirksverteilung je Gebiet |
| ✏️ **Gebiets-Editor** | Im Gebiets-Popup „Kunden dieses Gebiets umordnen": Kundenliste des Gebiets mit Checkboxen & Filter, ausgewählte Kunden (oder das ganze Gebiet) einem anderen Vertriebsbezirk oder einer Gruppe zuweisen – auch gemischte Gebiete gezielt aufteilen; wirkt sofort auf der Karte, mit **Rückgängig** |
| 🔍 **Zoom-Automatik** | „Automatisch (nach Zoom)": weit herausgezoomt zeigt die Karte Vertriebsgruppen als Flächen (mit Umsatz), mittlerer Zoom die Vertriebsbezirke, hineingezoomt die einzelnen Kunden – der Detailgrad wächst mit dem Zoom |
| 👥 **Filter** | **Vertriebsbezirk** ist die führende Ebene. Vertriebsgruppe kann zusätzlich eingeblendet werden; weitere optionale Ebenen lassen sich bei Bedarf ergänzen. Kundenzähler helfen beim schnellen Prüfen der Verteilung |
| 🚗 **Tour** | Startpunkt = eigener GPS-Standort oder ein Kunde; Vorschläge „Wen könnte ich in der Nähe noch besuchen?“ (Umkreis einstellbar); Tourenoptimierung (kürzeste Strecke, Nearest-Neighbor + 2-Opt); Übergabe an Google Maps zur Navigation. Unterwegs wird jeder Stopp mit „✓ Heute" abgehakt (am Handy per Tipp auf den Tour-Punkt), und der **Feierabend-Rückblick** zeigt abends den Tag in Zahlen: Besuche, geschätzte Strecke, abgearbeitete Überfällige, offen Gebliebenes – als Text kopierbar. Am Handy sind Startpunkt · Vorschläge · Meine Tour ein aufgeräumtes **Akkordeon** (genau eine Gruppe offen), und ein kleiner schwebender **Fuchs-Knopf** schlägt kontextabhängig den nächsten Schritt vor (Kunden in der Nähe → Tour ab hier planen → Route auf die Karte) |
| 📆 **Plan-Einstellungen** | Datum, Startzeit und Besuchsdauer (z. B. 45 min) der Tagestour sind einstellbar und fließen in Tagesplan-Druck und Kalender-Termine (.ics für Outlook, ein Termin je Besuch inkl. Fahrzeit) ein |
| 📲 **QR-Übergabe** | Am Desktop geplante Tour als QR-Code anzeigen, am Handy mit der Kamera scannen und übernehmen – nur die Tour (keine Datenbank), Bildschirm zu Kamera, ohne Netzwerk und ohne Server. Navigation und Kalender-Termine funktionieren direkt aus dem gescannten Code |
| 📋 **Kundenbriefing** | Ohne Einrichtung nutzbar: TourFuchs baut lokal einen kundenspezifischen Prompt, kopiert ihn und öffnet den Assistenten – abgesendet wird dort bewusst vom Nutzer. **TourFuchs meldet sich an keinem KI-Dienst an und ruft keine KI-API auf.** Im **Profi**-Modus ist das Ziel wählbar (Microsoft 365 Copilot, Google Gemini, ChatGPT oder eine eigene https-Adresse) |
| 🧭 **Gebiets-Briefing** | „Wen zuerst?" unter den Tourvorschlägen und unter „In der Nähe": derselbe manuelle Weg für die Kunden eines Gebiets. Der Prompt enthält je Kunde nur Name, Kundennummer, PLZ/Ort, Fälligkeit und letzten Besuch – kein Umsatz, keine Kontaktdaten, keine Straße –, ist auf 12 Kunden begrenzt und verlangt eine Besuchsreihenfolge statt eines weiteren Berichts |
| 🖊️ **Lasso auf der Karte** | Eine Fläche frei umfahren statt einen Regler zu schieben – der Knopf steht gleichrangig neben „Kunden in meiner Nähe“. Die Karte friert ein, die Spur wächst mit dem Finger mit, die Treffer leuchten auf, und eine **Auswahlkarte im Gewand der Kundenkarte** nennt Anzahl, fällige Kunden, Umsatz und Orte – von dort direkt ins Gebiets-Briefing. Im **Profi**-Modus trägt jede Zeile ein **Häkchen**: „Alle zur Tour" gab es schon, mit Häkchen heißt der Knopf „🚩 3 zur Tour" und übernimmt genau die – die Auswahl bleibt dabei liegen. Trifft auch **unrunde** Gebiete (Gewerbegebiet, Flussseite, Autobahnkorridor), die ein Umkreis prinzipiell verfehlt. Auf Handy und Tablet-Hochkant schiebt sich das Blatt dafür auf Guckhöhe |
| 🛡️ **Service-Vertragsradar** | Separater Excel-/CSV-Import für Vertragsstände aus SAP, SieSales/Salesforce oder weiteren Quellen. Exakter Kundenabgleich per Kundennummer, Quellenalter, Handlungsfristen, Vertragswert, SLA und Verantwortliche. Der Service-Modus ist ein **optionales Modul** – standardmäßig ausgeblendet und im Profi-Modus unten in der Gebietsplanung per Häkchen einblendbar, damit der Einstieg nicht überfrachtet |
| 🔊 **Zanobo-Brücke** | Serviceeinsätze mit Anlagen-ID verlinken direkt in die Schwester-App [Zanobo](https://zanobo.vercel.app) – akustischer Maschinen-Check am Smartphone, lokal im Browser, ohne Cloud. Vergleich statt Diagnose; die Anlagen-ID entspricht der Maschinen-ID am Zanobo-NFC-Tag und bleibt im URL-Fragment (wird nie an den Server übertragen). Eigene Zanobo-Instanz im Service-Cockpit einstellbar |
| 🔍 **Suche** | Kunden nach Name, Ort, PLZ oder Kundennummer finden und anfliegen |
| 📱 **PWA** | Auf Smartphone/Tablet/Desktop installierbar (die Installation wird aktiv angeboten, sobald mit eigenen Daten eine Tour steht), App-Shell und Gebietsdaten offline verfügbar, zuletzt gesehene Kartenausschnitte werden gecacht; mobil wird die Karte ruhig per Zwei-Finger-Geste statt zusätzlicher Zoomtasten bedient. Das Bottom-Sheet und die schwebenden Bedienelemente respektieren die untere **System-Navigationsleiste** (Android/iOS), sodass Hinweise dort nicht verdeckt werden |
| 🧩 **Ins System eingehängt** | **Excel-Liste per Doppelklick** in TourFuchs öffnen (Datei-Handler), **Excel-Anhang teilen** an TourFuchs (Android; die Datei wird lokal im Service Worker entgegengenommen und verlässt das Gerät nicht – der Teilen-Eintrag entsteht beim **Installieren aus Chrome**, eine ältere Installation muss dafür einmal neu installiert werden) und **Icon-Kurzbefehle** (Long-Press): Meine Tour · Kunden in der Nähe · Liste importieren |
| 📐 **Drei Layouts, ein Funktionsumfang** | Am **Schreibtisch** liegt das Panel seitlich, am **Handy** unten als Blatt. Ein **hochkantes Tablet** bekommt die Blatt-Geometrie (eine Seitenleiste würde dort die halbe Breite fressen) – aber **den vollen Funktionsumfang**: Profi-Modus, Gebietsplanung, Cockpit und Simulation bleiben erreichbar. Quer kehrt die Seitenleiste zurück. Die installierte App ist **nicht mehr aufs Hochformat gesperrt** |
| 🖥️ **Mobile-Vorschau** | Zeigt am Desktop dieselben Kunden-, Briefing- und Tourabläufe im Smartphone-Format. Nach dem ersten Datenbestand weist ein einmaliger, ruhiger Kurzlauf auf den Einstieg hin und öffnet gezielt den mobilen Tour-Bereich |
| 🔐 **Datentresor** | Optional aktivierbar: Kundendaten werden **AES-256-verschlüsselt** lokal gespeichert (Schlüssel aus PIN via PBKDF2, nie gespeichert). Sperrbildschirm bei App-Start/Inaktivität, **optional Face/Touch ID** (WebAuthn-PRF als zusätzliche Tür), **einstellbare Auto-Lock-Zeit**, Wiederherstellungscode, Auto-Löschung nach zu vielen Fehlversuchen – alles ausschließlich mit der Web-Crypto-API, ohne Server |
| 🧳 **Sicherer Umzug** | Kundendaten verschlüsselt auf ein anderes Gerät übertragen: **verschlüsselte Datei** (`.tfsafe`, AES-256-GCM mit Zufallsschlüssel) + **Schlüssel als QR-Code**. Datei und Schlüssel reisen **getrennt** (Kanaltrennung) – ohne Schlüssel ist die Datei wertlos; der Schlüssel geht nur per Bildschirm→Kamera, nie übers Netz. Am Zielgerät folgt direkt das erzwungene Tresor-Setup |

### Erwartetes Excel-Format

Die Spaltennamen werden automatisch erkannt (auch Synonyme wie „Firma“, „Betreuer“, „Kundenkreis“ …)
und können beim Import manuell zugeordnet werden. Empfohlene Spalten:

| Spalte | Pflicht | Beispiel |
|---|---|---|
| Kundenname | ✅ | TourFuchs Demo · Autohaus 0001 |
| PLZ | ✅ (für die Karte) | 50667 |
| Straße & Hausnummer | – | Hauptstraße 12 |
| Ort | – | Köln |
| Vertriebsbezirk | – (empfohlen) | Bezirk Rheinland |
| Vertriebschannel | – | Fachhandel |
| Vertriebsgruppe | – | Handel |
| Ansprechpartner, Telefon, E-Mail | – | Demo-Team · 0221 4710 000 · kunde-0001@example.com |
| Besuchsrhythmus (Wochen), Letzter Besuch | – | 6 · 12.05.2026 |
| Kundennummer, Umsatz, Lat/Lng | – | optional |

Der **Vertriebsbezirk** ist die führende operative Ebene und steuert Gebietsplanung, Farben, Cockpit und Tourfilter. Er ist beim Import keine Pflicht: Eine einfache Liste (Name + PLZ) landet sofort auf der Karte, Kunden ohne Bezirk laufen unter „Ohne Zuordnung" und können später per neuem Import zugeordnet werden. **Vertriebsgruppe** ist die empfohlene zweite Ebene; Vertriebschannel und weitere Ebenen sind optional und werden nur angezeigt, wenn sie bewusst ergänzt werden. Persönliche Vertriebsnamen sind für die Gebietssteuerung nicht leitend.

Eine fertige Vorlage gibt es in der App unter **Daten → Excel-Vorlage herunterladen**.

### Servicevertrags-Dateien

Serviceverträge werden bewusst als separater Datenbestand importiert. Eine Zeile entspricht einem aktuellen Vertrag; eindeutiger Schlüssel ist `Quellsystem + Vertrags-ID`, die Verknüpfung zum Kunden erfolgt ausschließlich über die exakte `Kundennummer`. Ein Reimport ersetzt nur die in der Datei enthaltenen Vertragsquellen. Andere Quellen, Kunden, Gebiete und Touren bleiben erhalten.

Die geprüfte Excel-Vorlage mit Auswahllisten und Feldbeschreibung sowie ein UTF-8-CSV-Beispiel stehen im Profi-Modus unter **Service → Verträge** bereit. Das vollständige Schema und die Importregeln beschreibt [Serviceverträge in TourFuchs importieren](./docs/servicevertraege-import.md).

#### Flächenzeilen (Gebiete ohne Kunden zuordnen)

Neben Kundenzeilen kann die Liste **Flächenzeilen** enthalten: eine Zeile **ohne Kundenname**, aber mit der Spalte **Gebiet (LK/PLZ)** und einem **Vertriebsbezirk**. So lässt sich ein ganzer Landkreis oder ein PLZ-Bereich einem Bezirk zuordnen, auch wenn dort (noch) keine Kunden sind – z. B. um Gebiete für Neukunden zu reservieren. „Gebiet" ist entweder ein **Landkreis-Name** (z. B. `Oberhausen`) oder eine **PLZ / PLZ-Präfix** (`46` = alle 46xxx, `46045` = genau dieses PLZ-Gebiet). Dasselbe geht interaktiv über das **Gebiets-Popup** auf der Karte oder im **Cockpit** (Häkchen „Auch Gebiete ohne Kunden einbeziehen").

#### Plausibilitätsprüfung beim Import

Beim Import werden die Zeilen geprüft. **Gültige Zeilen werden importiert**, problematische landen in einer **herunterladbaren Fehlerliste (Excel)** statt in einer unübersichtlichen Fehleranzeige. Erkannt werden u. a.: Dubletten (gleiche Kundennummer bzw. Name + PLZ), fehlender Vertriebsbezirk, widersprüchliche Gebietszuordnungen (ein Gebiet zwei verschiedenen Bezirken zugewiesen), unbekannte Landkreise/PLZ-Gebiete sowie nicht auffindbare Kunden-PLZ (Hinweis).

Eine Datei mit Kundenzeilen gilt als **neuer vollständiger Kundenbestand**. Sind bereits Daten geladen, nennt TourFuchs vor dem Import die Wirkung und verlangt eine Bestätigung. Erst danach werden alte Kunden, Tour und Gebietszuordnungen ersetzt. Reine Kontakt- oder Gebietsdateien bleiben ergänzend, weil sie sich ausdrücklich auf den vorhandenen Kundenbestand beziehen.

### Datenschutz

- Kundendaten werden **lokal im Browser** gespeichert (IndexedDB); der Betreiber erhält sie nicht und es gibt kein Tracking.
- Bei Demo-Kunden werden Telefon, E-Mail, Briefing und exakte Adress-Geocodierung nicht extern gestartet. Die sichtbaren Aktionen sind sichere Simulationen; echte importierte Kunden bleiben unverändert nutzbar.
- Beim **Kunden- und beim Gebiets-Briefing** entsteht der Prompt ausschließlich lokal, wird vollständig angezeigt und nur in die Zwischenablage kopiert. Eine Übertragung erfolgt erst, wenn der Nutzer ihn selbst im Assistenten einfügt und absendet. TourFuchs führt dabei keine Anmeldung und keinen API-Aufruf durch; eine frühere automatische Entra-/Graph-Anbindung wurde entfernt.
- Nur die optionale adressgenaue Verortung sendet die jeweilige Adresse an OpenStreetMap (Nominatim), gedrosselt gemäß deren Nutzungsrichtlinie.
- Optionale Straßenrouten (Routenlinie und Korridor-Vorschläge) senden **nach ausdrücklicher Zustimmung** die Koordinaten von Start und Tour-Stopps an OSRM (`router.project-osrm.org`) – keine Namen oder sonstigen Kundendaten. Ohne Zustimmung rechnet die App mit der Luftlinie, komplett offline.

### Schulungsunterlagen

- [Ausführliches Schulungshandbuch](./docs/schulung-tourfuchs.md)
- [Kurzanleitung für Anwender](./docs/kurzanleitung-tourfuchs.md)
- [Wissensbasis für den Guide-Bot](./docs/guide-ki-wissensbasis.md) – aufgabenorientiert mit dokumentierten Klickpfaden, aktueller Funktionsstand
- [PDF-Fassung der Guide-Wissensbasis](./TourFuchs_KI-Agent_Wissensbasis.pdf) – gut lesbare Referenz für Review, Schulung und Weitergabe
- [Kunden- und Gebiets-Briefing](./docs/kundenbriefing.md) – Ablauf, Inhalt der Prompts, Wahl des Assistenten und Prüfschritte
- [Lasso auf der Karte](./docs/lasso.md) – Zeichenmodus, Auswahlvorschau, Grenzen, Verhalten am Handy und Prüfschritte

---

## Entwicklung

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # Produktions-Build nach dist/
npm run preview    # Build lokal testen
npm test           # Unit-Tests (Vitest)
```

### Live-Demos prüfen (`npm run demo-check`)

Die geführten Live-Demos hängen an Selektoren, Layout-Schwellen und
Zeitverhalten über vier Formate – genau die Sorte Abhängigkeit, die still
verrottet. Das Werkzeug fährt **jede sichtbare Demo in der echten App** durch
und misst, was Unit-Tests nicht sehen können: ob die Vorführung durchläuft, ob
die Zeigerspitze des Geister-Cursors auf dem geklickten Element landet, ob
dieses Element überhaupt im Bild liegt, und wie lange die Demo wirklich dauert.

```bash
npm run build
npm run demo-check                                        # alle Formate, alle Demos (~20 min)
npm run demo-check -- --format=tablet-hochkant            # ein Format
npm run demo-check -- --format=desktop --story=handy-qr   # gezielt
```

Einmalige Einrichtung – **bewusst nicht** in `package.json`, damit ein normales
`npm install` keinen Browser-Download auslöst:

```bash
npm i -D playwright && npx playwright install chromium
```

**Bewusst nicht in der CI:** Ein vollständiger Lauf dauert rund 20 Minuten, und
zeitbasierte Vorführungen werden dort früher oder später unzuverlässig. Ein
flackerndes Tor ist schlimmer als keines. Aufgerufen wird das Werkzeug gezielt:
nach Layout-Änderungen, nach Eingriffen an den Demo-Skripten und vor einem
Release. Der Lauf endet mit Exit-Code 1, sobald eine Demo abbricht oder ein
Klick danebengeht.

Die gemessenen Laufzeiten gehören anschließend nach `src/features/stories.js` –
das Demo-Panel verspricht sie den Nutzern.

### Fingergesten prüfen (`npm run touch-check`)

`demo-check` bedient die App mit der **Maus**. Das genügt für Klickwege, aber
nicht für alles: Für die Maus gilt `touch-action` nicht. Genau daran ist das
Lasso beim ersten echten Gerätetest gescheitert – der Prüflauf war grün, auf dem
Telefon fror die Karte ein und der Finger zeichnete ins Leere, weil der Browser
die Wischgeste für sich beanspruchte.

Dieses Werkzeug speist Berührungen über das Chrome DevTools Protocol ein, so wie
ein Gerät sie erzeugt, und prüft, was nur damit sichtbar wird: ob ein
schwebendes Element den Knopf verdeckt, ob die Zeichenspur dem Finger wirklich
folgt, ob der Auswahlstreifen antippbar im Bild steht und ob sich die Karte
danach wieder schieben lässt. Dazu der Rückweg im Profi-Modus: ob ein Daumen die
Häkchen der Auswahlkarte trifft, ob der Tour-Knopf danach wirklich die
angehakten Kunden meint und ob die Auswahl nach dem Übernehmen stehen bleibt.

```bash
npm run build
npm run touch-check          # Smartphone und Tablet-Hochkant (~2 min)
```

Gleiche Voraussetzung wie oben; Exit-Code 1 bei jedem Befund. Kurz genug, um ihn
nach jeder Änderung an Karteninteraktionen laufen zu lassen.

**Stack:** Vite · Leaflet + markercluster · SheetJS (xlsx) · vite-plugin-pwa (Workbox) · Vanilla JS (ES Modules)

### Projektstruktur

```
src/
├── main.js               # Einstiegspunkt & Wiederherstellung des gespeicherten Zustands
├── core/
│   ├── config.js         # zentrale Konfiguration (Farben, Ebenen, Karten-Setup)
│   └── state.js          # App-State + Pub/Sub
├── services/
│   ├── excel.js          # Import/Export, Spaltenerkennung, Vorlage, Demo-Daten
│   ├── geocode.js        # PLZ-Zentroide + optionale Nominatim-Geocodierung
│   ├── geodata.js        # Gebiets-GeoJSON laden, Point-in-Polygon
│   ├── routing.js        # optionale Straßenroute/Korridor (OSRM)
│   ├── crypto.js · vault.js · biometric.js   # Datentresor (AES-256, PIN/PRF)
│   ├── assistant.js · zanobo.js              # Ziel-Assistent (Briefing) / Zanobo-Anbindung
│   ├── showcaseOnboarding.js # Willkommens-Automatik & Demo-Status
│   └── storage.js        # IndexedDB-Persistenz
├── features/
│   ├── map.js            # Leaflet-Karte, Gebiets-Layer, Marker, Tour-Anzeige
│   ├── customerMarkers.js · customerScope.js · labelPlacement.js  # Marker/Filter/Labels
│   ├── territory.js      # Kunden→Gebiet-Aggregation
│   ├── tour.js · tourExport.js · tourShare.js # Umkreis, Optimierung, Druck/ICS, QR
│   ├── serviceContracts.js · serviceVisits.js · serviceDayPlanner.js # Service-Modul
│   ├── firstSteps.js · stories.js            # Onboarding-Checkliste & Live-Demo-Skripte
│   └── safeTransfer.js · handoff.js          # Sicherer Umzug & Geräteübergabe
└── ui/                   # Sidebar (Bottom-Sheet, Tour-Akkordeon, Fuchs-Nudge),
                          # Import-Assistent, Tour-Panel, Showcase-Engine, Suche, Toasts

public/geodata/           # gebündelte Gebietsdaten (siehe Datenquellen)
```

### Deployment (Vercel)

Das Repository ist deployfertig für [Vercel](https://vercel.com):

1. Repository bei Vercel importieren (Framework **Vite** wird automatisch erkannt, `vercel.json` liegt bei)
2. Build-Kommando `npm run build`, Output `dist/` – beides vorkonfiguriert
3. Nach dem Deploy ist die App unter der Vercel-URL erreichbar und als PWA installierbar
   (Browser-Menü → „App installieren“ / „Zum Startbildschirm hinzufügen“)

Alternativ per CLI: `npx vercel`

---

## Datenquellen & Lizenzen

| Daten | Quelle | Lizenz |
|---|---|---|
| Landkreisgrenzen (VG250, vereinfacht) | © GeoBasis-DE / [BKG](https://gdz.bkg.bund.de/) 2024 | [dl-de/by-2-0](https://www.govdata.de/dl-de/by-2-0) |
| PLZ-Gebiete (vereinfacht, aus OSM) | [Esri Deutschland Open Data](https://opendata-esridede.opendata.arcgis.com/) / © OpenStreetMap-Mitwirkende | [ODbL](https://opendatacommons.org/licenses/odbl/) |
| PLZ-Koordinaten | [WZB plz_geocoord](https://github.com/WZBSocialScienceCenter/plz_geocoord) / © OpenStreetMap-Mitwirkende | ODbL |
| Kartendarstellung „Standard" (Voreinstellung) | © [OpenStreetMap](https://www.openstreetmap.org/copyright)-Mitwirkende | ODbL |
| Kartendarstellung „Hell" | © OpenStreetMap & [CARTO](https://carto.com/attributions) | – |
| Kartendarstellung „Satellit" (nur bei bewusster Wahl) | © [Esri](https://www.esri.com/), Maxar, Earthstar Geographics | Esri-Nutzungsbedingungen |
| Geocoding (optional) | [Nominatim](https://nominatim.org/) | [Usage Policy](https://operations.osmfoundation.org/policies/nominatim/) |

Verwendete Software-Bibliotheken (mit Lizenz) sind in der App unter **Lizenz & Rechtliches** sowie in der [NOTICE](./NOTICE)-Datei aufgeführt.

## Lizenz & Haftung

**Quellcode: [MIT](./LICENSE).** Kopieren, ändern, weitergeben, intern ausrollen – erlaubt, auch
kommerziell. Bedingung ist einzig, dass Copyright-Hinweis und Lizenztext in jeder Kopie mitgehen.
MIT ist bewusst gewählt: Die App soll in Unternehmen weitergereicht werden können, ohne dass vorher
jemand eine Rechtsabteilung fragen muss.

**Privates Projekt, unentgeltlich.** Kein Support, keine zugesagte Reaktionszeit, keine Zusage auf
Fortbestand einer Funktion. Bereitstellung ohne jegliche Gewährleistung, Nutzung auf eigene Gefahr,
**keine Haftung jeglicher Art** – insbesondere nicht für die Richtigkeit der dargestellten Daten
oder für Entscheidungen, die darauf aufbauen.

**Achtung bei Weitergabe und Fork:** Die MIT-Lizenz deckt nur den Quellcode. Die mitgelieferten
Geodaten stehen unter ODbL, dl-de/by-2-0 bzw. CC BY 4.0 – diese verlangen Namensnennung und wirken
auch auf abgeleitete Datenbestände fort. Einzelheiten: [NOTICE](./NOTICE).

## Kontakt & Impressum

**Günter Struck** · Lönsberg 8 · 45136 Essen · tourfuchs@online.de

**Made with 🦊 in Germany**
