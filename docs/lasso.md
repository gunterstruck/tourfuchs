# Lasso – eine Fläche auf der Karte umfahren

Der kürzeste Weg von „ich sehe eine Karte" zu „ich weiß, wen ich zuerst besuche".

## Warum es das gibt, obwohl der Umkreis dasselbe kann

Zwei Gründe – der zweite ist der wichtigere für den Alltag, der erste für den
ersten Eindruck.

**1. Eine Geste statt eines Formulars.** Der Umkreis im Tourplaner verlangt vier
Handgriffe, bevor etwas passiert: Bezirk wählen, Startpunkt setzen, Regler
schieben, Knopf drücken. Das Lasso ist eine einzige Bewegung um das, was man
ohnehin gerade ansieht. Wer TourFuchs zum ersten Mal sieht, versteht in zehn
Sekunden, worum es geht.

**2. Unrunde Flächen.** Ein Umkreis ist ein Kreis. Ein Gewerbegebiet, eine
Rheinseite, ein Autobahnkorridor, „alles nördlich der B1" – nichts davon ist
rund. Ein Radius nimmt an solchen Stellen immer zu viel oder zu wenig mit. Das
Lasso trifft genau die Fläche, die gemeint war.

Dass zwei Wege zum selben Dialog führen, ist Absicht: **geplant** am Schreibtisch
über den Tourplaner, **spontan** unterwegs über die Karte.

## Der Ablauf – drei Schläge, der mittlere zählt

1. **🖊️ Lasso ziehen.** Der Knopf steht in der Karten-Knopfzeile direkt neben
   „Kunden in meiner Nähe" – zwei gleichrangige Angebote, gleiches Gewand. Die
   Karte friert ein, der Zeiger wird zum Fadenkreuz, ein Rahmen zeigt den Modus.
2. **Fläche ziehen.** Die Spur wächst **mit dem Finger mit** und ist ab dem
   dritten Punkt gefüllt; ein Punkt markiert den Start, damit man weiß, wohin
   man zurückkommen muss. Beim Loslassen schließt sich die Form, die getroffenen
   Kunden leuchten auf – und es erscheint eine **Auswahlkarte im Gewand der
   Kundenkarte**: Anzahl, fällige Kunden, Umsatz, Orte, die ersten Namen.
3. **📋 Briefing über alle.** Öffnet das [Gebiets-Briefing](./kundenbriefing.md)
   als Modal – genau wie beim einzelnen Kunden. Dort steht der fertige Prompt,
   wird kopiert, und der Assistent wird geöffnet.

Schritt 2 ist der eigentliche Moment: **erst sehen, dann gefragt werden.** Das
Ziehen allein wählt nur aus – es öffnet nie von selbst einen Dialog.

Im Profi-Modus bietet die Auswahlkarte zusätzlich **🚩 Alle zur Tour**.

## Warum die Karte einfriert

„Finger runter und ziehen" heißt auf einer Karte sonst „verschieben". Ohne
ausdrücklichen Modus würde jedes Verschieben zur Auswahl. Deshalb ist das Lasso
ein Zustand, den man sieht und wieder verlässt:

- Der Knopf wechselt Farbe und Beschriftung („✏️ Fläche ziehen …").
- Der Zeiger wird zum Fadenkreuz, die Karte bekommt einen Rahmen.
- **Escape** verlässt den Modus jederzeit.
- Nach einem Zug schaltet er sich selbst wieder ab – man zieht selten zweimal
  hintereinander, und ein Werkzeug, das anbleibt, blockiert die Karte.

## Was am Handy anders ist als am Schreibtisch

Zwei Dinge, die beim ersten Gerätetest aufgefallen sind und ohne echten Finger
nicht sichtbar werden:

**Der Browser beansprucht die Wischgeste.** Leaflet setzt auf dem Kartenfenster
`touch-action: pan-x pan-y`. Leaflets eigenes Ziehen abzuschalten genügt deshalb
nicht: Die Karte friert zwar ein, aber der Browser wertet die Berührung
weiterhin als Scrollen, schickt `pointercancel` und stellt die
Bewegungsereignisse ein – der Finger zeichnet ins Leere. Nur `touch-action:
none` im Zeichenmodus gibt die Geste an die App zurück. Zusätzlich wird der
Zeiger festgehalten (`setPointerCapture`), damit ein Zug über ein Popup oder
über den Kartenrand hinaus nicht mitten in der Fläche endet; bricht das System
die Berührung doch ab, wird eine bereits brauchbare Fläche ausgewertet statt
weggeworfen.

**Die untere Kante ist überfüllt.** Dort liegen Bedienblatt, Griff und
Beispieldaten-Streifen. Beide Knöpfe teilen sich deshalb **eine** Zeile
(`.map-fab-row`), die deutlich darüber schwebt; ist das Blatt aufgezogen,
verschwindet sie ganz, statt halb verdeckt hineinzuragen. Auf **Tablet-Hochkant**
steht das Blatt meist offen und nimmt die untere Hälfte ein – dort wandert die
Zeile an den **oberen** Kartenrand, wo das Blatt nie hinkommt.

**Zwei Fallen beim Popup.** Leaflet wertet die Berührung direkt nach dem
Loslassen als Kartenklick und schlösse die frisch geöffnete Auswahlkarte sofort
(`closeOnClick: false`). Und das automatische Nachschwenken eines Popups löst
`movestart` aus – womit die Regel „Karte bewegt, Auswahl verwerfen" die eigene
Auswahl im selben Moment löschte. Deshalb `autoPan: false` und Aufräumen erst
bei `dragstart`/`zoomstart`.

**Prüfen lässt sich das nur mit echten Touch-Ereignissen.** Ein
Playwright-Lauf mit `page.mouse` läuft grün durch, weil `touch-action` für die
Maus nicht gilt. Die Prüfstrecke dafür speist die Berührungen über CDP ein.

## Grenzen und Verhalten

| Fall | Verhalten |
|---|---|
| Tippen statt Ziehen | Nichts wird ausgewählt, ein ruhiger Hinweis erscheint |
| Fläche ohne Kunden | Hinweis „Zieh sie etwas größer", keine Auswahl |
| Weniger als zwei echte Kunden | Auswahl wird gezeigt, aber kein Briefing angeboten – für einen einzelnen Kunden ist das Kundenbriefing der bessere Weg |
| Nur Beispielkunden | Kein Prompt, kein Assistent – wie überall sonst |
| Karte verschieben oder zoomen | Auswahl wird verworfen: Sie galt für den Ausschnitt, in dem sie gezogen wurde |
| Sehr große Auswahl | Die Karte nennt die volle Zahl; hervorgehoben werden höchstens 250 Punkte, damit sie flüssig bleibt |

Der Knopf erscheint nur, wenn mindestens zwei verortete Kunden sichtbar sind,
und nicht in der Simulationsansicht.

## Was ins Briefing geht

Nichts Eigenes. Das Lasso liefert ausschließlich die **Auswahl**; Prompt,
Deckelung auf zwölf Kunden, Datenschutzzusage und Demo-Sperre kommen unverändert
aus dem [Gebiets-Briefing](./kundenbriefing.md). Die Kunden werden vom
Flächenmittelpunkt nach außen sortiert übergeben – wer am nächsten an dem liegt,
was markiert wurde, steht zuerst im Prompt.

## Live-Demo

Die Demo **„Fläche umfahren, Briefing bekommen"** führt die Geste in der echten
App vor – mit echten Zeigerereignissen, nicht als Animation. Sie steht bewusst
weit vorn in der Demo-Auswahl: Wenn der Effekt nur im Werbefilm existiert, ist er
Werbung; wenn ihn jeder Besucher selbst auslösen kann, ist er das Produkt.

## Prüfschritte

1. Eigene Kunden laden → **🖊️ Lasso ziehen** erscheint neben „Kunden in meiner Nähe“.
2. Modus ein: Knopf wird farbig, Zeiger wird Fadenkreuz, Karte lässt sich nicht
   mehr verschieben.
3. Fläche um mehrere Kunden ziehen → die Spur folgt dem Finger, die Fläche
   bleibt liegen, Treffer leuchten, die Auswahlkarte nennt Zahl und Kennwerte,
   Modus ist wieder aus.
4. **📋 Briefing über alle** → Gebiets-Briefing mit „die von mir auf der Karte
   markierte Fläche" als Gebiet.
5. Karte verschieben → Auswahl verschwindet.
6. Modus ein, nur tippen → nichts wird ausgewählt.
7. **Escape** im Modus → Modus aus, Karte wieder verschiebbar.
