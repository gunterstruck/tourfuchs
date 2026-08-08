# Experiment: Räumliche UI und semantisches Zoomen

**Stand:** 08.08.2026  
**Status:** Konzept / Experiment, ausdrücklich kein Umbauauftrag  
**Bezug:** `docs/gestaltprinzip-aufmerksamkeit.md`

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

---

## 12. Arbeitshypothese

Die stärkste Formulierung des Experiments lautet derzeit:

> **TourFuchs könnte als räumliche, rekursive Benutzeroberfläche verstanden werden: Jede semantische Ebene ist eine navigierbare Landschaft. Wischen bewegt innerhalb einer Bedeutungsebene; Tap oder Pinch bewegt zwischen Bedeutungsebenen.**

Diese Aussage ist eine Hypothese, keine Produktentscheidung.

Der nächste sinnvolle Schritt ist ein technisch isolierter Prototyp hinter einem Experiment-Schalter. Erst dessen Nutzung soll entscheiden, welche Teile des Konzepts weiterverfolgt werden.