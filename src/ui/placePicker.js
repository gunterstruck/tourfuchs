/**
 * Exakte eigene Orte per Karten-Pin.
 *
 * Der Nutzer wählt eine Koordinate direkt in Leaflet. Kein Suchtext und keine
 * Adresse verlassen das Gerät. Der Punkt bleibt fachlich ein `place` und wird
 * niemals als Kunde in Kennzahlen, Gebiete oder Besuchsstatus eingemischt.
 */
import L from 'leaflet';
import {
    state, on, emit, addPlace, updatePlace, clearServiceTourPlan
} from '../core/state.js';
import { createOwnPlace, tourPointFromOwnPlace } from '../features/places.js';
import { getMap, closeMapPopups } from '../features/map.js';
import { clearLassoSelection, setLassoActive } from './lasso.js';
import { collapseSheetForDemo, restoreSheetAfterDemo } from './sidebar.js';
import { showToast } from './toast.js';

let request = null;
let marker = null;
let controls = null;
let mapClick = null;

const validCoordinate = (value, max) => Number.isFinite(Number(value)) && Math.abs(Number(value)) <= max;

function pointFrom(latlng) {
    if (!latlng || !validCoordinate(latlng.lat, 90) || !validCoordinate(latlng.lng, 180)) return null;
    return { lat: Number(latlng.lat), lng: Number(latlng.lng) };
}

function pickerIcon() {
    return L.divIcon({
        className: 'place-picker-marker-wrapper',
        html: '<div class="place-picker-marker"><span>📌</span></div>',
        iconSize: [46, 52],
        iconAnchor: [23, 48]
    });
}

function visibleMapCenter(map) {
    const mapRect = map.getContainer().getBoundingClientRect();
    const sidebar = document.getElementById('sidebar');
    const sidebarRect = sidebar?.classList.contains('open') ? sidebar.getBoundingClientRect() : null;
    const coveredLeft = sidebarRect && sidebarRect.right > mapRect.left && sidebarRect.left <= mapRect.left
        ? Math.min(mapRect.width, sidebarRect.right - mapRect.left)
        : 0;
    return map.containerPointToLatLng([coveredLeft + (mapRect.width - coveredLeft) / 2, mapRect.height / 2]);
}

function updateCoordinateLabel() {
    const point = pointFrom(marker?.getLatLng());
    const label = controls?.querySelector('[data-place-picker-coordinates]');
    if (label && point) label.textContent = `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
}

function ensureControls(map) {
    if (controls?.isConnected) return controls;
    controls = document.createElement('section');
    controls.className = 'place-picker-controls';
    controls.hidden = true;
    controls.setAttribute('aria-label', 'Kartenpunkt wählen');
    controls.innerHTML = `
        <div class="place-picker-instruction">
            <span class="place-picker-big-pin" aria-hidden="true">📌</span>
            <span><b>Exakte Position setzen</b><small>Karte verschieben, Stelle antippen oder Pin ziehen.</small></span>
            <code data-place-picker-coordinates></code>
        </div>
        <div class="place-picker-actions">
            <button type="button" data-place-picker-cancel>Abbrechen</button>
            <button type="button" class="primary" data-place-picker-confirm>Position übernehmen</button>
        </div>`;
    map.getContainer().appendChild(controls);
    L.DomEvent.disableClickPropagation(controls);
    L.DomEvent.disableScrollPropagation(controls);
    controls.querySelector('[data-place-picker-cancel]').addEventListener('click', cancelPicker);
    controls.querySelector('[data-place-picker-confirm]').addEventListener('click', confirmPosition);
    return controls;
}

function closePicker() {
    const map = getMap();
    if (map && mapClick) map.off('click', mapClick);
    mapClick = null;
    if (marker && map) map.removeLayer(marker);
    marker = null;
    if (controls) controls.hidden = true;
    document.body.classList.remove('place-picker-active');
    restoreSheetAfterDemo();
}

function cancelPicker() {
    closePicker();
    request = null;
}

function openPicker(detail = {}) {
    const map = getMap();
    if (!map) return;
    const existing = detail.placeId
        ? state.places.find((place) => place?.id === detail.placeId)
        : null;
    const supplied = pointFrom(detail.point || existing);
    request = {
        target: ['start', 'destination', 'edit'].includes(detail.target) ? detail.target : 'start',
        placeId: detail.placeId || existing?.id || null,
        label: String(detail.label ?? existing?.label ?? '').trim(),
        strasse: String(detail.strasse ?? existing?.strasse ?? ''),
        plz: String(detail.plz ?? existing?.plz ?? ''),
        ort: String(detail.ort ?? existing?.ort ?? '')
    };

    setLassoActive(false);
    clearLassoSelection();
    closeMapPopups();
    collapseSheetForDemo();
    document.body.classList.add('place-picker-active');
    ensureControls(map).hidden = false;
    map.invalidateSize();

    const initial = supplied || visibleMapCenter(map);
    if (supplied) map.setView(initial, Math.max(map.getZoom(), 16), { animate: true });
    marker = L.marker(initial, { icon: pickerIcon(), draggable: true, keyboard: true, zIndexOffset: 3000 })
        .addTo(map)
        .bindTooltip('Pin ziehen oder Stelle auf der Karte antippen', { direction: 'top', offset: [0, -38] });
    marker.on('drag dragend', updateCoordinateLabel);
    mapClick = (event) => {
        marker?.setLatLng(event.latlng);
        closeMapPopups();
        updateCoordinateLabel();
    };
    map.on('click', mapClick);
    updateCoordinateLabel();
}

function dialogElements() {
    return {
        dialog: document.getElementById('place-pin-dialog'),
        form: document.getElementById('place-pin-form'),
        title: document.getElementById('place-pin-title'),
        name: document.getElementById('place-pin-name'),
        street: document.getElementById('place-pin-street'),
        postcode: document.getElementById('place-pin-postcode'),
        city: document.getElementById('place-pin-city'),
        coordinates: document.getElementById('place-pin-coordinates'),
        rememberRow: document.getElementById('place-pin-remember-row'),
        remember: document.getElementById('place-pin-remember'),
        save: document.getElementById('place-pin-save')
    };
}

function saveLabel(target, remembered) {
    if (target === 'edit') return 'Ort speichern';
    if (target === 'destination') return remembered ? 'Merken und als Ziel verwenden' : 'Als Ziel verwenden';
    return remembered ? 'Merken und als Start verwenden' : 'Als Start verwenden';
}

function syncSaveLabel() {
    const el = dialogElements();
    if (!request || !el.save) return;
    el.save.textContent = saveLabel(request.target, request.placeId || el.remember?.checked);
}

function confirmPosition() {
    const point = pointFrom(marker?.getLatLng());
    if (!point || !request) return;
    request.point = point;
    closePicker();

    const el = dialogElements();
    el.title.textContent = request.placeId ? '📌 Gespeicherten Ort ändern' : '📌 Ort benennen';
    el.name.value = request.label;
    el.street.value = request.strasse;
    el.postcode.value = request.plz;
    el.city.value = request.ort;
    el.coordinates.textContent = `Pin: ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
    el.rememberRow.hidden = Boolean(request.placeId) || request.target === 'edit';
    el.remember.checked = true;
    syncSaveLabel();
    el.dialog.showModal();
    requestAnimationFrame(() => el.name.focus());
}

function syncTourReferences(place) {
    const point = tourPointFromOwnPlace(place);
    if (!point) return;
    if (state.tour.start?.placeId === place.id) state.tour.start = { ...point };
    if (state.tour.destination?.placeId === place.id) state.tour.destination = { ...point };
}

function applyAsTourPoint(point, target) {
    if (!point || target === 'edit') return;
    clearServiceTourPlan();
    if (target === 'destination') {
        const first = !state.tour.destination;
        state.tour.destination = point;
        if (first && state.tour.suggestMode !== 'route') state.tour.suggestMode = 'route';
    } else {
        state.tour.start = point;
    }
}

function savePlace(event) {
    event.preventDefault();
    const el = dialogElements();
    if (!request || !el.form.reportValidity()) return;
    const values = {
        label: el.name.value,
        lat: request.point.lat,
        lng: request.point.lng,
        strasse: el.street.value.trim(),
        plz: el.postcode.value.trim(),
        ort: el.city.value.trim(),
        coordinateSource: 'map-pin'
    };

    let point;
    let remembered = false;
    if (request.placeId) {
        const updated = updatePlace(request.placeId, values);
        if (!updated) return;
        syncTourReferences(updated);
        point = tourPointFromOwnPlace(updated);
        remembered = true;
    } else if (el.remember.checked) {
        const place = createOwnPlace(values);
        if (!place || !addPlace(place)) {
            showToast('Der Ort konnte nicht gespeichert werden. Bitte zuerst einen anderen eigenen Ort löschen.', 'info', 6000);
            return;
        }
        point = tourPointFromOwnPlace(place);
        remembered = true;
    } else {
        point = { ...values, label: values.label.trim() };
    }

    applyAsTourPoint(point, request.target);
    const targetLabel = request.target === 'destination' ? ' als Ziel' : request.target === 'start' ? ' als Start' : '';
    el.dialog.close();
    showToast(`„${point.label}"${remembered ? ' gespeichert und' : ''}${targetLabel} übernommen.`, 'success');
    request = null;
    emit('tour:changed');
}

function closeDialog() {
    dialogElements().dialog?.close();
    request = null;
}

export function initPlacePicker() {
    const el = dialogElements();
    if (!el.dialog || !el.form || !getMap()) return;
    on('place-picker:open', openPicker);
    el.form.addEventListener('submit', savePlace);
    el.remember.addEventListener('change', syncSaveLabel);
    el.dialog.querySelectorAll('[data-place-pin-close]').forEach((button) => button.addEventListener('click', closeDialog));
    el.dialog.addEventListener('cancel', () => { request = null; });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && document.body.classList.contains('place-picker-active')) cancelPicker();
    });
}
