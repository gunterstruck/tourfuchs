/**
 * QR-Tour-Übergabe – UI.
 * Desktop: aktuelle Tour als QR-Code anzeigen (Canvas, lokal erzeugt).
 * Handy: QR per Kamera scannen (jsQR auf Videobildern, Foto-Fallback) und die
 * Tour übernehmen bzw. direkt navigieren / Termine erzeugen.
 * Es findet keinerlei Netzwerkübertragung statt.
 */

import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { state, emit, getCustomer, setCustomers } from '../core/state.js';
import { decodeTourText, matchStopsToCustomers, encodeTourUrlPacked } from '../features/tourShare.js';
import { googleMapsLegs } from '../features/tour.js';
import { downloadIcs } from '../features/tourExport.js';
import { combinePlanStart } from '../features/dayPlanner.js';
import { showToast } from './toast.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

let shareDialog = null;
let scanDialog = null;
let videoStream = null;
let scanLoopId = 0;
let received = null; // dekodierte Tour aus dem letzten Scan

export function initTourQr() {
    shareDialog = document.getElementById('qr-share-dialog');
    scanDialog = document.getElementById('qr-scan-dialog');
    shareDialog.querySelector('.dialog-close').addEventListener('click', () => shareDialog.close());
    scanDialog.querySelector('.dialog-close').addEventListener('click', () => scanDialog.close());
    scanDialog.addEventListener('close', stopCamera);

    document.getElementById('btn-tour-scan').addEventListener('click', openScanDialog);
    // Weitere Einstiege (Schrittleiste, „Eigene Daten laden"): ein offener
    // Dialog wird vorher geschlossen, damit der Scan-Dialog oben liegt.
    document.querySelectorAll('[data-tour-scan]').forEach((button) => {
        button.addEventListener('click', () => {
            button.closest('dialog')?.close();
            openScanDialog();
        });
    });
    document.getElementById('qr-scan-file').addEventListener('change', onScanFile);
    document.getElementById('qr-received-adopt').addEventListener('click', adoptReceivedTour);
    document.getElementById('qr-received-gmaps').addEventListener('click', () => {
        if (!received) return;
        const legs = googleMapsLegs(received.start, received.stops, received.roundTrip);
        if (legs.length === 1) { window.open(legs[0].link, '_blank', 'noopener'); return; }
        // Mehr Stopps, als Google Maps in einem Link annimmt: vollständige
        // Teilstrecken anbieten statt still Stopps wegzulassen. Je ein Knopf –
        // mehrere Fenster auf einmal würde der Browser blockieren.
        renderLegButtons(legs);
    });
    document.getElementById('qr-received-ics').addEventListener('click', () => {
        if (!received) return;
        const pseudo = received.stops.map((s) => ({
            name: s.name, strasse: s.adresse, plz: '', ort: '', telefon: s.telefon,
            nummer: s.nummer, lat: s.lat, lng: s.lng
        }));
        downloadIcs(received.start, pseudo, {
            startTime: combinePlanStart(received.date, received.startTime),
            visitMinutes: received.visitMinutes,
            tourName: received.tourName
        });
        showToast('Kalender-Datei (.ics) erstellt.', 'success');
    });
}

/**
 * Vom Tour-Panel aufgerufen: die Tour als QR-Code (App-URL) anzeigen. Die URL
 * öffnet beim Scannen mit der normalen Handy-Kamera direkt die PWA/den Browser.
 * @param {string} encoded  Ergebnis von encodeTourPayload
 */
export async function openShareDialog(encoded, { stopCount, skipped = 0, fromPhone = false } = {}) {
    const title = document.getElementById('qr-share-title');
    if (title) title.textContent = fromPhone ? '📲 Tour per QR teilen' : '📲 Tour an Handy übergeben';
    const canvas = document.getElementById('qr-share-canvas');
    const url = await encodeTourUrlPacked(encoded, window.location.origin + window.location.pathname);
    try {
        // ECC „L": maximale Kapazität für die längere URL; Bildschirm→Kamera ist
        // ein sauberer Kanal, hohe Fehlerkorrektur ist hier nicht nötig.
        // Intern hoch aufgelöst (CSS skaliert auf die Anzeigegröße): Screenshots
        // und Kamera bekommen scharfe Kanten statt verwaschener Module.
        await QRCode.toCanvas(canvas, url, { errorCorrectionLevel: 'L', width: 1024, margin: 3 });
    } catch {
        showToast('QR-Code konnte nicht erzeugt werden – Tour zu groß. Bitte Stopps reduzieren.', 'error', 6000);
        return;
    }
    document.getElementById('qr-share-info').textContent =
        `${stopCount} Stopp${stopCount === 1 ? '' : 's'} im Code` +
        (skipped > 0 ? ` · ${skipped} weitere passen nicht hinein` : '') +
        (fromPhone ? ' · das andere Handy scannt ihn mit der Kamera' : ' · mit der Handy-Kamera scannen');
    shareDialog.showModal();
}

/**
 * Beim App-Start aufgerufen: liegt eine Tour im URL-Fragment (#t=…), direkt den
 * Empfangs-Dialog öffnen. So genügt das Scannen des QR-Codes mit der Kamera.
 * @param {object} payload  bereits dekodierte Tour (aus decodeTourPayload)
 */
export function openReceivedFromUrl(payload) {
    if (!payload) return;
    received = payload;
    if (!scanDialog) scanDialog = document.getElementById('qr-scan-dialog');
    renderReceived();
    scanDialog.showModal();
}

function openScanDialog() {
    received = null;
    document.getElementById('qr-scan-result').hidden = true;
    document.getElementById('qr-scan-live').hidden = false;
    scanDialog.showModal();
    startCamera();
}

async function startCamera() {
    const statusEl = document.getElementById('qr-scan-status');
    const video = document.getElementById('qr-scan-video');
    try {
        // Hohe Auflösung anfordern: Ohne Angabe liefern viele Handys 640×480 –
        // zu grob für einen dichten Tour-Code. Dauer-Autofokus, wo vorhanden.
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                advanced: [{ focusMode: 'continuous' }]
            },
            audio: false
        });
        video.srcObject = videoStream;
        await video.play();
        statusEl.textContent = 'Kamera auf den QR-Code richten – nah genug, dass er das Bild füllt …';
        scanLoop(video);
    } catch {
        statusEl.textContent = 'Kamera nicht verfügbar – bitte unten ein Foto des QR-Codes wählen.';
    }
}

function stopCamera() {
    scanLoopId++;
    if (videoStream) {
        videoStream.getTracks().forEach((t) => t.stop());
        videoStream = null;
    }
    const video = document.getElementById('qr-scan-video');
    if (video) video.srcObject = null;
}

// Eingebauter Erkenner des Browsers (Chrome/Android): liest auch sehr dichte
// Codes zuverlässig. Wo es ihn nicht gibt (Safari), übernimmt jsQR.
let barcodeDetector;
function nativeDetector() {
    if (barcodeDetector !== undefined) return barcodeDetector;
    barcodeDetector = null;
    try {
        if (typeof window.BarcodeDetector === 'function') barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
    } catch { barcodeDetector = null; }
    return barcodeDetector;
}
async function detectNative(source) {
    const detector = nativeDetector();
    if (!detector) return [];
    try {
        const codes = await detector.detect(source);
        return codes.map((c) => c.rawValue).filter(Boolean);
    } catch {
        return [];
    }
}

/**
 * Ausschnitt einer Quelle (Video, Bild) verkleinert auf ein Canvas zeichnen
 * und mit jsQR lesen. jsQR wird auf riesigen Bildern langsam und unsicher,
 * auf zu kleinen verschwimmen die Module – deshalb mehrere Größen/Ausschnitte.
 */
function jsqrRegion(source, srcW, srcH, crop, maxSide, canvas) {
    const side = Math.min(srcW, srcH) * crop;
    const sw = crop >= 1 ? srcW : side;
    const sh = crop >= 1 ? srcH : side;
    const sx = (srcW - sw) / 2;
    const sy = (srcH - sh) / 2;
    const scale = Math.min(1, maxSide / Math.max(sw, sh));
    canvas.width = Math.max(1, Math.round(sw * scale));
    canvas.height = Math.max(1, Math.round(sh * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(img.data, img.width, img.height)?.data || null;
}

// Für Videobilder wechselnde Versuche (je Takt einer): ganzes Bild und Mitte.
const VIDEO_ATTEMPTS = [[1, 1280], [0.75, 1100], [0.55, 900]];
// Für Fotos/Screenshots alle Versuche nacheinander.
const IMAGE_ATTEMPTS = [[1, 1600], [1, 1100], [0.8, 1400], [0.6, 1200], [1, 800], [0.45, 1000], [1, 2400]];

function scanLoop(video) {
    const loopId = ++scanLoopId;
    const canvas = document.createElement('canvas');
    let attempt = 0;
    const tick = async () => {
        if (loopId !== scanLoopId || !scanDialog.open) return;
        if (video.readyState >= 2 && video.videoWidth > 0) {
            const texts = await detectNative(video);
            if (loopId !== scanLoopId) return;
            if (!texts.length) {
                const [crop, maxSide] = VIDEO_ATTEMPTS[attempt++ % VIDEO_ATTEMPTS.length];
                const text = jsqrRegion(video, video.videoWidth, video.videoHeight, crop, maxSide, canvas);
                if (text) texts.push(text);
            }
            for (const text of texts) {
                if (await tryHandlePayload(text)) return;
            }
        }
        setTimeout(tick, 160);
    };
    tick();
}

/** Alle Leseversuche auf einem Bild (für Tests exportiert). */
export async function readQrFromImage(bitmap) {
    const texts = await detectNative(bitmap);
    if (texts.length) return texts;
    const canvas = document.createElement('canvas');
    for (const [crop, maxSide] of IMAGE_ATTEMPTS) {
        const text = jsqrRegion(bitmap, bitmap.width, bitmap.height, crop, maxSide, canvas);
        if (text) return [text];
    }
    return [];
}

async function onScanFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) { showToast('Bild konnte nicht gelesen werden.', 'error'); return; }
    const statusEl = document.getElementById('qr-scan-status');
    if (statusEl) statusEl.textContent = 'Bild wird gelesen …';
    const texts = await readQrFromImage(bitmap);
    for (const text of texts) {
        if (await tryHandlePayload(text)) return;
    }
    if (statusEl) statusEl.textContent = '';
    showToast(texts.length
        ? 'Das ist kein TourFuchs-Tour-Code.'
        : 'Kein QR-Code im Bild gefunden – bitte näher heran oder schärfer fotografieren.', 'error', 6000);
}

async function tryHandlePayload(text) {
    const payload = await decodeTourText(text);
    if (!payload) return false;
    received = payload;
    stopCamera();
    renderReceived();
    return true;
}

function renderLegButtons(legs) {
    const box = document.getElementById('qr-received-legs');
    if (!box) return;
    box.hidden = false;
    box.innerHTML = `<p class="muted small">Google Maps nimmt nicht alle ${received.stops.length} Stopps in einem Link an. Fahr die Tour in ${legs.length} Teilstrecken – jede beginnt, wo die vorige endet:</p>`
        + legs.map((leg, i) => `<button type="button" data-leg="${i}">🧭 Teil ${i + 1}: Stopp ${leg.from}–${leg.to}${received.roundTrip && i === legs.length - 1 ? ' + Rückweg' : ''}</button>`).join('');
    box.querySelectorAll('[data-leg]').forEach((button) => button.addEventListener('click', () => {
        window.open(legs[Number(button.dataset.leg)].link, '_blank', 'noopener');
    }));
}

function renderReceived() {
    document.getElementById('qr-scan-live').hidden = true;
    const result = document.getElementById('qr-scan-result');
    result.hidden = false;

    const dateText = received.date
        ? new Date(`${received.date}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
        : 'ohne Datum';
    document.getElementById('qr-scan-summary').innerHTML =
        `<b>${escapeHtml(received.tourName)}</b> · ${received.stops.length} Stopps · ${escapeHtml(dateText)}, `
        + `Start ${escapeHtml(received.startTime)} Uhr · ${received.visitMinutes} min je Besuch`;
    const legs = googleMapsLegs(received.start, received.stops, received.roundTrip);
    const gmaps = document.getElementById('qr-received-gmaps');
    gmaps.textContent = legs.length > 1 ? `🧭 In Google Maps navigieren (${legs.length} Teilstrecken)` : '🧭 In Google Maps navigieren';
    const legBox = document.getElementById('qr-received-legs');
    if (legBox) { legBox.hidden = true; legBox.innerHTML = ''; }
    document.getElementById('qr-scan-stoplist').innerHTML = received.stops.map((s, i) =>
        `<div class="qr-stop-row"><b>${i + 1}.</b> ${escapeHtml(s.name)}${s.adresse ? ` <span class="muted small">${escapeHtml(s.adresse)}</span>` : ''}</div>`
    ).join('');

    const { matched, ambiguous } = matchStopsToCustomers(received.stops, state.customers);
    const missing = received.stops.length - matched.length;
    const adopt = document.getElementById('qr-received-adopt');
    // Übernehmen ist immer möglich: fehlende Kunden werden dabei lokal angelegt,
    // damit die komplette Tourplanung sichtbar ist.
    adopt.disabled = received.stops.length === 0;
    document.getElementById('qr-scan-matchinfo').textContent = missing === 0
        ? 'Alle Stopps sind in den lokalen Kundendaten vorhanden.'
        : matched.length === 0
            ? 'Diese Kunden sind lokal noch nicht vorhanden – beim Übernehmen werden sie angelegt, damit die ganze Tour sichtbar ist.'
            : `${matched.length} von ${received.stops.length} Stopps sind lokal vorhanden; ${missing} werden beim Übernehmen neu angelegt.`;
    if (ambiguous > 0) {
        document.getElementById('qr-scan-matchinfo').textContent += ` ${ambiguous === 1 ? 'Eine Kundennummer gibt' : `${ambiguous} Kundennummern gibt`} es lokal mehrfach – `
            + 'diese Stopps werden mit den Daten aus dem QR-Code angelegt statt geraten.';
    }
}

/**
 * Baut aus einem empfangenen Stopp (nur Name/Adresse/Koordinaten aus dem
 * QR-Code) einen vollwertigen lokalen Kunden, damit unbekannte Tourstopps nicht
 * verloren gehen. Die Kundennummer kommt mit, sofern übertragen.
 */
function customerFromStop(stop, i) {
    const addr = String(stop.adresse || '');
    const parts = addr.split(',').map((s) => s.trim()).filter(Boolean);
    const strasse = parts.length > 1 ? parts.slice(0, -1).join(', ') : (parts[0] || '');
    const cityPart = parts.length > 1 ? parts[parts.length - 1] : '';
    const cityMatch = cityPart.match(/^(\d{4,5})\s+(.+)$/);
    const plz = String(stop.plz || (cityMatch ? cityMatch[1] : '')).trim();
    const ort = cityMatch ? cityMatch[2] : (plz ? cityPart.replace(plz, '').trim() : cityPart);
    return {
        id: `qr-${Date.now().toString(36)}-${i}`,
        nummer: String(stop.nummer || '').trim(),
        name: stop.name || 'Stopp',
        strasse, plz, ort,
        vb: '', channel: '', gruppe: '', bezirk: '',
        ansprechpartner: '', telefon: String(stop.telefon || '').trim(), email: '',
        umsatz: null, rhythmusWochen: null, besuche: [],
        lat: Number(stop.lat), lng: Number(stop.lng), geo: 'exakt',
        extra: { Herkunft: 'QR-Übergabe' },
        fromQr: true
    };
}

function adoptReceivedTour() {
    if (!received || received.stops.length === 0) return;
    const { matched } = matchStopsToCustomers(received.stops, state.customers);
    const idByStop = new Map(matched.map(({ stop, customer }) => [stop, customer.id]));
    // Lokaler Kunde ohne Position: Die QR-Position ist gültig – übernehmen,
    // sonst fiele der Stopp aus Karte und Route.
    let positioned = 0;
    for (const { stop, customer } of matched) {
        if (hasValidCoords(customer) || !hasValidCoords(stop)) continue;
        customer.lat = Number(stop.lat);
        customer.lng = Number(stop.lng);
        customer.geo = 'exakt';
        positioned += 1;
    }

    state.tour.bezirk = '__all__'; // Stopps können außerhalb des gewählten Bezirks liegen

    // Reihenfolge der empfangenen Tour beibehalten; unbekannte Stopps anlegen.
    const created = [];
    const orderedIds = received.stops.map((stop, i) => {
        const known = idByStop.get(stop);
        if (known) return known;
        const c = customerFromStop(stop, i);
        created.push(c);
        return c.id;
    });
    if (created.length > 0) setCustomers([...state.customers, ...created]);

    // Start vollständig übernehmen: Adresse und „von Hand gesetzt" gehören dazu,
    // sonst steht im Plan nur noch ein namenloser Kartenpunkt.
    const { adresse, coordinateSource, here } = received.start;
    state.tour.start = {
        lat: received.start.lat,
        lng: received.start.lng,
        label: received.start.label || 'Übernommener Start',
        ...(adresse ? { adresse } : {}),
        ...(coordinateSource ? { coordinateSource } : {}),
        ...(here ? { here: true } : {})
    };
    state.tour.destination = null;
    state.tour.roundTrip = received.roundTrip;
    state.tour.stops = orderedIds.filter((id) => getCustomer(id));

    const dateInput = document.getElementById('plan-date');
    const timeInput = document.getElementById('plan-time');
    const visitInput = document.getElementById('plan-visit-min');
    if (dateInput && received.date) dateInput.value = received.date;
    if (timeInput && received.startTime) timeInput.value = received.startTime;
    if (visitInput && received.visitMinutes) visitInput.value = received.visitMinutes;

    emit('tour:scope-changed');
    emit('tour:changed');
    if (positioned > 0) emit('customers:changed');
    if (created.length > 0 || positioned > 0) emit('dataset:dirty'); // neue Kunden/Positionen lokal sichern
    scanDialog.close();
    showToast(created.length > 0
        ? `Tour mit ${state.tour.stops.length} Stopps übernommen – ${created.length} neu${created.length === 1 ? 'er Kunde' : 'e Kunden'} angelegt.`
        : `Tour mit ${state.tour.stops.length} Stopps übernommen.`,
        'success', 6000);
}
