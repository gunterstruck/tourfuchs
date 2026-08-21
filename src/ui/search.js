/**
 * Globale Suche in der Kopfleiste.
 *
 * Das Feld verspricht seit jeher „Kunde, Ort, PLZ" – gefunden wurden aber nur
 * **Kunden**. „Ort" und „PLZ" meinten die Ort- und PLZ-Spalte eines Kunden:
 * Wer „Essen" tippte, bekam die Kunden in Essen, nie Essen selbst. Ein
 * gespeicherter Ort („SIXT Essen Hbf") war über dieses Feld gar nicht
 * erreichbar, obwohl er auf der Karte liegt.
 *
 * Gesucht wird deshalb in denselben drei Quellen wie bei der Startpunktwahl im
 * Tourplaner, in derselben Reihenfolge und mit denselben Gruppennamen:
 *
 *   1. **Eigene Orte** – selbst benannte Punkte, die wenigsten und die
 *      persönlichsten. Sie stehen oben, weil man sie selbst angelegt hat.
 *   2. **Kunden** – der Normalfall.
 *   3. **Orte** – die gebündelten PLZ-Zentroide, ohne Netz.
 *
 * Bewusst dieselben Funktionen aus `features/places.js`: Eine zweite
 * Ortssuche mit eigenen Regeln fiele beim ersten Vergleich auf – „warum findet
 * das eine Feld meinen Ort und das andere nicht?".
 *
 * Was dieses Feld ausdrücklich **nicht** tut: Orte anlegen. Es bringt zu einer
 * Stelle auf der Karte. Das Anlegen gehört dorthin, wo der Ort gebraucht wird –
 * an Start und Ziel im Tourplaner.
 */

import { state, getCustomer, on } from '../core/state.js';
import { flyToCustomer, flyToPlace } from '../features/map.js';
import { applyServiceCustomerScope } from '../features/customerScope.js';
import {
    loadPlaceIndex, parseCoordinateQuery, searchGeoPlaces, searchOwnPlaces, MIN_PLACE_QUERY
} from '../features/places.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

/** Stehen mehrere Gruppen da, bekommt jede denselben knappen Platz. */
export const GROUP_LIMIT = 4;
/** Steht eine Gruppe allein, darf sie ihn ausnutzen. */
export const SINGLE_GROUP_LIMIT = 8;

export function normalizeSearchText(value) {
    return String(value ?? '')
        .trim()
        .toLocaleLowerCase('de-DE')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ß/g, 'ss');
}

export function searchCustomers(customers, query, limit = SINGLE_GROUP_LIMIT) {
    const q = normalizeSearchText(query);
    if (q.length < 2) return [];
    return customers.filter((customer) => (
        normalizeSearchText(customer?.name).includes(q)
        || normalizeSearchText(customer?.ort).includes(q)
        || String(customer?.plz ?? '').startsWith(q)
        || normalizeSearchText(customer?.nummer) === q
    )).slice(0, limit);
}

/**
 * Die drei Quellen zu einer Trefferliste zusammenführen – reine Funktion, damit
 * die Aufteilung prüfbar ist und nicht nur im DOM stattfindet.
 *
 * Die Kundenmenge wird erst am Ende beschnitten: Am echten Bestand gefunden –
 * an „45136" hängen mehrere Kunden, und der Ort „45136 Essen" rutschte damit
 * unter die Faltkante. Die Antwort, wegen der man die Postleitzahl getippt hat,
 * war nicht zu sehen. Wie viele Kunden es insgesamt gab, bleibt trotzdem
 * ablesbar (`totalCustomers`), statt sie stillschweigend zu unterschlagen.
 *
 * @param {{customers?: Array, places?: Array, index?: object|null, query?: string}} input
 */
export function globalSearchHits({ customers = [], places = [], index = null, query = '' } = {}) {
    const raw = String(query ?? '').trim();
    const own = searchOwnPlaces(raw, places, GROUP_LIMIT);
    const coords = parseCoordinateQuery(raw);
    const coordHits = coords
        ? [{
            kind: 'koordinaten',
            id: 'koordinaten',
            label: `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
            detail: 'Eingefügte Koordinaten',
            ...coords,
            plz: '',
            ort: ''
        }]
        : [];
    // Koordinaten sind bereits die Antwort; das Verzeichnis daneben wäre Rauschen.
    const geo = coords ? [] : searchGeoPlaces(raw, index, GROUP_LIMIT);
    const orte = [...coordHits, ...geo];

    const alle = searchCustomers(customers, raw, Number.MAX_SAFE_INTEGER);
    const platz = (own.length || orte.length) ? GROUP_LIMIT : SINGLE_GROUP_LIMIT;
    return {
        own,
        orte,
        customers: alle.slice(0, platz),
        totalCustomers: alle.length
    };
}

export function initSearch() {
    const input = document.getElementById('global-search');
    const results = document.getElementById('search-results');

    const close = () => { results.innerHTML = ''; results.style.display = 'none'; };

    const groupHtml = (title, rows) => (rows.length
        ? `<div class="result-group" role="presentation">${escapeHtml(title)}</div>${rows.join('')}`
        : '');

    const placeRow = (result) => `
        <button type="button" class="result-row" data-place="${escapeHtml(result.id)}">
            <b>${escapeHtml(result.label)}</b>
            <span class="muted">${escapeHtml(result.detail)}</span>
        </button>`;

    // Zwischen Tastendruck und geladenem Ortsverzeichnis liegt beim ersten Mal
    // ein Moment. Wer in dieser Zeit weitertippt, darf keine veraltete Liste
    // untergeschoben bekommen.
    let sequence = 0;

    const render = async () => {
        const raw = input.value.trim();
        const run = ++sequence;
        if (normalizeSearchText(raw).length < MIN_PLACE_QUERY) { close(); return; }

        const pool = state.ui.mode === 'service'
            ? applyServiceCustomerScope(state.customers)
            : state.customers;

        // Das Verzeichnis wird beim ersten Tippen aufgebaut; Kunden und eigene
        // Orte stehen unabhängig davon sofort bereit.
        const index = await loadPlaceIndex();
        if (run !== sequence) return;

        const hits = globalSearchHits({ customers: pool, places: state.places, index, query: raw });
        const gefunden = hits.own.length + hits.orte.length + hits.customers.length;
        if (gefunden === 0) {
            results.innerHTML = '<div class="result-empty">Keine Treffer</div>';
            results.style.display = 'block';
            return;
        }

        const verdeckt = hits.totalCustomers - hits.customers.length;
        results.innerHTML = [
            groupHtml('Eigene Orte', hits.own.map(placeRow)),
            groupHtml(
                verdeckt > 0 ? `Kunden (${hits.customers.length} von ${hits.totalCustomers})` : 'Kunden',
                hits.customers.map((c) => `
                    <button type="button" class="result-row" data-id="${escapeHtml(c.id)}">
                        <b>${escapeHtml(c.name)}</b>
                        <span class="muted">${escapeHtml(c.plz)} ${escapeHtml(c.ort)}${c.vb ? ` · ${escapeHtml(c.vb)}` : ''}</span>
                    </button>`)
            ),
            groupHtml('Orte', hits.orte.map(placeRow))
        ].join('');
        results.style.display = 'block';

        results.querySelectorAll('[data-id]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const c = getCustomer(btn.dataset.id);
                close();
                input.value = '';
                if (c && c.lat !== null) flyToCustomer(c);
            });
        });
        results.querySelectorAll('[data-place]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const treffer = [...hits.own, ...hits.orte].find((r) => String(r.id) === btn.dataset.place);
                close();
                input.value = '';
                if (treffer) flyToPlace(treffer);
            });
        });
    };

    input.addEventListener('input', () => { render(); });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-wrap')) close();
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { close(); input.blur(); }
    });
    on('mode:changed', close);
    on('service-customer-scope:changed', close);
    on('service-contracts:changed', close);
}
