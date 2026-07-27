# 🦊 TourFuchs – Onboarding & Go-to-Market

**Stand:** 25.07.2026 · **Rolle:** Product Owner · **Status:** Entscheidungsvorlage

---

## 1. Die Leitmetrik

Alles in diesem Dokument zahlt auf **eine** Zahl ein:

> **TTOD – Time to own Data:** Sekunden vom ersten Öffnen bis zu den **eigenen**
> Kunden auf der Karte.

Heute realistisch: **3 bis 5 Minuten** (aus dem CRM exportieren, speichern,
wiederfinden, hochladen, Spalten prüfen, bestätigen).
Mit dem Einfüge-Weg möglich: **unter 40 Sekunden** – nur weiß es niemand.

Zielwert: **≤ 60 Sekunden für 80 % der Erstnutzer.**

Warum diese Metrik und nicht „Onboarding-Abschlussrate": Ein Nutzer, der alle
Live-Demos gesehen hat, aber keine eigenen Daten geladen hat, ist verloren. Ein
Nutzer, der keine einzige Demo gesehen hat, aber seine 400 Kunden auf der Karte
sieht, ist gewonnen. Die Demos sind Mittel, nicht Zweck.

---

## 2. Onboarding – Diagnose

### 2.1 Zustimmung mit einer Einschränkung

„Onboarding ist 90 %" – **ja, aber**: Nicht *mehr* Onboarding, sondern
*schnelleres*. TourFuchs hat inzwischen viel Onboarding-Maschinerie:

- Willkommens-Choreografie (leere Karte → Beispielkunden erscheinen)
- zentrale Hinweiskarte „Das sind Beispieldaten"
- Demo-Streifen
- „Erste Schritte"-Checkliste
- **acht** Live-Demos mit Geister-Cursor
- Mobile-Vorschau-Kurzlauf
- Fuchs-Nudge

Das ist keine Lücke, das ist ein Überangebot. **Alle diese Bausteine erklären
die App – keiner beschleunigt den Weg zu den eigenen Daten.** Genau da liegt der
Hebel. Meine Empfehlung: **kein neuer Onboarding-Baustein**, sondern die
vorhandenen auf TTOD ausrichten und einen einzigen echten Belohnungsmoment
hinzufügen (siehe P2).

### 2.2 Der konkrete Befund zum Einfügen

Der schnellste Weg ist der am schlechtesten sichtbare:

| | heute |
|---|---|
| Ort | Textlink **unter** dem primären Datei-Knopf |
| Tiefe | im Dialog „Eigene Daten laden" – also einen Klick tief |
| Gewicht | `linklike`, also optisch drittrangig |
| Formulierung | „Strg+V" – am **Handy sinnlos** |
| Erwähnung im Willkommen | keine |
| Erwähnung in den Live-Demos | keine |

Ein Nutzer erfährt davon praktisch nur durch Zufall.

### 2.3 Der fehlende Belohnungsmoment

Nach dem Import passiert heute: Die Karte ist voll. Das ist ein Zustand, kein
Erlebnis. Es gibt keinen Satz, der sagt, was die App **gesehen** hat.

---

## 3. Onboarding – Maßnahmen

### P1 · Der Einfüge-Weg wird der Hauptweg (Desktop) — ✅ umgesetzt 26.07.2026

**Warum:** Auf dem Desktop ist die Liste in 9 von 10 Fällen ohnehin offen. Der
Datei-Umweg ist reine Gewohnheit aus Zeiten ohne Alternative.

- Im Dialog „Eigene Daten laden" **gerätespezifische Reihenfolge**:
  - **Desktop:** „📋 Liste aus Excel einfügen" als **primärer** Knopf,
    „Excel-/CSV-Datei auswählen" als zweite Option.
  - **Handy:** Datei/Teilen bleibt primär (Excel ist dort selten offen),
    Einfügen als zweite Option.
- Die zentrale Willkommenskarte bekommt den Weg **als eigene Zeile**, nicht
  versteckt hinter „Eigene Daten laden".
- **Mobile-Formulierung korrigieren:** statt „Strg+V" → „Ins Feld tippen,
  halten, **Einfügen** wählen". Die Anleitung erkennt das Gerät.

**Akzeptanz:** Auf dem Desktop ist der Einfüge-Weg ohne Scrollen und ohne
Aufklappen sichtbar. Am Handy steht nirgends „Strg".

### P2 · Der Befund nach dem Import — *der eigentliche Wow-Moment* — ✅ umgesetzt 26.07.2026

**Warum:** Das ist der Moment, in dem die App aufhört, eine Landkarte zu sein,
und anfängt, etwas zu **wissen**.

Direkt nach dem ersten Import, ruhig eingeblendet:

> **412 Kunden auf der Karte.**
> 6 Vertriebsbezirke · Bezirk Rheinland betreut **3,1×** so viele Kunden wie
> Bezirk Nord · **47 Kunden** sind überfällig.
> [Überfällige zeigen] [Tour planen]

Alle Zahlen liegen bereits vor (`territory.js`, `visits.js`). Kein neues
Konzept, keine neue Datenquelle – nur ausgesprochen, was ohnehin da ist.

**Akzeptanz:** Nach dem ersten eigenen Import steht innerhalb von 2 Sekunden ein
Satz auf dem Schirm, den der Nutzer vorher nicht wusste. Beim zweiten Import
erscheint stattdessen der Änderungsbericht (bereits gebaut).

### P3 · Reibung als Auslöser nutzen — ✅ umgesetzt 26.07.2026

Wer den Datei-Dialog öffnet und **ohne Auswahl abbricht**, hat gerade gemerkt,
dass er keinen fertigen Export hat. Genau dann – und nur dann:

> „Kein Export zur Hand? Wenn die Liste in Excel offen ist, genügt Kopieren und
> Einfügen." [Jetzt einfügen]

Das ist die beste Sorte Entdeckung: ausgelöst durch echte Not, nicht durch einen
Hinweis auf Vorrat.

### P4 · Die erste Live-Demo zeigt das Einfügen — ✅ umgesetzt 26.07.2026

Die Demo hieß „Vom Stapel zur Kundenkarte" und begann mit fertigen Daten. Sie
heißt jetzt **„Von der Excel-Liste zur Kundenkarte"** und führt am Schreibtisch
zuerst den Einfüge-Weg vor: Dialog öffnen, Beispieltabelle erscheint auf einen
Schlag im Feld, Befund, Dialog zu. Vorführen schlägt erklären.

**Bewusst ohne Import:** Die Vorführung fasst keine echten Daten an und nimmt
die Berechtigungs-Bestätigung am Ende zurück – auch bei Abbruch. Am Handy
entfallen die Schritte, dort ist Excel selten offen.

### P5 · Beispieldaten in der eigenen Region *(größer, später)*

Die Demo-Kunden liegen bundesweit. Fragt man beim Start nach der eigenen PLZ
(oder nutzt GPS), erscheinen sie **um den Nutzer herum**. Der Unterschied
zwischen „nette Demo" und „das ist ja meine Gegend" ist erheblich.

### Reihenfolge

**P1 + P3 + Mobile-Korrektur** in einem Paket (klein, sofort).
**P2** als eigenes Paket (das ist der Wow-Moment, der die Filmaufnahme trägt).
~~P4 zusammen mit dem Film~~ – ✅ umgesetzt. Demo und Film erzählen jetzt
dieselbe Geschichte: erst das Einfügen, dann die Karte.
**P5** danach, wenn überhaupt.

**Der Film sollte erst nach P1 und P2 gedreht werden** – sonst zeigt er ein
Produkt, das es so noch nicht gibt.

---

## 4. Go-to-Market – Positionierung

### 4.1 Was TourFuchs ist – in einem Satz

> Aus der Excel-Kundenliste wird eine Karte und ein Tagesplan. Ohne Konto, ohne
> Cloud, ohne dass die Kundendaten das Gerät verlassen.

### 4.2 Die drei Botschaften – in dieser Reihenfolge

1. **Geschwindigkeit:** Kopieren, einfügen, Karte. Sekunden statt Projekt.
2. **Alltagsnutzen:** Wen besuche ich Dienstag? Wer ist überfällig?
3. **Haltung:** Die Daten bleiben auf dem Gerät. Das ist kein Feature, das ist
   die Architektur – und der Grund, warum es ohne IT-Projekt nutzbar ist.

Botschaft 3 ist der Unterschied zu jedem CRM-Modul. Sie steht bewusst **hinten**:
Zuerst muss man sehen, was es kann; dann wird interessant, wie es das macht.

### 4.3 Zielgruppe und Kanal

| Zielgruppe | Kanal | Erwartung |
|---|---|---|
| Außendienst, Vertriebsleitung, Servicetechnik (DACH) | **LinkedIn** | echte Nutzer, Gespräche |
| Entwickler, Local-First-/PWA-Interessierte | **Reddit** | fachliches Feedback, Reichweite – **keine** Vertriebsnutzer |

**Klar sein:** Reddit bringt keine Außendienstler. Der deutschsprachige Vertrieb
ist dort nicht. Reddit ist die richtige Bühne für die *technische* Geschichte
und für ehrliches Feedback – wer es als Nutzerakquise misst, wird enttäuscht.

---

## 5. Der Film – Regie

**Format:** 90 Sekunden Hauptfilm (16:9) + 30-Sekunden-Schnitt (9:16, vertikal).
**Werkzeuge:** Bildschirmaufnahme + Clipchamp (Schnitt, Untertitel, Musik),
Sprecherstimme aus dem Skript in Abschnitt 5.3.

### 5.1 Die zentrale Regieentscheidung

**Der Film beginnt nicht mit der App, sondern mit dem Schmerz.** Erstes Bild ist
eine Excel-Tabelle – eine Wand aus Zeilen. Jeder in der Zielgruppe kennt dieses
Bild und weiß sofort, dass er gemeint ist. Die App darf erst auftreten, wenn die
Frage im Raum steht.

**Die zweite Entscheidung:** Der Beweis am Ende. Statt zu behaupten, dass nichts
das Gerät verlässt, wird der **Flugmodus eingeschaltet** – und die App arbeitet
weiter. Ein sichtbarer Beweis schlägt drei Sätze Marketing.

### 5.2 Einstellungsliste

| # | Zeit | Bild | Text im Bild |
|---|---|---|---|
| 1 | 0:00–0:08 | Excel, ~400 Zeilen, langsames Scrollen | – |
| 2 | 0:08–0:12 | Bereich markieren, **Strg+C** (Tastendruck einblenden) | `Strg + C` |
| 3 | 0:12–0:20 | TourFuchs, Einfügen, **Strg+V** → Karte füllt sich. **Kein Schnitt.** | `Strg + V` |
| 4 | 0:20–0:30 | Der Befund erscheint (P2): Kunden, Bezirke, Überfällige | – |
| 5 | 0:30–0:38 | Einfärbung nach Vertriebsbezirk, Zoom in eine Region | „Farbe = Vertriebsbezirk" |
| 6 | 0:38–0:52 | Standort setzen, Umkreis, Vorschläge, **Reihenfolge optimieren** | „Route optimieren" |
| 7 | 0:52–1:02 | **Kamerabild:** Handy scannt den QR-Code vom Monitor, Tour erscheint | „Bildschirm → Kamera" |
| 8 | 1:02–1:10 | Handy: Stopp abhaken, Feierabend-Rückblick | – |
| 9 | 1:10–1:22 | **Flugmodus an**, App arbeitet weiter, Karte reagiert | „Flugmodus" |
| 10 | 1:22–1:30 | Ruhige Karte, Logo, Adresse | `tourfuchs.vercel.app` |

**Einstellung 3 und 7 sind der Film.** Wenn Zeit knapp wird, kürze 5 und 6, nie
diese beiden. Einstellung 3 muss **ungeschnitten** laufen – ein Schnitt würde
genau die Behauptung untergraben, die sie beweisen soll.

### 5.3 Sprechertext (fertig für Sprachausgabe)

*Hinweise für die Vertonung: kurze Sätze, keine Abkürzungen, Zahlen
ausgeschrieben. `//` markiert eine deutliche Pause. Ruhiger, sachlicher Ton –
nicht Werbestimme, sondern Kollege.*

```
Das hier ist ein Vertriebsgebiet.  //  Vierhundert Kunden. Eine Excel-Liste.
//
Und jetzt die Frage: Wen besuchen Sie am Dienstag?

Markieren. Kopieren.  //  Einfügen.

Das ist dasselbe Gebiet.  //  Nur eben sichtbar.

Und TourFuchs sagt Ihnen sofort, was drinsteht:
sechs Vertriebsbezirke, ungleich verteilt.  //  Siebenundvierzig Kunden sind überfällig.

Die Farbe zeigt den Bezirk. Rot heißt: zu lange her.

Standort setzen. Umkreis wählen.
TourFuchs schlägt vor, wen Sie unterwegs mitnehmen können.
Ein Klick sortiert die Route auf die kürzeste Strecke.

Die fertige Tour kommt so aufs Handy:  //  Bildschirm zeigen, Kamera scannen.
Kein Konto. Kein Versand. Kein Server dazwischen.

Unterwegs haken Sie ab.  //  Und abends steht da, was der Tag gebracht hat.

Und jetzt der wichtigste Teil.  //
Nichts von alledem war im Internet.
Ihre Kundendaten liegen im Browser. Verschlüsselt, wenn Sie das möchten.
Auch ohne Netz.

TourFuchs.  //  Aus der Liste wird ein Plan.
```

### 5.4 30-Sekunden-Schnitt (vertikal, für Feed und Story)

Nur vier Einstellungen: **Excel-Wand → Einfügen → Karte → Flugmodus.**

```
Vierhundert Kunden in Excel.  //  Wen besuchen Sie am Dienstag?
Kopieren.  //  Einfügen.  //  Fertig.
Und das Beste:  //  nichts davon war im Internet.
TourFuchs. Aus der Liste wird ein Plan.
```

Untertitel sind Pflicht – der Feed läuft stumm. Clipchamp erzeugt sie
automatisch; die Rechtschreibung **muss** nachkontrolliert werden, besonders
„TourFuchs".

### 5.5 Produktionshinweise – bitte ernst nehmen

- **Niemals echte Kundendaten aufnehmen.** Für den Film eine erfundene Liste
  bauen: ausgedachte Firmennamen, echte Postleitzahlen, plausible Umsätze.
- **Vorteil dieser Regel:** Eine eingefügte Fantasieliste gilt für die App als
  „eigene Daten" – damit verschwindet der Beispieldaten-Streifen von selbst und
  der Film sieht sauber aus. Die Demo-Daten der App wären im Video sichtbar als
  Demo markiert; das wirkt im Film unfertig.
- Bildschirm aufräumen: keine Lesezeichenleiste, keine Benachrichtigungen,
  neutraler Hintergrund, 1920 × 1080.
- Mauszeiger ruhig führen. Langsamer als es sich beim Aufnehmen richtig anfühlt.
- Tastendrücke einblenden (Clipchamp-Textfeld genügt) – sonst sieht niemand,
  wie wenig passiert ist.
- Musik aus der Clipchamp-Bibliothek (lizenzfrei), leise, unter der Stimme.
- Einstellung 7 mit dem Handy filmen, nicht simulieren. Die kleine Unschärfe
  der Handkamera macht den Moment glaubwürdig.

---

## 6. LinkedIn

Drei Beiträge über zwei Wochen, nicht einer. Der Film ist Beitrag zwei – ein
Video als Kaltstart hat wenig Reichweite, wenn niemand die Frage kennt, die es
beantwortet.

**Handwerk:** Link **nicht** in den Beitrag, sondern in den ersten Kommentar
(LinkedIn drosselt Beiträge mit externem Link). Erste zwei Zeilen entscheiden –
danach klappt der Text ein. Höchstens drei Hashtags. In den ersten zwei Stunden
auf Kommentare antworten.

### Beitrag 1 – Das Problem (Bild: die Karte)

```
Vierhundert Kunden. Eine Excel-Liste. Und die Frage, die sich jeden Sonntagabend
wiederholt: Wen besuche ich diese Woche?

Ich habe im Vertrieb lange mit Listen gearbeitet, die alles wussten – außer dem
Einen: wo die Kunden eigentlich liegen. Zwei Spalten weiter stand, wann jemand
zuletzt besucht wurde. Zusammengedacht hat das niemand. Auch kein CRM.

Also habe ich es gebaut. Kundenliste rein, Deutschlandkarte raus. Farbe zeigt
den Vertriebsbezirk, Rot heißt „zu lange her".

Das Überraschende war nicht die Karte. Sondern was man sieht, sobald sie da ist:
Ein Bezirk betreute dreimal so viele Kunden wie der Nachbarbezirk. Über Jahre.
Niemandem aufgefallen, weil niemand es je nebeneinander gesehen hat.

Kennt jemand das Problem – oder habt ihr das im Griff?

#Vertrieb #Außendienst
```

### Beitrag 2 – Der Film

```
Neunzig Sekunden. Von der Excel-Liste zum fertigen Tagesplan.

Der Teil, auf den ich am meisten stolz bin, kommt am Ende: Ich schalte den
Flugmodus ein – und die App arbeitet weiter.

Denn genau das ist die Bauweise. Es gibt keinen Server, auf dem Kundendaten
liegen. Sie bleiben im Browser, verschlüsselt, wenn man will. Kein Konto, keine
Anmeldung, kein IT-Projekt.

Das hat einen Preis: keine Synchronisierung zwischen Geräten. Wer eine Tour aufs
Handy will, scannt einen QR-Code vom Bildschirm. Bildschirm zu Kamera, mehr
nicht.

Für mich der richtige Tausch. Für alle? Sagt es mir.

#Vertrieb #PWA #Datenschutz
```

### Beitrag 3 – Die Haltung *(erfahrungsgemäß der stärkste)*

```
„Wo liegen die Daten?"

Diese Frage beendet mehr Werkzeug-Einführungen im Vertrieb als jeder Preis.
Zu Recht: In einer Kundenliste steht, mit wem das Unternehmen Geld verdient.
Das lädt niemand leichtfertig irgendwo hoch.

Also habe ich die Frage umgedreht: Was, wenn die Daten das Gerät gar nicht erst
verlassen?

Kundenliste einfügen, Karte, Tourplanung, Navigation – alles rechnet im Browser.
Kein Konto, kein Server, kein Tracking. Optional AES-256-verschlüsselt hinter
einer PIN.

Was das kostet: keine Synchronisierung, kein Team-Zugriff, kein zentrales
Reporting.
Was es bringt: Man kann morgen früh anfangen. Ohne Freigabe, ohne Projekt, ohne
Vertrag.

Für ein Werkzeug, das ein einzelner Außendienstler auf seiner Tour benutzt,
halte ich das für den besseren Tausch.

#Datenschutz #Vertrieb #LocalFirst
```

---

## 7. Reddit

### 7.1 Grundregeln – sonst geht es nach hinten los

1. **Nichts in deutschen Vertriebsforen posten.** Es gibt sie praktisch nicht,
   und Selbstwerbung fliegt dort sofort raus.
2. **Die technische Geschichte erzählen, nicht das Produkt bewerben.** Auf
   Reddit gewinnt, wer eine *Entscheidung* erklärt, nicht wer ein Werkzeug
   anpreist.
3. **Von Anfang an offenlegen:** „Ich habe das gebaut."
4. **`r/opensource` und `r/selfhosted` sind offen**, seit die Lizenz MIT lautet
   (siehe Abschnitt 8.1). Vorher wäre „Alle Rechte vorbehalten" dort binnen
   Minuten aufgegriffen worden, und es wäre nur noch darum gegangen.
5. Vor dem Posten die Regeln des jeweiligen Subreddits lesen. Jedes hat eigene
   Vorgaben zu Eigenwerbung.

### 7.2 Geeignete Foren

| Subreddit | Aufhänger | Erwartung |
|---|---|---|
| `r/SideProject` | „Habe eine PWA gebaut, die ohne Backend auskommt" | wohlwollend, wenig Tiefgang |
| `r/webdev` | die technischen Entscheidungen | echtes Feedback, kritisch |
| `r/PWA` | File-Handler, Teilen-Ziel, WebAPK-Fallstricke | klein, sehr passend |
| `r/kaufmannsgehilfe`, `r/de` | nur bei sehr zurückhaltender Formulierung | riskant, eher lassen |

### 7.3 Entwurf für `r/webdev` (englisch)

**Titel:** *I built a field-sales PWA with no backend at all — customer data
never leaves the browser. Here's what that cost me.*

```
Field sales reps get a customer list as an Excel file. Nobody wants to upload
that to a SaaS tool — it's the list of who the company makes money from. So I
tried the other direction: no backend, at all.

Everything runs in the browser. Excel/CSV parsing, geocoding from a bundled
postcode dataset, territory polygons, route optimisation (nearest neighbour +
2-opt), IndexedDB persistence, optional AES-256-GCM encryption via WebCrypto
behind a PIN.

What that bought me:
- No account, no login, no onboarding friction. Paste a table, see a map.
- Works offline. Service worker caches the app shell, territory data and the
  map tiles you've already looked at.
- The privacy claim is trivially verifiable — open devtools, watch the network
  tab do nothing.

What it cost me:
- No sync. Getting a planned route from desktop to phone happens via a QR code
  on screen, scanned by the phone camera. Screen to camera, no network.
- No server means no shared state, no team features, no central reporting.
- Android share-target needs a service worker POST handler, and the entry only
  appears when the WebAPK is (re)installed — that one cost me an evening.
- 400 district polygons plus postcode layers is a lot of GeoJSON to ship.
  Simplification and lazy loading per zoom level.

Stack is deliberately boring: Vite, vanilla ES modules, Leaflet, SheetJS,
Workbox. No framework.

I built this for my own use, so I'm curious where you'd push back — particularly
on the "no sync, use a QR code" trade. Is that a reasonable answer for a
single-user tool, or am I rationalising a limitation?

(My project, demo data loads by default, nothing to sign up for.)
```

### 7.4 Entwurf für `r/PWA` (kürzer, technischer)

**Titel:** *Share target + file handlers on Android: the entry only appears when
the WebAPK is reinstalled*

```
Spent an evening on this, posting in case it saves someone else the time.

I added `share_target` and `file_handlers` to my manifest so users can send an
Excel attachment straight into the app. Deployed, verified the manifest was
live, and… the app still wasn't in the Android share sheet.

Two things I'd misunderstood:

1. The share entry is baked into the WebAPK at install time. Chrome re-reads
   the manifest and requests a fresh WebAPK on its own schedule, so an existing
   install won't pick it up straight away. Uninstall + reinstall makes it
   immediate.
2. My `accept` list was too narrow. File managers and mail clients report the
   same .xls under several MIME types (`application/msexcel`,
   `application/x-msexcel`, `application/excel`). I deliberately did NOT add
   `application/octet-stream` — that would put the app in the share sheet for
   literally every file, which seemed rude.

The POST itself is handled entirely in the service worker: it takes the
FormData, stashes the file in a cache, and redirects to `/?share=1`. The page
picks it up from there. Nothing is uploaded — there is no server.

Anyone found a reliable way to test share-target changes without the
uninstall/reinstall dance?
```

---

## 8. Risiken und offene Entscheidungen

### 8.1 Die Lizenzfrage – entschieden: MIT

**Erledigt.** Der Quellcode steht seit dem Lizenzwechsel unter **MIT**, dazu eine
`NOTICE`, die festhält: privates Projekt, unentgeltlich, kein Support, ohne
Gewähr.

Warum MIT und nicht das ursprünglich erwogene „Schaufenster" (alle Rechte
vorbehalten):

- **Die Zielgruppe sitzt in Konzernen.** MIT verlangt Namensnennung in jeder
  Kopie und macht sonst keine Prüfprobleme – niemand muss vor dem Ausprobieren
  eine Rechtsabteilung fragen. „Alle Rechte vorbehalten" an einem öffentlichen
  Repository ist genau der Widerspruch, an dem ein technisches Publikum
  hängenbleibt.
- **AGPL würde kommerzielle Übernahmen verhindern** – aber eben auch die interne
  Verbreitung ausbremsen, auf die alles hier setzt. Der Schutz, den sie bietet,
  kostet genau das, was erreicht werden soll.
- **Geld ist ausdrücklich nicht das Ziel.** Was zählt, ist Verbreitung und
  soziales Kapital. Dazu passt die Lizenz, die am wenigsten im Weg steht.

Was MIT **nicht** deckt: die mitgelieferten Geodaten. ODbL, dl-de/by-2-0 und
CC BY 4.0 gelten unabhängig fort und wirken auch auf abgeleitete Datenbestände.
Steht in `NOTICE` und in „Lizenz & Rechtliches" in der App.

Für den Post heißt das: Die Lizenzfrage ist keine Gefahr mehr, sondern eine
Antwort. Ein Halbsatz genügt – „MIT, privates Projekt, ohne Gewähr".

### 8.2 Weitere Punkte

- **Haftung:** Das Projekt ist ausdrücklich privat und ohne Gewähr. In jedem
  Beitrag als das benennen, was es ist – ein privates Werkzeug, kein Angebot.
  Keine Formulierung, die nach Vertrieb oder Zusicherung klingt.
- **Datenschutzfragen kommen sicher.** Vorbereitete Antwort: „Die Kundendaten
  liegen ausschließlich im Browser (IndexedDB), optional AES-256-verschlüsselt.
  Externe Aufrufe gibt es nur für Kartenkacheln und – nach ausdrücklicher
  Zustimmung – für optionale Adressverortung und Straßenrouten. Nachlesbar in
  der Datenschutzerklärung, nachprüfbar im Netzwerk-Tab."
- **Rückmeldungen einsammeln, nicht nur Reichweite zählen.** Die drei Fragen,
  die wirklich interessieren: Wie lange bis zu den eigenen Daten? Woran ist es
  gescheitert? Was hat gefehlt?
- **Kein Tracking – bewusst.** Es wird keine Zahlen geben. Der Erfolgsmaßstab
  sind Kommentare und Gespräche, nicht ein Dashboard. Das ist die logische Folge
  der Bauweise und in Ordnung – man muss es nur vorher wissen.

---

## 9. Reihenfolge

1. ~~Onboarding P1 + P3 + Mobile-Korrektur~~ – ✅ umgesetzt.
2. ~~Onboarding P2 (Befund nach dem Import)~~ – ✅ umgesetzt.
3. **Film drehen** – die Voraussetzungen stehen jetzt. Einstellung 4 der
   Einstellungsliste (der Befund) ist ab sofort echt und nicht nachgestellt.
4. **LinkedIn Beitrag 1** (Problem), zwei Tage später **Beitrag 2** (Film), eine
   Woche später **Beitrag 3** (Haltung).
5. **Reddit** – die Lizenzentscheidung steht (MIT), damit ist der Weg frei.
   Trotzdem nur mit Zeit für Antworten am Tag des Postens.
