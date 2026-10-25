# TourFuchs-Guide – Einstellungen außerhalb der Anweisungen

Stand 25.10.2026. Was im ChatGPT-Editor („Konfigurieren") neben Anweisungen
und Wissen steht – festgehalten, weil es **bei der Umstellung GPT → Plugin
verloren geht** (OpenAI schaltet Custom GPTs am 11.12.2026 ab, siehe
Roadmap „Offene Themen mit Auslöser").

- **Anweisungen:** immer der Inhalt von
  [`custom-gpt-systemprompt.txt`](custom-gpt-systemprompt.txt) – nicht im
  Editor von Hand pflegen.
- **Wissen:** die Dateien aus `custom-gpt-upload/` (`npm run docs:gpt-upload`).
- **Bild:** das Fuchs-Symbol der App (`public/icons/icon-512.png`).

## Name

```
TourFuchs Guide
```

## Beschreibung

```
Persönlicher Bedien-, Support- und Schulungsassistent für TourFuchs Vertrieb. Erklärt Funktionen, führt Schritt für Schritt durch Arbeitsabläufe und hilft anhand von Screenshots weiter.
```

## Gesprächsaufhänger

Im Plugin dort wieder eintragen, wo es Beispiel-Anfragen anbietet; sonst
an die Tester weitergeben. Begriffe wie in der App („Mehrkunden-Briefing",
nicht mehr „Gebiets-Briefing").

```
Zeige mir den Lasso-Workflow bis zum Mehrkunden-Briefing.
```

```
Hilf mir beim Import meiner Kundendaten.
```

```
Erkläre mir das Kundenbriefing Schritt für Schritt.
```

```
Ich schicke dir einen Screenshot – zeige mir, wie es weitergeht.
```

```
🦊 TourFuchs-PWA öffnen
```

Der fünfte Aufhänger ist auf die Anweisungen abgestimmt: Auf genau diesen
Text antwortet der Guide nur mit dem Link zur App.

## Abgleich am 25.10.2026

Im veröffentlichten GPT stand noch eine **ältere Fassung der Anweisungen**
(mit „Basis"/„Profi", „Als Excel exportieren" und „Gebiets-Briefing"). Vor
der Umstellung auf das Plugin die aktuelle `custom-gpt-systemprompt.txt`
einsetzen und das Wissen neu hochladen – sonst übernimmt das Plugin den
alten Stand.

## Umstellung auf ein Plugin (bis 11.12.2026)

**Befund aus dem Migrationsdialog (25.10.2026):** „Öffentliche Freigabe nicht
verfügbar – Plugins können nicht öffentlich geteilt werden. Das Plugin bleibt
privat." Außerdem lässt sich der GPT nach der Migration **nicht mehr
bearbeiten**. Folge: Für die Tester endet der Guide bei ChatGPT am
11.12.2026; das Plugin taugt nur noch für den PO selbst. Deshalb vorher die
GPT-Anweisungen aktualisieren und einen Ersatz für die Tester festlegen
(naheliegend: dieselben Dateien im Firmen-Copilot, Kundendaten bleiben dann
ohnehin in der Organisation).

1. Anweisungen und Wissen auf den aktuellen Stand bringen und veröffentlichen.
2. *Meine GPTs* → TourFuchs Guide → „Zu Plugin migrieren".
3. *Plugins* → *Persönlich* → installieren; mit „@TourFuchs Guide" testen:
   Bildanzeige aus der PDF, Annahme der großen PDF, drei typische Fragen.
4. Gesprächsaufhänger von oben wieder eintragen.
5. Teilen klären (je nach ChatGPT-Tarif) und den neuen Link in
   `src/core/config.js` (`guideUrl`) und `index.html` (`#guide-open`)
   eintragen; Texte von „GPT" auf „Plugin" umstellen.
