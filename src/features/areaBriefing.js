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
 *  1. **Höchstens 8 Kunden** (PO 24.10.2026, vorher 12). Eine Liste mit
 *     vierzig Kunden ist weder ein guter Prompt noch eine gute Idee – und kein
 *     Weg, den Bestand in ein fremdes System zu tragen.
 *  2. **Angaben je nach Einstieg.** Tourvorschläge und „In der Nähe": nur Name,
 *     Kundennummer, Ort und Fälligkeit – kein Umsatz, keine Kontakte, keine
 *     Straße. Lasso (`detailed`): je Kunde dieselben Angaben wie das
 *     Kundenbriefing (Ansprechpartner und Zuständigkeiten mit Namen,
 *     Auftragseingang nach Geschäftsjahr, offene Opportunities) – weiterhin
 *     ohne Telefon, E-Mail und Straße.
 *  3. **Nie mit Beispielkunden.** Wie überall sonst auch.
 *
 * Reine Logik, ohne DOM.
 */

import { isDemoCustomer } from '../core/demoSafety.js';
import { lastVisit, visitStatus } from './visits.js';
import { briefingSourcesPromptBlock } from '../services/briefingSources.js';
import { customerDetailLines } from './customerBriefing.js';

/** Mehr Kunden ergeben kein besseres Briefing, nur einen längeren Prompt. */
export const AREA_BRIEFING_LIMIT = 8;

const STATUS_RANK = { ueberfaellig: 0, faellig: 1 };

/** Überfällige zuerst, dann bald fällige, dann die am längsten nicht Besuchten. */
export function briefingOrder(customers, now = new Date()) {
    const rank = (c) => STATUS_RANK[visitStatus(c, now)] ?? 2;
    // Besuche liegen als ISO-Datum vor („2026-05-01"); ohne Besuch zählt es als ältester.
    const last = (c) => Date.parse(lastVisit(c) || '') || 0;
    return [...customers].sort((a, b) => rank(a) - rank(b) || last(a) - last(b));
}

function value(input) {
    return String(input ?? '').trim();
}

function formatLocalDate(isoDate) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value(isoDate));
    return match ? `${match[3]}.${match[2]}.${match[1]}` : value(isoDate);
}

/**
 * Der Tag, auf den sich das Briefing bezieht: der eingestellte Planungstag,
 * sonst heute. `label` liefert die passende Anrede, damit der Prompt nicht
 * „heute" sagt, wenn ein anderer Tag gemeint ist.
 */
function referenceDate(context = {}) {
    if (context.now instanceof Date) return { date: context.now, label: 'heute' };
    const iso = value(context.plannedDate);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!match) return { date: new Date(), label: 'heute' };
    const planned = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
    if (Number.isNaN(planned.getTime())) return { date: new Date(), label: 'heute' };
    const today = new Date();
    const sameDay = planned.getFullYear() === today.getFullYear()
        && planned.getMonth() === today.getMonth()
        && planned.getDate() === today.getDate();
    return { date: planned, label: sameDay ? 'heute' : `am ${formatLocalDate(iso)}` };
}

/**
 * Wer kommt in den Prompt? Beispielkunden fliegen raus, der Rest wird gedeckelt.
 * Die Reihenfolge der Eingabe bleibt erhalten – sie ist bereits sinnvoll
 * sortiert (Entfernung bzw. „Überfällige zuerst").
 */
export function areaBriefingSelection(customers = [], { limit = AREA_BRIEFING_LIMIT, includeDemo = false } = {}) {
    // Beispielkunden nur für die reine Ansicht in der Vorführung (`includeDemo`).
    const real = customers.filter((customer) => customer && (includeDemo || !isDemoCustomer(customer)));
    return {
        included: real.slice(0, Math.max(1, limit)),
        total: real.length,
        demoCount: customers.length - real.length,
        truncated: real.length > limit
    };
}

/** Fälligkeit ist lokales Wissen und hilft dem Assistenten beim Sortieren. */
function visitParts(customer, now) {
    const parts = [];
    const status = visitStatus(customer, now);
    if (status === 'ueberfaellig') parts.push('überfällig');
    else if (status === 'faellig') parts.push('bald fällig');
    const last = lastVisit(customer);
    if (last) parts.push(`zuletzt besucht ${formatLocalDate(last)}`);
    return parts;
}

/** Eine Zeile je Kunde – knapp, aber eindeutig zuordenbar. */
function customerLine(customer, index, now) {
    const parts = [`${index + 1}. ${value(customer.name) || 'ohne Namen'}`];
    if (value(customer.nummer)) parts.push(`Kundennummer ${value(customer.nummer)}`);
    const place = [value(customer.plz), value(customer.ort)].filter(Boolean).join(' ');
    if (place) parts.push(place);
    return [...parts, ...visitParts(customer, now)].join(' · ');
}

/** Lasso: ein Block je Kunde mit denselben Angaben wie das Kundenbriefing. */
function customerBlock(customer, index, now) {
    const visits = visitParts(customer, now);
    const details = customerDetailLines(customer, { today: now })
        .filter((line) => !line.startsWith('- Kundenname:'));
    if (visits.length) details.push(`- Besuch: ${visits.join(' · ')}`);
    return [`${index + 1}. ${value(customer.name) || 'ohne Namen'}`, ...details.map((line) => `   ${line}`)].join('\n');
}

/**
 * @param {object[]} customers  bereits ausgewählte Kunden (siehe areaBriefingSelection)
 * @param {object} context      { areaLabel, plannedDate, total, preview, detailed, order }
 *                              `preview`: nur für die Ansicht in der Vorführung –
 *                              dann dürfen Beispielkunden im Text stehen.
 *                              `detailed`: je Kunde die Angaben des Kundenbriefings (Lasso).
 *                              `order`: 'urgent' (dringendste zuerst) oder Entfernung (Standard).
 * @param {object} assistant    optional, liefert die Quellenzeile
 * @param {object[]} sources    eigene Nachschlagequellen des Nutzers (optional)
 */
export function buildAreaBriefingPrompt(customers = [], context = {}, assistant = null, sources = []) {
    const list = customers.filter((customer) => customer && (context.preview === true || !isDemoCustomer(customer)));
    if (list.length === 0) {
        throw new Error('Für Beispielkunden wird kein Gebiets-Briefing erzeugt.');
    }

    // Fälligkeit und Anrede müssen sich auf **denselben** Tag beziehen.
    //
    // Vorher stand im Prompt „Ich bin heute unterwegs" samt „Geplanter
    // Besuchstag: 05.08.", während „überfällig" gegen die echte Uhr gerechnet
    // wurde. Bei einem Planungstag in der Zukunft kann ein Kunde am Reisetag
    // fällig sein, heute aber noch nicht – der Assistent bekam dann zwei
    // widersprüchliche Zeitbezüge und sortierte nach dem falschen.
    const reference = referenceDate(context);
    const now = reference.date;
    const sourceInstruction = value(assistant?.promptSources)
        || 'Durchsuche ausschließlich Microsoft-365-Inhalte, auf die ich mit meinem Arbeitskonto zugreifen darf: relevante E-Mails, Outlook-Termine, Teams-Chats, Besprechungen, Transkripte und Dateien.';

    const ownSources = briefingSourcesPromptBlock(sources);
    const areaLabel = value(context.areaLabel) || 'mein aktuelles Gebiet';
    const planned = value(context.plannedDate)
        ? `Geplanter Besuchstag: ${formatLocalDate(context.plannedDate)}. Fälligkeiten unten beziehen sich auf diesen Tag.\n`
        : '';
    const chosen = context.order === 'urgent' ? 'dringendsten (überfällig, bald fällig, am längsten nicht besucht)' : 'nächstgelegenen';
    const truncated = Number(context.total) > list.length
        ? `Es sind ${context.total} Kunden im Gebiet; hier stehen die ${list.length} ${chosen}.\n`
        : '';
    const lines = context.detailed
        ? list.map((customer, index) => customerBlock(customer, index, now))
        : list.map((customer, index) => customerLine(customer, index, now));
    // Auftragseingang ist kein Umsatz: Sonst schließt die KI auf Rechnungen und Zahlungen.
    const orderIntake = lines.some((line) => line.includes('- Auftragseingang nach Geschäftsjahr:'))
        ? '\nDie Zahlen „Auftragseingang" sind bestellt, nicht berechnet (kein Umsatz). Wiederhole sie nicht, sondern ordne sie ein.\n'
        : '';

    return `Du bist meine Vertriebsassistenz. Ich bin ${reference.label} in diesem Gebiet unterwegs und möchte wissen, wen ich zuerst besuchen sollte.

Gebiet: ${areaLabel}.
${planned}${truncated}
Diese Kunden stehen zur Auswahl:
${lines.join('\n')}
${orderIntake}
${ownSources}${sourceInstruction} Ordne Treffer eindeutig dem jeweiligen Kunden zu – nutze dafür Kundenname, Kundennummer und Ort gemeinsam. Vermische keine ähnlich benannten Kunden.

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
