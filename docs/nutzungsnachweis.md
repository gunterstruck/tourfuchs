# TourFuchs – Nutzungsnachweis

**Merkblatt für Budget-Entscheider und Betriebsrat · Stand: 03.10.2026**

## Worum es geht

Ein Werkzeug im Unternehmen kostet Pflege: Updates, Betrieb, Ansprechpartner.
Dieses Budget lässt sich nur rechtfertigen, wenn **neutral belegbar** ist, dass
das Werkzeug tatsächlich genutzt wird. Gleichzeitig darf dabei **kein Verdacht
einer Mitarbeiterüberwachung** entstehen.

TourFuchs löst beides mit einer bewusst schmalen Zählung: Es misst, **ob** die
Anwendung aufgerufen wird – nicht **wer** sie nutzt und nicht **was** jemand darin
tut.

## Was gezählt wird

| Gezählt | Nicht gezählt |
|---|---|
| Seitenaufrufe der Anwendung | Namen, Konten, Personalnummern |
| Besucher pro Tag (ohne Wiedererkennung über den Tag hinaus) | Wiedererkennung über Tage hinweg |
| grob: Browser, Betriebssystem, Gerätetyp (Handy/Desktop), Land | genaue IP-Adresse (nach Angaben von Vercel nicht gespeichert) |
| Herkunftsseite (z. B. ein Link aus dem Intranet) | Kundendaten, Touren, Briefings, Importe |
| | jede Bedienhandlung in der App (keine eigenen Ereignisse) |
| | Aufrufe mit „Do Not Track" oder Global Privacy Control |

Technik: **Vercel Web Analytics**, ohne Cookies und ohne Kennung auf dem Gerät.
TourFuchs kürzt jede gemeldete Adresse vor dem Senden auf Ursprung und Pfad –
eine per Link geteilte Tour steckt im Fragment (`#…`) und verlässt das Gerät so
nie. Quelltext: `src/services/usageCount.js`, Konfiguration:
`CONFIG.usageCount` in `src/core/config.js`.

## Wie man die Zahlen liest

- **Kennzahl:** *Besucher pro Woche* und ihr **Verlauf über Wochen**. Ein stetig
  steigender oder stabiler Wert bei der Zielgruppe ist der Beleg; ein einzelner
  Spitzentag (z. B. nach einer Vorführung) ist es nicht.
- **Die Zahl ist eine Untergrenze.** Wer die installierte App ohne Netz startet
  (draußen im Funkloch), wird nicht gezählt. Ebenso nicht, wer „Do Not Track"
  aktiviert hat.
- **Neugierige zählen mit.** Wer nur die Demo anschaut, ist ein Besucher wie jeder
  andere. Deshalb zählt der Verlauf über Wochen mehr als ein Einzelwert.
- **Wiederkehr ist nicht sichtbar** – bewusst: Dafür bräuchte es eine dauerhafte
  Kennung je Gerät, also genau das, was hier ausgeschlossen ist. Die Frage „nutzen
  dieselben Leute es jede Woche?" beantworten Gespräche, nicht die Statistik.

## Für den Betriebsrat

- Die Zählung ist **nicht personenbezogen auswertbar**: keine Anmeldung, keine
  Kennung, keine Zuordnung zu einer Person oder einem Gerät über den Tag hinaus.
- Es gibt **keine Leistungs- oder Verhaltensdaten**: nicht, wie viele Touren
  jemand plant, wann jemand arbeitet oder welche Kunden er besucht.
- Kundendaten liegen ausschließlich lokal im Browser der Anwender und werden nie
  übertragen (Datenschutzerklärung, Abschnitte 3 und 4a).
- Die Zählung ist im Quelltext offen nachprüfbar und lässt sich abschalten.

*Hinweis: Dieses Merkblatt beschreibt die Technik; es ersetzt keine rechtliche
Prüfung. Bei einem Betrieb im Unternehmen empfiehlt es sich, den Betriebsrat und
den Datenschutz von Anfang an einzubinden – die schmale Zählung macht dieses
Gespräch leicht, aber sie macht es nicht überflüssig.*

## Betrieb im Unternehmen (z. B. im Firmen-GitHub)

Eine Firmen-Installation unter eigener Adresse **zählt zunächst nichts**: Die
Zählung ist nur für die in `CONFIG.usageCount.hosts` eingetragenen Adressen
aktiv. Das Unternehmen entscheidet dann selbst:

1. **Gleiche Lösung im eigenen Vercel-Team:** eigene Adresse in
   `CONFIG.usageCount.hosts` eintragen und im Vercel-Projekt „Analytics"
   einschalten. Die Zahlen liegen dann beim Unternehmen.
2. **Eigener Webserver:** ganz ohne Skript – die Zugriffsprotokolle des Servers
   zeigen die Abrufe; `hosts` bleibt leer.
3. **Gar nicht zählen:** `hosts: []`.

## Auf tourfuchs.vercel.app einschalten

Im Vercel-Dashboard: Projekt **tourfuchs** → **Analytics** → **Enable**. Solange
das nicht geschehen ist, lädt TourFuchs das Zählskript zwar, es wird aber nichts
erfasst (Vercel liefert dann „nicht gefunden"); die Anwendung arbeitet
unverändert.
