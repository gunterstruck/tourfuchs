# Experiment: Räumliche UI und semantisches Zoomen

**Stand:** 08.08.2026  
**Status:** Konzept / Experiment, ausdrücklich kein Umbauauftrag  
**Bezug:** `docs/gestaltprinzip-aufmerksamkeit.md`

**Prüfvermerk:** Die Abschnitte 2.1, 9.1, 10.1 und 11.1 sind als Blockzitat
gekennzeichnete Ergänzungen aus einer Product-Owner-Prüfung vom 08.08.2026. Der
ursprüngliche Text ist unverändert. Wer wissen will, was Konzept war und was
Prüfung, erkennt es an der Nummerierung: Ganze Abschnitte sind vom Autor, die
Unterabschnitte mit `> **Prüfung**` sind es nicht.

---

## 1. Ausgangspunkt

TourFuchs verwendet bereits an mehreren Stellen ein Prinzip, bei dem der Detailgrad mit dem Interesse des Nutzers wächst. Auf der Karte werden je nach Zoomstufe unterschiedliche semantische Ebenen sichtbar; im Tour-Reiter führt das Öffnen eines Schritts von der Übersicht in dessen Inhalt.

Daraus entsteht die Frage, ob diese Logik nicht nur ein Gestaltprinzip, sondern zusätzlich eine konsistente Interaktionssprache werden kann.

Die Grundidee lautet:

> **Wischen bedeutet Reisen auf derselben semantischen Ebene. Zoomen bedeutet Wechsel der semantischen Tiefe.**

Dabei ist „Zoom“ ausdrücklich nicht als geometrische Vergrößerung derselben Oberfläche gemeint. Beim Hineinzoomen erscheint eine detailliertere Bedeutungsebene.

---

## 2. Tap und Pinch als zwei Wege zur selben Aktion

Heute kann ein Nutzer ein Element antippen, um es zu öffnen oder zu vertiefen. Experimentell könnte dieselbe Aktion zusätzlich durch eine Zwei-Finger-Geste ausgelöst werden.

### Pinch-out

Zieht der Nutzer zwei Finger auseinander, wird nicht die gesamte Oberfläche vergrößert. Stattdessen wird das semantisch zoombare Element am Zentrum der Geste vertieft.

Der Mittelpunkt zwischen den Fingern dient als räumliche Zielangabe. Das darunterliegende beziehungsweise nächstgelegene geeignete Element wird zum Fokus.

### Pinch-in

Das Zusammenziehen der Finger führt genau eine semantische Ebene zurück.

Damit gilt:

- **Tap:** explizite Auswahl eines Elements und Eintritt in dessen nächste Ebene.
- **Pinch-out:** räumliche Auswahl und Eintritt in dieselbe nächste Ebene.
- **Pinch-in:** Rückkehr zur Eltern-Ebene.

Tap und Pinch dürfen keine konkurrierenden Navigationsmodelle erzeugen. Sie sind alternative Eingaben für dieselbe semantische Hierarchie.

### 2.1 Pinch ist in der klassischen UI bereits belegt

> **Prüfung (Product Owner, 08.08.2026).** Dieses Dokument entstand wenige Stunden vor dem Merge von #214. Seither gilt in der klassischen Oberfläche:

| Fläche | Geste | Bedeutung |
|---|---|---|
| Bedienpanel, klassische UI (#214) | Zwei-Finger-Pinch | **Vergrößern** (`--panel-zoom`, 0,8 bis 1,5) |
| Bedienpanel, Spatial-UI (dieses Papier) | Zwei-Finger-Pinch | **Semantische Tiefe wechseln** |

Dieselbe Geste, dieselbe Fläche, zwei Bedeutungen. Solange die experimentelle Oberfläche hinter dem Schalter aus Abschnitt 8 liegt, sind es getrennte Welten und nichts kollidiert.

Abschnitt 10 nennt jedoch ausdrücklich als mögliches Ergebnis, dass Pinch-to-enter die **klassische** UI verbessern könnte. Genau dort träfen beide Bedeutungen aufeinander. Deshalb gilt ab sofort:

1. In der klassischen UI bedeutet Pinch auf dem Bedienpanel **Vergrößern**. Diese Bedeutung ist im Produkt und wird nicht stillschweigend umgedeutet.
2. Wandert Pinch-to-enter aus dem Experiment in die klassische UI, ist das eine **Ersetzung**, keine Ergänzung. Sie verlangt eine eigene Entscheidung mit der Frage, was aus der Vergrößerung wird — und einen Eintrag in „Was wir weggelassen haben“, falls sie stirbt.
3. Eine Fläche, auf der Pinch je nach Kontext mal vergrößert und mal die Ebene wechselt, ist ausgeschlossen. Das wäre der Widerspruch, den Abschnitt 2 selbst verbietet.

Der Anlass für diese Regel ist Befund 2 aus Commit #208: Die teuerste Sorte Fehler entsteht nicht durch eine falsche Entscheidung, sondern durch zwei richtige, die niemand nebeneinandergelegt hat.

---

## 3. Von der vertikalen Seite zur räumlichen Oberfläche

Klassische mobile Oberflächen wachsen hauptsächlich vertikal. Inhalte werden aufgeklappt, nachfolgende Inhalte rutschen nach unten und der Nutzer scrollt von oben nach unten. Die Breite des Bildschirms bleibt weitgehend konstant.

Das Experiment stellt diese Grundannahme infrage.

Eine semantische Ebene könnte stattdessen als **zweidimensionale Landschaft** organisiert sein. Nutzer bewegen sich nicht nur nach oben und unten, sondern auch nach links und rechts.

Dabei gibt es zwei voneinander getrennte Bewegungsarten:

1. **Bewegung innerhalb einer Ebene:** Wischen / Reisen.
2. **Bewegung zwischen Ebenen:** Tap oder Pinch / semantisches Zoomen.

Seitliche oder vertikale Bewegung verändert also den betrachteten Gegenstand. Zoom verändert dagegen den Abstraktionsgrad.

---

## 4. Die Idee der geschlossenen Welt

Als Denkmodell kann jede Ebene wie eine kleine Welt betrachtet werden, auf der verschiedene Bereiche räumlich angeordnet sind.

Die Welt soll möglichst keine harten Navigationskanten besitzen. Wer beispielsweise immer weiter nach rechts reist, kann wieder am Ausgangspunkt ankommen.

Eine echte Kugel ist dafür nur teilweise ein geeignetes geometrisches Modell: Horizontal lässt sich die Rundreise intuitiv verstehen, an Nord- und Südpol entstehen dagegen Sonderfälle. Technisch und konzeptionell könnte deshalb eine randlose beziehungsweise zyklische Fläche geeigneter sein als eine physikalisch korrekte Kugel.

Entscheidend ist nicht die Kugel selbst, sondern die Eigenschaft:

> **Eine Ebene ist eine zusammenhängende Landschaft statt einer Seite mit Anfang und Ende.**

Die visuelle Metapher muss nicht zwingend ein gezeichneter Globus sein.

---

## 5. Rekursive Welten

Ein Element einer Welt kann wiederum eine eigene Welt enthalten.

Beispielhaft:

```text
TourFuchs
  ├─ Kunden
  ├─ Gebiete
  └─ Touren
       ├─ Tour A
       ├─ Tour B
       └─ Tour C
            ├─ Stopp 1
            ├─ Stopp 2
            └─ Stopp 3
```

Die Darstellung wäre jedoch nicht primär als Baum sichtbar. Jede eingerückte Ebene wird beim Eintritt zu einer eigenen räumlichen Oberfläche.

Damit entsteht das Modell:

```text
Welt → Objekt → dessen Welt → Objekt → dessen Welt …
```

Ein Wechsel zu einem Geschwisterbereich sollte zunächst nicht quer durch beliebige Tiefenebenen erfolgen. Der sichere Weg ist:

1. zur Elternwelt zurückkehren,
2. dort zum anderen Bereich reisen,
3. in diesen Bereich hineinzoomen.

Dadurch bleibt die Informationsarchitektur trotz räumlicher Darstellung ein verständlicher Baum.

---

## 6. Orientierung als zentrale Bedingung

Eine randlose räumliche Oberfläche kann leicht zu Orientierungsverlust führen. Deshalb muss der Nutzer jederzeit drei Fragen beantworten können:

1. **Wo bin ich?**
2. **Was liegt um mich herum?**
3. **Wie tief bin ich?**

Eine mögliche Orientierungshilfe ist eine sichtbare semantische Spur, beispielsweise:

```text
TourFuchs › Touren › Tour C
```

Sie ist nicht zwingend die spätere Gestaltung, sondern zunächst ein Sicherheitsinstrument des Experiments.

Das bestehende TourFuchs-Prinzip der Umkehrbarkeit gilt uneingeschränkt: Jede Vertiefung braucht einen eindeutigen Rückweg.

---

## 7. Harte Regeln des Experiments

### 7.1 Keine erfundenen Zoomstufen

Nicht jedes Element muss hineinzoombar sein. Eine Zoomstufe existiert nur, wenn es fachlich eine sinnvolle detailliertere Bedeutungsebene gibt.

### 7.2 Determinismus

Die Oberfläche entscheidet nicht aufgrund vermuteter Nutzerabsichten, wohin sie springt. Geste, Ziel und Ergebnis müssen nachvollziehbar sein.

### 7.3 Umkehrbarkeit

Jeder Eintritt besitzt einen eindeutigen Austritt. Pinch-in beziehungsweise eine sichtbare Zurück-Funktion führt zur vorherigen semantischen Ebene.

### 7.4 Keine zweite Geschäftslogik

Die experimentelle UI darf TourFuchs fachlich nicht duplizieren. Daten, Regeln und Geschäftslogik bleiben gemeinsam. Experimentiert wird mit Darstellung und Navigation.

### 7.5 Bestehende UI bleibt unangetastet

Die heutige Oberfläche bleibt die produktive Referenz. Das Experiment darf weder bestehende Abläufe ersetzen noch deren Stabilität gefährden.

---

## 8. Parallelbetrieb über einen versteckten Experiment-Schalter

Die räumliche Oberfläche soll zunächst als alternative Präsentationsschicht parallel zur bestehenden UI entstehen.

Konzeptionell:

```text
              ┌─ klassische TourFuchs-UI
Daten + Logik ┤
              └─ experimentelle Spatial-/World-UI
```

Ein versteckter Schalter aktiviert die experimentelle Oberfläche. Denkbare Aktivierungen sind beispielsweise eine interne Debug-Option, ein spezieller URL-Parameter oder eine bewusst nicht dokumentierte Geste.

Der Schalter ist absichtlich kein regulärer Menüpunkt. Das Experiment soll nicht versehentlich zum versprochenen Produktfeature werden.

In der experimentellen UI muss jederzeit ein klarer Fluchtweg zurück zur klassischen Oberfläche vorhanden sein.

---

## 9. Minimaler erster Prototyp

Der erste Versuch soll nicht TourFuchs vollständig nachbauen. Er soll ausschließlich prüfen, ob sich die neue Navigationsgrammatik natürlich anfühlt.

Ein sinnvoller Minimalumfang wäre:

- eine oberste Welt mit etwa fünf bis sieben Bereichen,
- echte TourFuchs-Daten, wo ohne Zusatzlogik möglich,
- Wischen zum Reisen innerhalb der Ebene,
- Tap zum Eintritt in einen Bereich,
- Pinch-out als alternative Eintrittsgeste,
- Pinch-in zum Zurückkehren,
- höchstens zwei bis drei semantische Tiefen,
- sichtbare Tiefen-/Pfadanzeige,
- jederzeit erreichbarer Wechsel zurück zur klassischen UI.

Nicht Bestandteil des ersten Prototyps sind vollständige Feature-Parität, aufwendige Animationen, eine physikalisch korrekte Globusdarstellung oder ein Umbau bestehender TourFuchs-Komponenten.

### 9.1 Ein kleinerer erster Schnitt

> **Prüfung (Product Owner, 08.08.2026).** Abschnitt 3 setzt voraus, mobile Oberflächen wüchsen vertikal, und stellt das infrage. Für Listen stimmt das. Für TourFuchs nicht: Die Hauptfläche ist eine **Karte**.

Die Karte ist längst eine zweidimensionale Landschaft mit beiden Bewegungsarten aus Abschnitt 3 — Reisen durch Schieben, semantische Tiefe durch Zoom, mit echten Bedeutungsebenen in `src/features/mapLevel.js`: Vertriebsgruppen als Flächen, darunter Bezirke, darunter einzelne Kunden. Der Detailgrad wächst dort bereits mit dem Interesse, nicht mit dem Menü.

**Die räumliche UI existiert also schon. Sie heißt Karte, und sie ist die beste Fläche des Produkts.** Damit wird die eigentliche Frage kleiner und schärfer:

> **Soll sich das Bedienpanel verhalten wie die Karte?**

So gestellt braucht der erste Versuch keine neue Welt, keine fünf bis sieben Bereiche und keine randlose Fläche, sondern:

- **eine** bestehende Ebene des Panels — etwa Touren → Tour → Stopps,
- Pinch-out vertieft, Pinch-in kehrt zurück,
- sonst nichts.

Trägt das, trägt vermutlich auch mehr. Trägt es nicht, hat die Erkenntnis Tage gekostet statt Monate — und man weiß, woran es lag, weil nur eine Sache anders war.

**Nebenwirkung auf Abschnitt 4:** Die Karte hat Ränder, und niemand verirrt sich auf ihr. Die geschlossene Welt ohne Kanten ist damit die Idee mit dem schlechtesten Verhältnis von Reiz zu Nutzen im ganzen Papier: Sie nimmt die stärkste Orientierungshilfe weg, die es gibt — „hier ist Schluss“ —, und Abschnitt 6 versucht anschließend, den Verlust mit einer Pfadanzeige zu reparieren. Für den ersten Schnitt sollte Orientierung vor Nahtlosigkeit gehen.

---

## 10. Was der Versuch beantworten soll

Der Prototyp ist erfolgreich, wenn er Erkenntnisse liefert. Er muss nicht beweisen, dass TourFuchs vollständig auf diese UI umgestellt werden sollte.

Zu prüfen sind insbesondere:

- Beginnen Nutzer intuitiv, räumlich zu denken („dort hin“, „da hinein“)?
- Ist Pinch-out als semantische Vertiefung verständlich?
- Fühlt sich Pinch-in als Rückweg natürlich an?
- Unterstützt die räumliche Anordnung das Gedächtnis oder erzeugt sie Suchaufwand?
- Bleibt die aktuelle Tiefe jederzeit verständlich?
- Ist eine geschlossene Oberfläche hilfreich oder irritierend?
- Welche Teile funktionieren auch unabhängig vom Gesamtkonzept?

Ein mögliches Ergebnis kann deshalb auch lauten: Die vollständige World-UI ist ungeeignet, aber Pinch-to-enter, räumliche Nachbarschaft oder eine bestimmte Form der Tiefennavigation verbessert die klassische UI.

### 10.1 Abbruchbedingungen

> **Prüfung (Product Owner, 08.08.2026).** Sieben Fragen, aber keine Bedingung, unter der das Experiment stirbt. Ohne diesen Satz endet es nicht, es verblasst — und ein Zweig, der weder lebt noch stirbt, ist teurer als beides.

Das Vorbild steht bereits im Repo: `src/features/dayLog.js` ist als Messgerät mit **einer** Frage gebaut, und beide Bedingungen, unter denen Vorschlag B3 zu Recht stirbt, stehen ausgeschrieben im Änderungsprotokoll der Wissensbasis. Dasselbe gilt hier.

**Stichtag: 30.11.2026.** Bis dahin entscheidet sich am Prototyp:

1. **Pinch-to-enter stirbt**, wenn Nutzer die Geste ohne vorherige Erklärung nicht als Vertiefung deuten — konkret: wenn sie beim ersten Kontakt überwiegend versuchen, damit zu vergrößern statt einzutreten. Dann ist die Geste besetzt, und zwar nicht durch dieses Papier, sondern durch die Gewohnheit.
2. **Die geschlossene Welt stirbt**, wenn die Pfadanzeige aus Abschnitt 6 nötig ist, um sich zurechtzufinden. Eine Landschaft, die eine Beschriftung braucht, damit man weiß, wo man ist, hat ihre eigene Behauptung widerlegt — dann sind Ränder die bessere Orientierung.

Beide Bedingungen sind so formuliert, dass sie eintreten **können**. Eine Bedingung, die das nicht kann, ist keine.

> *Zahlen und Stichtag sind ein Vorschlag des Prüfenden und stehen unter dem Vorbehalt des Autors. Die Form — Bedingung plus Datum, ausgeschrieben vor dem Bauen — steht nicht zur Wahl; sie ist Hausstandard.*

---

## 11. Verhältnis zum Gestaltprinzip Aufmerksamkeit

Dieses Experiment erweitert das bestehende Gestaltprinzip nicht automatisch und ersetzt es nicht.

`gestaltprinzip-aufmerksamkeit.md` formuliert eine Prüfregel: Zeige, was für den nächsten Gedanken wichtig ist. Die hier beschriebene Spatial-UI untersucht lediglich eine mögliche Interaktionsform, mit der sich dieser Gedanke räumlich ausdrücken lässt.

Das Experiment darf daher nicht mit der Begründung „semantisches Zoomen“ zusätzliche Komplexität legitimieren. Im Gegenteil: Es muss sich an denselben Fragen messen lassen wie jede andere TourFuchs-Oberfläche.

Insbesondere:

- Was ist der nächste Gedanke?
- Was wird verdrängt?
- Wo ist der Rückweg?
- Gibt es bereits eine einfachere Oberfläche, die dieselbe Frage beantwortet?

### 11.1 Das Messgerät kann diesen Anspruch heute nicht einlösen

> **Prüfung (Product Owner, 08.08.2026).** Der Satz „muss sich an denselben Fragen messen lassen“ ist als Bedingung formuliert, aber nicht einlösbar.

`tools/attention-check.mjs` zählt sichtbare Bedienelemente **je Reiter, Tiefe und Modus**. Eine räumliche Welt hat weder Reiter noch ein Erstbild in diesem Sinn. Das Experiment wäre damit die erste Fläche im Produkt ohne Messgerät — ausgerechnet in einem Repo, dessen Lehrsatz lautet, dass Quelltext lesen keine Messung ist.

Entschieden wird das so:

- **Solange das Experiment hinter dem Schalter aus Abschnitt 8 liegt, ist Abschnitt 11 eine Absicht, keine Bedingung.** Ein verstecktes Experiment ohne Nutzer braucht keine Sperrklinke; es kostet niemanden Aufmerksamkeit außer den Bauenden.
- **In dem Moment, in dem irgendein Teil davon die klassische UI erreicht, wird daraus wieder eine Bedingung** — und dann muss das Werkzeug es messen können. Nötig wäre eine Zählung je **Welt und Tiefe** analog zu „je Reiter und Tiefe“, samt Budget.

Diese Erweiterung ist ausdrücklich **nicht** Teil des ersten Prototyps. Sie ist die Eintrittskarte aus dem Experiment heraus, nicht hinein.

---

## 12. Arbeitshypothese

Die stärkste Formulierung des Experiments lautet derzeit:

> **TourFuchs könnte als räumliche, rekursive Benutzeroberfläche verstanden werden: Jede semantische Ebene ist eine navigierbare Landschaft. Wischen bewegt innerhalb einer Bedeutungsebene; Tap oder Pinch bewegt zwischen Bedeutungsebenen.**

Diese Aussage ist eine Hypothese, keine Produktentscheidung.

Der nächste sinnvolle Schritt ist ein technisch isolierter Prototyp hinter einem Experiment-Schalter. Erst dessen Nutzung soll entscheiden, welche Teile des Konzepts weiterverfolgt werden.