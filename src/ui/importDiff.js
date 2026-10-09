/**
 * Änderungsbericht beim Reimport.
 *
 * Ersetzt für den häufigsten Fall – neue Kundenliste bei vorhandenem Bestand –
 * die nackte Systemabfrage durch eine Antwort auf „Was ändert sich?". Die
 * Bestätigung bleibt Pflicht; sie ist jetzt nur informiert statt blind.
 *
 * „Überblick → aufzoomen": Oben die drei Zahlen, die zählen, darunter der
 * unveränderte Warnhinweis, und erst eingeklappt die Bezirkstabelle und die
 * namentlichen Listen.
 */
import { diffCustomerDatasets, diffHeadline } from '../features/datasetDiff.js';
import { formatRevenueFull, formatRevenueShort } from '../core/format.js';
import { datasetReplacementMessage } from './datasetReplacement.js';

// Lange Listen bleiben lesbar; der vollständige Bestand steht ohnehin danach
// auf der Karte.
const LIST_LIMIT = 40;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
));

function signed(value) {
    if (!value) return '±0';
    return value > 0 ? `+${value.toLocaleString('de-DE')}` : value.toLocaleString('de-DE');
}

function signedRevenue(value) {
    if (!Math.round(value)) return '±0 €';
    return `${value > 0 ? '+' : '−'}${formatRevenueShort(Math.abs(value))}`;
}

function deltaClass(value) {
    if (value > 0) return 'diff-up';
    if (value < 0) return 'diff-down';
    return 'diff-flat';
}

function statTile(label, value, tone = '') {
    return `<div class="diff-stat${tone ? ` ${tone}` : ''}">
        <b>${escapeHtml(value)}</b>
        <span>${escapeHtml(label)}</span>
    </div>`;
}

function customerLine(entry, suffix = '') {
    const place = [entry.plz, entry.ort].filter(Boolean).join(' ');
    const meta = [entry.nummer ? `Nr. ${entry.nummer}` : '', place, suffix].filter(Boolean).join(' · ');
    return `<li><b>${escapeHtml(entry.name || 'ohne Namen')}</b>${meta ? `<span>${escapeHtml(meta)}</span>` : ''}</li>`;
}

function listSection(title, entries, lineSuffix) {
    if (!entries.length) return '';
    const shown = entries.slice(0, LIST_LIMIT);
    const rest = entries.length - shown.length;
    return `<details class="diff-list">
        <summary>${escapeHtml(title)} <span class="muted small">(${entries.length})</span></summary>
        <ul>${shown.map((entry) => customerLine(entry, lineSuffix?.(entry) || '')).join('')}</ul>
        ${rest > 0 ? `<p class="muted small">… und ${rest} weitere.</p>` : ''}
    </details>`;
}

function districtTable(districts) {
    if (!districts.length) return '';
    const rows = districts.map((entry) => `<tr>
        <td>${escapeHtml(entry.bezirk)}</td>
        <td class="num">${entry.beforeCount.toLocaleString('de-DE')} → ${entry.afterCount.toLocaleString('de-DE')}</td>
        <td class="num ${deltaClass(entry.deltaCount)}">${escapeHtml(signed(entry.deltaCount))}</td>
        <td class="num ${deltaClass(entry.deltaUmsatz)}" title="${escapeHtml(`${formatRevenueFull(entry.beforeUmsatz)} → ${formatRevenueFull(entry.afterUmsatz)}`)}">${escapeHtml(signedRevenue(entry.deltaUmsatz))}</td>
    </tr>`).join('');

    return `<details class="diff-districts">
        <summary>Wirkung je Vertriebsbezirk <span class="muted small">(${districts.length})</span></summary>
        <div class="table-scroll">
            <table class="diff-table">
                <thead><tr><th>Vertriebsbezirk</th><th class="num">Kunden</th><th class="num">Δ</th><th class="num">Δ Umsatz</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    </details>`;
}

/**
 * Fehlende Kunden: entfernen oder behalten? Und was die Datei nicht kennt,
 * bleibt ohnehin – das steht dabei, damit niemand um Straße & Co. fürchtet.
 */
function abgleichSection({ missingCount, keepMissing, carriedColumns }) {
    const carried = carriedColumns.length
        ? `<p class="diff-carried"><b>Bleibt erhalten</b> (steht nicht in dieser Datei): ${escapeHtml(carriedColumns.slice(0, 12).join(', '))}${carriedColumns.length > 12 ? ` und ${carriedColumns.length - 12} weitere` : ''}.</p>`
        : '';
    if (!missingCount) return carried;
    const count = missingCount.toLocaleString('de-DE');
    return `${carried}
        <fieldset class="diff-missing-choice">
            <legend>${count} ${missingCount === 1 ? 'Kunde fehlt' : 'Kunden fehlen'} in dieser Datei</legend>
            <label><input type="radio" name="diff-missing" value="keep"${keepMissing ? ' checked' : ''}>
                <span><b>Behalten</b> – die Datei ergänzt nur (z. B. eine Zuständigkeitsliste)</span></label>
            <label><input type="radio" name="diff-missing" value="remove"${keepMissing ? '' : ' checked'}>
                <span><b>Entfernen</b> – die Datei ist die neue Fassung der ganzen Liste</span></label>
        </fieldset>`;
}

function render(body, diff, warning, abgleich = null) {
    const deltaCount = diff.totals.afterCount - diff.totals.beforeCount;
    const deltaUmsatz = diff.totals.afterUmsatz - diff.totals.beforeUmsatz;

    body.innerHTML = `
        <p class="diff-headline">${escapeHtml(diffHeadline(diff))}</p>
        ${abgleich ? abgleichSection(abgleich) : ''}
        <div class="diff-stats">
            ${statTile('neue Kunden', diff.added.length.toLocaleString('de-DE'), 'diff-stat-up')}
            ${statTile('entfallen', diff.removed.length.toLocaleString('de-DE'), 'diff-stat-down')}
            ${statTile('Bezirkswechsel', diff.moved.length.toLocaleString('de-DE'))}
            ${statTile('geänderte Angaben', (diff.changed?.length || 0).toLocaleString('de-DE'))}
            ${statTile('unverändert', diff.keptCount.toLocaleString('de-DE'))}
        </div>
        <p class="diff-totals">
            <span>Kunden gesamt: <b>${diff.totals.beforeCount.toLocaleString('de-DE')} → ${diff.totals.afterCount.toLocaleString('de-DE')}</b>
                <em class="${deltaClass(deltaCount)}">${escapeHtml(signed(deltaCount))}</em></span>
            <span title="${escapeHtml(`${formatRevenueFull(diff.totals.beforeUmsatz)} → ${formatRevenueFull(diff.totals.afterUmsatz)}`)}">Umsatz gesamt:
                <b>${escapeHtml(formatRevenueShort(diff.totals.beforeUmsatz))} → ${escapeHtml(formatRevenueShort(diff.totals.afterUmsatz))}</b>
                <em class="${deltaClass(deltaUmsatz)}">${escapeHtml(signedRevenue(deltaUmsatz))}</em></span>
        </p>
        ${districtTable(diff.districts)}
        ${listSection('Neue Kunden', diff.added, (entry) => entry.bezirk)}
        ${listSection('Nicht mehr in der Liste', diff.removed, (entry) => entry.bezirk)}
        ${listSection('Bezirkswechsel', diff.moved, (entry) => `${entry.from} → ${entry.to}`)}
        ${listSection('Geänderte Angaben', diff.changed || [], (entry) => entry.fields.map((f) => f.label).join(', '))}
        ${diff.lostVisitCount ? `<p class="diff-warning"><b>${diff.lostVisitCount.toLocaleString('de-DE')} erfasste ${diff.lostVisitCount === 1 ? 'Besuch steht' : 'Besuche stehen'} nicht in der neuen Liste</b> und ${diff.lostVisitCount === 1 ? 'geht' : 'gehen'} beim Ersetzen verloren. Vorher sichern: „Als Excel exportieren" nimmt alle Besuche mit.</p>` : ''}
        ${listSection('Besuche gehen verloren', diff.visitsLost || [], (entry) => entry.dates.join(', '))}
        <p class="diff-warning">${escapeHtml(warning)}</p>`;
}

/**
 * Änderungsbericht zeigen und bestätigen lassen.
 * Mit `abgleich` ({ missing, defaultKeep, carriedColumns }) liefert die
 * Bestätigung `{ keepMissing }` statt `true`.
 * @returns {Promise<boolean|{ keepMissing: boolean }>} false bei Abbruch
 */
export function confirmImportWithDiff({ previous = [], incoming = [], sourceLabel, disablesVault = false, abgleich = null } = {}) {
    const dialog = document.getElementById('import-diff-dialog');
    const body = document.getElementById('import-diff-body');
    if (!dialog || !body || typeof dialog.showModal !== 'function') {
        // Ohne Dialog-Unterstützung bleibt die bisherige, ebenso verbindliche Abfrage.
        return Promise.resolve(globalThis.confirm(datasetReplacementMessage({
            incomingCount: incoming.length, sourceLabel, disablesVault
        })));
    }

    // Der bekannte Warntext ohne die Frage am Ende – die stellt der Knopf.
    const warningFor = (count) => datasetReplacementMessage({ incomingCount: count, sourceLabel, disablesVault })
        .replace(/\n\nFortfahren\?$/, '')
        .split('\n\n').slice(1).join(' ');

    // Abgleich: Der Nutzer wählt, ob fehlende Kunden bleiben. Der Bericht
    // rechnet jeweils mit dem Ergebnis, das er dann wirklich bekommt.
    const missing = abgleich?.missing || [];
    let keepMissing = Boolean(abgleich?.defaultKeep && missing.length);
    const draw = () => {
        const result = keepMissing ? [...incoming, ...missing] : incoming;
        render(body, diffCustomerDatasets(previous, result), warningFor(result.length), abgleich ? {
            missingCount: missing.length,
            keepMissing,
            carriedColumns: abgleich.carriedColumns || []
        } : null);
        body.querySelectorAll('input[name="diff-missing"]').forEach((input) => {
            input.addEventListener('change', () => {
                keepMissing = input.value === 'keep';
                draw();
            });
        });
    };
    draw();

    return new Promise((resolve) => {
        let decided = false;
        const finish = (value) => {
            if (decided) return;
            decided = true;
            dialog.close();
            resolve(value);
        };
        dialog.querySelector('[data-diff-cancel]').onclick = () => finish(false);
        dialog.querySelector('[data-diff-confirm]').onclick = () => finish(abgleich ? { keepMissing } : true);
        dialog.querySelector('.dialog-close').onclick = () => finish(false);
        // Escape schließt den Dialog: Abbruch ist die sichere Antwort.
        dialog.addEventListener('close', () => finish(false), { once: true });
        dialog.showModal();
    });
}
