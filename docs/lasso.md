# Lasso – eine Fläche auf der Karte umfahren

Der kürzeste Weg von „ich sehe eine Karte" zu „ich weiß, wen ich zuerst besuche".

## Warum es das gibt, obwohl der Umkreis dasselbe kann

Zwei Gründe – der zweite ist der wichtigere für den Alltag, der erste für den
ersten Eindruck.

**1. Eine Geste statt eines Formulars.** Der Umkreis im Tourplaner verlangt drei
Handgriffe, bevor etwas passiert: Startpunkt setzen, Regler schieben, Knopf
drücken. Das Lasso ist eine einzige Bewegung um das, was man
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
   „Kunden in meiner Nähe" – zwei gleichrangige Angebote, gleiches Gewand.
   Liegt eine Tour auf der Karte, nimmt dort der Umschalter 🗺️ „Straßenroute" /
   📏 „Luftlinie" den Platz des Fuchses ein: dieselbe Zeile, dieselbe Pille,
   nie übereinander. Die Karte friert ein, der Zeiger wird zum Fadenkreuz, ein
   Rahmen zeigt den Modus.
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

## Der Rückweg: „diese drei zur Tour"

Ein Briefing ist kein Selbstzweck. Wenn der Assistent geantwortet hat, will man
zwei oder drei der genannten Kunden auch tatsächlich anfahren – und die Auswahl
liegt beim Zurückkommen noch auf der Karte.

Deshalb trägt im **Profi-Modus** jede Zeile der Auswahlkarte ein Häkchen:

- **Ohne Häkchen** heißt der Knopf **🚩 Alle zur Tour** und tut genau das – der
  schnelle Weg, den es vorher schon gab.
- **Mit Häkchen** heißt er **🚩 3 zur Tour** und meint genau die angehakten.

Zwei Regeln, die man nicht erklären muss, sondern sieht:

- Wer schon in der Tour steht, erscheint mit ✓ und **in Tour** – ohne Kästchen.
  Ein Häkchen, bei dem nichts passiert, ist schlimmer als kein Häkchen.
- Nach dem Übernehmen **bleibt die Auswahl liegen**. Man hakt oft zweimal an:
  erst die drei im Gewerbegebiet, dann die zwei an der Ausfallstraße.

Namentlich stehen die ersten **acht** Kunden auf der Karte – sie ist ein Popup
auf einem Telefon, keine Tabelle. Es sind die richtigen acht: Die Auswahl ist
vom Flächenmittelpunkt nach außen sortiert. Für alles darüber hinaus gibt es
„Alle zur Tour".

Im Einsteiger-Modus bleibt die Liste eine reine Namensliste – dort ist die
Tourplanung ohnehin nicht der Weg.

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

**Auch die obere Kante ist belegt.** Dort schwebt der Kopf-Streifen mit
Basis/Profi – aus genau demselben Grund nach oben gezogen. Rechnete die
Knopfzeile gegen die Topbar, landete der Lasso-Knopf hinter der Basis/Profi-Pille
und ließ sich nicht antippen (Befund `npm run touch-check`, 01.08.2026). Sie
beginnt deshalb unter der **gemessenen** Unterkante des Streifens
(`--mobile-topnav-bottom`), nicht unter einer geschätzten Höhe: Der Streifen war
mal ein-, mal zweizeilig und ist im Onboarding gar nicht da. Seit Version 3.2 ist
er dauerhaft einzeilig (die Reiter „Karte | Tour" sind entfallen) – die Zeile
rückt hochkant entsprechend um rund 45 Pixel nach oben. Dass die Messung das
ohne eine einzige Änderung mitgemacht hat, ist der Beleg für die Regel: eine
feste Zahl wäre an genau diesem Tag falsch geworden.

**Drei Fallen beim Popup**, alle erst am Gerät sichtbar geworden:

1. **Es schloss sich sofort.** Leaflet wertet die Berührung direkt nach dem
   Loslassen als Kartenklick (`closeOnClick: false`).
2. **Es löschte sich selbst.** Das automatische Nachschwenken löst `movestart`
   aus – womit die Regel „Karte bewegt, Auswahl verwerfen" griff. Aufgeräumt
   wird deshalb erst bei `dragstart`/`zoomstart`, also nur bei echter
   Nutzerabsicht. Damit ist das Nachschwenken wieder erlaubt.
3. **Es hing über dem oberen Rand.** Ein Popup wächst vom Anker nach oben; über
   dem Flächenmittelpunkt ist dafür auf einem Telefon kein Platz, und
   nachschwenken kann Leaflet nicht, wenn die Landkarte ohnehin an ihrer Grenze
   steht (weit herausgezoomt auf Deutschland ist das die Regel). Die erste
   Zeile lag hinter der Tab-Leiste und ließ sich nicht antippen. Deshalb wandert
   der **Anker** nach unten statt der Landkarte (`cardAnchorLatLng`) – der
   Nutzer behält den Ausschnitt, den er sich gerade gezogen hat.

Dazu: Die Knöpfe der Auswahlkarte kleben am unteren Rand des Popups
(`position: sticky`). Sonst schob eine lange Namensliste „Briefing über alle"
und „Auswahl aufheben" aus dem sichtbaren Bereich heraus – man sah die Auswahl
und kam nicht weiter.

Und die Knöpfe der Auswahlkarte heißen `data-lasso`, nicht `data-action`: Die
Karte hängt an jeden `[data-action]`-Knopf in jedem Popup einen eigenen Zuhörer,
der das Popup danach schließt. „Zur Tour" hätte die Kunden übernommen und die
Auswahl im selben Moment weggerissen.

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

Sie zeigt den **ganzen Bogen**, nicht nur die Geste: umfahren → Briefing →
zurück auf die Karte → zwei anhaken → „🚩 2 zur Tour". Das Briefing ist dabei
kein Selbstzweck, sondern die Begründung für die Auswahl, die danach getroffen
wird – deshalb endet die Vorführung in der Tour und nicht im Dialog.

**Was sie zeigt, hängt an der Datenlage.** Mit Beispielkunden gibt es bewusst
keinen Prompt; dort erklärt die Demo die Sperre. Mit **eigenen** Kunden klappt
sie stattdessen den fertigen Prompt auf und benennt, was drinsteht und was
draußen bleibt (`realOnly`/`demoOnly` in `features/stories.js`). Ein Satz für
beide Fälle wäre in einem der beiden unwahr – und der Fall mit echten Daten ist
zugleich der, der gefilmt wird: siehe [Der Film: Lasso + Briefing](./film-lasso-briefing.md).

## Prüfschritte

1. Eigene Kunden laden → **🖊️ Lasso ziehen** erscheint neben „Kunden in meiner Nähe“.
2. Modus ein: Knopf wird farbig, Zeiger wird Fadenkreuz, Karte lässt sich nicht
   mehr verschieben.
3. Fläche um mehrere Kunden ziehen → die Spur folgt dem Finger, die Fläche
   bleibt liegen, Treffer leuchten, die Auswahlkarte nennt Zahl und Kennwerte,
   Modus ist wieder aus.
4. **📋 Briefing über alle** → Gebiets-Briefing mit „die von mir auf der Karte
   markierte Fläche" als Gebiet.
5. Profi-Modus: zwei Zeilen anhaken → der Knopf heißt **🚩 2 zur Tour**;
   drücken → die zwei stehen in der Tour, in der Liste mit ✓ **in Tour**, die
   Auswahl bleibt liegen, der Knopf heißt wieder **🚩 Alle zur Tour**.
6. Karte verschieben → Auswahl verschwindet.
6. Modus ein, nur tippen → nichts wird ausgewählt.
7. **Escape** im Modus → Modus aus, Karte wieder verschiebbar.
