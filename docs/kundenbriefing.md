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

## Gebiets-Briefing: „Wen zuerst?"

Die häufigere Frage im Außendienst ist nicht „erzähl mir alles über einen Kunden",
sondern **„ich bin hier – wen von diesen besuche ich zuerst?"**. Genau das kann
TourFuchs allein nicht beantworten: Entfernung und Fälligkeit weiß es, offene
Vorgänge und den letzten Schriftwechsel nicht.

**Zwei Einstiege, ein Dialog** – beide erscheinen erst ab zwei echten Kunden:

| Einstieg | Gebiet |
|---|---|
| Tourplaner → „2. Vorschläge" → **🧭 Wen zuerst?** | der eingestellte Umkreis um den Startpunkt bzw. der Korridor entlang der Strecke |
| Karte → „In der Nähe" → **🧭 Wen zuerst?** | die nächstgelegenen Kunden um Kartenmitte oder GPS-Standort |

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
