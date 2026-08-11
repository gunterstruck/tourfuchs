/**
 * „In der Nähe" – Besuchs-Begleiter im Tourpanel.
 *
 * Zeigt die nächstgelegenen Kunden – bezogen auf die Kartenmitte (was man
 * gerade ansieht) oder den GPS-Standort. Beantwortet direkt die Kernfrage
 * „Wen besuche ich als Nächstes?".
 *
 * Bis Version 3.2 war das ein eigener Reiter (`#tab-karte`), erreichbar über
 * die mobile Reiterzeile „Karte | Tour". Dieser Reiter war in Wahrheit kein
 * Bereich, sondern ein Blatt-Schalter: `activateTab('karte')` klappte schlicht
 * das Blatt ein. Damit gab es drei Bedienelemente (Reiter, Griff, ☰) für einen
 * einzigen Zustand – und den Widerspruch, dass „Karte" gewählt sein konnte,
 * während das aufgezogene Blatt die Karte verdeckte. Der Reiter ist weg, der
 * Inhalt geblieben: als eingeklappte Karte über dem Tour-Prozess.
 *
 * Basis:  Name · Ort · Entfernung · Umsatz (aufgeräumt).
 * Profi:  zusätzlich Status-Punkt (fällig/überfällig) und „davon X fällig".
 */
import { state, on, emit } from '../core/state.js';
import { customersOnMap, getMap, flyToCustomer } from '../features/map.js';
import { visitStatus, isOpportunity, STATUS_COLORS } from '../features/visits.js';
import { planningNow } from '../features/dayPlanner.js';
import { formatRevenueShort } from '../core/format.js';
import { showMapView } from './sidebar.js';
import { isDemoCustomer } from '../core/demoSafety.js';
import { areaLabelFor } from '../features/areaBriefing.js';
import { openAreaBriefing } from './areaBriefing.js';

const MAX_ROWS = 12;
// Eingeklappt steht nur die Zusammenfassungszeile; aufgeklappt zeigt die Karte
// erst fünf Zeilen. Wer mehr sehen will, sagt es – so bleibt das Blatt beim
// Aufklappen eine Karte und keine Liste, die den Tour-Prozess wegschiebt.
const PREVIEW_ROWS = 5;
// Was auf dem Schirm steht, ist auch das, was ins Briefing geht.
let nearbyCustomers = [];
let originMode = 'map';     // 'map' | 'gps'
let gpsPos = null;          // { lat, lng } zuletzt bekannter GPS-Standort
let gpsError = '';          // Hinweistext, falls GPS nicht verfügbar
let expanded = false;       // Karte auf-/zugeklappt
let showAll = false;        // „Alle zeigen" innerhalb der aufgeklappten Karte

function els() {
    return {
        card: document.getElementById('nearby-card'),
        summary: document.getElementById('acc-sum-nearby'),
        stats: document.querySelector('#nearby-card .near-stats'),
        list: document.querySelector('#nearby-card .near-list'),
        more: document.querySelector('#nearby-card .near-more'),
        empty: document.querySelector('#nearby-card .near-empty')
    };
}

// Entfernung Luftlinie in km (Haversine)
function distanceKm(aLat, aLng, bLat, bLng) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const s = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
}

function fmtDist(km) {
    if (km === null || !Number.isFinite(km)) return '';
    if (km < 1) return `${Math.round(km * 1000)} m`;
    if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`;
    return `${Math.round(km)} km`;
}

function originLatLng() {
    if (originMode === 'gps' && gpsPos) return gpsPos;
    const map = getMap();
    const c = map?.getCenter?.();
    return c ? { lat: c.lat, lng: c.lng } : null;
}

/**
 * Nur rechnen, wenn etwas davon zu sehen ist.
 *
 * Das ist strenger als früher (`Karte-Reiter aktiv`) und deshalb billiger: Am
 * Handy liegt das Blatt beim Kartenschieben zu – dann bleibt auch die
 * Zusammenfassungszeile unsichtbar, und `map:moved` feuert beim Schieben oft.
 *
 * Der Fokus-Modus eines Tourschritts blendet die Karte zwar aus (CSS), zählt
 * hier aber bewusst **nicht** als unsichtbar: Sonst liefe die Zusammenfassung
 * beim Planen weg, und nach „☰ Übersicht" stünde eine veraltete Zeile da.
 */
function isVisible() {
    const { card } = els();
    if (!card) return false;
    const panel = document.getElementById('tab-tour');
    if (!panel || !panel.classList.contains('active')) return false;
    return state.ui.sidebarOpen;
}

export function renderNearby() {
    const { card, summary, stats, list, more, empty } = els();
    if (!card || !summary || !stats || !list || !more || !empty) return;
    if (!isVisible()) return;

    const profi = state.ui.depth === 'profi';
    // Dieselbe Menge, die auch auf der Karte liegt – nicht die global
    // sichtbare. „In der Nähe" ist das Geschwister des Lassos und hatte
    // denselben Fehler: Bei Tour-Fokus, Service-Umfang oder Chancen-Filter
    // wurden Kunden vorgeschlagen und zur Tour hinzugefügt, die gar nicht
    // gezeichnet sind.
    const pool = customersOnMap();
    const origin = originLatLng();

    // Nach Entfernung zum Bezugspunkt sortieren (ohne Bezug: unverändert).
    const ranked = pool
        .map((c) => ({ c, km: origin ? distanceKm(origin.lat, origin.lng, c.lat, c.lng) : null }))
        .sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity))
        .slice(0, MAX_ROWS);

    nearbyCustomers = ranked.map(({ c }) => c);
    updateBriefingButton();

    // Die Zusammenfassungszeile trägt eingeklappt die ganze Aussage: wie viele
    // stehen hier, und wie weit ist der Nächste. Sonst wäre die zugeklappte
    // Karte nur eine Tür ohne Schild.
    // Knapp halten wie bei den Schritten („Umkreis 25 km", „noch leer"): Der
    // Kopf daneben sagt schon, worum es geht, und in Großbuchstaben ist die
    // Zeile schnell breiter als der Platz. „12 · ab 1,1 km" liest sich mit dem
    // Titel zusammen als „zwölf in der Nähe, der nächste 1,1 km entfernt".
    const naechster = ranked.find(({ km }) => km !== null)?.km ?? null;
    summary.textContent = ranked.length === 0
        ? 'niemand in Sicht'
        : `${ranked.length}${naechster !== null ? ` · ab ${fmtDist(naechster)}` : ''}`;

    // Der Rest der Karte wird nur gefüllt, wenn sie offen ist.
    if (!expanded) return;

    // Kopf-Kennzahlen des aktuell sichtbaren Bestands.
    const revSum = pool.reduce((s, c) => s + (c.umsatz || 0), 0);
    const dueCount = pool.filter((c) => isOpportunity(c, planningNow())).length;
    const statParts = [`<b>${pool.length}</b> sichtbar`];
    if (profi && dueCount > 0) statParts.push(`<b>${dueCount}</b> fällig`);
    if (revSum > 0) statParts.push(`${formatRevenueShort(revSum)} Umsatz`);
    stats.innerHTML = statParts.join(' · ')
        + (originMode === 'gps' && !gpsPos && gpsError ? ` · <span class="near-gps-hint">${gpsError}</span>` : '');

    if (ranked.length === 0) {
        list.innerHTML = '';
        more.hidden = true;
        empty.hidden = false;
        return;
    }
    empty.hidden = true;

    const rows = showAll ? ranked : ranked.slice(0, PREVIEW_ROWS);
    more.hidden = ranked.length <= PREVIEW_ROWS;
    more.textContent = showAll
        ? 'Weniger zeigen'
        : `Alle ${ranked.length} zeigen`;

    list.innerHTML = rows.map(({ c, km }) => {
        const inTour = state.tour.stops.includes(c.id);
        const dot = profi
            ? `<span class="near-dot" style="background:${STATUS_COLORS[visitStatus(c)]}"></span>`
            : '<span class="near-dot near-dot-plain"></span>';
        const dist = km !== null ? `<span class="near-dist">${fmtDist(km)}</span>` : '';
        const rev = c.umsatz ? `<span class="near-rev">${formatRevenueShort(c.umsatz)}</span>` : '';
        const ort = c.ort ? ` <span class="muted">${escapeHtml(c.ort)}</span>` : '';
        return `<li class="near-row" data-near-id="${escapeHtml(c.id)}">
            ${dot}
            <span class="near-name">${escapeHtml(c.name)}${ort}</span>
            ${rev}
            ${dist}
            <button type="button" class="near-add${inTour ? ' in-tour' : ''}" data-near-add="${escapeHtml(c.id)}" aria-label="${inTour ? 'In der Tour' : 'Zur Tour hinzufügen'}" title="${inTour ? 'In der Tour' : 'Zur Tour'}">${inTour ? '✓' : '➕'}</button>
        </li>`;
    }).join('');
}

/**
 * „Wen zuerst?" – erst ab zwei echten Kunden. Bei einem einzigen führt das
 * Kundenbriefing weiter; mit Beispielkunden wird ohnehin kein Prompt gebaut.
 */
function updateBriefingButton() {
    const btn = document.getElementById('btn-near-briefing');
    if (!btn) return;
    btn.hidden = nearbyCustomers.filter((c) => !isDemoCustomer(c)).length < 2;
}

// Mehrere schnelle Auslöser (Panning) zu einem Frame zusammenfassen.
let rafId = 0;
function scheduleRender() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => { rafId = 0; renderNearby(); });
}

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (ch) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
}

/** Auf-/Zuklappen. Zugeklappt bleibt die Zusammenfassungszeile stehen. */
function setExpanded(next) {
    expanded = Boolean(next);
    const { card } = els();
    if (!card) return;
    card.classList.toggle('open', expanded);
    card.querySelector('.acc-head')?.setAttribute('aria-expanded', String(expanded));
    if (!expanded) showAll = false;
    renderNearby();
}

function setOrigin(mode) {
    originMode = mode;
    document.querySelectorAll('#nearby-card .near-origin .seg').forEach((b) =>
        b.classList.toggle('active', b.dataset.nearOrigin === mode));
    if (mode === 'gps') requestGps();
    else renderNearby();
}

function requestGps() {
    if (!navigator.geolocation) { gpsError = 'GPS nicht verfügbar'; renderNearby(); return; }
    gpsError = 'Standort wird bestimmt …';
    renderNearby();
    navigator.geolocation.getCurrentPosition(
        (pos) => { gpsPos = { lat: pos.coords.latitude, lng: pos.coords.longitude }; gpsError = ''; renderNearby(); },
        () => { gpsError = 'Standort nicht freigegeben'; renderNearby(); },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
}

export function initNearby() {
    const card = document.getElementById('nearby-card');
    if (!card) return;

    const head = card.querySelector('.acc-head');
    head?.addEventListener('click', (ev) => {
        // Der Info-Punkt zeigt nur seinen Tooltip, klappt nicht.
        if (ev.target.closest('.help-dot')) return;
        setExpanded(!expanded);
    });
    head?.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); head.click(); }
    });

    card.addEventListener('click', (ev) => {
        const originBtn = ev.target.closest('[data-near-origin]');
        if (originBtn) { setOrigin(originBtn.dataset.nearOrigin); return; }

        if (ev.target.closest('.near-more')) {
            showAll = !showAll;
            renderNearby();
            return;
        }

        if (ev.target.closest('#btn-near-briefing')) {
            openAreaBriefing(nearbyCustomers, areaLabelFor({
                mode: originMode === 'gps' && gpsPos ? 'gps' : 'map'
            }));
            return;
        }

        const addBtn = ev.target.closest('[data-near-add]');
        if (addBtn) {
            const id = addBtn.dataset.nearAdd;
            if (!state.tour.stops.includes(id)) {
                state.tour.stops.push(id);
                emit('tour:changed');
                emit('toast', { type: 'success', text: 'Zur Tour hinzugefügt.' });
            }
            renderNearby();
            return;
        }

        const row = ev.target.closest('[data-near-id]');
        if (row) {
            const customer = state.customers.find((c) => c.id === row.dataset.nearId);
            if (customer) { showMapView(); flyToCustomer(customer); }
        }
    });

    // Neu berechnen bei Kartenbewegung, Datenänderungen, Tiefen-/Blattwechsel.
    on('map:moved', scheduleRender);
    on('customers:changed', scheduleRender);
    on('filters:changed', scheduleRender);
    on('tour:changed', scheduleRender);
    on('depth:changed', scheduleRender);
    // Das Blatt ist am Handy der Sichtbarkeitsschalter – geht es auf, ist die
    // Zusammenfassungszeile womöglich veraltet.
    on('sheet:changed', scheduleRender);
    on('tab:changed', scheduleRender);
}
