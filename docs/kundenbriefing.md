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

## Prüfschritte

1. Basis-Modus, echter Kunde → Dialog zeigt Prompt, **keine** Assistentenwahl,
   Knopf lautet „Prompt kopieren & Microsoft 365 Copilot öffnen".
2. Profi-Modus → Auswahl aufklappen, **Google Gemini** wählen: Knopftext und
   Quellenzeile im Prompt wechseln sofort.
3. **Eigener Assistent** mit `http://…` → sichtbare Fehlermeldung, Ziel bleibt gültig.
4. Demo-Kunde → Demo-Vorschau, kein Fenster öffnet sich, nichts wird kopiert.
5. Nach dem ersten Start sind `tourfuchs:copilot-config:v1` und
   `tourfuchs:copilot-consent:v1` nicht mehr im Local Storage.
