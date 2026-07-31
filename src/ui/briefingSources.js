/**
 * Eingabe für die eigenen Nachschlagequellen – ein Fragment, zwei Einbauorte
 * (Kundenbriefing und Gebiets-Briefing). Bewusst nicht zweimal gepflegt: Beide
 * Dialoge zeigen denselben Zustand, geändert wird er, wo er gerade auffällt.
 *
 * Eingeklappt („Überblick → aufzoomen"), aber mit sprechender Zeile: Ohne
 * Eintrag stellt sie die Frage, die den Nutzen erklärt – „Wo soll der Assistent
 * zuerst nachsehen?" –, mit Eintrag meldet sie den Stand.
 *
 * Bewusst in **beiden** Ansichtstiefen sichtbar, anders als die Zielwahl: Die
 * Zielwahl ist Konfiguration für den Sonderfall, die Quelle verbessert das
 * Ergebnis, für das der Nutzer den Dialog überhaupt geöffnet hat.
 */

import {
    BRIEFING_SOURCES_LIMIT,
    loadBriefingSources,
    saveBriefingSources
} from '../services/briefingSources.js';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
));

function summaryText(count) {
    if (count === 0) return '<b>Wo soll der Assistent zuerst nachsehen?</b><span>Eigene Liste oder Ordner hinterlegen – einmalig</span>';
    return `<b>Meine Quellen: ${count} hinterlegt</b><span>Ändern oder ergänzen</span>`;
}

function rowHtml({ label = '', location = '' } = {}) {
    return `<div class="briefing-source-row">
        <label class="briefing-field">Was steckt drin?
            <input type="text" data-source-label maxlength="160" autocomplete="off"
                placeholder="z. B. Bezirksliste Rheinland – Konditionen und Kontakte, Zuordnung über die Kundennummer"
                value="${escapeHtml(label)}">
        </label>
        <label class="briefing-field">Link oder Pfad
            <input type="text" data-source-location maxlength="400" autocomplete="off" spellcheck="false"
                placeholder="https://firma.sharepoint.com/… oder Ordner Vertrieb / Bezirkslisten"
                value="${escapeHtml(location)}">
        </label>
    </div>`;
}

/** Markup des eingeklappten Blocks – von den Dialogen in ihr Body eingesetzt. */
export function briefingSourcesHtml() {
    const list = loadBriefingSources();
    const rows = [...list, { label: '', location: '' }].slice(0, BRIEFING_SOURCES_LIMIT);
    return `<details class="briefing-sources">
        <summary>${summaryText(list.length)}</summary>
        <div class="briefing-sources-content">
            <p class="muted small">Der Assistent durchsucht sonst alles, worauf du Zugriff hast – und findet oft Älteres. Nenne ihm die Ablage, die du selbst pflegst; sie bekommt im Prompt Vorrang. <b>Die Angabe wird nur in den Prompt geschrieben</b>: TourFuchs öffnet nichts davon und sendet nichts.</p>
            <div class="briefing-source-rows">${rows.map(rowHtml).join('')}</div>
            <p class="muted small">Höchstens ${BRIEFING_SOURCES_LIMIT} Quellen – mehr ergeben wieder einen Heuhaufen. Zum Entfernen beide Felder leeren.</p>
        </div>
    </details>`;
}

function readRows(root) {
    return [...root.querySelectorAll('.briefing-source-row')].map((row) => ({
        label: row.querySelector('[data-source-label]')?.value ?? '',
        location: row.querySelector('[data-source-location]')?.value ?? ''
    }));
}

/**
 * Verdrahten. `onChange` baut den Prompt neu, damit der Nutzer die Wirkung
 * sofort im angezeigten Prompt sieht statt erst im Assistenten.
 */
export function wireBriefingSources(root, onChange) {
    const block = root?.querySelector('.briefing-sources');
    if (!block) return;
    const rowsBox = block.querySelector('.briefing-source-rows');

    const apply = () => {
        const saved = saveBriefingSources(readRows(block));
        const summary = block.querySelector('summary');
        if (summary) summary.innerHTML = summaryText(saved.length);

        // Ist jede sichtbare Zeile gefüllt und Platz übrig, wartet schon die
        // nächste – ohne Neuaufbau, damit der Fokus nicht wegspringt.
        // Verglichen wird gegen die **gespeicherten** (also nicht leeren)
        // Einträge; die rohen Zeilen zu zählen hieße „immer anhängen".
        const rows = [...rowsBox.querySelectorAll('.briefing-source-row')];
        const alleGefuellt = rows.length > 0 && saved.length === rows.length;
        if (alleGefuellt && rows.length < BRIEFING_SOURCES_LIMIT) {
            rowsBox.insertAdjacentHTML('beforeend', rowHtml());
            wireRow(rowsBox.lastElementChild);
        }
        if (typeof onChange === 'function') onChange(saved);
    };

    function wireRow(row) {
        row?.querySelectorAll('input').forEach((input) => {
            input.addEventListener('change', apply);
            input.addEventListener('blur', apply);
        });
    }

    rowsBox?.querySelectorAll('.briefing-source-row').forEach(wireRow);
}
