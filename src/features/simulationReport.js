/**
 * Entscheidungsvorlage aus der Gebietssimulation (Roadmap 3.1).
 *
 * Das Problem, das dieses Modul löst, steht seit Juli in der Roadmap: Die
 * Simulation ist stark, aber ihr Ergebnis „verpufft" im Dialog. Wer eine
 * Gebietsreform durchgerechnet hat, steht danach vor der Aufgabe, die Zahlen
 * für eine Sitzung von Hand abzuschreiben – und schreibt dabei genau die
 * Kennzahl ab, die seine Variante stützt.
 *
 * Deshalb erzeugt die Vorlage **beide** Zustände nebeneinander: vorher und
 * nachher, je Einheit, mit Differenz. Eine Vorlage, die nur den Zielzustand
 * zeigt, ist keine Entscheidungsgrundlage, sondern eine Werbung für die
 * Variante, die gerade offen ist.
 *
 * **Aufteilung nach Adressat – und das ist eine Datenschutz-Entscheidung:**
 * Die Druckansicht ist **aggregiert** (Einheiten, Summen, Aktionen) und nennt
 * keinen einzigen Kundennamen. Sie geht in eine Sitzung, wird kopiert und
 * herumgereicht. Die namentliche Umbuchungsliste gibt es getrennt als
 * Excel-Datei für die Person, die die Umbuchung anschließend ausführt.
 * Wer beides in ein Dokument legt, verteilt Kundendaten an einen Verteiler,
 * der sie nicht braucht.
 *
 * Bis auf `printSimulationReport()` ist alles hier DOM-frei und in Node
 * testbar: Der Rechenweg gehört geprüft, das Fenster nicht.
 */

import { formatRevenueFull, formatRevenueShort } from '../core/format.js';
import { DEMO_DATA_LABEL } from '../core/demoSafety.js';
import { fairness } from './territory.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

/** Vorzeichen immer mitschreiben: „12" und „+12" sind in einer Delta-Spalte nicht dasselbe. */
function signedCount(value) {
    if (!value) return '±0';
    return `${value > 0 ? '+' : '−'}${Math.abs(value)}`;
}

function signedRevenue(value) {
    if (!value) return '±0 €';
    return `${value > 0 ? '+' : '−'}${formatRevenueShort(Math.abs(value))}`;
}

function dateTimeDe(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('de-DE', {
        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

/**
 * Das Modell der Vorlage – reine Rechnung, kein Markup.
 *
 * @param {object} input
 * @param {Map<string,{count:number,umsatz:number}>} input.baseStats  Zustand ohne Simulation
 * @param {Map<string,{count:number,umsatz:number}>} input.simStats   simulierter Zustand
 * @param {Iterable<string>} input.keys           alle vorkommenden Einheiten
 * @param {Array} input.moves                     [{ id, name, nummer, ort, plz, from, to, umsatz }]
 * @param {Array} input.territories               [{ name, level, levelLabel, value, customerCount }]
 * @param {Array} input.opsLog                    [{ desc, count, revenue, toRep }]
 * @param {object} input.meta                     { attrLabel, levelLabel, groupScope, fileName,
 *                                                  createdAt, demo, maxRatio, unassigned }
 */
export function buildSimulationReport({
    baseStats = new Map(),
    simStats = new Map(),
    keys = [],
    moves = [],
    territories = [],
    opsLog = [],
    meta = {}
} = {}) {
    const allKeys = [...new Set(keys)];
    const maxRatio = Number(meta.maxRatio);
    const unassigned = meta.unassigned ?? null;

    const rows = allKeys.map((key) => {
        const before = baseStats.get(key) ?? { count: 0, umsatz: 0 };
        const after = simStats.get(key) ?? { count: 0, umsatz: 0 };
        return {
            key,
            countBefore: before.count,
            countAfter: after.count,
            countDelta: after.count - before.count,
            revenueBefore: before.umsatz,
            revenueAfter: after.umsatz,
            revenueDelta: after.umsatz - before.umsatz,
            changed: after.count !== before.count || after.umsatz !== before.umsatz
        };
    }).sort((a, b) => b.revenueAfter - a.revenueAfter || b.countAfter - a.countAfter);

    return {
        meta: {
            ...meta,
            createdAt: meta.createdAt ? new Date(meta.createdAt) : new Date(),
            demo: Boolean(meta.demo)
        },
        rows,
        fairness: {
            before: fairness(baseStats, allKeys, { maxRatio, exclude: unassigned }),
            after: fairness(simStats, allKeys, { maxRatio, exclude: unassigned })
        },
        totals: {
            territories: territories.length,
            customersMoved: moves.length,
            revenueMoved: moves.reduce((sum, move) => sum + (Number(move.umsatz) || 0), 0),
            // Nicht dieselbe Zahl wie `rows.length`: Eine Einheit, die alle
            // Kunden verliert, bleibt mit 0 in der Tabelle stehen und zählt hier
            // trotzdem als betroffen.
            unitsTouched: rows.filter((row) => row.changed).length
        },
        actions: opsLog.map((op) => ({
            desc: String(op?.desc ?? ''),
            count: Number(op?.count) || 0,
            revenue: Number(op?.revenue) || 0,
            toRep: String(op?.toRep ?? '')
        })),
        territories,
        moves
    };
}

/**
 * Zeilen für den Excel-Export der Umbuchungsliste.
 *
 * Bewusst mit sprechenden deutschen Spaltenköpfen statt der internen
 * Feldnamen: Diese Datei wird in Excel geöffnet und weiterverarbeitet, nicht
 * von TourFuchs wieder eingelesen.
 */
export function reassignmentRows(model) {
    const label = model?.meta?.attrLabel || 'Ziel';
    return (model?.moves ?? []).map((move) => ({
        'Kunde': move.name ?? '',
        'Kd.-Nr.': move.nummer ?? '',
        'PLZ': move.plz ?? '',
        'Ort': move.ort ?? '',
        [`${label} – bisher`]: move.from ?? '',
        [`${label} – neu`]: move.to ?? '',
        'Umsatz (€)': Math.round(Number(move.umsatz) || 0)
    }));
}

function fairnessCell(entry) {
    if (!entry) return '<span class="muted">weniger als zwei Einheiten mit Kunden</span>';
    const status = entry.balanced ? 'Ausgewogen' : 'Ungleich verteilt';
    return `<b>${entry.ratio.toFixed(1)}×</b> <span class="muted">(${escapeHtml(status)}, `
        + `${entry.units} Einheiten)</span>`;
}

function fairnessDetail(entry, kind) {
    if (!entry) return '';
    const source = kind === 'revenue' ? entry.revenue : entry.count;
    if (!source) return '<td colspan="2" class="muted">keine Umsatzangaben</td>';
    const value = (unit) => (kind === 'revenue'
        ? formatRevenueShort(unit.umsatz)
        : `${unit.count} Kunden`);
    return `<td>${escapeHtml(source.max.key)} <span class="muted">${escapeHtml(value(source.max))}</span></td>`
        + `<td>${escapeHtml(source.min.key)} <span class="muted">${escapeHtml(value(source.min))}</span></td>`;
}

/** Die vollständige Druckansicht als HTML-Dokument. */
export function reportHtml(model) {
    const { meta, rows, totals, actions, territories } = model;
    const ratioText = String(meta.maxRatio).replace('.', ',');
    const title = 'Gebietsreform – Entscheidungsvorlage';

    const scopeParts = [
        meta.levelLabel && `Ebene: ${meta.levelLabel}`,
        meta.attrLabel && `Zuweisung nach: ${meta.attrLabel}`,
        meta.groupScope && `Vertriebsgruppe: ${meta.groupScope}`,
        meta.fileName && `Datensatz: ${meta.fileName}`
    ].filter(Boolean);

    const kpiRows = rows.map((row) => `<tr${row.changed ? ' class="changed"' : ''}>
        <td>${escapeHtml(row.key)}</td>
        <td class="num">${row.countBefore}</td>
        <td class="num">${row.countAfter}</td>
        <td class="num ${row.countDelta > 0 ? 'up' : row.countDelta < 0 ? 'down' : ''}">${signedCount(row.countDelta)}</td>
        <td class="num" title="${escapeHtml(formatRevenueFull(row.revenueBefore))}">${formatRevenueShort(row.revenueBefore)}</td>
        <td class="num" title="${escapeHtml(formatRevenueFull(row.revenueAfter))}">${formatRevenueShort(row.revenueAfter)}</td>
        <td class="num ${row.revenueDelta > 0 ? 'up' : row.revenueDelta < 0 ? 'down' : ''}">${signedRevenue(row.revenueDelta)}</td>
    </tr>`).join('');

    const actionRows = actions.map((action) => `<tr>
        <td>${escapeHtml(action.desc)}</td>
        <td class="num">${action.count}</td>
        <td class="num">${formatRevenueShort(action.revenue)}</td>
        <td>${escapeHtml(action.toRep)}</td>
    </tr>`).join('');

    const territoryRows = territories.map((territory) => `<tr>
        <td>${escapeHtml(territory.name)}</td>
        <td>${escapeHtml(territory.levelLabel || territory.level || '')}</td>
        <td>${escapeHtml(territory.value)}</td>
        <td class="num">${Number(territory.customerCount) || 0}</td>
    </tr>`).join('');

    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
    <title>${escapeHtml(title)}</title>
    <style>
        body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 24px; }
        h1 { font-size: 1.4rem; margin: 0 0 2px; }
        h2 { font-size: 1rem; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; margin: 24px 0 8px; }
        .sub { color: #64748b; margin: 0 0 16px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        th { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; }
        .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
        .up { color: #15803d; }
        .down { color: #b91c1c; }
        .muted { color: #64748b; font-size: 0.85rem; }
        .changed td { background: #f8fafc; font-weight: 600; }
        .cards { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
        .card { flex: 1 1 150px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; }
        .card b { display: block; font-size: 1.3rem; }
        .demo { padding: 8px 10px; background: #fffbeb; border: 1px solid #f59e0b; color: #92400e; font-weight: 700; }
        .note { padding: 8px 10px; background: #f1f5f9; border-left: 3px solid #94a3b8; margin: 12px 0; font-size: 0.9rem; }
        .foot { margin-top: 20px; color: #64748b; font-size: 0.8rem; }
        .toolbar { margin-top: 20px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
        @media print { body { margin: 0; } .noprint { display: none; } }
    </style></head><body>
    <h1>🦊 ${escapeHtml(title)}</h1>
    ${meta.demo ? `<p class="demo">${escapeHtml(DEMO_DATA_LABEL)}</p>` : ''}
    <p class="sub">${escapeHtml(dateTimeDe(meta.createdAt))}${scopeParts.length ? ` · ${escapeHtml(scopeParts.join(' · '))}` : ''}</p>

    <p class="note"><b>Diese Vorlage beschreibt eine Simulation.</b> Die Zuweisung ist
    <b>nicht übernommen</b> – die Kundendaten stehen unverändert im bisherigen Zuschnitt.
    Zum Umsetzen: im Cockpit „Zuweisung übernehmen".</p>

    <h2>Das Ergebnis</h2>
    <div class="cards">
        <div class="card"><b>${totals.territories}</b><span class="muted">Gebiete zugewiesen</span></div>
        <div class="card"><b>${totals.customersMoved}</b><span class="muted">Kunden umgebucht</span></div>
        <div class="card"><b title="${escapeHtml(formatRevenueFull(totals.revenueMoved))}">${formatRevenueShort(totals.revenueMoved)}</b><span class="muted">Umsatz bewegt</span></div>
        <div class="card"><b>${totals.unitsTouched}</b><span class="muted">betroffene ${escapeHtml(meta.attrLabel || 'Einheiten')}</span></div>
    </div>

    <h2>Ausgewogenheit vorher und nachher</h2>
    <table>
        <thead><tr><th>Stand</th><th>Kunden-Faktor</th><th>Stärkste Einheit</th><th>Schwächste Einheit</th></tr></thead>
        <tbody>
            <tr><td>vorher</td><td>${fairnessCell(model.fairness.before)}</td>${fairnessDetail(model.fairness.before, 'count')}</tr>
            <tr><td>nachher</td><td>${fairnessCell(model.fairness.after)}</td>${fairnessDetail(model.fairness.after, 'count')}</tr>
        </tbody>
    </table>
    <p class="muted">Ausgewogen bis Faktor ${escapeHtml(ratioText)} – gesetzte Konvention, keine Messung.
    Die Grenze ist der Zielwert für den Gebietszuschnitt und keine branchenübliche Kennzahl;
    wer anders zuschneidet, darf sie anders setzen.</p>

    <h2>Kennzahlen je ${escapeHtml(meta.attrLabel || 'Einheit')}</h2>
    <table>
        <thead><tr>
            <th>${escapeHtml(meta.attrLabel || 'Einheit')}</th>
            <th class="num">Kunden vorher</th><th class="num">nachher</th><th class="num">Δ</th>
            <th class="num">Umsatz vorher</th><th class="num">nachher</th><th class="num">Δ</th>
        </tr></thead>
        <tbody>${kpiRows}</tbody>
    </table>

    ${actionRows ? `<h2>Was getan wurde</h2>
    <table>
        <thead><tr><th>Schritt</th><th class="num">Kunden</th><th class="num">Umsatz</th><th>Ziel</th></tr></thead>
        <tbody>${actionRows}</tbody>
    </table>` : ''}

    ${territoryRows ? `<h2>Betroffene Gebiete</h2>
    <table>
        <thead><tr><th>Gebiet</th><th>Ebene</th><th>Neues Ziel</th><th class="num">Kunden</th></tr></thead>
        <tbody>${territoryRows}</tbody>
    </table>` : ''}

    <p class="foot">Umsätze stammen aus dem geladenen Datensatz und sind nicht nachgerechnet.
    Diese Vorlage nennt bewusst keine Kundennamen – die namentliche Umbuchungsliste
    gibt es im Cockpit als getrennte Excel-Datei. Erstellt mit TourFuchs Vertrieb.</p>

    <div class="toolbar noprint">
        <button onclick="window.print()" style="padding:8px 16px;">Drucken / als PDF sichern</button>
        <p class="muted">Ein Kartenbild Alt/Neu enthält diese Vorlage nicht – für den
        Blick auf die Karte im Cockpit „Simulation auf Karte prüfen". Dieser Hinweis
        steht nur am Bildschirm und wird nicht mitgedruckt.</p>
    </div>
    </body></html>`;
}

/**
 * Druckansicht in einem neuen Fenster öffnen.
 * @returns {boolean} false, wenn der Browser das Fenster blockiert hat
 */
export function printSimulationReport(model, open = (...args) => window.open(...args)) {
    const win = open('', '_blank');
    if (!win) return false;
    win.document.write(reportHtml(model));
    win.document.close();
    return true;
}
