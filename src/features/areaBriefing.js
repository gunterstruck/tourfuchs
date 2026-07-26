/**
 * Gebiets-Briefing: ein Prompt für mehrere Kunden aus dem gewählten Umkreis.
 *
 * Die Frage im Außendienst lautet selten „erzähl mir alles über einen Kunden",
 * sondern: **„Ich bin hier – wen von diesen besuche ich zuerst, und warum?"**
 * Genau das kann TourFuchs allein nicht beantworten: Überfälligkeit und
 * Entfernung weiß es, offene Vorgänge und den letzten Schriftwechsel nicht.
 *
 * Deshalb dieselbe Bauweise wie beim Kundenbriefing: TourFuchs baut den Prompt
 * **lokal**, zeigt ihn vollständig und kopiert ihn. Gesendet wird nichts – das
 * macht der Nutzer im Assistenten.
 *
 * Drei bewusste Grenzen, weil hier vieles auf einmal zusammenkommt:
 *
 *  1. **Kein Umsatz, keine Kontaktdaten, keine Straße.** Beim Kundenbriefing
 *     ist das zugesagt; bei einer ganzen Liste wiegt es schwerer, nicht
 *     leichter. Was TourFuchs lokal weiß, muss es nicht aus der Hand geben.
 *  2. **Gedeckelte Anzahl.** Eine Liste mit vierzig Kunden ist weder ein guter
 *     Prompt noch eine gute Idee. Es zählt der Umkreis, nicht der Bestand.
 *  3. **Nie mit Beispielkunden.** Wie überall sonst auch.
 *
 * Reine Logik, ohne DOM.
 */

import { isDemoCustomer } from '../core/demoSafety.js';
import { lastVisit, visitStatus } from './visits.js';

/** Mehr Kunden ergeben kein besseres Briefing, nur einen längeren Prompt. */
export const AREA_BRIEFING_LIMIT = 12;

function value(input) {
    return String(input ?? '').trim();
}

function formatLocalDate(isoDate) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value(isoDate));
    return match ? `${match[3]}.${match[2]}.${match[1]}` : value(isoDate);
}

/**
 * Wer kommt in den Prompt? Beispielkunden fliegen raus, der Rest wird gedeckelt.
 * Die Reihenfolge der Eingabe bleibt erhalten – sie ist bereits sinnvoll
 * sortiert (Entfernung bzw. „Überfällige zuerst").
 */
export function areaBriefingSelection(customers = [], { limit = AREA_BRIEFING_LIMIT } = {}) {
    const real = customers.filter((customer) => customer && !isDemoCustomer(customer));
    return {
        included: real.slice(0, Math.max(1, limit)),
        total: real.length,
        demoCount: customers.length - real.length,
        truncated: real.length > limit
    };
}

/** Eine Zeile je Kunde – knapp, aber eindeutig zuordenbar. */
function customerLine(customer, index, now) {
    const parts = [`${index + 1}. ${value(customer.name) || 'ohne Namen'}`];
    if (value(customer.nummer)) parts.push(`Kundennummer ${value(customer.nummer)}`);
    const place = [value(customer.plz), value(customer.ort)].filter(Boolean).join(' ');
    if (place) parts.push(place);

    // Fälligkeit ist lokales Wissen und hilft dem Assistenten beim Sortieren.
    const status = visitStatus(customer, now);
    if (status === 'ueberfaellig') parts.push('überfällig');
    else if (status === 'faellig') parts.push('bald fällig');
    const last = lastVisit(customer);
    if (last) parts.push(`zuletzt besucht ${formatLocalDate(last)}`);

    return parts.join(' · ');
}

/**
 * @param {object[]} customers  bereits ausgewählte Kunden (siehe areaBriefingSelection)
 * @param {object} context      { areaLabel, plannedDate, total }
 * @param {object} assistant    optional, liefert die Quellenzeile
 */
export function buildAreaBriefingPrompt(customers = [], context = {}, assistant = null) {
    const list = customers.filter((customer) => customer && !isDemoCustomer(customer));
    if (list.length === 0) {
        throw new Error('Für Beispielkunden wird kein Gebiets-Briefing erzeugt.');
    }

    const now = context.now instanceof Date ? context.now : new Date();
    const sources = value(assistant?.promptSources)
        || 'Durchsuche ausschließlich Microsoft-365-Inhalte, auf die ich mit meinem Arbeitskonto zugreifen darf: relevante E-Mails, Outlook-Termine, Teams-Chats, Besprechungen, Transkripte und Dateien.';

    const areaLabel = value(context.areaLabel) || 'mein aktuelles Gebiet';
    const planned = value(context.plannedDate)
        ? `Geplanter Besuchstag: ${formatLocalDate(context.plannedDate)}.\n`
        : '';
    const truncated = Number(context.total) > list.length
        ? `Es sind ${context.total} Kunden im Gebiet; hier stehen die ${list.length} nächstgelegenen.\n`
        : '';

    return `Du bist meine Vertriebsassistenz. Ich bin heute in diesem Gebiet unterwegs und möchte wissen, wen ich zuerst besuchen sollte.

Gebiet: ${areaLabel}.
${planned}${truncated}
Diese Kunden stehen zur Auswahl:
${list.map((customer, index) => customerLine(customer, index, now)).join('\n')}

${sources} Ordne Treffer eindeutig dem jeweiligen Kunden zu – nutze dafür Kundenname, Kundennummer und Ort gemeinsam. Vermische keine ähnlich benannten Kunden.

Zeitraum: die letzten 6 Monate, dazu bereits terminierte Ereignisse.

Deine Aufgabe hat zwei Teile: **Sag mir, was bei diesen Kunden gerade los ist – und in welcher Reihenfolge ich sie besuchen soll.**

Liefere ausschließlich dieses Format:
## Tourreihenfolge
1. Name – der eine Grund, der den Besuch jetzt dringend macht
2. … alle übrigen Kunden mit Rang, je eine kurze Zeile

## Das solltest du wissen
- je Kunde mit Fundstellen ein Stichpunkt: Name – offener Vorgang, Eskalation, zugesagte Rückmeldung oder jüngste Kommunikation, mit Datum
- höchstens ein zweiter Stichpunkt je Kunde, wenn er wirklich etwas ändert

## Mitnehmen / vorbereiten
- höchstens 3 konkrete Punkte: Unterlage, Angebot, Zusage, offene Frage

## Nichts gefunden
- Kunden, zu denen du keine belastbaren internen Informationen hast, als reine Aufzählung

Qualitätsregeln:
- Das gesamte Briefing hat höchstens 300 Wörter.
- Beginne direkt mit „## Tourreihenfolge". Kein Vorspann, kein Bericht über deine Suche.
- Die Reihenfolge muss sich aus den Fundstellen ergeben, nicht aus der Entfernung: Wer etwas Offenes hat, steht vorn.
- Entscheidend ist, was ich noch nicht weiß. Wie lange der letzte Besuch her ist, steht oben – wiederhole es nicht als Begründung.
- Nenne bei jeder Aussage Datum und Anlass, damit ich sie einordnen kann.
- Erfinde nichts. Ordne einen Kunden lieber unter „Nichts gefunden" ein.
- Nutze keine Websuche und keine allgemeinen Internetinformationen.
- Schreibe knapp, auf Deutsch, ohne Höflichkeitsfloskeln.`;
}

/** Kurze Beschreibung des Gebiets für Dialog und Prompt. */
export function areaLabelFor({ mode = 'radius', radiusKm = 0, startLabel = '', mapLabel = '' } = {}) {
    if (mode === 'radius' && radiusKm > 0) {
        const around = value(startLabel) ? ` um ${value(startLabel)}` : ' um den Startpunkt';
        return `Umkreis von ${radiusKm} km${around}`;
    }
    if (mode === 'route') {
        const from = value(startLabel) ? ` ab ${value(startLabel)}` : '';
        return `Kunden entlang der geplanten Strecke${from}`;
    }
    if (mode === 'lasso') return 'die von mir auf der Karte markierte Fläche';
    if (mode === 'gps') return 'Umkreis um meinen aktuellen Standort';
    return value(mapLabel) || 'der aktuell sichtbare Kartenausschnitt';
}
