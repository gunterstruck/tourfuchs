# Die erfundene Ablage für den KI-Einschub

**Requisiten, keine Daten.** Die Dateien in diesem Ordner sind erfundener
interner Schriftverkehr zu den erfundenen Firmen aus der Filmliste
(`KUNDENLISTE` in `tools/film.mjs`). Sie existieren aus einem einzigen Grund:
damit im Film eine KI auf den TourFuchs-Prompt **wirklich antworten kann**.

## Warum es sie braucht

Der Gebiets-Prompt verlangt ausdrücklich interne Quellen und verbietet die
Websuche:

> Nutze keine Websuche und keine allgemeinen Internetinformationen. Erfinde
> nichts. Ordne einen Kunden lieber unter „Nichts gefunden" ein.

Im Alltag ist das genau richtig. Für den Film ist es ein Problem: Zu erfundenen
Firmen findet ein frischer Assistent nichts und antwortet – völlig korrekt – mit
einer leeren Liste. Das wäre eine ehrliche, aber unbrauchbare Aufnahme.

Mit dieser Ablage antwortet der Assistent **echt**, nur eben aus erfundenen
Quellen. Nichts am Bild ist gestellt, und niemandes echte Kundendaten sind im
Film.

## Anwendung

1. Ein **eigenes Projekt** im Assistenten anlegen (ChatGPT-Projekt, Gemini-Gem,
   eigener Assistent). Nicht in eine bestehende Arbeitsumgebung legen – die
   Dateien sehen aus wie echter Schriftverkehr und sollen später niemanden
   verwirren. Ein sprechender Name hilft: „TourFuchs Filmkulisse".
2. Die sechs Dateien dieses Ordners dort hochladen.
3. Im Film den Prompt aus TourFuchs einfügen und absenden.

Wird ChatGPT verwendet, gehört im Profi-Modus unter **Daten → Briefing-Ziel**
auch ChatGPT eingestellt – sonst steht im Film auf dem Knopf „Microsoft 365
Copilot öffnen" und im nächsten Bild geht etwas anderes auf.

## Was in der Ablage steht – und was bewusst fehlt

| Kunde | Nr. | Vorgang | Wirkung auf die Reihenfolge |
|---|---|---|---|
| Rheinstahl Fördertechnik | 10021 | Anlage steht seit 08.07., zugesagte Rückmeldung ausgeblieben, zweimal nachgefasst | ganz vorn: Eskalation **und** gebrochene Zusage |
| Emscher Anlagenbau | 10151 | Reklamation aus Mai, zugesagte Gutschrift nicht erfolgt, Rechnung zurückgehalten | vorn: offenes Geld, blockiert die nächste Bestellung |
| Sauerland Hydraulik | 10135 | Hallenerweiterung, Budgetfreigabe im September, bittet um Termin im August | vorn: Chance mit Frist, Wettbewerb war da |
| Lindemann Kunststofftechnik | 10166 | Angebot über 18.600 EUR, Bindefrist 31.08., keine Rückmeldung | Mitte: Frist läuft, aber nichts brennt |
| Hellweg Präzisionsteile | 10182 | Abnahmetermin am 27.08. bereits vereinbart | hinten: steht schon, nur Vorbereitung |
| Berger Werkzeugbau | 10044 | Wartung im Juni ohne Befund | hinten: gefunden, aber nichts Offenes |

**Sechs von zwölf Firmen haben bewusst keine Notiz** – Vosskuhl, Nordhoff,
Kampmann, Westfalen, Ruhrtal und Niederrhein. Damit füllt der Assistent den
Abschnitt „## Nichts gefunden" wirklich, statt ihn leer zu lassen. Das ist der
bessere Film: Er zeigt, dass die Regel „Erfinde nichts" greift.

## Die Daten passen zur Filmliste

Bezugstag ist der **12.08.2026** – derselbe Tag, der im Prompt als „Geplanter
Besuchstag" steht. Alle Vorgänge liegen in den letzten sechs Monaten (der
Zeitraum, den der Prompt vorgibt) oder sind terminierte Ereignisse in der
Zukunft. Kundennummern, Orte und Postleitzahlen stimmen mit der Filmliste
überein, damit der Assistent sauber zuordnen kann – der Prompt verlangt genau
das („nutze dafür Kundenname, Kundennummer und Ort gemeinsam").

Die Firmen tragen erfundene Namen und `example.com`-Adressen, wie die
Beispielkunden der App auch.

## Was dabei herauskommen sollte

Der Prompt schreibt das Format vor. Erwartbar ist ungefähr:

```
## Tourreihenfolge
1. Rheinstahl Fördertechnik – Anlage steht seit dem 08.07., zugesagte
   Rückmeldung zweimal ausgeblieben
2. Emscher Anlagenbau – im Juni zugesagte Gutschrift offen, Rechnung wird
   zurückgehalten
3. Sauerland Hydraulik – Budgetfreigabe im September, Termin für August erbeten
4. Lindemann Kunststofftechnik – Angebot vom 15.07., Bindefrist 31.08.
5. Hellweg Präzisionsteile – Abnahme am 27.08. steht bereits
6. Berger Werkzeugbau – Wartung im Juni ohne Befund

## Das solltest du wissen
…

## Nichts gefunden
- Vosskuhl Metallverarbeitung, Nordhoff Antriebstechnik, …
```

Kommt etwas deutlich Dünneres zurück, liegt es meist daran, dass die Dateien im
Projekt nicht wirklich durchsucht werden – dann hilft es, sie einzeln statt als
Archiv hochzuladen.

**Fällt die Antwort schwach aus, lieber ganz auf den Einschub verzichten.** Der
Film funktioniert auch ohne ihn; ein schwacher Einschub schadet mehr, als er
nützt.
