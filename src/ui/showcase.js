/**
 * Schaufenster / Showcase – geführte Live-Demos.
 *
 * Ein Geister-Cursor fährt sichtbar durch die ECHTE, laufende App und klickt
 * echte Bedienelemente – die App reagiert wirklich (kein Video). So werden
 * versteckte Stärken (Tour, QR-Übergabe, Mobile-Ansicht) erlebbar.
 *
 * Sicherheit: Während einer Vorführung fängt ein Schutz-Overlay echte Klicks
 * ab (die Geister-Klicks laufen programmatisch und werden dadurch nicht
 * blockiert). Stories, die den Tour-Zustand verändern, sichern und stellen ihn
 * am Ende wieder her. ESC / „Abbrechen" bricht jederzeit sauber ab.
 */

import { STORIES, visibleStories, visibleStorySteps, prepareShowcaseTour, selectShowcaseTour, storyDuration } from '../features/stories.js';
import { state, emit, markDirty, datasetSnapshot, on } from '../core/state.js';
import { isEnabled as vaultEnabled, removeVaultMeta } from '../services/vault.js';
import { saveDataset } from '../services/storage.js';
import {
    allShowcaseStoriesSeen,
    markShowcaseCompleted,
    markShowcaseStorySeen,
    nextUnseenShowcaseStory,
    resetShowcaseAfterDataClear,
    seenShowcaseIds
} from '../services/showcaseOnboarding.js';
import { distanceKm } from '../services/geocode.js';
import { isPhoneUi } from '../core/viewport.js';
import { openSetupDialog, showRecoveryCodeForDemo } from './lockVault.js';
import { flyToCustomer, fitToCustomers, fitTourRoute, focusMapArea, closeMapPopups, getMap } from '../features/map.js';
import { showMapView, showRouteView, showTourView, captureSheetForDemo, expandSheetForDemo, collapseSheetForDemo, restoreSheetAfterDemo, applyDepth, applyMode } from './sidebar.js';
import { showKeyStepForDemo } from './safeTransfer.js';
import { openCustomerBriefing as openBriefingDialog } from './customerBriefing.js';
import { clearLassoSelection, lassoSelection, setLassoActive } from './lasso.js';
import { openAreaBriefing as openAreaBriefingDialog } from './areaBriefing.js';
import { areaLabelFor } from '../features/areaBriefing.js';
import { loadDemo } from './importWizard.js';

const ROUTING_CONSENT_KEY = 'gf_routing_consent';

// Beispieltabelle für die Einfüge-Vorführung: bewusst klein, mit
// Überschriftenzeile und Tabulatoren – genau das, was Excel beim Kopieren in
// die Zwischenablage legt. Erfundene Firmen, echte Postleitzahlen.
const PASTE_DEMO_TABLE = [
    'Kundenname\tPLZ\tOrt\tVertriebsbezirk',
    'Muster Technik GmbH\t45136\tEssen\tBezirk West',
    'Beispiel Maschinenbau AG\t44135\tDortmund\tBezirk West',
    'Demo Handel KG\t50667\tKöln\tBezirk Rheinland'
].join('\n');

/**
 * Die Berechtigungs-Zusicherung nach der Vorführung zurücknehmen.
 *
 * Sie wird seit der Persistenz gespeichert – eine Vorführung darf sie deshalb
 * nicht heimlich stehen lassen. Der Klick auf die Checkbox löst dieselbe
 * Speicherung aus wie beim echten Nutzer, also wird das Ereignis hier gefeuert.
 */
function restorePasteDemoConsent() {
    if (pasteDemoConsent === null) return;
    const consent = document.querySelector('[data-compliance-optin]');
    if (consent && consent.checked !== pasteDemoConsent) {
        consent.checked = pasteDemoConsent;
        consent.dispatchEvent(new Event('change', { bubbles: true }));
    }
    pasteDemoConsent = null;
}

const isMobileView = () => isPhoneUi();
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
));

const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const insideMobilePreview = new URLSearchParams(location.search).has('mobilePreview');

let cursorEl = null;
let bubbleEl = null;
let shieldEl = null;
let toolbarEl = null;
let dialog = null;
let running = false;
let aborted = false;
let activeReject = null;
let tourSnapshot = null;
let visitRestore = null;      // { id, besuche } zum Zurücksetzen von „Heute besucht"
let origConfirm = null;       // Originales window.confirm während patchConfirm
let priorConsent = undefined; // Routing-Zustimmung vor der Demo (zum Zurücksetzen)
let demoVaultCreated = false; // hat DIESE Demo den Tresor angelegt? (nur dann abbauen)
let priorDepth = null;        // Ansichtstiefe vor der Demo (zum Zurücksetzen)
let priorMode = null;         // Arbeitsfokus vor der Demo (zum Zurücksetzen)
let showcaseTourPlan = null;  // reproduzierbare Start-/Stoppwahl der aktuellen Demo
let pasteDemoConsent = null;  // Berechtigungs-Bestätigung vor der Einfüge-Vorführung

class AbortError extends Error {}

// ---- DOM der Show ----
function ensureDom() {
    if (cursorEl) return;
    cursorEl = document.createElement('div');
    cursorEl.className = 'sc-cursor';
    cursorEl.hidden = true;
    cursorEl.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2 L4 19 L8.6 14.6 L11.8 21.6 L14.6 20.4 L11.5 13.6 L18 13.6 Z" fill="#ffffff" stroke="#0f172a" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
    bubbleEl = document.createElement('div');
    bubbleEl.className = 'sc-bubble';
    bubbleEl.hidden = true;
    document.body.append(cursorEl, bubbleEl);
}

// ---- Abbruch-sichere Pausen ----
function sleep(ms) {
    return new Promise((resolve, reject) => {
        const dur = prefersReduced ? Math.min(ms, 250) : ms;
        const timer = setTimeout(() => { activeReject = null; resolve(); }, dur);
        activeReject = () => { clearTimeout(timer); reject(new AbortError()); };
    });
}
function sleepExact(ms) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { activeReject = null; resolve(); }, ms);
        activeReject = () => { clearTimeout(timer); reject(new AbortError()); };
    });
}
function guard() { if (aborted) throw new AbortError(); }
function abortNow() {
    if (!running) return;
    aborted = true;
    if (activeReject) activeReject();
}

// ---- Element-Auflösung ----
function isVisible(el) {
    if (!el) return false;
    // Ein geöffnetes natives <dialog> liegt im Top-Layer und besitzt je nach
    // Browser keinen offsetParent. Es ist trotzdem sichtbar.
    if (el.matches?.('dialog[open]')) return true;
    return el.offsetParent !== null || el.getClientRects().length > 0;
}
async function resolveEl(sel, timeout = 4000) {
    const start = Date.now();
    for (;;) {
        guard();
        const el = document.querySelector(sel);
        if (isVisible(el)) return el;
        if (Date.now() - start > timeout) return null;
        await sleep(120);
    }
}
function centerOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// Cursor/Blase/Leiste in die richtige Ebene hängen: Ein modaler <dialog> liegt
// im Top-Layer und würde die Overlays sonst verdecken. Elemente im offenen
// Dialog rendern darüber – also die Overlays dorthin verschieben.
function moveOverlaysInto(layer) {
    if (!layer || cursorEl?.parentElement === layer) return;
    layer.append(cursorEl, bubbleEl);
    if (toolbarEl) layer.append(toolbarEl);
}
function layerFor(el) {
    return (el && el.closest('dialog[open]')) || document.body;
}

/**
 * Zustand der Karte in einem Wort – Zoomstufe, Kundenstapel, Kundenkacheln.
 *
 * Damit lässt sich nach einem vorgeführten Klick fragen: Hat sich überhaupt
 * etwas bewegt? Die Prüfstrecke `demo-check` misst nur, ob der Cursor sein Ziel
 * trifft; ob der Treffer wirkt, sieht sie nicht. Innerhalb der Vorführung ist
 * genau das aber die Frage, an der ein Schritt scheitert oder gelingt.
 */
function mapSignature() {
    const zoom = getMap()?.getZoom?.() ?? null;
    return [
        zoom,
        document.querySelectorAll('.customer-stack-card').length,
        document.querySelectorAll('.customer-marker-card').length
    ].join('|');
}

/**
 * Von mehreren gleichartigen Zielen (Kartenkacheln) das am besten sichtbare
 * wählen: ganz im Bild und möglichst nah an der Mitte. Sonst klickt der
 * Geister-Cursor gern das erste im DOM – und das kann am Bildrand kleben.
 */
function pickMostCentral(sel) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    let best = null;
    let bestScore = Infinity;
    for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        // Angeschnittene Ziele scheiden aus – der Klick soll sichtbar sein.
        if (r.top < 0 || r.left < 0 || r.bottom > window.innerHeight || r.right > window.innerWidth) continue;
        const score = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy);
        if (score < bestScore) { bestScore = score; best = el; }
    }
    return best;
}

// ---- Cursor-Bewegung / Klick ----
function placeCursor(x, y) {
    // Sitzt der Cursor in einem transformierten Vorfahren, ist „fixed" relativ zu
    // diesem – nicht zum Viewport. Offene Dialoge tragen durch die Einblend-
    // Animation dauerhaft ein transform (scale(1) via fill-mode „both") und bilden
    // damit einen solchen Bezugsrahmen. Dessen Viewport-Versatz abziehen, damit die
    // Zeigerspitze trotzdem exakt auf den Viewport-Koordinaten (x, y) sitzt.
    let ox = 0;
    let oy = 0;
    for (let n = cursorEl.parentElement; n && n !== document.body; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.transform !== 'none' || cs.perspective !== 'none' || (cs.willChange || '').includes('transform')) {
            const r = n.getBoundingClientRect();
            ox = r.left;
            oy = r.top;
            break;
        }
    }
    const px = x - ox - 4;
    const py = y - oy - 2;
    cursorEl.style.setProperty('--sc-x', `${px}px`);
    cursorEl.style.setProperty('--sc-y', `${py}px`);
    cursorEl.style.transform = `translate(${px}px, ${py}px)`;
}
async function moveTo(x, y) {
    cursorEl.hidden = false;
    placeCursor(x, y);
    await sleep(prefersReduced ? 120 : 680);
}
// Cursor OHNE Übergang exakt auf eine Position setzen. Wird kurz vor dem Klick
// genutzt, um die Zeigerspitze auf die AKTUELLE Ziel-Mitte nachzuführen, falls
// sich das Element seit dem Anvisieren verschoben hat (Liste re-rendert, Karte
// animiert noch, Dialog öffnet). So klickt der Zeiger nicht sichtbar daneben.
function snapCursor(x, y) {
    const prevTransition = cursorEl.style.transition;
    cursorEl.style.transition = 'none';
    // Robust gegen transformierte Container / Re-Parenting: grob setzen, die
    // TATSÄCHLICHE Lage der Spitze im Viewport messen und den Restfehler in ein
    // paar Schritten ausgleichen, bis die Spitze exakt auf (x, y) sitzt.
    let px = x - 4;
    let py = y - 2;
    const apply = () => {
        cursorEl.style.setProperty('--sc-x', `${px}px`);
        cursorEl.style.setProperty('--sc-y', `${py}px`);
        cursorEl.style.transform = `translate(${px}px, ${py}px)`;
        void cursorEl.offsetWidth; // Reflow, damit die Messung die neue Lage sieht
    };
    apply();
    for (let i = 0; i < 3; i++) {
        const r = cursorEl.getBoundingClientRect();
        const dx = x - (r.left + 4);
        const dy = y - (r.top + 2);
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) break;
        px += dx;
        py += dy;
        apply();
    }
    cursorEl.style.transition = prevTransition;
}
async function moveToEl(sel) {
    const el = await resolveEl(sel);
    if (!el) return null;
    moveOverlaysInto(layerFor(el));
    // „nearest" statt „center": schon sichtbare Ziele (Kartenmarker, Blatt-Knöpfe)
    // NICHT ins Fenster scrollen – sonst schiebt sich auf dem Handy die feste App
    // samt Kopfleiste nach oben aus dem Bild.
    el.scrollIntoView({ block: 'nearest', behavior: prefersReduced ? 'auto' : 'smooth' });
    await sleep(prefersReduced ? 60 : 260);
    const c = centerOf(el);
    await moveTo(c.x, c.y);
    return el;
}
/**
 * In den Tour-Bereich wechseln – am Schreibtisch über den Reiter, am Handy
 * ohne ihn.
 *
 * Mobil gibt es keine Reiterleiste mehr: Die Tour ist dort der einzige Bereich,
 * gewechselt wird nur noch die Blatt-Höhe. Ein Klick auf den unsichtbaren
 * Reiter würde die Vorführung nur um die Wartezeit von `resolveEl` bremsen und
 * dann still scheitern.
 */
async function openTourTab() {
    const sel = '.tab-button[data-tab="tour"]';
    if (isVisible(document.querySelector(sel))) { await clickEl(sel); return; }
    showTourView();
    await sleep(200);
}
async function clickEl(sel, { keepOverlaysOutside = false } = {}) {
    const el = await moveToEl(sel);
    if (!el) return false;
    // Manche Dialog-Aktionen ersetzen ihren kompletten Inhalt – dann müssen die
    // Overlays vorher aus dem Dialog heraus. Das ZUERST tun, damit die folgende
    // Nachführung im endgültigen Bezugsrahmen (Body) misst und exakt sitzt.
    if (keepOverlaysOutside) moveOverlaysInto(document.body);
    // Ziel exakt nachführen: zwischen Anvisieren und Klick kann es sich verschoben
    // haben (Vorschlagsliste re-rendert, Kartenanimation, frisch geöffneter Dialog).
    const c = centerOf(el);
    snapCursor(c.x, c.y);
    cursorEl.classList.add('sc-click', 'sc-press');
    await sleep(150);
    cursorEl.classList.remove('sc-press');
    // Unmittelbar vor dem Klick noch einmal nachschlagen.
    //
    // Zwischen Anvisieren und Klick liegen rund 800 ms Cursor-Weg. Karten-
    // elemente überstehen das nicht immer: Leaflet baut Kundenstapel bei jeder
    // Bewegung neu auf. Der Klick träfe dann einen Knoten, der nicht mehr im
    // Dokument hängt – er geht ins Leere, ohne dass etwas danebengeht. Auf einem
    // echten Telefon ist das wahrscheinlicher als im Emulator, weil dort jede
    // Animation länger dauert. Genau diese Fehlerklasse hat `attention-check`
    // schon einmal getroffen (Wechsel von Tiefe/Modus baut die Reiterleiste neu).
    const frisch = document.querySelector(sel);
    (frisch && isVisible(frisch) ? frisch : el).click();
    await sleep(120);
    cursorEl.classList.remove('sc-click');
    await sleep(prefersReduced ? 120 : 420);
    return true;
}
async function typeInto(sel, text) {
    const el = await moveToEl(sel);
    if (!el) return false;
    el.focus();
    el.value = '';
    for (const ch of text) {
        guard();
        el.value += ch;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(prefersReduced ? 0 : 130);
    }
    return true;
}
// Wert setzen, ohne das Feld zu fokussieren – auf dem Handy poppt so keine
// Tastatur auf (für PIN-Felder in der Tresor-Demo). Die Ziffern werden sichtbar
// „getippt", indem der Wert Zeichen für Zeichen wächst.
async function fillNoFocus(sel, value) {
    const el = await moveToEl(sel);
    if (!el) return false;
    el.value = '';
    for (const ch of String(value)) {
        guard();
        el.value += ch;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(prefersReduced ? 0 : 160);
    }
    return true;
}
async function selectValue(sel, value) {
    const el = await moveToEl(sel);
    if (!el) return false;
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(prefersReduced ? 120 : 500);
    return true;
}

// ---- Sprechblase ----
async function say(text, sel, pos) {
    bubbleEl.textContent = text;
    bubbleEl.hidden = false;
    bubbleEl.classList.remove('sc-show');
    // Vorläufig platzieren, um Maße zu kennen. Die Blase erscheint erst,
    // nachdem der Cursor sichtbar zum erklärten Element gewandert ist.
    bubbleEl.style.left = '-9999px';
    bubbleEl.style.top = '0px';
    await sleep(10);
    const bw = bubbleEl.offsetWidth;
    const bh = bubbleEl.offsetHeight;
    const anchor = sel ? await resolveEl(sel, 800) : null;
    if (anchor) {
        moveOverlaysInto(layerFor(anchor));
        anchor.scrollIntoView({ block: 'nearest', behavior: prefersReduced ? 'auto' : 'smooth' });
        await sleep(prefersReduced ? 40 : 240);
        const target = centerOf(anchor);
        await moveTo(target.x, target.y);
    }
    let x;
    let y;
    if (anchor) {
        const r = anchor.getBoundingClientRect();
        x = Math.min(window.innerWidth - bw - 12, Math.max(12, r.left));
        y = r.bottom + 12 + bh > window.innerHeight ? r.top - bh - 12 : r.bottom + 12;
    } else {
        x = Math.max(12, Math.min(window.innerWidth - bw - 12, window.innerWidth / 2 - bw / 2));
        // pos 'bottom': unter ein zentrales Karten-Popup, damit die Blase es nicht verdeckt.
        y = pos === 'bottom'
            ? Math.max(window.innerHeight * 0.5, window.innerHeight - bh - 180)
            : Math.max(64, window.innerHeight * 0.16);
    }
    bubbleEl.style.left = `${x}px`;
    bubbleEl.style.top = `${Math.max(58, y)}px`;
    bubbleEl.classList.add('sc-show');
}
function hideBubble() {
    if (!bubbleEl) return;
    bubbleEl.classList.remove('sc-show');
    bubbleEl.hidden = true;
}

// ---- benannte Helfer (aus den Stories referenziert) ----
function scopedWithCoords() {
    return state.customers.filter((c) => c.lat !== null && c.lng !== null);
}
function showcaseSearchTerm(customer) {
    const pool = scopedWithCoords();
    const name = String(customer?.name || '').trim();
    const terms = [name.slice(0, 12), name, String(customer?.plz || ''), String(customer?.ort || '')]
        .filter((term, index, all) => term.length >= 2 && all.indexOf(term) === index);
    return terms.find((term) => pool
        .filter((c) => c.name.toLowerCase().includes(term.toLowerCase())
            || String(c.ort || '').toLowerCase().includes(term.toLowerCase())
            || String(c.plz || '').startsWith(term))
        .slice(0, 6)
        .some((c) => c.id === customer.id)) || name;
}
function assignShowcaseStart(customer) {
    state.tour.start = {
        lat: customer.lat, lng: customer.lng, label: customer.name, customerId: customer.id,
        strasse: customer.strasse, plz: customer.plz, ort: customer.ort
    };
    emit('tour:changed');
}
async function waitForCustomers(timeout = 6000) {
    const start = Date.now();
    while (state.customers.length === 0) {
        guard();
        if (Date.now() - start > timeout) return;
        await sleep(150);
    }
}

const HELPERS = {
    async ensureDemo() {
        if (state.customers.length > 0) return;
        await loadDemo({ source: 'showcase', confirmReplacement: true, announce: false });
        await waitForCustomers();
        await sleep(1100);
    },
    // ---- Einfügen vorführen ----
    // Der schnellste Weg zu eigenen Daten ist der, den niemand von selbst
    // findet. Also wird er gezeigt – aber **ohne echte Daten anzufassen**:
    // Dialog auf, Beispieltabelle erscheint auf einen Schlag im Feld (so wie
    // ein echtes Einfügen), TourFuchs meldet den Befund, Dialog zu. Importiert
    // wird bewusst nichts; der vorhandene Bestand bleibt unberührt.
    async openPasteDemo() {
        const ownData = document.getElementById('own-data-dialog');
        if (!ownData?.showModal) return;
        if (!ownData.open) ownData.showModal();
        await sleep(700);
        // Die Berechtigungs-Zusicherung ist ein echter Riegel. Sie wird nicht
        // mehr vorab angehakt, sondern taucht – wie beim echten Nutzer – als
        // Bestätigungsschritt auf, sobald der Weg gewählt ist. Was die Demo
        // dabei setzt, nimmt sie am Ende wieder zurück.
        pasteDemoConsent = document.querySelector('[data-compliance-optin]')?.checked ?? false;
        await clickEl('#btn-paste');
        const consentDialog = document.getElementById('consent-dialog');
        if (consentDialog?.open) {
            await sleep(900);
            await clickEl('#consent-confirm');
            await sleep(300);
        }
        await resolveEl('#paste-input', 2500);
        await sleep(400);
    },
    async pasteDemoTable() {
        const field = await moveToEl('#paste-input');
        if (!field) return;
        field.focus();
        // Einfügen erscheint auf einen Schlag – Zeichen für Zeichen zu tippen
        // wäre genau die falsche Geste.
        field.value = PASTE_DEMO_TABLE;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(900);
    },
    async closePasteDemo() {
        restorePasteDemoConsent();
        document.getElementById('paste-dialog')?.close();
        document.getElementById('own-data-dialog')?.close();
        await sleep(400);
    },
    async excelToMap() {
        if (state.customers.length === 0) {
            await loadDemo({ source: 'showcase', confirmReplacement: true, announce: false });
            await waitForCustomers();
        }
        showMapView();
        fitToCustomers();
        await sleep(1400);
    },
    async zoomToCustomerCards() {
        showMapView();
        await sleep(500);
        // Die echte Cluster-Interaktion sichtbar wiederholen, bis aus dem
        // Kundenstapel einzelne Kundenkacheln werden. So erklärt sich die
        // Zoom-Logik durch die Mausbewegung statt durch einen Sprung.
        //
        // Wie oft das nötig ist, hängt am Bestand und am Gerät – es ist keine
        // feste Zahl. Am Handy bündelt die Karte mit bis zu 124 px statt 104
        // (`customerClusterRadius`), und wer 5.000 Kunden in einer Region hat,
        // braucht mehr Ebenen als die Beispieldaten. Vier Tipps waren deshalb
        // eine Wette: Ging sie nicht auf, klopfte der Cursor viermal auf einen
        // Stapel, der sich nicht öffnete, und der nächste Satz sprach von
        // Kundenkacheln, die gar nicht dastanden.
        //
        // Jetzt entscheidet die **Wirkung**, nicht die Anzahl: Nach jedem Tipp
        // wird nachgesehen, ob sich die Karte überhaupt bewegt hat. Tut sie es
        // nicht, ist die tiefste Ebene erreicht – dann hört der Cursor auf zu
        // klopfen. Die Obergrenze ist nur noch ein Notnagel gegen Endlosläufe.
        // Zwei folgenlose Tipps hintereinander beenden den Versuch – einer
        // allein kann ein neu aufgebauter Stapel gewesen sein.
        for (let tiefe = 0, ohneWirkung = 0; tiefe < 8 && ohneWirkung < 2; tiefe += 1) {
            if (await resolveEl('.customer-marker-card', 350)) break;
            if (!await resolveEl('.customer-stack-card', 900)) break;
            const vorher = mapSignature();
            await clickEl('.customer-stack-card');
            await sleep(1100);
            ohneWirkung = mapSignature() === vorher ? ohneWirkung + 1 : 0;
        }
        // Bleibt der Bestand auch dann ein Stapel, wird die Zusage anders
        // eingelöst: ein Flug auf einen einzelnen Kunden. Danach steht die
        // Kundenkachel wirklich da, von der der nächste Satz spricht.
        if (!await resolveEl('.customer-marker-card', 350)) await HELPERS.showOneCustomer();
    },
    async openCustomerCard() {
        if (await resolveEl('.customer-marker-card', 800)) {
            // Nicht einfach die erste Kachel im DOM: Die kann am Bildrand kleben
            // und wird dann angeklickt, während sie halb abgeschnitten ist – in
            // genau der Demo, die einen guten ersten Eindruck machen soll.
            // Stattdessen die Kachel wählen, die am weitesten in der Mitte liegt
            // und ganz im Bild steht.
            const pick = pickMostCentral('.customer-marker-card');
            if (pick) {
                pick.classList.add('sc-pick');
                await clickEl('.customer-marker-card.sc-pick');
                pick.classList.remove('sc-pick');
            } else {
                await clickEl('.customer-marker-card');
            }
            await resolveEl('.leaflet-popup-content', 2200);
            await sleep(1100);
            return;
        }
        await HELPERS.showOneCustomer();
    },
    async openCustomerFromMap() {
        await HELPERS.zoomToCustomerCards();
        await HELPERS.openCustomerCard();
    },
    async focusDemoTourArea() {
        showcaseTourPlan = selectShowcaseTour(scopedWithCoords());
        const center = showcaseTourPlan?.center || { lat: 51.48, lng: 7.08 };
        document.querySelector('.mode-btn[data-mode="aussendienst"]')?.click();
        showMapView();
        focusMapArea(center.lat, center.lng, 10);
        await sleep(1700);
    },
    async showOneCustomer() {
        // Karte in den Vordergrund holen (auf dem Handy das Blatt einklappen),
        // dann in einen einzelnen Kunden zoomen und seine Infos zeigen.
        showMapView();
        await sleep(700);
        const located = scopedWithCoords();
        if (located.length === 0) return;
        const c = located.find((x) => x.umsatz && x.telefon) || located.find((x) => x.umsatz) || located[Math.floor(located.length / 2)];
        flyToCustomer(c, true);
        await sleep(2400);
    },
    async gotoTour() {
        await clickEl('.mode-btn[data-mode="aussendienst"]');
        await sleep(300);
        await openTourTab();
        // Auf dem Handy das Blatt weit aufziehen, damit man die Bedienung sieht.
        expandSheetForDemo();
        await resolveEl('#tour-scope', 3000);
        await sleep(400);
    },
    async gotoDaten() {
        await clickEl('.tab-button[data-tab="daten"]');
        await resolveEl('#vault-controls', 3000);
        await sleep(300);
    },
    async gotoService() {
        await clickEl('.mode-btn[data-mode="service"]');
        await resolveEl('#service-customer-scope', 3000);
        await sleep(600);
    },
    async gotoServiceTour() {
        await openTourTab();
        expandSheetForDemo();
        await resolveEl('#service-day-planner', 3000);
        await sleep(400);
    },
    async pickServiceStart() {
        // Start nahe am Tages-Cluster der Demo-Einsätze wählen, damit ein
        // kompakter, glaubwürdiger Tagesplan entsteht (statt Quer-durchs-Land).
        const byNumber = new Map(scopedWithCoords().map((c) => [String(c.nummer ?? '').trim(), c]));
        const clustered = (state.serviceVisits || [])
            .map((visit) => byNumber.get(String(visit.customerNumber ?? '').trim()))
            .filter(Boolean);
        const c = clustered[0] || scopedWithCoords()[0];
        if (c) assignShowcaseStart(c);
        await sleep(500);
    },
    async buildServiceDay() {
        await clickEl('#btn-service-day-preview');
        await resolveEl('#service-day-preview .service-day-preview-card', 6000);
        document.querySelector('#service-day-preview')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(1200);
    },
    async pickBezirkAll() {
        // „Alle Bezirke" ist der Standard – die Demo führt ihn nicht mehr vor,
        // sie stellt ihn nur her, falls der Nutzer vorher eingeschränkt hatte.
        if (state.tour.bezirk !== '__all__') {
            state.tour.bezirk = '__all__';
            emit('tour:scope-changed');
            emit('tour:changed');
        }
        await sleep(200);
    },
    async pickStart() {
        const planned = showcaseTourPlan?.start;
        // Auf dem Handy NICHT ins Suchfeld tippen – das würde die Bildschirm-
        // tastatur öffnen und das halbe Panel verdecken. Dort Start direkt setzen.
        if (!isMobileView() && planned) {
            await typeInto('#start-search', showcaseSearchTerm(planned));
            const selector = `#start-results [data-id="${CSS.escape(String(planned.id))}"]`;
            const res = await resolveEl(selector, 2200);
            if (res) { await clickEl(selector); await sleep(500); return; }
        } else if (!isMobileView()) {
            await typeInto('#start-search', 'au');
            const res = await resolveEl('#start-results .result-row', 2200);
            if (res) { await clickEl('#start-results .result-row'); await sleep(500); return; }
        }
        const c = planned || scopedWithCoords()[0];
        if (c) assignShowcaseStart(c);
        await sleep(400);
    },
    async addOneSuggestion() {
        await HELPERS.addSuggestions(1);
    },
    async addTwoSuggestions() {
        await HELPERS.addSuggestions(2);
    },
    /** Den Schritt „Vorschläge" sichtbar öffnen – wie es ein Mensch täte. */
    async showSuggestions() {
        const stepper = document.getElementById('tour-stepper');
        if (stepper && !stepper.hidden && await resolveEl('#tour-stepper .tour-step[data-step="suggest"]', 600)) {
            await clickEl('#tour-stepper .tour-step[data-step="suggest"]');
        } else {
            const acc = document.querySelector('.tour-acc[data-acc="suggest"]');
            if (acc && !acc.classList.contains('open')) await clickEl('.tour-acc[data-acc="suggest"] .acc-head');
        }
        await resolveEl('#tour-suggestions [data-add]', 2500);
        await sleep(400);
    },
    /**
     * Kunden aus den Vorschlägen zur Tour nehmen – sichtbar, Zeile für Zeile.
     *
     * Vorher stand hier eine Abkürzung mit Folgen: Die Suche nach dem Plus der
     * Zeile gab nach 250 ms auf und schrieb den Stopp danach still in den
     * Zustand. Weil der Schritt „Vorschläge" in der Übersicht zugeklappt ist,
     * war das Plus zu diesem Zeitpunkt gar nicht sichtbar – die Abkürzung war
     * also nicht der Ausnahmefall, sondern der Normalfall. Zu sehen blieb, dass
     * „Meine Tour" sich von selbst füllt.
     *
     * Genau den Eindruck darf diese Demo nicht hinterlassen: **Die Tour plant
     * der Mensch** – das ist die Produktentscheidung vom 10.07.2026, für die
     * ein fertig gebauter Tourvorschlag gestrichen wurde. Eine Vorführung, die
     * das Aussuchen unterschlägt, wirbt für das Gegenteil.
     *
     * Deshalb: erst die Liste öffnen, dann mit dem Cursor auf das Plus der
     * Zeile. Der stille Weg bleibt nur als Notnagel, wenn die Liste wirklich
     * nichts hergibt.
     */
    async addSuggestions(count = 2) {
        // Steht die Liste schon offen (die Tour-Demo öffnet sie als eigenen,
        // erzählten Schritt), nicht noch einmal auf den Kopf tippen.
        if (!await resolveEl('#tour-suggestions [data-add]', 400)) await HELPERS.showSuggestions();
        const geplant = showcaseTourPlan?.stops?.filter((c) => c.id !== state.tour.start?.customerId) || [];
        for (let i = 0; i < count; i++) {
            const kunde = geplant[i];
            const gezielt = kunde ? `#tour-suggestions [data-add="${CSS.escape(String(kunde.id))}"]` : null;
            let selektor = null;
            if (gezielt && await resolveEl(gezielt, 2500)) selektor = gezielt;
            else if (await resolveEl('#tour-suggestions [data-add]', 2500)) selektor = '#tour-suggestions [data-add]';
            if (selektor) { await clickEl(selektor); await sleep(650); continue; }
            // Notnagel: einen weiteren verorteten Kunden anhängen, damit die
            // Demo nicht ohne Tour dasteht. Sichtbar ist das nicht – deshalb
            // wirklich nur, wenn die Liste leer bleibt.
            const startId = state.tour.start?.customerId;
            const cand = scopedWithCoords()
                .filter((c) => c.id !== startId && !state.tour.stops.includes(c.id))
                .sort((a, b) => distanceKm(state.tour.start, a) - distanceKm(state.tour.start, b))[0];
            if (cand) { state.tour.stops.push(cand.id); emit('tour:changed'); }
            await sleep(400);
        }
    },
    async focusTourRoute() {
        showRouteView();
        // Handy: das (für die Bedienung aufgezogene) Blatt zurückziehen, damit die
        // Route die volle Kartenhöhe bekommt und nicht nach oben gequetscht wird.
        collapseSheetForDemo();
        await sleep(isMobileView() ? 700 : 300);
        fitTourRoute();
        await sleep(900);
    },
    // Auf den Schritt „Meine Tour" wechseln, damit die dortigen Aktionen
    // (Optimieren, Route auf Karte, QR-Übergabe) sichtbar und erreichbar sind.
    // Im Desktop-Fokus liegt die kompakte Schrittleiste vor – ein Tipp darauf
    // öffnet den Schritt; sonst genügt der Akkordeon-Kopf.
    async showMyTour() {
        const stepper = document.getElementById('tour-stepper');
        if (stepper && !stepper.hidden && await resolveEl('#tour-stepper .tour-step[data-step="mytour"]', 600)) {
            await clickEl('#tour-stepper .tour-step[data-step="mytour"]');
        } else {
            const acc = document.querySelector('.tour-acc[data-acc="mytour"]');
            if (acc && !acc.classList.contains('open')) await clickEl('.tour-acc[data-acc="mytour"] .acc-head');
        }
        await resolveEl('#btn-optimize', 1500);
        await sleep(500);
    },
    async closeQr() {
        const d = document.getElementById('qr-share-dialog');
        if (d?.open) d.close();
        await sleep(400);
    },
    // Von Luftlinie auf die echte Straßenroute umschalten (OSRM). Zustimmung für
    // die Vorführung setzen und danach wieder auf den alten Stand bringen.
    async showRoadRoute() {
        if (priorConsent === undefined) {
            try { priorConsent = localStorage.getItem(ROUTING_CONSENT_KEY); } catch { priorConsent = null; }
        }
        try { localStorage.setItem(ROUTING_CONSENT_KEY, 'yes'); } catch { /* egal */ }
        // Umschalten Luftlinie -> Straße (mapFocus ist bereits aktiv). Der richtige
        // Knopf dafür ist die Leiste ÜBER der Karte (#btn-route-mode): Sie ist im
        // Kartenfokus auf Desktop wie Handy sichtbar. Der #btn-route-focus im
        // Tour-Blatt verschwindet dagegen auf dem Handy, sobald die Karte in den
        // Vordergrund rückt – dann bliebe es bei der Luftlinie.
        const toggled = await clickEl('#btn-route-mode');
        if (!toggled) await clickEl('#btn-route-focus');
        collapseSheetForDemo();               // Karte frei halten, Blatt bleibt unten
        await sleep(2600);                    // Straßenroute (OSRM) berechnen/zeichnen lassen
        fitTourRoute();
        await sleep(700);
    },
    // Fertige Tour als QR-Code zeigen (Barcode-Übergabe aufs Handy).
    async shareTourQr() {
        await openTourTab();
        expandSheetForDemo();
        await sleep(300);
        // Der QR-Knopf sitzt im Schritt „Meine Tour"; im Desktop-Fokus ist der
        // sonst ausgeblendet – erst aktivieren, dann übergeben.
        await HELPERS.showMyTour();
        const btn = await resolveEl('#btn-tour-qr', 2500);
        if (!btn || btn.disabled) throw new Error('Die Tour ist noch nicht für die QR-Übergabe bereit.');
        await clickEl('#btn-tour-qr');
        if (!await resolveEl('#qr-share-dialog[open]', 4000)) {
            throw new Error('Der QR-Code konnte nicht sichtbar geöffnet werden.');
        }
        await sleep(700);
    },
    // ---- Tresor: PIN wirklich eingeben und Wiederherstellungscode zeigen ----
    async typePinDemo() {
        await fillNoFocus('#setup-pin', '2468');
        await sleep(400);
        await fillNoFocus('#setup-pin2', '2468');
        await sleep(400);
    },
    async submitVaultSetup() {
        // Nur wirklich anlegen, wenn noch KEIN Tresor existiert – sonst würde ein
        // bestehender (echter) Tresor überschrieben. Bei vorhandenem Tresor wird
        // nur die Eingabe-UI gezeigt, ohne etwas anzulegen.
        if (vaultEnabled()) {
            moveOverlaysInto(document.body);
            showRecoveryCodeForDemo();
            await resolveEl('#recovery-code', 3000);
            await sleep(600);
            return;
        }
        await clickEl('#vault-setup-form button[type="submit"]', { keepOverlaysOutside: true });
        if (await resolveEl('#recovery-code', 12000)) demoVaultCreated = true;
        await sleep(600);
    },
    async finishVaultDemo() {
        const done = document.querySelector('#vault-dialog .vault-done');
        if (done) { await clickEl('#vault-dialog .vault-done'); }
        else { const d = document.getElementById('vault-dialog'); if (d?.open) d.close(); }
        await sleep(400);
    },
    async openReceive() {
        // Empfangs-Dialog öffnen (Datei-Schritt; Kamera startet hier noch nicht).
        // Auf dem Handy liegt der Button in der eingeklappten Daten-Ansicht und
        // ist für den Geister-Cursor nicht sichtbar erreichbar – dann direkt öffnen.
        const btn = await resolveEl('#btn-safe-receive', 1000);
        if (btn) await clickEl('#btn-safe-receive');
        else (document.getElementById('btn-safe-receive') || document.getElementById('btn-safe-receive-ob'))?.click();
        await resolveEl('#safe-receive-dialog[open]', 3000);
        await sleep(500);
    },
    async showReceiveKeyStep() {
        // Schritt 2 zeigen: Scanner-Bereich + manuelles Schlüsselfeld (ohne Kamera).
        showKeyStepForDemo();
        await sleep(800);
    },
    async typeReceiveKeyDemo() {
        // Den Eintipp-Fallback sichtbar aufklappen und einen Demo-Schlüssel
        // tippen – ohne „Entschlüsseln" zu drücken (es gibt ja keine Datei).
        const details = document.querySelector('#safe-step-key details.safe-fallback');
        if (details && !details.open) {
            await clickEl('#safe-step-key details.safe-fallback summary');
            await sleep(500);
        }
        await typeInto('#safe-key-input', 'TFK1:DEMO-SCHLÜSSEL');
        await sleep(700);
    },
    async closeReceive() {
        const d = document.getElementById('safe-receive-dialog');
        if (d?.open) d.close();
        const input = document.getElementById('safe-key-input');
        if (input) input.value = '';
        await sleep(400);
    },
    async openVaultSetup() {
        demoVaultCreated = false;
        // Setup-Formular garantiert öffnen (unabhängig von Tresor-Status/Topbar) –
        // sonst wäre das PIN-Modal in der Demo evtl. nicht sichtbar. Angelegt wird
        // erst beim Absenden, und nur wenn noch kein Tresor existiert.
        openSetupDialog();
        await resolveEl('#setup-pin', 3000);
        await sleep(500);
    },
    async closeVaultSetup() {
        const d = document.getElementById('vault-dialog');
        if (d?.open) d.close();
        await sleep(400);
    },
    // ---- Story 4: Simulation ----
    async gotoGebiete() {
        await clickEl('.mode-btn[data-mode="gebietsplanung"]');
        await sleep(300);
        await clickEl('.tab-button[data-tab="gebiete"]');
        await resolveEl('#btn-cockpit', 3000);
        await sleep(300);
    },
    async openCockpit() {
        await clickEl('#btn-cockpit');
        await resolveEl('#cockpit-dialog[open]', 3000);
        // Die Simulation ist standardmäßig eingeklappt (Analyse zuerst) – für die
        // Vorführung aufklappen, damit die Zuweisung sichtbar bedient wird.
        const sim = document.getElementById('simulation-panel');
        if (sim && !sim.open) sim.open = true;
        await sleep(600);
    },
    async simAssign() {
        // Alle sichtbaren Gebiete wählen und auf einen Zielbezirk umbuchen
        await clickEl('#sim-select-all');
        await sleep(500);
        const rep = await moveToEl('#sim-rep');
        if (rep && rep.options.length) {
            rep.value = rep.options[Math.min(1, rep.options.length - 1)].value;
            rep.dispatchEvent(new Event('change', { bubbles: true }));
        }
        await sleep(400);
        await clickEl('#sim-apply');
        await sleep(700);
    },
    async simToMap() {
        await clickEl('#cockpit-to-map');
        await resolveEl('#simulation-map-bar:not([hidden])', 3000);
        await sleep(700);
    },
    async simCycleViews() {
        for (const v of ['old', 'new', 'changes']) {
            await clickEl(`[data-simulation-view="${v}"]`);
            await sleep(1100);
        }
    },
    async simDiscard() {
        // window.confirm ist während patchConfirm auf „true" gesetzt
        await clickEl('#simulation-map-discard');
        await sleep(600);
    },
    // ---- Story 5: Chancen & Kundenbriefing ----
    async chancenOn() {
        await clickEl('.seg[data-view="chancen"]');
        await sleep(700);
    },
    async openCustomerBriefing() {
        const stopId = state.tour.stops[0];
        const customer = state.customers.find((item) => item.id === stopId)
            || scopedWithCoords().find((item) => item.id !== state.tour.start?.customerId);
        if (!customer) throw new Error('Kein geeigneter Kunde für die Briefing-Demo gefunden.');

        showMapView();
        await sleep(isMobileView() ? 700 : 350);
        flyToCustomer(customer, true);
        await sleep(1600);

        const selector = `[data-action="customer-briefing"][data-id="${CSS.escape(String(customer.id))}"]`;
        const openedByClick = await clickEl(selector);
        if (!openedByClick) openBriefingDialog(customer);
        const briefing = document.getElementById('customer-briefing-dialog');
        if (!briefing?.open) throw new Error('Das Kundenbriefing konnte nicht geöffnet werden.');
        await sleep(500);
    },
    async closeCustomerBriefing() {
        moveOverlaysInto(document.body);
        const briefing = document.getElementById('customer-briefing-dialog');
        if (briefing?.open) briefing.close();
        await sleep(400);
    },
    // ---- Lasso: die Geste vorführen ----
    // Der Wow-Moment darf nicht nur im Werbefilm existieren. Hier wird er
    // wirklich gezogen: echte Zeigerereignisse auf dem Kartencontainer, der
    // Geister-Cursor läuft mit. Was der Zuschauer sieht, ist exakt das, was
    // sein eigener Finger gleich auslöst.
    async drawLasso() {
        showMapView();
        await sleep(isMobileView() ? 800 : 400);
        const container = document.getElementById('map');
        if (!container) throw new Error('Die Karte ist nicht verfügbar.');
        if (document.getElementById('btn-lasso')?.hidden) {
            throw new Error('Das Lasso steht ohne verortete Kunden nicht zur Verfügung.');
        }
        await clickEl('#btn-lasso');
        await sleep(600);

        // Die Fläche wird um die Mitte der Karte gezogen – dort liegen nach
        // „Alle Kunden zeigen" die meisten Marker.
        const rect = container.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const radius = Math.max(70, Math.min(rect.width, rect.height) * 0.28);
        const ring = [];
        for (let i = 0; i <= 28; i++) {
            const angle = (i / 28) * Math.PI * 2 - Math.PI / 2;
            // Leicht unrunde Form: Ein perfekter Kreis sieht aus wie ein
            // Werkzeug, eine krumme Schleife wie eine Hand.
            const wobble = 1 + Math.sin(angle * 3) * 0.12;
            ring.push({ x: cx + Math.cos(angle) * radius * wobble, y: cy + Math.sin(angle) * radius * wobble * 0.85 });
        }

        const fire = (type, point) => container.dispatchEvent(new PointerEvent(type, {
            pointerId: 991, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1,
            clientX: point.x, clientY: point.y, bubbles: true, cancelable: true
        }));

        await moveTo(ring[0].x, ring[0].y);
        fire('pointerdown', ring[0]);
        for (const point of ring.slice(1)) {
            guard();
            snapCursor(point.x, point.y);
            fire('pointermove', point);
            await sleep(prefersReduced ? 8 : 34);
        }
        fire('pointerup', ring[ring.length - 1]);
        await sleep(900);

        if (!document.querySelector('.popup-lasso')) throw new Error('Die Lasso-Auswahl ist nicht zustande gekommen.');
    },
    async openLassoBriefing() {
        // Mit Beispielkunden bietet der Streifen bewusst kein „Briefing
        // erstellen" an – genau dieselbe Sperre wie beim Kundenbriefing. Die
        // Vorführung geht den Weg trotzdem zu Ende und zeigt die geschützte
        // Vorschau, statt vor der Sperre abzubrechen.
        const opened = await clickEl('#btn-lasso-brief');
        if (!opened) openAreaBriefingDialog(lassoSelection(), areaLabelFor({ mode: 'lasso' }));
        const dialog = document.getElementById('area-briefing-dialog');
        if (!dialog?.open) throw new Error('Das Gebiets-Briefing konnte nicht geöffnet werden.');
        await sleep(500);
    },
    async closeLassoBriefing() {
        moveOverlaysInto(document.body);
        const dialog = document.getElementById('area-briefing-dialog');
        if (dialog?.open) dialog.close();
        clearLassoSelection();
        await sleep(400);
    },
    async checkVisit() {
        const id = state.tour.stops[0];
        const c = id && state.customers.find((x) => x.id === id);
        if (c) visitRestore = { id: c.id, besuche: [...(c.besuche || [])] };
        const btn = await resolveEl('#tour-stops .stop-visit', 2500);
        if (btn) await clickEl('#tour-stops .stop-visit');
        await sleep(500);
    }
};

// ---- Schritt-Ausführung ----
async function runStep(step) {
    if (step.t !== 'say') hideBubble();
    switch (step.t) {
        case 'say': await say(step.text, step.sel, step.pos); await sleep(step.ms ?? 1800); break;
        case 'move': if (!await moveToEl(step.sel)) throw new Error('Demo-Ziel nicht sichtbar.'); break;
        case 'click': if (!await clickEl(step.sel)) throw new Error('Demo-Aktion nicht erreichbar.'); break;
        case 'type': if (!await typeInto(step.sel, step.text)) throw new Error('Demo-Eingabe nicht erreichbar.'); break;
        case 'select': if (!await selectValue(step.sel, step.value)) throw new Error('Demo-Auswahl nicht erreichbar.'); break;
        case 'wait': await sleep(step.ms ?? 800); break;
        case 'waitFor': if (!await resolveEl(step.sel, step.ms ?? 4000)) throw new Error('Demo-Ergebnis nicht sichtbar.'); break;
        case 'run': {
            const helper = HELPERS[step.key];
            if (!helper) throw new Error('Demo-Schritt ist nicht definiert.');
            await helper();
            break;
        }
        default: break;
    }
}

// ---- Chrome (Shield + Toolbar) ----
function showChrome(story) {
    shieldEl = document.createElement('div');
    shieldEl.className = 'sc-shield';
    toolbarEl = document.createElement('div');
    toolbarEl.className = 'sc-toolbar';
    toolbarEl.innerHTML = `<span class="sc-story-label">${story.icon} <b>${story.title}</b></span>
        <span class="sc-progress"></span>
        <button type="button" class="sc-cancel">Beenden</button>`;
    document.body.append(shieldEl, toolbarEl);
    // Während einer Vorführung ruht die schwebende „nächster Schritt"-Hilfe –
    // sie würde sonst über der Karte mitlaufen und die Demo überlagern.
    document.body.classList.add('sc-running');
    toolbarEl.querySelector('.sc-cancel').addEventListener('click', abortNow);
    cursorEl.hidden = false;
    placeCursor(window.innerWidth / 2, window.innerHeight / 2);
}
function setProgress(i, n) {
    const el = toolbarEl?.querySelector('.sc-progress');
    if (el) el.textContent = `${Math.min(i + 1, n)} / ${n}`;
}
function cleanup(story) {
    hideBubble();
    // Overlays zurück in den Body holen (falls sie in einem Dialog hingen)
    if (cursorEl) { document.body.append(cursorEl, bubbleEl); cursorEl.hidden = true; cursorEl.classList.remove('sc-click', 'sc-press'); }
    shieldEl?.remove(); shieldEl = null;
    toolbarEl?.remove(); toolbarEl = null;
    document.body.classList.remove('sc-running');

    // Simulation gefahrlos verwerfen (auch bei Abbruch) – confirm dabei bejahen
    const savedConfirm = window.confirm;
    window.confirm = () => true;
    try {
        const bar = document.getElementById('simulation-map-bar');
        if (bar && !bar.hidden) document.getElementById('simulation-map-discard')?.click();
        const cockpit = document.getElementById('cockpit-dialog');
        if (cockpit?.open) { document.getElementById('sim-reset')?.click(); cockpit.close(); }
    } finally {
        window.confirm = origConfirm ?? savedConfirm;
        origConfirm = null;
    }

    // Weitere Overlays schließen
    // Einfüge-Vorführung: Feld leeren, Bestätigung zurücknehmen (auch bei Abbruch)
    restorePasteDemoConsent();
    const pasteDialog = document.getElementById('paste-dialog');
    if (pasteDialog?.open) pasteDialog.close();
    const ownData = document.getElementById('own-data-dialog');
    if (ownData?.open) ownData.close();
    const qr = document.getElementById('qr-share-dialog');
    if (qr?.open) qr.close();
    const recv = document.getElementById('safe-receive-dialog');
    if (recv?.open) recv.close();
    const briefing = document.getElementById('customer-briefing-dialog');
    if (briefing?.open) briefing.close();
    // Lasso: Auch bei Abbruch mitten im Zug darf weder der Zeichenmodus noch
    // eine Auswahl zurückbleiben – sonst ist die Karte danach „kaputt".
    const areaBriefing = document.getElementById('area-briefing-dialog');
    if (areaBriefing?.open) areaBriefing.close();
    setLassoActive(false);
    clearLassoSelection();
    const vd = document.getElementById('vault-dialog');
    if (vd?.open) vd.close();
    const mp = document.getElementById('mobile-preview');
    if (mp && !mp.hidden) document.getElementById('btn-mobile-preview')?.click();

    // Chancen-Fokus zurücksetzen
    if (state.ui.opportunityOnly) { state.ui.opportunityOnly = false; emit('customers:changed'); }

    // „Heute besucht" der Vorführung zurücknehmen
    if (visitRestore) {
        const c = state.customers.find((x) => x.id === visitRestore.id);
        if (c) { c.besuche = visitRestore.besuche; markDirty(); }
        visitRestore = null;
    }

    // Tour-Zustand wiederherstellen
    if (story?.mutatesTour && tourSnapshot) {
        Object.keys(state.tour).forEach((k) => delete state.tour[k]);
        Object.assign(state.tour, tourSnapshot);
        emit('tour:scope-changed');
        emit('tour:changed');
    }
    tourSnapshot = null;
    showcaseTourPlan = null;

    // Routing-Zustimmung auf den Stand vor der Demo zurücksetzen.
    if (priorConsent !== undefined) {
        try {
            if (priorConsent === null) localStorage.removeItem(ROUTING_CONSENT_KEY);
            else localStorage.setItem(ROUTING_CONSENT_KEY, priorConsent);
        } catch { /* egal */ }
        priorConsent = undefined;
    }

    // Nur einen von DIESER Demo angelegten Tresor wieder abbauen – ein bereits
    // vorhandener (echter) Tresor bleibt unangetastet.
    if (story?.mutatesVault && demoVaultCreated && vaultEnabled()) {
        removeVaultMeta();
        saveDataset(datasetSnapshot()); // wieder im Klartext speichern (kein await nötig)
    }
    demoVaultCreated = false;

    // Blatt-Höhe (Handy) auf den Nutzerzustand zurücksetzen und Kartenausschnitt
    // auf die definierte Ausgangslage bringen (nicht dort stehen bleiben, wo die
    // Vorführung geendet hat).
    restoreSheetAfterDemo();
    // Ansichtstiefe und Arbeitsfokus auf den Stand vor der Demo zurück.
    if (priorDepth) { applyDepth(priorDepth, false); priorDepth = null; }
    if (priorMode) { applyMode(priorMode, false); priorMode = null; }
    resetView();
}

// Definierte Ausgangslage des Kartenausschnitts: Popups zu, Gesamtübersicht.
// So beginnt und endet jede Vorführung gleich – „so wie man startet".
function resetView() {
    closeMapPopups();
    // Sicherheitsnetz: Falls ein Schritt das Fenster doch verschoben hat, die
    // feste App wieder ganz nach oben holen – sonst bleibt die Kopfleiste nach
    // der Demo teilweise aus dem Bild geschoben.
    if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
    if (state.customers.length > 0) fitToCustomers();
}

// ---- Ablauf ----
async function play(story) {
    if (running) return;
    running = true;
    aborted = false;
    let completed = false;
    let failure = null;
    ensureDom();
    showcaseTourPlan = null;
    captureSheetForDemo();
    if (story.mutatesTour) {
        tourSnapshot = JSON.parse(JSON.stringify(state.tour));
        Object.assign(state.tour, prepareShowcaseTour(state.tour));
        emit('tour:scope-changed');
        emit('tour:changed');
    }
    if (story.patchConfirm) { origConfirm = window.confirm; window.confirm = () => true; }
    showChrome(story);
    // Vorführungen laufen im Profi-Modus, damit alle Funktionen zeigbar sind.
    priorDepth = state.ui.depth;
    priorMode = state.ui.mode;
    applyDepth('profi', false);
    resetView();
    const startedAt = Date.now();
    try {
        const isDesktop = !isPhoneUi();
        const steps = visibleStorySteps(story, { isDesktop });
        for (let i = 0; i < steps.length; i++) {
            guard();
            setProgress(i, steps.length);
            try {
                await runStep(steps[i]);
            } catch (error) {
                if (error && typeof error === 'object') {
                    error.showcaseStep = i + 1;
                    error.showcaseStepCount = steps.length;
                }
                throw error;
            }
        }
        const remainingRuntime = Math.max(0, Number(story.minRuntimeMs || 0) - (Date.now() - startedAt));
        if (remainingRuntime > 0) await sleepExact(remainingRuntime);
        markShowcaseStorySeen(story.id);
        completed = true;
    } catch (err) {
        if (!(err instanceof AbortError)) {
            failure = err;
            console.warn('Showcase-Story abgebrochen:', err);
        }
    } finally {
        cleanup(story);
        running = false;
    }
    if (completed) {
        emit('showcase:story-completed', story.id);
        showStoryCompletion(story);
    }
    else if (failure) showStoryFailure(story, failure);
}

function currentVisibleStories() {
    const isDesktop = !isPhoneUi();
    return visibleStories({ isDesktop });
}

function showShowcaseDialog() {
    if (!dialog.open) dialog.showModal();
}

function startStory(story) {
    if (!story || running) return;
    if (dialog.open) dialog.close();
    void play(story);
}

function wireOutcomeActions({ next = null, retry = null } = {}) {
    dialog.querySelector('.sc-finish')?.addEventListener('click', () => dialog.close());
    dialog.querySelector('.sc-overview')?.addEventListener('click', buildPanel);
    dialog.querySelector('.sc-next')?.addEventListener('click', () => startStory(next));
    dialog.querySelector('.sc-retry')?.addEventListener('click', () => startStory(retry));
}

function showStoryCompletion(story) {
    const stories = currentVisibleStories();
    const seen = seenShowcaseIds();
    const next = nextUnseenShowcaseStory(stories, seen, story.id);
    const allDone = allShowcaseStoriesSeen(stories, seen);
    if (allDone) markShowcaseCompleted();

    dialog.dataset.view = 'outcome';
    dialog.innerHTML = `
        <div class="sc-outcome-head">
            <div class="sc-outcome-icon" aria-hidden="true">✓</div>
            <span>Live-Demo abgeschlossen</span>
            <h2>${allDone ? 'Alle Demos angesehen' : story.title}</h2>
        </div>
        <div class="sc-outcome-body">
            <p>${allDone
                ? 'Du kennst jetzt die wichtigsten TourFuchs-Abläufe. Starte direkt mit deinen Kunden oder öffne die Demos später erneut über die Info.'
                : `Du hast gesehen: ${story.blurb}`}</p>
            ${next ? `<div class="sc-next-story">
                <span>Als Nächstes</span>
                <div><b>${next.icon} ${next.title}</b><small>${next.blurb}</small></div>
            </div>` : ''}
        </div>
        <div class="sc-outcome-actions">
            ${allDone
                ? '<button type="button" class="sc-overview">Demo-Auswahl</button><button type="button" class="primary sc-finish">TourFuchs verwenden</button>'
                : '<button type="button" class="sc-finish">Für jetzt beenden</button><button type="button" class="sc-overview">Demo-Auswahl</button><button type="button" class="primary sc-next">Nächste Demo starten</button>'}
        </div>`;
    wireOutcomeActions({ next });
    showShowcaseDialog();
}

function showStoryFailure(story, failure) {
    const step = Number(failure?.showcaseStep) || 0;
    const total = Number(failure?.showcaseStepCount) || 0;
    const reason = String(failure?.message || 'Der nächste Demo-Schritt war nicht erreichbar.');
    dialog.dataset.view = 'outcome';
    dialog.innerHTML = `
        <div class="sc-outcome-head sc-outcome-failed">
            <div class="sc-outcome-icon" aria-hidden="true">!</div>
            <span>Live-Demo unterbrochen</span>
            <h2>${story.title}</h2>
        </div>
        <div class="sc-outcome-body">
            <p>Diese Vorführung konnte nicht vollständig beendet werden. TourFuchs hat den vorherigen Zustand wiederhergestellt.</p>
            <p class="sc-failure-reason"><b>${step && total ? `Hängengeblieben bei Schritt ${step}/${total}:` : 'Grund:'}</b> ${escapeHtml(reason)}</p>
        </div>
        <div class="sc-outcome-actions">
            <button type="button" class="sc-finish">Beenden</button>
            <button type="button" class="sc-overview">Demo-Auswahl</button>
            <button type="button" class="primary sc-retry">Erneut versuchen</button>
        </div>`;
    wireOutcomeActions({ retry: story });
    showShowcaseDialog();
}

// ---- Intro-Panel ----
function buildPanel() {
    const seen = new Set(seenShowcaseIds());
    const tiles = currentVisibleStories().map((s) => `
        <button type="button" class="sc-tile" data-story="${s.id}">
            <span class="sc-tile-icon">${s.icon}</span>
            <span class="sc-tile-body"><b>${s.title}</b><span>${s.blurb}</span><small>ca. ${storyDuration(s, { isDesktop: !isPhoneUi() })} Sek.</small></span>
            ${seen.has(s.id) ? '<span class="sc-tile-seen" title="schon gesehen">✓</span>' : '<span class="sc-tile-play">▶</span>'}
        </button>`).join('');
    dialog.dataset.view = 'intro';
    dialog.innerHTML = `
        <div class="sc-panel-head">
            <div class="sc-panel-fox">🦊</div>
            <h2>Soll ich dir kurz zeigen, was ich kann?</h2>
            <p>Wähle einen Ablauf – der Cursor zeigt jeden Schritt direkt in der echten App.</p>
        </div>
        <div class="sc-tiles">${tiles}</div>
        <div class="sc-panel-foot">
            <button type="button" class="sc-later primary">Später</button>
        </div>`;
    dialog.querySelectorAll('.sc-tile').forEach((tile) => {
        tile.addEventListener('click', () => {
            const story = STORIES.find((s) => s.id === tile.dataset.story);
            startStory(story);
        });
    });
    dialog.querySelector('.sc-later').addEventListener('click', () => dialog.close());
}
function openPanel() {
    // In der Handy-Vorschau (iframe) keine Vorführungen starten.
    if (insideMobilePreview) return;
    if (!dialog) return;
    buildPanel();
    showShowcaseDialog();
}

/** Startet eine konkrete Live-Demo aus einem kontextuellen Einstieg. */
export function startShowcaseStory(storyId) {
    if (insideMobilePreview || !dialog || running) return false;
    const story = currentVisibleStories().find((item) => item.id === storyId);
    if (!story) return false;
    startStory(story);
    return true;
}

export function initShowcase() {
    dialog = document.getElementById('showcase-dialog');
    if (!dialog) return;
    ensureDom();

    // Ein Trichter statt konkurrierender Auto-Dialoge: Der Showcase öffnet nur
    // noch auf bewussten Klick – aus dem Willkommens-Panel oder der Info.
    document.getElementById('btn-showcase')?.addEventListener('click', () => {
        document.getElementById('info-dialog')?.close();
        openPanel();
    });
    ['btn-showcase-ob', 'btn-demo-welcome-demos'].forEach((id) => {
        document.getElementById(id)?.addEventListener('click', () => openPanel());
    });

    // ESC bricht eine laufende Vorführung ab (statt nur den Dialog zu schließen)
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && running) { e.preventDefault(); abortNow(); } }, true);

    // Nach bewusstem Datenlöschen zählt der Demo-Fortschritt neu.
    on('dataset:cleared', () => resetShowcaseAfterDataClear());
}
