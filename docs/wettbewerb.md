# TourFuchs – Wettbewerb

**Stand: 03.10.2026 · Rolle: Product Owner · Status: Arbeitsgrundlage**

Diese Seite beantwortet zwei Fragen: Was machen die Wettbewerber, gerade bei
Werbung und Kurzfilmen? Und was würde ein Wettbewerber tun, wenn er TourFuchs
als Bedrohung sähe, etwa nach dem Rat einer KI? Daraus folgt, wie wir uns
aufstellen.

> Die Recherche stützt sich auf öffentlich auffindbare Quellen (Stand oben). Sie
> ist eine Momentaufnahme, keine vollständige Marktstudie. Was eine fremde KI
> raten würde, ist eine begründete Einschätzung, keine Tatsache.

---

## 1. Wer ist im Markt?

| Anbieter | Kurzprofil | Preis / Einstieg | Marketing |
|---|---|---|---|
| **portatour** (impactit, Wien) | Automatische Touren- und Gebietsplanung; Besuchsintervalle, Öffnungszeiten, Übernachtungen; Excel/CSV und CRM (Salesforce, Dynamics, Veeva). | Kaufprodukt für Unternehmen | Sachliche Erklärvideos (2 Min., 10-Min.-Demo), Hilfe-Center |
| **Badger Maps** (USA) | Karten-App für den Außendienst: CRM-Daten auf Google Maps, Routenoptimierung, Leads; Excel/CSV oder CRM. | ab ca. 69 $ pro Nutzer und Monat, 7 Tage Test | Starke Inhaltsmaschine: Gründer-Podcast „Outside Sales Talk“ auf YouTube (einzelne Folgen ~30.000 Aufrufe) |
| **easymap / EasyVisit** | Web-basierte Touren- und Besuchsplanung mit Frequenzüberwachung. | Unternehmenslizenz | Webinare, Fachportale |
| **SPOTIO, Repsly** | Außendienst-Automatisierung (Tür-zu-Tür, Konsumgüter im Handel). | Unternehmenslizenz | Klassisches B2B-Marketing |
| **Microsoft-Umfeld** (z. B. MapCopilot für Dynamics 365) | Karten in Dynamics, Routen per natürlicher Sprache: „Zeig alle Leads im Umkreis von 50 km und optimiere die Route“. | Zusatz zu Dynamics | Partner-Blogs, Microsoft-Ökosystem |

## 2. Werbung und Kurzfilme

- Die Wettbewerber **erklären** ihr Produkt (Demos, Webinare, Vergleiche) oder
  setzen auf **Fachinhalte** (Badger Maps' Podcast).
- **Emotionale Kurzfilme** im Stil der Lichterkarte haben wir nicht gefunden.
  Das beweist nicht, dass es keine gibt, aber das Muster ist klar: Niemand
  „zeigt her“.
- **Folge für uns:** Unsere Filme (Lichterkarte, Tour planen, Firmen-KI-Liste)
  besetzen eine Lücke. Der Coolness-Faktor ist ein echter Unterschied, kein
  Beiwerk.

## 3. Was würde ein Wettbewerber tun? (Die Sicht einer „fremden KI“)

**Lageeinschätzung, wie sie eine Analyse vermutlich treffen würde:** *„Kein
Grund zur Panik.“* TourFuchs ist ein privates, frei nutzbares Projekt: ohne
Support, ohne CRM-Abgleich, ohne Team-Funktionen, ohne Vertrag. Die Wettbewerber
verkaufen an **Unternehmen** (Einkauf, IT); TourFuchs erreicht **Einzelne**, die
an der IT vorbei ausprobieren. Andere Käufer, andere Front.

**Wahrscheinliche Empfehlungen, vom Wahrscheinlichen zum Gefährlichen:**

| # | Zug des Wettbewerbers | Wahrscheinlichkeit | Gefahr für uns |
|---|---|---|---|
| 1 | **Beobachten, nicht reagieren.** Eine Reaktion würde TourFuchs nur bekannter machen. | hoch | gering |
| 2 | **Vertrauen angreifen:** „Privates Tool, Schatten-IT, wer haftet, wo ist der Auftragsverarbeitungsvertrag?“ | mittel | **hoch** – das zieht in Unternehmen am stärksten |
| 3 | **Ideen nachbauen:** Lichterkarte als Heatmap, Copilot-Prompt für den Import. Ideen sind nicht geschützt und schnell kopiert. | mittel | mittel |
| 4 | **Gratis-Einstieg für Einzelne** (Solo-Tarif) – schließt die Tür, durch die wir kommen. | mittel | mittel |
| 5 | **In CRM und Copilot einbauen:** „Frag Copilot nach deiner Tour.“ Langfristig ist Microsoft selbst die größere Bedrohung als portatour: Ist Tourenplanung ein Copilot-Feature, ist sie in jedem Konzern einfach da. | steigend | **hoch** (langfristig) |
| 6 | **Den Entwickler ansprechen** – einstellen oder übernehmen. | gering | keine – eher eine Chance |

## 4. Unser Schutz – was schwer zu kopieren ist

Unser Schutz sind nicht Funktionen, sondern vier Dinge:

1. **Null Hürde:** Browser, kein Login, keine IT-Freigabe, in einer Minute
   ausprobiert.
2. **Nachprüfbares Vertrauen:** Kundendaten bleiben lokal, Datenschutz offen
   beschrieben, Nutzungszählung betriebsratsfest dokumentiert
   ([Nutzungsnachweis](nutzungsnachweis.md)). Genau die Antwort auf Zug 2.
3. **Insider im Konzern:** Der Entwickler kennt die Abläufe, die Firmen-KI und
   die Kollegen. Das hat kein US-Anbieter.
4. **Emotion:** die Filme und die Lichterkarte.

## 5. Unsere Antworten (Produktentscheidungen)

| Zug | Unsere Antwort |
|---|---|
| **Vertrauen angreifen (2)** | Das Argument liegt schon bereit: lokal-first, [Datenschutzerklärung](../public/datenschutz.html), [Nutzungsnachweis](nutzungsnachweis.md) mit Betriebsrats-Teil, Open Source. Beim Umzug ins Konzern-GitHub übernimmt der Konzern die Verantwortung (Roadmap, „Offene Themen“). |
| **Ideen nachbauen (3)** | Nicht verhindern, sondern schneller sein: Tempo durch echte Nutzer schlägt Nachbau. |
| **Gratis-Einstieg (4)** | Wir sind schon frei nutzbar; unser Vorsprung ist die fehlende Hürde (kein Konto), nicht der Preis. |
| **CRM / Copilot (5)** | **Mit Copilot arbeiten, nicht dagegen.** TourFuchs bereitet Prompts vor und sendet selbst nichts. Wird Copilot besser im Routen, profitieren wir mit. |
| **Generell** | **Schmal bleiben, nicht in Funktionen konkurrieren.** CRM-Abgleich, Teams, Verträge wären das Heimspiel der Wettbewerber. Es gilt die Prüffrage aus Roadmap 1a: *„Hilft das unseren 10 Außendienstlern?“* |

**Der beste Schutz:** 10 Menschen, die TourFuchs jede Woche nutzen – bevor es
jemand anderes merkt.

## 6. Wann diese Seite neu ansehen?

- Ein Wettbewerber bringt einen Gratis-Tarif für Einzelne oder eine
  Lichterkarte-ähnliche Ansicht.
- Microsoft kündigt Tourenplanung als Copilot-Funktion an.
- Jemand stellt TourFuchs in einem Unternehmen als „Schatten-IT“ in Frage.
- Spätestens bei der Entscheidung über den Konzern-Betrieb.

---

### Quellen

- [Badger Maps: Vergleich mit portatour](https://www.badgermapping.com/compare-portatour-field-sales/)
- [Badger Maps auf Capterra (Preis, Bewertung)](https://www.capterra.co.za/software/148607/badger-maps)
- [Badger Maps Podcast „Outside Sales Talk“](https://www.badgermapping.com/podcast/how-i-left-my-sales-career-to-start-badger-maps)
- [Starter Story: Wie Badger Maps mit einem Nischen-Podcast wächst](https://www.starterstory.com/stories/how-our-podcast-for-field-salespeople-became-one-of-the-most-popular-sales-podcasts)
- [portatour Erklärvideo (Help Center)](https://help.portatour.com/hc/en-us/articles/360023577312-Explanation-video-in-2-minutes)
- [portatour auf Softguide](https://www.softguide.de/programm/portatour-tourenplanung-fuer-outlook-mobile-salesforce-crm)
- [easymap Webinar (Ipsos)](https://www.ipsos.com/de-de/node/1051991)
- [Capterra: Field-Sales-Software Deutschland](https://www.capterra.com.de/directory/33395/field-sales/software)
- [MapCopilot für Dynamics 365 (Inogic)](https://www.inogic.com/blog/2025/11/meet-mapcopilot-your-ai-powered-geo-mapping-companion-for-dynamics-365/)
