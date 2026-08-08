/**
 * Experiment: räumliche, semantisch zoombare Oberfläche.
 *
 * Grundlage ist `docs/experiment-raeumliche-ui-semantic-zoom.md`. Gebaut ist
 * bewusst **nicht** das Papier in voller Breite, sondern der kleine Schnitt aus
 * dessen Abschnitt 9.1: nicht eine neue Welt mit fünf bis sieben Bereichen,
 * sondern **eine** Hierarchie, und zwar die, die TourFuchs auf der Karte
 * ohnehin schon fährt – Gebiet, dann Kunde.
 *
 * Damit beantwortet der Versuch genau eine Frage:
 *
 *   > Soll sich das Bedienpanel verhalten wie die Karte?
 *
 * Trägt das nicht, braucht es die Welt nicht. Trägt es, ist der Rest eine
 * eigene Entscheidung – und dieser Prototyp hat sie billig vorbereitet.
 *
 * ## Warum eine eigene Ebene, obwohl der Schnitt klein ist
 *
 * Seit #214 bedeutet Pinch im klassischen Bedienpanel **Vergrößern**
 * (`--panel-zoom`). Abschnitt 2.1 des Papiers schließt aus, dass dieselbe
 * Fläche die Geste je nach Zusammenhang mal so und mal als Tiefenwechsel
 * deutet. Der Prototyp läuft deshalb in einem eigenen Layer hinter dem
 * versteckten Schalter: zwei getrennte Welten, zwei klare Bedeutungen.
 *
 * ## Grenzen, die hier ausdrücklich gelten
 *
 * - **Nur lesen.** Der Prototyp verändert keine Kundendaten und keine Tour.
 * - **Keine zweite Geschäftslogik.** Gruppiert wird über `state.customers`,
 *   nichts wird kopiert oder zwischengespeichert.
 * - **Keine erfundenen Zoomstufen** (Papier §7.1). Ein Kunde hat in diesem
 *   Versuch keine fachlich sinnvolle tiefere Ebene, also ist er ein Blatt.
 * - **Deterministisch** (§7.2). Die Anordnung folgt einer festen Rechnung,
 *   nicht einer Vermutung über den Nutzer.
 * - **Kein Wrap-around.** Ränder sind die stärkste Orientierungshilfe, die es
 *   gibt; die randlose Welt ist die schwächste Idee des Papiers (§9.1).
 */
import '../styles/spatial-ui.css';
import { state, on, UNASSIGNED } from '../core/state.js';

// ---------------------------------------------------------------------------
// Reine Funktionen – ohne DOM, damit sie ohne Browser prüfbar sind.
// ---------------------------------------------------------------------------

/** Fünf schnelle Tipper öffnen das Experiment. */
export const TAP_COUNT = 5;
export const TAP_WINDOW_MS = 2500;

/**
 * Schwellen der Pinch-Geste, als Verhältnis zum Abstand bei Gestenbeginn.
 *
 * Bewusst asymmetrisch und deutlich über/unter 1: Eine Geste, die schon bei
 * 5 % Abweichung auslöst, löst auch beim Zittern aus.
 */
export const PINCH_ENTER = 1.35;
export const PINCH_EXIT = 0.74;

/** Abstand zweier Punkte `{x, y}`. */
export function spread(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Mittelpunkt zweier Punkte – die räumliche Zielangabe der Geste. */
export function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Was will die Geste? `'enter'`, `'exit'` oder `null`.
 *
 * Bekommt bewusst nur Zahlen: Ob daraufhin überhaupt etwas passiert, entscheidet
 * der Aufrufer – am Mittelpunkt kann ein Blatt liegen oder gar nichts.
 */
export function pinchIntent(startSpread, currentSpread) {
    if (!(startSpread > 0) || !(currentSpread > 0)) return null;
    const ratio = currentSpread / startSpread;
    if (ratio >= PINCH_ENTER) return 'enter';
    if (ratio <= PINCH_EXIT) return 'exit';
    return null;
}

/**
 * Ist die Tipp-Folge vollständig? Prüft die letzten `count` Zeitpunkte gegen das
 * Fenster – langsame Tipper laufen aus dem Fenster heraus und zählen nicht.
 */
export function tapBurstReached(times, count = TAP_COUNT, windowMs = TAP_WINDOW_MS) {
    if (!Array.isArray(times) || times.length < count) return false;
    const relevant = times.slice(-count);
    return relevant[relevant.length - 1] - relevant[0] <= windowMs;
}

/**
 * Ebene 0 aus dem gemeinsamen State ableiten: die Gebiete, in denen Kunden
 * liegen. Aggregiert, nicht kopiert – jeder Aufruf liest `state.customers` neu.
 */
export function buildAreas(customers = []) {
    const byArea = new Map();
    for (const customer of customers) {
        if (!customer) continue;
        const key = String(customer.bezirk ?? '').trim() || UNASSIGNED;
        byArea.set(key, (byArea.get(key) || 0) + 1);
    }
    return [...byArea.entries()]
        .map(([name, count]) => ({ id: `area:${name}`, name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'de'));
}

/** Ebene 1: die Kunden eines Gebiets, in stabiler Reihenfolge. */
export function customersOfArea(customers = [], area) {
    return customers
        .filter((c) => c && (String(c.bezirk ?? '').trim() || UNASSIGNED) === area)
        .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'de'));
}

/**
 * Feste Anordnung in der Fläche: quadratisch aufgeteilt, ungerade Reihen um eine
 * halbe Spalte versetzt. Das ergibt eine Landschaft statt einer Liste, ohne dass
 * die Lage eines Elements von irgendetwas anderem abhinge als seiner Position.
 */
export function tileLayout(count) {
    if (!(count > 0)) return [];
    const columns = Math.ceil(Math.sqrt(count));
    return Array.from({ length: count }, (_, i) => {
        const row = Math.floor(i / columns);
        const column = i % columns;
        return { x: column + (row % 2 ? 0.5 : 0), y: row };
    });
}

// ---------------------------------------------------------------------------
// Oberfläche
// ---------------------------------------------------------------------------

const TILE_W = 180;
const TILE_H = 120;
const GAP = 28;

let root = null;
let plane = null;
let crumbEl = null;
let backBtn = null;
let active = false;
let path = [];              // [] = Ebene 0, ['Bezirk X'] = Ebene 1
let offset = { x: 0, y: 0 };
let unsubscribe = [];

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
));

/** Was steht auf der aktuellen Ebene? Immer frisch aus dem State. */
function currentItems() {
    const customers = state.customers || [];
    if (path.length === 0) {
        return buildAreas(customers).map((area) => ({
            id: area.id,
            title: area.name,
            sub: `${area.count} ${area.count === 1 ? 'Kunde' : 'Kunden'}`,
            zoomable: true,
            key: area.name
        }));
    }
    return customersOfArea(customers, path[0]).map((customer, i) => ({
        id: `customer:${customer.id ?? i}`,
        title: String(customer.name ?? 'ohne Namen'),
        sub: [customer.plz, customer.ort].filter(Boolean).join(' '),
        // Papier §7.1: Ein Kunde hat hier keine sinnvolle tiefere Bedeutungsebene.
        zoomable: false,
        key: null
    }));
}

function crumbText() {
    return ['TourFuchs', ...path].join(' › ');
}

function render() {
    if (!plane) return;
    const items = currentItems();
    const layout = tileLayout(items.length);

    plane.innerHTML = items.map((item, i) => {
        const pos = layout[i];
        const left = Math.round(pos.x * (TILE_W + GAP));
        const top = Math.round(pos.y * (TILE_H + GAP));
        return `<button type="button" class="sx-tile${item.zoomable ? ' sx-zoomable' : ''}"
            style="left:${left}px; top:${top}px"
            data-key="${escapeHtml(item.key ?? '')}"
            data-zoomable="${item.zoomable ? '1' : '0'}"
            aria-label="${escapeHtml(item.title)}${item.zoomable ? ', hineinzoomen' : ''}">
            <span class="sx-tile-title">${escapeHtml(item.title)}</span>
            <span class="sx-tile-sub">${escapeHtml(item.sub)}</span>
        </button>`;
    }).join('') || '<p class="sx-empty">Keine Kundendaten geladen.</p>';

    if (crumbEl) crumbEl.textContent = crumbText();
    if (backBtn) backBtn.disabled = path.length === 0;
    applyOffset();
}

function applyOffset() {
    if (plane) plane.style.transform = `translate(${Math.round(offset.x)}px, ${Math.round(offset.y)}px)`;
}

/** Genau eine Ebene hinein. Blätter tun nichts – das ist keine Sackgasse, das ist das Ende. */
function enter(key) {
    if (!key || path.length >= 1) return false;
    path = [key];
    offset = { x: 0, y: 0 };
    render();
    return true;
}

/** Genau eine Ebene zurück. Nie mehrere in einer Geste. */
function leaveOneLevel() {
    if (path.length === 0) return false;
    path = path.slice(0, -1);
    offset = { x: 0, y: 0 };
    render();
    return true;
}

/** Das Element an einem Bildschirmpunkt – über die Lage, nicht über das Ereignisziel. */
function zoomableAt(point) {
    if (!plane) return null;
    for (const tile of plane.querySelectorAll('.sx-tile[data-zoomable="1"]')) {
        const rect = tile.getBoundingClientRect();
        if (point.x >= rect.left && point.x <= rect.right
            && point.y >= rect.top && point.y <= rect.bottom) return tile.dataset.key;
    }
    return null;
}

function buildRoot() {
    const el = document.createElement('div');
    el.className = 'sx-root';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Experimentelle räumliche Oberfläche');
    el.innerHTML = `
        <header class="sx-bar">
            <span class="sx-crumb" aria-live="polite"></span>
            <span class="sx-actions">
                <button type="button" class="sx-back">↰ Eine Ebene zurück</button>
                <button type="button" class="sx-leave">Zur klassischen Oberfläche</button>
            </span>
        </header>
        <div class="sx-stage" tabindex="0" aria-label="Fläche – ziehen zum Reisen, Pfeiltasten bewegen">
            <div class="sx-plane"></div>
        </div>
        <p class="sx-note">Experiment · nur lesend · Tippen oder Aufziehen vertieft, Zusammenziehen führt zurück</p>`;
    return el;
}

function wire(el) {
    plane = el.querySelector('.sx-plane');
    crumbEl = el.querySelector('.sx-crumb');
    backBtn = el.querySelector('.sx-back');
    const stage = el.querySelector('.sx-stage');

    backBtn.addEventListener('click', leaveOneLevel);
    el.querySelector('.sx-leave').addEventListener('click', () => close());

    plane.addEventListener('click', (ev) => {
        const tile = ev.target.closest('.sx-tile');
        if (tile && tile.dataset.zoomable === '1') enter(tile.dataset.key);
    });

    // Reisen: ein Zeiger zieht die Fläche. Gilt für Maus und Finger gleichermaßen,
    // damit Pinch eine Zusatzform bleibt und kein exklusiver Zugang.
    let dragId = null;
    let from = null;
    let base = null;
    let pinching = false;
    stage.addEventListener('pointerdown', (ev) => {
        if (pinching || ev.target.closest('.sx-tile')) return;
        dragId = ev.pointerId;
        from = { x: ev.clientX, y: ev.clientY };
        base = { ...offset };
        stage.setPointerCapture?.(ev.pointerId);
    });
    stage.addEventListener('pointermove', (ev) => {
        // Ein Finger reist, zwei Finger wechseln die Ebene. Ohne diese Sperre
        // täte der erste Finger beides zugleich – Touch erzeugt auch
        // Zeigerereignisse, und die Fläche wanderte beim Zoomen mit.
        if (pinching || dragId !== ev.pointerId || !from) return;
        offset = { x: base.x + (ev.clientX - from.x), y: base.y + (ev.clientY - from.y) };
        applyOffset();
    });
    const endDrag = () => { dragId = null; from = null; };
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);

    // Pinch. Aktiviert wird bei `touchmove`, nicht bei `touchstart`: Ein
    // Touch-Ereignis trägt das Element des ersten Fingers mit sich, und wo das
    // neu gezeichnet wird, geht das Ereignis verloren. Derselbe Befund wie in
    // #214, dort am echten Browser gemessen.
    let startSpread = 0;
    let usedThisGesture = false;
    stage.addEventListener('touchmove', (ev) => {
        if (ev.touches.length !== 2) return;
        const a = { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
        const b = { x: ev.touches[1].clientX, y: ev.touches[1].clientY };
        if (!startSpread) {
            startSpread = spread(a, b);
            pinching = true;
            endDrag();
            return;
        }
        ev.preventDefault();
        if (usedThisGesture) return;
        const intent = pinchIntent(startSpread, spread(a, b));
        if (intent === 'enter') {
            // Höchstens ein Ebenenwechsel je Geste. Liegt am Mittelpunkt nichts
            // Zoombares, geschieht nichts – die Geste gilt trotzdem als
            // verbraucht, sonst löste dieselbe Bewegung gleich mehrfach aus.
            enter(zoomableAt(midpoint(a, b)));
            usedThisGesture = true;
        } else if (intent === 'exit') {
            leaveOneLevel();
            usedThisGesture = true;
        }
    }, { passive: false });
    const endPinch = (ev) => {
        if (ev.touches.length >= 2) return;
        startSpread = 0;
        usedThisGesture = false;
        pinching = false;
    };
    stage.addEventListener('touchend', endPinch);
    stage.addEventListener('touchcancel', endPinch);

    // Tastatur: alles Wesentliche ohne Geste erreichbar.
    stage.addEventListener('keydown', (ev) => {
        const step = 60;
        if (ev.key === 'Escape') { path.length ? leaveOneLevel() : close(); ev.preventDefault(); return; }
        if (ev.key === 'Backspace') { leaveOneLevel(); ev.preventDefault(); return; }
        const moves = {
            ArrowLeft: { x: step, y: 0 }, ArrowRight: { x: -step, y: 0 },
            ArrowUp: { x: 0, y: step }, ArrowDown: { x: 0, y: -step }
        };
        if (moves[ev.key]) {
            offset = { x: offset.x + moves[ev.key].x, y: offset.y + moves[ev.key].y };
            applyOffset();
            ev.preventDefault();
        }
    });
}

export function open() {
    if (active) return;
    if (!root) { root = buildRoot(); wire(root); }
    // Getrennt vom Bauen prüfen: Wer den Layer aus dem Dokument nimmt, bekommt
    // ihn beim nächsten Öffnen zurück. Sonst hielte das Modul stumm eine
    // abgelöste Instanz und zeichnete ins Leere.
    if (!root.isConnected) document.body.appendChild(root);
    active = true;
    path = [];
    offset = { x: 0, y: 0 };
    root.hidden = false;
    // Die klassische Oberfläche wird nicht abgebaut, nur aus Darstellung und
    // Bedienung genommen. Verlassen stellt sie damit ohne Neuaufbau wieder her.
    document.body.classList.add('sx-on');
    unsubscribe = [on('customers:changed', render), on('tour:changed', render)];
    render();
    root.querySelector('.sx-stage')?.focus();
}

export function close() {
    if (!active) return;
    active = false;
    if (root) root.hidden = true;
    document.body.classList.remove('sx-on');
    for (const off of unsubscribe) { try { off?.(); } catch { /* egal */ } }
    unsubscribe = [];
}

export function isOpen() {
    return active;
}

/**
 * Der versteckte Schalter: fünf schnelle Tipper auf das Markenzeichen.
 *
 * Kein Menüpunkt, keine Speicherung – die Freischaltung gilt nur für diese
 * Sitzung. Ein Experiment, das ein Neuladen überlebt, ist auf dem Weg, ein
 * Versprechen zu werden.
 */
export function initSpatialUi() {
    const brand = document.querySelector('.brand');
    if (!brand) return;
    let taps = [];
    brand.addEventListener('click', () => {
        const now = Date.now();
        taps = [...taps, now].filter((t) => now - t <= TAP_WINDOW_MS).slice(-TAP_COUNT);
        if (!tapBurstReached(taps)) return;
        taps = [];
        open();
    });
}
