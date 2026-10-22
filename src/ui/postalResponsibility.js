import { state, on, emit } from '../core/state.js';
import { isPostalQuery, postalLabel, postalResponsibility, teamsChatUrl } from '../features/postalResponsibility.js';
import { COMPANY_LINK_KEY, DUVE_TEMPLATE, readCompanyLink, validCompanyLink } from '../features/companyLink.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const amount = (value) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
let dialog;
let timer;

function revenue(stats) {
    return stats.count === stats.missingRevenue ? 'Kein Umsatz hinterlegt' : `${amount(stats.revenue)} erfasster Umsatz${stats.missingRevenue ? ` · ${stats.missingRevenue} ohne Umsatzangabe` : ''}`;
}

export function customerFocusText(profile) {
    if (!profile) return 'Nicht ableitbar: Vertriebsbezirk fehlt';
    if (!profile.top.length) return `Nicht hinterlegt (${profile.count} Kunden ohne Kundentyp)`;
    const top = profile.top.map((type) => `${type.name} (${type.count}/${profile.count} Kunden · ${Math.round(type.count / profile.count * 100)} %)`).join(' / ');
    return `${top}${profile.top.length > 1 ? ' · Gleichstand' : ''}${profile.missing ? ` · ${profile.missing} ohne Kundentyp` : ''}`;
}

export function responsibilityResultsHtml(result) {
    if (!result.valid) return '<p>Bitte 3 bis 5 PLZ-Ziffern eingeben, zum Beispiel 451, 4512 oder 45127.</p>';
    const assignments = result.assignments.length
        ? `<section class="postal-assignment"><h3>Hinterlegte PLZ-Gebietszuordnungen</h3><ul>${result.assignments.map((a) => `<li>PLZ ${esc(postalLabel(a.prefix))}: <b>${esc(a.district)}</b></li>`).join('')}</ul><p>Jede Zeile gilt für den genannten Bereich. Überschneidungen und Ausnahmen bitte vor der Neukundenanlage prüfen.</p></section>`
        : '<p>Keine hinterlegte PLZ-Gebietszuordnung für diesen Bereich. Landkreiszuordnungen werden hier nicht ausgewertet.</p>';
    const years = result.years.length ? `Umsatzjahre im Bestand: ${result.years.join(', ')}${result.unknownYear ? '; teilweise ohne Jahresangabe' : ''}.` : 'Umsatzzeitraum nicht hinterlegt.';
    return `<h3>PLZ ${esc(postalLabel(result.prefix))}</h3>
        <p class="postal-total"><b>${result.count} Kunden</b> · ${esc(revenue(result))}</p><p class="muted">${esc(years)} Verwendet wird der importierte Umsatz je Kunde.</p>
        ${assignments}<h3>In diesem Bereich vertreten</h3>
        <p>Bestandskunden zeigen die bisherige Verteilung, keine verbindliche Neukundenzuständigkeit. Zuordnung bitte abstimmen.</p>
        ${result.groups.length ? result.groups.map((group, index) => {
            const manager = group.manager;
            const teams = !group.demo && teamsChatUrl(manager.upn);
            return `<article class="postal-card"><h4>VBZ: ${esc(group.district || 'Nicht hinterlegt')}</h4>
                <p>Vertriebsgruppe: <b>${esc(group.salesGroup || 'Nicht hinterlegt')}</b></p>
                <p>Häufigste Kundenart im VBZ: <b>${esc(customerFocusText(group.profile))}</b><br><span class="muted">Gesamter geladener Bestand dieses VBZ und dieser Vertriebsgruppe; nach Kundenanzahl.</span></p>
                <p><b>Account Manager: ${esc(manager.name || 'Nicht hinterlegt')}</b></p>
                <p>${group.count} Kunden · ${Math.round(group.count / result.count * 100)} % der Kunden dieses PLZ-Bereichs<br>${esc(revenue(group))}</p>
                <div class="postal-actions">${manager.tel && !group.demo ? `<a href="tel:${esc(manager.tel)}">📞 ${esc(manager.phone)}</a>` : `<span class="muted">${group.demo ? 'Beispieldaten: keine Kontaktaufnahme' : 'Telefon nicht hinterlegt'}</span>`}
                ${teams ? `<a href="${esc(teams)}" target="_blank" rel="noopener noreferrer">💬 Teams-Chat</a>` : '<span class="muted">Teams-Kennung nicht hinterlegt</span>'}
                <button type="button" data-postal-copy="${index}">Zuordnung kopieren</button></div></article>`;
        }).join('') : '<p>Keine Kunden in diesem PLZ-Bereich im geladenen Bestand.</p>'}`;
}

function render() {
    if (!dialog?.open) return;
    const result = postalResponsibility(state.customers, dialog.querySelector('#postal-query').value, state.territories);
    dialog.querySelector('#postal-results').innerHTML = responsibilityResultsHtml(result);
    dialog.querySelector('#postal-status').textContent = result.valid ? `${result.count} Kunden in PLZ ${postalLabel(result.prefix)}.` : 'Ab drei Ziffern erscheint die Übersicht.';
    const date = state.importedAt ? new Date(state.importedAt) : null;
    dialog.querySelector('#postal-source').textContent = `Gesamter geladener Kundenbestand · Kartenfilter werden nicht angewendet. Letzter Import: ${date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('de-DE') : 'nicht bekannt'}.`;
    dialog.querySelectorAll('[data-postal-copy]').forEach((button) => button.addEventListener('click', async () => {
        const group = result.groups[Number(button.dataset.postalCopy)];
        const text = `PLZ ${postalLabel(result.prefix)} · VBZ: ${group.district || 'nicht hinterlegt'} · Vertriebsgruppe: ${group.salesGroup || 'nicht hinterlegt'} · Häufigste Kundenart im VBZ (gesamter geladener Bestand): ${customerFocusText(group.profile)} · Account Manager: ${group.manager.name || 'nicht hinterlegt'}${group.manager.phone ? ` · Telefon: ${group.manager.phone}` : ''}${group.manager.upn ? ` · Teams: ${group.manager.upn}` : ''}\nAus Bestandskunden abgeleitet; Neukundenzuordnung bitte abstimmen.`;
        try { await navigator.clipboard.writeText(text); dialog.querySelector('#postal-status').textContent = 'Zuordnung kopiert.'; }
        catch { dialog.querySelector('#postal-status').textContent = 'Kopieren nicht möglich. Bitte die Angaben im Fenster markieren und kopieren.'; }
    }));
}

export function openPostalResponsibility(query = '') {
    if (!dialog) return;
    dialog.querySelector('#postal-query').value = isPostalQuery(query) ? query.trim() : '';
    if (!dialog.open) dialog.showModal();
    render();
    dialog.querySelector('#postal-query').focus();
}

export function initPostalResponsibility() {
    dialog = document.createElement('dialog');
    dialog.id = 'postal-dialog';
    dialog.className = 'postal-dialog';
    dialog.setAttribute('aria-labelledby', 'postal-title');
    dialog.innerHTML = `<header><h2 id="postal-title">Zuständigkeit finden</h2><button type="button" class="dialog-close">Schließen</button></header>
        <div class="postal-body"><label for="postal-query">PLZ oder PLZ-Anfang</label>
        <input id="postal-query" type="search" inputmode="numeric" autocomplete="off" maxlength="5" placeholder="Ab 3 Ziffern, z. B. 451" aria-describedby="postal-source postal-status">
        <p id="postal-source" class="muted"></p><p id="postal-status" role="status" aria-live="polite"></p>
        <div id="postal-results"></div>
        <details class="postal-settings"><summary>Firmenlink in der Kundenkachel einrichten</summary>
        <p>DUVE erscheint automatisch neben einem vorhandenen SieSales-Link, wenn der Kunde eine Kundennummer hat. Hier kannst du den Firmenlink ändern oder ausblenden. Erst beim Anklicken wird die Kundennummer an das Ziel übergeben. Anmeldung und Berechtigungen gelten dort weiter.</p>
        <button type="button" id="company-duve">DUVE-Vorlage einsetzen</button>
        <form id="company-link-form"><label>Bezeichnung<input id="company-label" maxlength="40" placeholder="z. B. DUVE"></label>
        <label>HTTPS-Adresse mit {kundennummer}<input id="company-template" type="text" placeholder="https://…?searchTerm={kundennummer}"></label>
        <div class="postal-actions"><button type="submit">Firmenlink speichern</button><button type="button" id="company-remove">Firmenlink entfernen</button></div></form>
        <p id="company-status" role="status"></p><p class="muted">Gilt nur in diesem Browser. Keine automatische Übernahme auf andere Geräte.</p></details></div>`;
    document.body.append(dialog);
    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { clearTimeout(timer); dialog.querySelector('#postal-results').innerHTML = ''; });
    dialog.querySelector('#postal-query').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, 180); });
    document.getElementById('btn-postal-responsibility')?.addEventListener('click', () => openPostalResponsibility(document.getElementById('global-search')?.value || ''));
    const label = dialog.querySelector('#company-label');
    const template = dialog.querySelector('#company-template');
    const status = dialog.querySelector('#company-status');
    const config = readCompanyLink();
    label.value = config?.label || '';
    template.value = config?.template || '';
    dialog.querySelector('#company-duve').addEventListener('click', () => { label.value = 'DUVE'; template.value = DUVE_TEMPLATE; status.textContent = 'DUVE ist vorbereitet. Zum Aktivieren „Firmenlink speichern“ wählen.'; });
    dialog.querySelector('#company-link-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const next = { label: label.value.trim(), template: template.value.trim() };
        if (!validCompanyLink(next)) { status.textContent = 'Bitte eine Bezeichnung und eine HTTPS-Adresse mit {kundennummer} eingeben; keine Zugangsdaten in der Adresse.'; return; }
        try { localStorage.setItem(COMPANY_LINK_KEY, JSON.stringify(next)); emit('customers:changed'); status.textContent = 'Firmenlink gespeichert. Kundenkachel erneut öffnen.'; }
        catch { status.textContent = 'Speichern nicht möglich. Bitte Browser-Speicher prüfen.'; }
    });
    dialog.querySelector('#company-remove').addEventListener('click', () => {
        try { localStorage.setItem(COMPANY_LINK_KEY, JSON.stringify({ disabled: true })); label.value = ''; template.value = ''; emit('customers:changed'); status.textContent = 'Firmenlink ausgeblendet. Mit der DUVE-Vorlage und „Firmenlink speichern“ wieder aktivieren.'; }
        catch { status.textContent = 'Entfernen nicht möglich. Bitte Browser-Speicher prüfen.'; }
    });
    on('customers:changed', render);
    on('territories:changed', render);
    on('vault:locked', () => { dialog.close(); dialog.querySelector('#postal-results').innerHTML = ''; dialog.querySelector('#postal-query').value = ''; dialog.querySelector('#postal-status').textContent = ''; });
}
