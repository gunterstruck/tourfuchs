# Gestaltprinzip: Aufmerksamkeit

**Stand:** 01.08.2026 · **Rolle:** Product Owner · **Status:** Prüfregel, kein Umbauauftrag

---

## Wozu dieses Dokument

TourFuchs ist an seinen besten Stellen bereits nach einem Prinzip gebaut, das
nirgends aufgeschrieben stand. Die Zoom-Automatik der Karte, das eingeklappte
Tour-Akkordeon, das Zurücktreten der Angebote beim Scrollen – das sind keine
drei Einfälle, das ist dreimal dieselbe Regel. Ohne Namen ließ sie sich nicht
prüfen, nicht begründen und beim nächsten Feature nicht verteidigen.

Dieses Dokument gibt ihr einen Namen und ein Messgerät. Es ist ausdrücklich
**keine Aufforderung, etwas umzubauen**. Es ist die Frage, die ab jetzt jedes
neue Feature beantworten muss.

---

## 1. Die Regel

> **Zeige immer nur das, was für den nächsten Gedanken wichtig ist.
> Nicht mehr. Aber auch nicht weniger.**

Der Mensch erlebt die Welt nicht als Liste, sondern als Landschaft. Die
Aufmerksamkeit liegt auf einem Ausschnitt; alles andere verschwindet nicht, es
rückt zurück. Wird etwas interessant, geht man näher heran, und dabei entsteht
Bedeutung: Aus einem Symbol wird ein Objekt, aus dem Objekt eine Geschichte, aus
der Geschichte ein Zusammenhang.

Genau das macht die Karte längst. Weit herausgezoomt sind Vertriebsgruppen
Flächen, in mittlerer Höhe Bezirke, nah dran einzelne Kunden
(`src/features/mapLevel.js`). Der Detailgrad wächst mit dem Interesse, nicht mit
dem Menü.

## 2. Die vier Prüffragen

Jedes neue Feature, jede neue Ansicht, jeder neue Dialog beantwortet vier
Fragen. Sie gehören in die Definition of Done.

### 2.1 Welchen nächsten Gedanken unterstützt das?

Nicht „welche Daten zeigt das", sondern: In welchem Moment steht ein Mensch
davor, und was will er als Nächstes wissen? Wer die Frage nicht in einem Satz
beantworten kann, hat noch kein Feature, sondern eine Datenansicht.

### 2.2 Was verdrängt es – und wie kommt der Nutzer zurück?

Jedes neue Element nimmt einem anderen den Platz oder die Aufmerksamkeit.
Verdrängung ist erlaubt, **stille Verdrängung nicht**: Wo die App etwas
wegnimmt, muss der Rückweg im selben Bild stehen. Der Fokus-Modus des
Tourplaners räumt Titel, Kartenstil und Checkliste weg – und stellt dafür „☰
Übersicht" hin. Ohne diesen Knopf wäre er eine Falle.

`src/features/offerAutoHide.js` treibt denselben Gedanken noch einen Schritt
weiter: Die Funktion `recedingPaysOff()` verweigert das Zurücktreten, wenn danach
der Inhalt vollständig ins Fenster passt. Dann gäbe es nichts mehr zu scrollen,
also kein Scroll-Ereignis, also keinen Weg zurück – eine Einbahnstraße für einen
Gewinn, den es gar nicht gab. **Umkehrbarkeit ist keine Zutat, sie ist die
Bedingung.**

### 2.3 Zeigt die Übersicht den Prozess oder die Inhalte?

Eine Übersicht, die alles ausklappt, ist keine Übersicht, sondern ein Stapel.
Der Tour-Reiter öffnet mit drei Schritt-Köpfen und einer sprechenden Zeile je
Schritt („🚩 Musterfirma", „Umkreis 25 km", „3 Stopps · ~47 km"). Antippen zoomt
hinein. Das ist die Karten-Logik im Panel – dieselbe Regel, anderes Material.

### 2.4 Beantwortet schon etwas anderes dieselbe Frage?

Die teuerste Art von Überfrachtung entsteht nicht durch ein zu großes Feature,
sondern durch **zwei richtige Features, die unabhängig voneinander entstanden
sind und dieselbe Frage beantworten**. Sie fällt niemandem auf, weil jedes für
sich begründet ist. Siehe Abschnitt 4.

---

## 3. Was gemessen wird

`npm run attention-check` (`tools/attention-check.mjs`) befragt die **gebaute
App im echten Browser** an Handy- und Schreibtischmaßen. Es zählt sichtbare
Bedienelemente – „was kann ich anfassen", nicht „wie viel Text steht da", denn
ein erklärender Satz ist Orientierung, ein Knopf ist eine Entscheidung.

| Maß | Frage |
|---|---|
| **Erstbild** | Was steht im Fenster, ohne einen einzigen Klick? |
| **Rahmen** | Was kostet die Navigation selbst (Modus · Tiefe · Reiter)? |
| **Reiter** | Was bietet ein Reiter im Erst-Zustand an, je Tiefe und Modus? |
| **Übersicht** | Stehen im Tour-Reiter die Köpfe – und die Inhalte nicht? |
| **Vertiefung** | Bleibt beim Verdrängen der sichtbare Rückweg stehen? |

Kunden, Bündel und Gebiete auf der Karte werden **nicht** mitgezählt. Sie sind
die Landschaft, nicht die Bedienung; sie mitzurechnen hieße, der App genau das
als Last anzukreiden, was da sein soll.

**Gemessener Stand 01.08.2026:** Erstbild Handy 16, Schreibtisch 33. Rahmen 6
bzw. 9. Reiter zwischen 0 und 11.

Die Budgets im Werkzeug sind dieser Ist-Stand plus wenig Luft. Sie sind eine
**Sperrklinke**: Sie verbieten nichts, was heute da ist, machen aber jedes
weitere Anwachsen sichtbar, statt es über Monate unbemerkt geschehen zu lassen.
Wer ein Budget hebt, trifft damit eine bewusste Produktentscheidung – und genau
darum geht es.

### Was das Werkzeug zuerst widerlegt hat

Anlass war ein Produkt-Review, das den Tour-Reiter als überladen bezeichnete:
105 Knöpfe, gezählt im Quelltext von `index.html`. Die Messung sagt 5 bis 9.
Gezählt worden war Markup, nicht Oberfläche – der Tourplaner klappt seine
Schritte ein, das meiste ist im Erst-Zustand gar nicht da.

Das ist die Lehre aus `tools/face-check.mjs`, noch einmal: Quelltext lesen ist
keine Messung. Der Befund war falsch. Die Frage war richtig, und sie war bis
dahin schlicht unbeantwortbar.

---

## 4. Der erste echte Befund: drei Angebote, eine Frage

Am Schreibtisch standen im Erstbild gleichzeitig:

1. die **Willkommenskarte** über der Landkarte („Das sind Beispieldaten" ·
   eigene Daten laden · Live-Demos · „Verstanden"),
2. der **Beispieldaten-Streifen** im Panel mit dem Knopf „📂 Eigene Daten laden",
3. die ausgeklappte **Erste-Schritte-Checkliste** mit vier Aktionen, „Später"
   und „Nicht mehr zeigen".

Drei Oberflächen, eine Frage: *Was ist das hier – und wie komme ich an meine
Daten?* Zwei davon mit **derselben Beschriftung auf demselben Knopf**.

Keines der drei war ein Fehler. Jedes ist einzeln entstanden, jedes mit gutem
Grund, und die Checkliste klappte sich beim automatischen Erscheinen der
Beispielkunden sogar ausdrücklich auf – damals die richtige Entscheidung, weil
es die Willkommenskarte noch nicht gab. Erst zusammen wurden sie zum Stapel.

**Entscheidung:** Aus dem Stapel wird eine Reihenfolge. Solange die
Willkommenskarte im Bild steht, wartet die Checkliste als schmaler Chip, und der
Streifen zeigt nur seinen Hinweis, nicht sein Angebot – der Hinweis „das sind
Demo-Kunden" bleibt, er ist die Ehrlichkeit des Streifens. Ist die Karte
quittiert (auf jedem der vier Wege), klappt die Checkliste auf und bietet den
nächsten Schritt an.

Erst die Frage beantworten, die gerade dran ist. Dann die nächste.

Regel in Code: `shouldRevealFirstStepsOnDemo()` in `src/features/firstSteps.js`,
geprüft in `tests/firstSteps.test.js`.

**Wirkung:** Erstbild am Schreibtisch von 39 auf 33 Bedienelemente, Panel von 24
auf 18.

### Derselbe Fehler an anderer Stelle: der Lasso-Knopf

`touch-check` meldete unabhängig davon, dass der Lasso-Knopf auf dem hochkanten
Tablet verdeckt und nicht antippbar ist. Beim Nachsehen: dieselbe Ursache.

Der schwebende Kopf-Streifen (Basis/Profi, Reiter) wurde nach oben gezogen,
damit Tiefe und Bereich immer sichtbar bleiben. Die Karten-Knopfzeile wurde
hochkant nach oben gezogen, weil unten das Blatt steht und sie dort
verschwände. **„Oben ist frei" stimmte für beide – aber nur einzeln.**

Behoben, indem die Unterkante des Streifens gemessen statt geschätzt wird
(`syncTopnavMetrics()`, veröffentlicht als `--mobile-topnav-bottom`). Eine feste
Zahl im CSS wäre nur so lange richtig gewesen, bis jemand eine Zeile ergänzt.

**Die Lehre über beide Befunde hinweg:** Diese Sorte Fehler entsteht nicht durch
eine falsche Entscheidung, sondern durch **zwei richtige, die niemand
nebeneinandergelegt hat**. Ein Review findet sie nicht, weil jeder Teil für sich
begründet ist. Nur eine Messung am fertigen Bild findet sie. Deshalb ist
Prüffrage 2.4 keine Formalie.

---

## 5. Was ausdrücklich nicht gilt

Das Prinzip endet dort, wo es dem Produktversprechen widerspricht. Drei Grenzen,
die nicht verhandelt werden:

### 5.1 Keine Oberfläche, die sich selbst umbaut

Eine Oberfläche, die „erkennt, wann der Nutzer Orientierung braucht", ist per
Definition unvorhersehbar. Moment A der Roadmap lautet „07:30, Außendienst, in
30 Sekunden zum Tagesplan". Das funktioniert, weil der Knopf jeden Morgen an
derselben Stelle liegt. Muskelgedächtnis schlägt Anpassungsfähigkeit.

Die Zoom-Automatik der Karte ist kein Gegenbeispiel, sondern der Beleg: Sie
funktioniert nicht, weil sie klug ist, sondern weil sie **deterministisch,
nutzerausgelöst und umkehrbar** ist.

### 5.2 Kein KI-Modell der Aufmerksamkeit

Eine Oberfläche, die den Denkprozess des Nutzers modelliert, braucht Telemetrie
oder einen API-Aufruf. TourFuchs hat weder Tracking noch KI-Anbindung –
Release 5.1 hat die automatische Copilot-Anbindung ausdrücklich **ausgebaut**
(„TourFuchs ist kein KI-Werkzeug"). Lokal-first ist die härteste Leitplanke des
Produkts; ein Aufmerksamkeitsmodell hätte hier keine Datengrundlage, die es
haben dürfte.

Dazu kommt ein bereits vorliegendes Nutzervotum: Der automatische Tourvorschlag
wurde am 10.07.2026 **gestrichen**, weil Nutzer manuell planen wollen. Die
Roadmap hält fest: „Automatik unterstützt nur dort, wo sie nichts vorwegnimmt."
Für die Oberfläche gilt derselbe Satz.

### 5.3 Zoom ist nicht die einzige Denkbewegung

Moment B ist **Vergleich**: Bezirk A gegen Bezirk B, „Variante Nord" gegen
„Variante Süd". Vergleich ist Nebeneinander, nicht Tiefe. Wer alles auf Zoom
reduziert, hat für die Gebietssimulation keine Geste mehr. Die Landschaft
braucht auch die Breite.

---

## 6. Kurzfassung fürs Review

- Jede Ansicht dient **einem** nächsten Gedanken.
- Verdrängen ist erlaubt, **stilles** Verdrängen nicht – der Rückweg steht im Bild.
- Die Übersicht zeigt den Prozess, die Vertiefung die Inhalte.
- Zwei Angebote zur selben Frage sind eines zu viel.
- Freier Raum ist kein verschwendeter Platz.
- Gemessen wird mit `npm run attention-check`, nicht mit dem Bauchgefühl.
- Was sich selbst umbaut, ist nicht klug, sondern unvorhersehbar.
