# 🎬 Der Film: Lasso + Briefing

**Ein Satz, sechzig Sekunden, ein Beitrag.**
Drehbuch für den LinkedIn-Film über das, was TourFuchs von allem anderen
unterscheidet.

Der allgemeine Go-to-Market-Plan steht in [go-to-market.md](./go-to-market.md);
dort ist auch der große 90-Sekunden-Film beschrieben (Excel → Karte → Flugmodus).
**Dieser Film hier ist der kleinere und der wichtigere.** Er erklärt nicht, was
TourFuchs alles kann – er zeigt die eine Kombination, die es sonst nirgends gibt.

## Fertiger Film zum Herunterladen

Die veröffentlichten Fassungen mit dem beispielhaften Wechsel zu einem Sales
Agent liegen hier:

- [LinkedIn 4:5 – 1080 × 1350](../film/tourfuchs-linkedin-mit-sales-agent.mp4)
- [Shorts/Reels 9:16 mit Desktop-Ansicht – 1080 × 1920](../film/tourfuchs-shorts-9x16-ohne-musik.mp4)
- [Shorts/Reels 9:16 mit Mobile-Ansicht – 1080 × 1920](../film/tourfuchs-shorts-9x16-mobile-ohne-musik.mp4)
- [Samsung Galaxy S24 mit Mobile-Ansicht – 1080 × 2340](../film/tourfuchs-samsung-s24-1080x2340-ohne-musik.mp4)

Alle vier Dateien sind MP4/H.264 mit konstanten 30 fps. Die ersten drei
Fassungen sind 69 Sekunden lang; die erweiterte S24-Fassung dauert 1:54 Minuten
und erzählt den Ablauf bis zur fertigen Straßenroute. Die drei Hochkantfassungen
erzeugen zwischen den UI-Zuständen zusätzliche Zwischenbilder, statt dieselben
Bilder nur zu wiederholen. Alle Fassungen sind **ohne Musik** und damit zugleich
Ausgangsdateien für einen späteren Schnitt mit separat lizenzierter Musik. Alle
im Film gezeigten Firmen, Vorgänge und KI-Quellen sind erfunden.

Die Mobile-Fassung zeigt nicht etwa einen beschnittenen Desktop. TourFuchs läuft
darin mit Touch-Eingabe bei 720 × 1280 Pixeln: Karte über die volle Fläche,
Bottom-Sheets statt Seitenleiste und die echten mobilen Dialoge. Für den
Endschnitt werden sechs reale UI-Zustände pro Sekunde aufgenommen und flüssig
auf konstante 30 fps ergänzt. Titel, Dramaturgie, Sales-Agent-Beispiel und
Abspann entsprechen der Desktop-Porträtfassung.

Die S24-Fassung geht einen Schritt weiter: TourFuchs läuft mit 360 × 780
CSS-Pixeln und dreifacher Pixeldichte. Die aufgenommenen App-Bilder entstehen
dadurch direkt mit 1080 × 2340 Pixeln im Geräteverhältnis 19,5:9. Auch die
beispielhafte Sales-Agent-Szene ist dort einspaltig für das Smartphone gebaut.
Nach der KI-Priorisierung kehrt der Film in dieselbe erhaltene Lasso-Auswahl
zurück: Zwei Kunden werden bewusst ausgewählt, ein Startpunkt wird gesetzt und
die Tour zuerst als Luftlinie, dann – nach Zustimmung – als echte Straßenroute
gezeigt. Ruhige Kapitelkarten trennen Assistent, Auswahl und Tourplanung.
Für Instagram Reels, TikTok und YouTube Shorts bleibt die standardisierte
1080-×-1920-Mobile-Fassung meist die passendere Upload-Datei; die S24-Fassung
zeigt dagegen die unverfälschte Geräteansicht ohne Beschnitt.

Reproduzierbarer Mobile-Lauf nach `npm run build`:

```sh
npm run film -- --format=hochkant --demo=lasso --capture-mobile-frames
zsh film/render-shorts-mobile-sales-agent.sh
```

Reproduzierbarer Samsung-S24-Lauf nach `npm run build`:

```sh
npm run film -- --format=s24 --demo=lasso --capture-mobile-frames
zsh film/render-samsung-s24-sales-agent.sh
```

---

## 1. Die Aussage

> **Ich ziehe eine Fläche um ein Gebiet und weiß sofort, wer dort liegt.
> Dann lasse ich mir von einer KI meiner Wahl sagen, was bei diesen Kunden
> gerade los ist – und entscheide danach, wen ich wirklich besuche.**

Das sind zwei Hälften, und beide braucht der Film:

| Hälfte | Was sie zeigt | Wer das sonst kann |
|---|---|---|
| **Lasso** | eine Geste statt eines Formulars – Fläche umfahren, Treffer stehen da | manche CRM-Karten, meist als Filterdialog |
| **Briefing** | fertiger Prompt in der Zwischenablage, KI der Wahl, Antwort entscheidet die Reihenfolge | **praktisch niemand** |

**Die zweite Hälfte trägt den Film.** Ein Lasso ist hübsch; ein Lasso, aus dem
ein recherchierbarer Prompt fällt, ist neu. Wer nach dreißig Sekunden abschaltet,
soll trotzdem den Prompt gesehen haben – deshalb kommt er früh.

Was der Film **nicht** sagt: dass TourFuchs mit einer KI verbunden ist. Ist es
nicht, und das ist der Punkt. Der Prompt geht in die Zwischenablage, den Rest
macht der Mensch in seinem Assistenten. Diese Grenze ist im Film sichtbar
(„Absenden tust du selbst") und in jedem Kommentar die Antwort auf die erste
Rückfrage, die kommen wird.

---

## 1a. Wie der Film entsteht: `npm run film`

**Der Film wird nicht aufgenommen, er wird erzeugt.** Es gibt keinen Grund, eine
Bildschirmaufnahme von Hand zu machen: Die Live-Demo bedient die echte App
bereits selbsttätig und in jedem Anlauf gleich. `tools/film.mjs` setzt nur eine
Kamera davor.

```
npm run build
npm run film                       # 16:9, für den Feed
npm run film -- --format=hochkant  # 9:16, für Story und Reels
npm run film -- --demo=briefing    # zweite Fassung, Schwerpunkt Prompt
```

### Zwei Fassungen, zwei Schwerpunkte

`--demo` wählt die Live-Demo, die gefilmt wird. Zwei taugen dafür, und sie
beantworten verschiedene Fragen:

| Fassung | Trägt | Antwortet auf | Länge |
|---|---|---|---|
| `lasso` *(Voreinstellung)* | die **Geste** – Fläche umfahren, Treffer stehen da | „Was kann das?" | 1:09 |
| `briefing` | den **Prompt** – durchgescrollt, mit dem, was drinsteht und was nicht | „Was schickt ihr da eigentlich weg?" | 1:17 |

Der Unterschied ist nicht der Schnitt, sondern die Vorführung: In der
Briefing-Fassung ist die Fläche nur der Anlauf (zwei Sätze), dafür wird der
Prompt **von oben bis unten durchgescrollt** – samt Quellenanweisung, Aufgabe
und Qualitätsregeln – und der Absatz „Nicht enthalten: Umsatz, Telefon, E-Mail,
Straße" ausdrücklich benannt. Rund 58 % der Laufzeit liegen im Briefing statt
wie in der Lasso-Fassung 38 %.

**Welche wofür:** `lasso` ist der bessere Erstkontakt – die Geste versteht man
in zehn Sekunden ohne Vorwissen. `briefing` ist die Fassung für die zweite
Frage, die in jedem Konzern kommt, und damit die bessere Antwort in Kommentaren,
in einer internen Vorstellung oder als Beitrag 3 zum Thema Haltung.

Vor- und Abspann unterscheiden sich mit: Die Briefing-Fassung öffnet mit
„Die Karte weiß, *wo* die Kunden sind. Nicht, was dort gerade läuft." und landet
auf „Ein Prompt. Deine KI. Deine Entscheidung."

Einmalige Einrichtung (bewusst nicht in `package.json`, damit ein normales
`npm install` keinen Browser und kein ffmpeg herunterlädt):

```
npm i -D playwright ffmpeg-static && npx playwright install chromium
```

Was der Lauf tut, der Reihe nach:

1. startet die gebaute App in einer echten Chromium-Sitzung,
2. blendet die **Titelkarte** ein und erledigt dahinter die ganze Vorbereitung –
   insbesondere fügt er die erfundene Kundenliste ein, damit die App **eigene
   Daten** hat und der Prompt echt ist (siehe Abschnitt 3.1),
3. startet die Live-Demo **„Fläche umfahren, Briefing bekommen"** und filmt sie,
4. blendet den **Abspann** ein (Adresse, „alle Kunden erfunden"),
5. schneidet die Vorbereitung vorne ab und wandelt nach **MP4/H.264, 30 fps** –
   direkt bei LinkedIn hochladbar,
6. schreibt eine **Schnittliste** mit dem echten Timecode jedes gesprochenen
   Satzes.

Ergebnis in `film/` (nicht im Repository – der Film entsteht jederzeit neu):

```
film/tourfuchs-lasso-briefing-quer.mp4
film/schnittliste-quer.md
```

Vor- und Abspann sind **Einblendungen in der Seite**, kein Videoschnitt
hinterher. Der Film entsteht dadurch in einem Stück, ohne Schnittprogramm, und
sieht nach jeder App-Änderung wieder aktuell aus. Wer den Text ändern will,
ändert ihn in `KARTEN_CSS` bzw. den beiden `zeigeKarte`-Aufrufen in
`tools/film.mjs`.

**Was der Lauf nicht kann:** sich bei einem KI-Assistenten anmelden. Der
KI-Einschub ist der einzige Teil, der von Hand entsteht – wenn man ihn
überhaupt will (Abschnitt 3.2). Die Schnittliste nennt die Sekunde, an der er
hingehört.

---

## 2. Die Regieentscheidung: Der Film ist die Live-Demo

TourFuchs hat einen Geister-Cursor, der die echte App bedient – und die
Live-Demo **„🖊️ Fläche umfahren, Briefing bekommen"** erzählt seit dem Umbau
genau diese Geschichte, von der Fläche bis in die Tour. Sie ist damit kein
Werbematerial neben dem Produkt, sondern das Produkt selbst.

**Das heißt für die Produktion:**

- Es wird **nicht nachgestellt** und – seit `npm run film` – nicht einmal von
  Hand aufgenommen. Kein Schnittplan für die App-Teile.
- Die **Sprechblasen der Demo sind die Untertitel**. Der LinkedIn-Feed läuft
  stumm – hier steht der Text ohnehin schon im Bild, in ganzen Sätzen, lang
  genug zum Lesen. Ein Voice-over ist optional (Text in Abschnitt 6), nicht
  nötig.
- Die Demo läuft in **jedem Anlauf gleich**. Misslingt eine Aufnahme, wird sie
  einfach wiederholt – es gibt keine Handbewegung, die man treffen muss.
- Was der Zuschauer sieht, kann er **selbst auslösen**: dieselbe Demo steht auf
  tourfuchs.vercel.app unter „Live-Demos". Das ist der stärkste Satz im
  Kommentar: *„Der Film ist keine Animation. Das ist die Demo, die du selbst
  starten kannst."*

**Ein einziger Schnitt ist nötig** – dort, wo die App aufhört und der Assistent
anfängt (Einstellung 5). Genau an dieser Stelle wartet die Demo ohnehin, weil
TourFuchs den Prompt nur kopiert und nichts sendet.

---

## 3. Vorbereitung – das ist die eigentliche Arbeit

### 3.1 Eine erfundene Kundenliste (Pflicht)

**Niemals echte Kundendaten aufnehmen.** Und es gibt einen zweiten Grund, der
für diesen Film entscheidend ist:

> **Mit Beispielkunden baut TourFuchs bewusst keinen Prompt.** Das Briefing
> zeigt dann die geschützte Vorschau („Für Beispielkunden wird kein Briefing
> erzeugt"). Der Film würde also genau die Hälfte verlieren, auf die es ankommt.

Eine eingefügte Fantasieliste gilt für die App als **eigene Daten** – damit ist
der Prompt echt, der Beispieldaten-Streifen verschwindet, und die Demo schaltet
selbsttätig auf ihre `realOnly`-Sätze um (der Prompt wird aufgeklappt und
erklärt, statt der Demo-Sperre).

**`npm run film` fügt diese Liste selbst ein** – sie steht als `KUNDENLISTE` in
`tools/film.mjs`. Hier steht sie für den Fall, dass von Hand gedreht oder etwas
ausprobiert werden soll: in Excel einfügen und **Strg+C**, oder direkt hier
kopieren und in TourFuchs unter **Daten → Liste einfügen** ablegen.

```
Kundenname	Kundennummer	PLZ	Ort	Vertriebsbezirk	Besuchsrhythmus	Letzter Besuch
Rheinstahl Fördertechnik GmbH	10021	45136	Essen	Bezirk West	6	02.01.2026
Berger Werkzeugbau KG	10044	45329	Essen	Bezirk West	8	14.11.2025
Nordhoff Antriebstechnik AG	10078	46045	Oberhausen	Bezirk West	6	20.03.2026
Kampmann Industrieservice GmbH	10092	46049	Oberhausen	Bezirk West	12	05.02.2026
Vosskuhl Metallverarbeitung	10113	45468	Mülheim an der Ruhr	Bezirk West	6	18.12.2025
Sauerland Hydraulik GmbH	10135	44787	Bochum	Bezirk Ruhr	8	09.04.2026
Emscher Anlagenbau AG	10151	44793	Bochum	Bezirk Ruhr	6	27.10.2025
Lindemann Kunststofftechnik	10166	45879	Gelsenkirchen	Bezirk Ruhr	10	11.05.2026
Hellweg Präzisionsteile GmbH	10182	44135	Dortmund	Bezirk Ruhr	6	22.01.2026
Westfalen Schweißtechnik KG	10199	44139	Dortmund	Bezirk Ruhr	8	30.03.2026
Ruhrtal Maschinenbau GmbH	10204	47051	Duisburg	Bezirk West	6	08.02.2026
Niederrhein Fluidtechnik AG	10218	47119	Duisburg	Bezirk West	12	16.06.2026
```

Erfundene Firmen, echte Postleitzahlen, **im Ruhrgebiet** – dorthin fährt die
Demo von selbst (`selectShowcaseTour`), und dort liegen die Kunden dicht genug,
dass ein Lasso mehrere trifft. Die Besuchsdaten sind so gestreut, dass die
Auswahlkarte „fällig" anzeigt; das ist der Grund, warum später jemand vorn
steht.

### 3.2 Damit die KI wirklich etwas findet (der unterschätzte Punkt)

Der Prompt sagt dem Assistenten: *„Durchsuche ausschließlich Microsoft-365-
Inhalte, auf die ich mit meinem Arbeitskonto zugreifen darf"* – und verbietet
ausdrücklich die Websuche. Das ist im Alltag genau richtig und **im Film ein
Problem**: Zu erfundenen Firmen findet ein frisches ChatGPT nichts und antwortet
korrekterweise mit „Nichts gefunden". Das wäre eine ehrliche, aber unbrauchbare
Aufnahme.

Zwei gangbare Wege:

**A – Erfundene Ablage (empfohlen).** Ein eigenes Projekt im Assistenten anlegen
und dort kurze Dateien hochladen, die aussehen wie interner Schriftverkehr zu
den erfundenen Firmen. Der Assistent antwortet dann **wirklich**, aus wirklich
vorhandenen (nur eben erfundenen) Quellen. Nichts am Bild ist gestellt.

**Die Ablage liegt fertig im Projekt: [`docs/film-ablage/`](./film-ablage/).**
Sechs Dateien – zwei Mail-Verläufe, eine Gesprächsnotiz, ein Angebot, ein
Wartungsbericht, ein Kalendereintrag –, abgestimmt auf die Kundennummern,
Fälligkeiten und den Bezugstag der Filmliste. Wie sie zu benutzen sind und was
dabei herauskommen sollte, steht in der
[README dort](./film-ablage/README.md).

Sechs der zwölf Firmen haben **bewusst keine Notiz**. So füllt der Assistent den
Abschnitt „## Nichts gefunden" wirklich – und der Film zeigt nebenbei, dass die
Regel „Erfinde nichts" greift.

**B – Der eigene Arbeits-Copilot mit echten Kunden.** Liefert das
überzeugendste Ergebnis und ist als Aufnahme heikel: echte Kundennamen, echte
Vorgänge. Wenn überhaupt, dann nur mit Unkenntlichmachung im Schnitt – und dann
lieber Weg A.

**Im Abspann steht in beiden Fällen ein Satz:** *„Alle Kunden und Vorgänge in
diesem Film sind erfunden."* Das kostet eine Sekunde und beantwortet eine Frage,
die sonst in den Kommentaren landet.

### 3.3 Bildschirm und Aufnahme – nur beim Drehen von Hand

`npm run film` bringt das alles selbst mit: eigenes Browserfenster in
1920 × 1080, keine Lesezeichenleiste, keine Benachrichtigungen, und die Demo
schaltet den Profi-Modus ohnehin ein (nur dort trägt die Auswahlkarte Häkchen –
der Schluss „2 zur Tour" ist genau das).

Wer trotzdem selbst aufnimmt:

- Fenster 1920 × 1080, keine Lesezeichenleiste, Benachrichtigungen aus,
  neutraler Hintergrund.
- **Profi-Modus einschalten**, bevor die Aufnahme läuft – das gibt ein ruhigeres
  Bild, als wenn die Demo mittendrin umschaltet.
- Assistent im Profi-Modus auf **ChatGPT** stellen (Daten → Briefing-Ziel), wenn
  Weg A gewählt wurde – sonst steht auf dem Knopf „Microsoft 365 Copilot
  öffnen" und im nächsten Bild geht ChatGPT auf. Solche Kleinigkeiten fallen im
  Film sofort auf.
- Aufnahmewerkzeug: Windows-Aufzeichnung oder Clipchamp genügt. **Kein**
  Mauszeiger-Hervorheben einschalten – der Geister-Cursor ist der Zeiger, ein
  zweiter Kringel daneben verwirrt.

---

## 4. Einstellungsliste (16:9, ca. 75 s)

Zeitangaben sind an der Live-Demo gemessen (12.08.2026, Produktions-Build):
mit eingefügter Fantasieliste **61 Sekunden**, mit Beispieldaten 51 – die
Differenz ist genau der Teil, um den es hier geht (Prompt aufklappen, erklären,
Zwischenablage). Mit Vorspann, KI-Einschub und Abspann ergibt das rund 75.

| # | Zeit | Bild | Text im Bild |
|---|---|---|---|
| 1 | 0:00–0:04 | Standbild: Karte mit Kunden, Titelkarte darüber | „Ich bin in dieser Gegend. Wen besuche ich?" |
| 2 | 0:04–0:20 | **Demo läuft:** Lasso-Knopf, Fläche wird gezogen, Treffer leuchten auf | (Sprechblase der Demo) |
| 3 | 0:20–0:28 | Auswahlkarte: Anzahl · fällige Kunden · Orte | (Sprechblase der Demo) |
| 4 | 0:28–0:45 | Briefing-Dialog, **Prompt wird aufgeklappt und sichtbar gescrollt** | „Der Prompt entsteht auf deinem Gerät" |
| 5 | 0:45–0:58 | **Schnitt.** Assistent: Prompt einfügen, absenden, Antwort läuft ein | „Deine KI. Deine Quellen." |
| 6 | 0:58–1:08 | Zurück in TourFuchs: Auswahl liegt noch da, zwei Häkchen, „🚩 2 zur Tour" | (Sprechblase der Demo) |
| 7 | 1:08–1:15 | Ruhige Karte, Logo, Adresse, Abspannzeile | `tourfuchs.vercel.app` · „Kunden erfunden" |

**Einstellung 4 und 5 sind der Film.** Wenn gekürzt werden muss, fallen 1 und 3
– niemals der Prompt und niemals die Antwort. Der Prompt muss **lesbar** sein:
lieber eine Sekunde länger stehen lassen und notfalls im Schnitt auf den oberen
Teil zoomen, in dem „Gebiet", die Kundenliste und die Aufgabe stehen.

**Zum Schnitt bei 0:45:** Die Demo sagt an dieser Stelle *„Ein Klick legt ihn in
die Zwischenablage und öffnet deinen Assistenten. Absenden tust du selbst."* –
das ist die Schnittmarke. Danach läuft die Demo im Hintergrund weiter; für
Einstellung 6 wird der Teil ab *„Zurück auf der Karte liegt deine Auswahl noch
genau so da"* verwendet. Beide Teile stammen aus **derselben** Aufnahme, es wird
nur der Assistent dazwischengelegt.

---

## 5. Der 30-Sekunden-Schnitt (9:16, für Feed und Story)

Vier Einstellungen, keine Erklärung:

**Lasso ziehen → Prompt → Antwort der KI → 2 zur Tour.**

Für das Hochformat wird das Bild auf die Karte beschnitten (die Seitenleiste
fällt weg). Alternativ – und ehrlicher – die Demo einmal in der
**Mobile-Vorschau** oder direkt auf dem Handy aufnehmen: Dort läuft dieselbe
Demo im Hochformat, mit dem Blatt statt der Seitenleiste, und man muss nichts
beschneiden.

Textkarten (weil im Feed nichts gehört wird):

```
Fläche umfahren.
Neun Kunden. Vier fällig.

Ein Prompt – auf dem Gerät gebaut.

Deine KI sagt, was dort läuft.

Du entscheidest, wer in die Tour kommt.
```

---

## 6. Sprechertext (optional)

Nur nötig, wenn der Film auch außerhalb des Feeds läuft (Vorstellung im Team,
Website). Im LinkedIn-Feed reichen die Sprechblasen.

*Ruhig, sachlich, kurze Sätze. `//` ist eine deutliche Pause.*

```
Ich bin in dieser Gegend unterwegs.  //  Und die Frage ist immer dieselbe:
Wen besuche ich zuerst?

Also ziehe ich eine Fläche um das, was mich interessiert.
Keinen Regler. Keinen Filterdialog.  //  Eine Bewegung.

Neun Kunden. Vier davon fällig.

Und jetzt der Teil, den ich woanders nicht gefunden habe:
TourFuchs schreibt daraus einen Prompt.  //  Hier, auf meinem Gerät.
Name, Kundennummer, Ort, Fälligkeit.  //  Kein Umsatz, keine Telefonnummer.

Ein Klick legt ihn in die Zwischenablage.
Abgeschickt wird er von mir.  //  In der KI, die ich ohnehin benutze.

Die sagt mir, was bei diesen Kunden gerade läuft.
Offene Vorgänge. Zugesagte Rückmeldungen.  //  Und eine Reihenfolge.

Zurück auf der Karte liegt meine Auswahl noch genau so da.
Zwei Häkchen.  //  Und die Tour steht.

Umfahren. Briefen lassen. Entscheiden.
TourFuchs.
```

---

## 7. Der LinkedIn-Beitrag

**Handwerk:** Video direkt hochladen (kein YouTube-Link). Die Adresse gehört in
den **ersten Kommentar**, nicht in den Beitrag – LinkedIn drosselt Beiträge mit
externem Link. Die ersten zwei Zeilen entscheiden, danach klappt der Text ein.
Höchstens drei Hashtags. In den ersten zwei Stunden auf Kommentare antworten.

```
Die meisten Vertriebswerkzeuge zeigen mir, wo meine Kunden sind.
Keines sagt mir, was dort gerade los ist.

Also habe ich beides zusammengelegt.

Im Video ziehe ich mit der Maus eine Fläche über ein Gebiet – kein Umkreis,
kein Filterdialog, einfach die Form, die ich meine. Ein Gewerbegebiet ist nun
mal kein Kreis. Neun Kunden, vier davon fällig.

Der zweite Teil ist der, auf den ich stolz bin: Aus dieser Auswahl baut die App
einen fertigen Prompt. Auf meinem Gerät. Er landet in der Zwischenablage – und
ich schicke ihn in der KI ab, die ich ohnehin benutze. Die durchsucht meine
eigenen Quellen und sagt mir, wo etwas offen ist.

Danach entscheide ich, wen ich wirklich besuche. Zwei Häkchen, Tour steht.

Die App selbst ruft keine KI auf und meldet sich nirgends an. Sie schreibt den
Prompt und hört da auf. Das klingt nach weniger, ist aber der Grund, warum man
das Ding einfach benutzen kann – ohne Freigabe, ohne Projekt, ohne dass eine
Kundenliste irgendwo hochgeladen wird.

Der Film ist übrigens keine Animation: Das ist eine Live-Demo, die in der App
steckt. Ihr könnt sie selbst starten.

(Alle Kunden im Video sind erfunden. Privates Projekt, kostenlos, ohne Gewähr.)

#Vertrieb #Außendienst #KI
```

**Erster Kommentar:**

```
Hier ausprobieren: tourfuchs.vercel.app – die Demo heißt „Fläche umfahren,
Briefing bekommen". Ohne Anmeldung, Beispieldaten sind schon geladen.
```

### Wo dieser Beitrag im Plan steht

Der Go-to-Market-Plan sieht drei Beiträge vor: Problem → Film → Haltung. Dieser
Film ist der **stärkere Kandidat für Beitrag 2** als der große 90-Sekunden-Film:
Er dauert ein Drittel, zeigt etwas Ungewohntes statt einer guten Ausführung des
Gewohnten, und er lässt sich in einem Nachmittag drehen. Der große Film kann
danach kommen – oder gar nicht.

---

## 8. Was der Film nicht zeigt (und warum das gut ist)

- **Keine Excel-Wand am Anfang.** Die gehört in den anderen Film. Dieser hier
  beginnt mitten in der Arbeit – der Zuschauer soll nicht lernen, wie Daten
  hineinkommen, sondern was danach möglich ist.
- **Kein Flugmodus-Beweis.** Der ist stark, aber er beantwortet eine andere
  Frage („wo liegen die Daten?"). Hier ist er ein Nebensatz im Beitragstext.
- **Keine Tourenoptimierung, kein QR-Code, kein Tresor.** Alles gut, alles
  Beilage. Ein Film über sechs Dinge ist ein Film über nichts.

---

## 9. Prüfschritte

### Nach `npm run film` – den fertigen Film ansehen

1. **Der Prompt ist lesbar** (etwa ab 0:30). Ist er zu klein, im Schnitt auf den
   oberen Teil zoomen – dort stehen Gebiet, Kundenliste und Aufgabe.
2. **Die Sätze sprechen vom echten Prompt**, nicht von der Demo-Sperre. Die
   Schnittliste zeigt sie alle; taucht dort „Für Beispielkunden bleibt es bei
   dieser Vorschau" auf, hat das Einfügen nicht geklappt und der Film ist
   unbrauchbar. Der Lauf meldet in dem Fall auch weniger geladene Kunden.
3. **Am Ende stehen zwei Kunden mit ✓ „in Tour"** in der Auswahlkarte.
4. Der Lauf endet mit `Vorführung ok`. Steht dort `FEHLER`, ist die Demo
   unterwegs hängengeblieben – dann `npm run demo-check -- --story=lasso`
   laufen lassen, das sagt, an welchem Schritt.

### Beim Drehen von Hand

1. Fantasieliste einfügen → 12 Kunden auf der Karte, **kein**
   Beispieldaten-Streifen mehr.
2. Profi-Modus an, Briefing-Ziel auf den gewünschten Assistenten gestellt.
3. Live-Demo einmal komplett durchlaufen lassen und dieselben drei Punkte
   prüfen.
4. Erst dann aufnehmen. Die Demo verändert die Tour nur vorübergehend und stellt
   den vorherigen Stand danach wieder her – ein zweiter Anlauf ist gefahrlos.
