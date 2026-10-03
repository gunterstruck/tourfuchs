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

## Umzug ins Konzern-GitHub *(offenes Thema, Stand 03.10.2026)*

**Auslöser:** Der Konzern entscheidet, TourFuchs selbst zu betreiben. Vorher
wird hierfür **nichts gebaut** (Baustopp, Roadmap 1a).

**Warum überhaupt umziehen:** Vercel war ursprünglich nur der Weg, den Code
privat zu halten und trotzdem zu veröffentlichen. Technisch braucht TourFuchs
Vercel nicht – es ist eine rein statische Web-App (`dist/`), die auf jedem
Webserver läuft. Dazu kommt: Der Vercel-**Hobby-Plan** ist nur für private,
nicht-kommerzielle Nutzung gedacht. Ein Betrieb **durch den Konzern für seine
Mitarbeiter** gehört nicht auf einen privaten Hobby-Account, sondern auf
Infrastruktur des Konzerns.

**Bis dahin:** TourFuchs bleibt auf `tourfuchs.vercel.app`. Die dort gezählten
Besucher pro Woche sind der erste Beleg für die Entscheidung im Konzern.

### Hosting im Konzern – Optionen

| Option | Passt, wenn … | Hinweis |
|---|---|---|
| **GitHub Pages im Konzern-GitHub** | der Konzern GitHub Enterprise nutzt | Zugriff lässt sich auf angemeldete Mitarbeiter beschränken – für ein internes Werkzeug ideal. |
| **Azure Static Web Apps** | der Konzern auf Microsoft setzt (M365, Copilot) | Anmeldung über das Firmenkonto möglich. |
| **Eigener Webserver der IT** | es schon einen internen Webserver gibt | einfachste Variante, wenn vorhanden. |

### Nutzungszahlen im Konzern

GitHub Pages zeigt **keine** Besucherzahlen der Seite. „Insights → Traffic"
im Repository zählt nur Aufrufe des **Codes** auf github.com, nicht die Nutzung
der App. Wege im Konzern:

1. **Zugriffsprotokolle von Proxy oder Webserver** – ohne Code in der App,
   am neutralsten, für den Betriebsrat am einfachsten.
2. **Vorhandenes Zählwerkzeug des Konzerns** (z. B. Application Insights,
   Matomo): TourFuchs schickt dieselbe schmale Meldung wie heute an Vercel
   (nur Seitenaufruf, Adresse ohne Suchteil/Fragment), aber an den Firmen-Zähler.
   Die Zahlen bleiben im Konzern.
3. Vercel Web Analytics nur, wenn der Konzern selbst ein Vercel-Team betreibt
   (siehe oben, „Betrieb im Unternehmen").

### Technische To-dos beim Umzug

- [ ] **Unterpfad-fähig machen:** GitHub Pages liegt meist unter
  `…/tourfuchs/`. Feste Pfade auf `/` anpassen – Vite `base`, PWA-Manifest
  (`start_url`, `scope` in `vite.config.js`), Verweise wie `/theme-boot.js`,
  `/datenschutz.html`, `/license.html`, `/geodata/…` in `index.html`, `src/`
  und `public/`.
- [ ] **Header aus `vercel.json` ersetzen:** `sw.js` und `manifest.webmanifest`
  ohne langen Cache. GitHub Pages erlaubt keine eigenen Header (kurzer Standard-
  Cache – prüfen, ob Updates zuverlässig ankommen).
- [ ] **Zählung umstellen:** `CONFIG.usageCount.hosts` auf die Konzern-Adresse
  setzen oder leeren; bei Option 2 den Zielort der Meldung konfigurierbar
  machen (`src/services/usageCount.js`).
- [ ] **Datenschutzerklärung anpassen:** Verantwortlicher wird der Konzern;
  Abschnitt 4a (Hosting/Zählung) auf den neuen Betrieb umschreiben.
- [ ] **CI/Deploy:** GitHub-Actions-Workflow „build → Pages" statt
  Vercel-Git-Integration; die bestehenden Prüfungen (build-and-test,
  attention, smoke) bleiben.

### Fragen an die IT des Konzerns

1. Gibt es GitHub Enterprise mit Pages und Zugriffsbeschränkung auf Mitarbeiter?
   Oder ist Azure Static Web Apps bzw. ein interner Webserver der Standardweg?
2. Können Proxy- oder Webserver-Protokolle die Aufrufe einer internen Adresse
   anonym zählen (Besucher pro Woche)?
3. Gibt es ein freigegebenes Zählwerkzeug (Application Insights, Matomo …),
   und ist es mit dem Betriebsrat abgestimmt?
4. Wer ist Verantwortlicher im Sinne der DSGVO, wer pflegt die Anwendung?
5. Sind die externen Dienste erlaubt, die TourFuchs nutzt (Kartenkacheln von
   OpenStreetMap/Esri, optional Nominatim und OSRM)?

## Auf tourfuchs.vercel.app einschalten

Im Vercel-Dashboard: Projekt **tourfuchs** → **Analytics** → **Enable**. Solange
das nicht geschehen ist, lädt TourFuchs das Zählskript zwar, es wird aber nichts
erfasst (Vercel liefert dann „nicht gefunden"); die Anwendung arbeitet
unverändert.
