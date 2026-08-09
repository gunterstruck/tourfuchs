# Kundenbriefing – vorbereiteter Prompt für Ihren Assistenten

Das Kundenbriefing beantwortet die Frage „Was weiß meine Firma über diesen Kunden,
bevor ich hineingehe?" – ohne dass TourFuchs selbst zu einem KI-Werkzeug wird.

## Der Weg – bewusst genau einer

1. Kunden auf der Karte oder in der Tour öffnen → **📋 Briefing**.
2. TourFuchs baut **lokal** einen kundenspezifischen Prompt und zeigt ihn vollständig an.
3. **Prompt kopieren & Assistent öffnen** kopiert den Text und öffnet den Assistenten
   in einem neuen Tab (unter Windows bevorzugt die installierte Edge-/Copilot-App).
4. Im Assistenten einfügen und **selbst absenden**.

TourFuchs **meldet sich nirgends an, ruft keine KI-API auf und holt keine Antwort
zurück**. Der einzige Moment, in dem Kundendaten das Gerät verlassen, ist Ihr eigenes
Absenden im Assistenten – ein Schritt, den Sie sehen und kontrollieren.

> **Produktentscheidung 25.07.2026:** Die frühere automatische Entra-/Graph-Anbindung
> (Anmeldung mit dem Arbeitskonto, Copilot-Antwort direkt im Dialog) wurde **entfernt**.
> Sie stand im Widerspruch zum Lokal-first-Versprechen, verlangte eine
> Administratorfreigabe und band das Produkt an einen einzigen Anbieter. Die
> MSAL-Abhängigkeit ist aus dem Projekt entfernt; vorhandene Kennungen und
> Einwilligungen werden beim nächsten Start aus dem Browser gelöscht.

## Was im Prompt steht – und was nicht

**Enthalten** (nur zur eindeutigen Zuordnung und Besuchsvorbereitung):
Kundenname, Kundennummer, PLZ/Ort, Hauptansprechpartner sowie der Tourkontext
(geplantes Datum, Position in der Tour, Tourrolle, letzter lokal dokumentierter Besuch).

**Nicht enthalten:** Straße, Telefonnummer, E-Mail-Adresse, Umsatz, Koordinaten und
selbstverständlich nie die übrige Kundenliste.

Für technisch markierte **Demo-Kunden** wird gar kein Prompt erzeugt und kein
Assistent geöffnet – der Dialog zeigt nur eine lokale Ergebnisvorschau.

## Zielassistent wählen (nur Profi)

In **Basis** ist das Ziel fest Microsoft 365 Copilot – ein Knopf, keine Entscheidung.

Im **Profi-Modus** lässt sich im Briefing-Dialog unter „Ziel: … · Anderen Assistenten
wählen" umstellen auf:

| Auswahl | Adresse | Quellen im Prompt |
|---|---|---|
| Microsoft 365 Copilot (Standard) | `m365.cloud.microsoft/chat` | berechtigte Microsoft-365-Inhalte |
| Google Gemini | `gemini.google.com/app` | berechtigte Google-Workspace-Inhalte |
| ChatGPT | `chatgpt.com` | neutral: verbundene interne Quellen |
| Eigener Assistent | selbst eingetragene **https**-Adresse | neutral: verbundene interne Quellen |

Die Wahl wird lokal gemerkt und passt zwei Dinge an: die geöffnete Adresse **und** die
Quellenzeile im Prompt. Für eigene Adressen ist ausschließlich `https` zulässig; eine
unvollständige Eingabe fällt sichtbar auf Copilot zurück, damit der Knopf nie ins Leere führt.

## Der Prompt: einsehbar, aber nicht im Weg

Der vollständige Prompt steht im Dialog unter **„🔍 Vollständigen Prompt ansehen"**
– mit Zeilenzahl und dem Hinweis, dass er erst beim Absenden im Assistenten das
Gerät verlässt. Aufklappen geht **vor** dem Kopieren; nichts wird übertragen,
bevor der Nutzer es lesen konnte.

Ausgeklappt belegte er zuvor 41 % eines Dialogs, dessen ganze Aufgabe ein Knopf
ist. Die Zusage lautet „vollständig verfügbar", nicht „muss ungefragt den halben
Bildschirm belegen" – eingeklappt mit sprechender Zeile steht sie sogar
deutlicher da als vorher im grauen Kasten.

## Eigene Nachschlagequellen – „schau hier nach" statt „such mal"

Der häufigste Grund für ein enttäuschendes Briefing ist kein schlechter Prompt,
sondern ein zu großer Suchraum: Der Assistent durchsucht **alles**, worauf der
Nutzer Zugriff hat, und findet dabei oft Älteres – während der aktuellste Stand
in einer einzigen, selbst gepflegten Liste steht.

Deshalb lassen sich im Briefing-Dialog (in **beiden** Ansichtstiefen, eingeklappt
unter „Wo soll der Assistent zuerst nachsehen?") bis zu **drei eigene Quellen**
hinterlegen. Je Quelle zwei Felder:

| Feld | Zweck | Beispiel |
|---|---|---|
| **Was steckt drin?** | Sagt dem Assistenten, **wie** er die Ablage mit dem Kunden verknüpft. Das ist der eigentliche Hebel – ein nackter Link ohne diese Angabe hilft kaum. | „Bezirksliste Rheinland – Konditionen und Kontakte, Zuordnung über die Kundennummer" |
| **Link oder Pfad** | Die Ortsangabe. Bewusst Freitext: SharePoint-Adresse, Teams-Kanal, Laufwerkspfad oder schlicht ein Ordnername. | `https://firma.sharepoint.com/sites/vertrieb/Bezirke` |

Im Prompt erscheinen sie **vor** der allgemeinen Suchanweisung als
Vorrang-Hinweis:

> Vorrangige Quellen – sieh zuerst hier nach:
> - Bezirksliste Rheinland – … : https://…
> Diese Ablagen pflege ich selbst; sie sind für mich der aktuellste Stand. Steht
> dort etwas zu einem der genannten Kunden, hat es Vorrang vor älteren
> Fundstellen – ordne die Einträge über die Kundennummer zu. …

Drei bewusste Grenzen:

1. **Vorrang, kein Filter.** Formuliert ist „sieh zuerst hier nach", nicht „nur
   hier". Wer die Bezirksliste hinterlegt, will nicht, dass die Mail von gestern
   unter den Tisch fällt.
2. **Höchstens drei.** Mehr Quellen ergeben keinen besseren Prompt, nur einen
   neuen Heuhaufen.
3. **Nur Prompt-Text.** TourFuchs öffnet die Quelle nicht, ruft sie nicht ab und
   sendet nichts. Die Angabe liegt lokal im Browser und steht sichtbar im
   angezeigten Prompt, bevor der Nutzer ihn selbst absendet. Für Beispielkunden
   entsteht wie bisher gar kein Prompt.

Die Einträge gelten für **beide** Briefings; geändert werden sie in dem Dialog,
in dem sie gerade auffallen. Die Wirkung ist sofort im angezeigten Prompt
sichtbar – man muss sie nicht im Assistenten nachprüfen.

## Gebiets-Briefing: „Wen zuerst?"

Die häufigere Frage im Außendienst ist nicht „erzähl mir alles über einen Kunden",
sondern **„ich bin hier – wen von diesen besuche ich zuerst?"**. Genau das kann
TourFuchs allein nicht beantworten: Entfernung und Fälligkeit weiß es, offene
Vorgänge und den letzten Schriftwechsel nicht.

**Drei Einstiege, ein Dialog** – alle erscheinen erst ab zwei echten Kunden:

| Einstieg | Gebiet |
|---|---|
| Karte → **Lasso ziehen** → umfahren → **Briefing über alle** | die frei gezogene Fläche |
| Tourplaner → „2. Vorschläge" → **🧭 Wen zuerst?** | der eingestellte Umkreis um den Startpunkt bzw. der Korridor entlang der Strecke |
| Karte → „In der Nähe" → **🧭 Wen zuerst?** | die nächstgelegenen Kunden um Kartenmitte oder GPS-Standort |

Der erste Weg ist der schnellste und beantwortet als einziger auch **unrunde**
Gebiete: Gewerbegebiet, eine Flussseite, ein Autobahnkorridor. Vertriebsgebiete
sind keine Kreise; ein Radius nimmt immer zu viel oder zu wenig mit. Einzelheiten
zum Werkzeug: [Lasso](./lasso.md).

Fachlich sind es zwei getrennte Schritte: Das Lasso erzeugt ausschließlich die
Kundenauswahl. Erst **„Briefing über alle"** öffnet den Gebiets-Briefing-Ablauf,
der den Prompt lokal vorbereitet und zur Prüfung zeigt.

Der Ablauf ist derselbe wie beim Kundenbriefing: lokal bauen, vollständig zeigen,
kopieren, im Assistenten selbst absenden.

**Im Prompt steht je Kunde nur:** Name, Kundennummer, PLZ/Ort, Fälligkeitsstand
(„überfällig" / „bald fällig") und das Datum des letzten dokumentierten Besuchs.

**Nicht enthalten:** Umsatz, Telefon, E-Mail, Straße, Koordinaten. Beim
Einzelbriefing ist das zugesagt – bei einer ganzen Liste wiegt es schwerer, nicht
leichter.

**Höchstens 12 Kunden.** Eine Liste mit vierzig Namen ist weder ein guter Prompt
noch eine gute Idee; es zählt das Gebiet, nicht der Bestand. Wurde gekürzt, sagt
der Prompt es ausdrücklich („Es sind 37 Kunden im Gebiet; hier stehen die 12
nächstgelegenen") und der Dialog weist darauf hin.

Der Assistent liefert eine **Reihenfolge**, keinen weiteren Bericht: `## Zuerst`
(höchstens drei Kunden mit je einem Grund), `## Wenn Zeit bleibt`,
`## Nichts gefunden` – zusammen höchstens 200 Wörter. Dass der letzte Besuch lange
her ist, steht bereits im Prompt und zählt ausdrücklich nicht als Begründung.

Liegen im Gebiet nur Demo-Kunden, wird kein Prompt gebaut und kein Assistent geöffnet.

## Prüfschritte

1. Basis-Modus, echter Kunde → Dialog zeigt Prompt, **keine** Assistentenwahl,
   Knopf lautet „Prompt kopieren & Microsoft 365 Copilot öffnen".
2. Profi-Modus → Auswahl aufklappen, **Google Gemini** wählen: Knopftext und
   Quellenzeile im Prompt wechseln sofort.
3. **Eigener Assistent** mit `http://…` → sichtbare Fehlermeldung, Ziel bleibt gültig.
4. Demo-Kunde → Demo-Vorschau, kein Fenster öffnet sich, nichts wird kopiert.
5. Nach dem ersten Start sind `tourfuchs:copilot-config:v1` und
   `tourfuchs:copilot-consent:v1` nicht mehr im Local Storage.
6. Gebiets-Briefing: Startpunkt setzen, Umkreis so wählen, dass mindestens zwei
   eigene Kunden erscheinen → **🧭 Wen zuerst?** wird sichtbar; der Dialog listet
   dieselben Kunden auf, die im Prompt stehen.
7. Umkreis auf einen einzigen Kunden verkleinern → der Knopf verschwindet wieder.
8. Nur Demo-Kunden im Gebiet → Hinweis „Für Beispielkunden wird kein Briefing
   erzeugt", kein Fenster öffnet sich, nichts wird kopiert.
