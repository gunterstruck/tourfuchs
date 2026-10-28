/**
 * Harter Schnitt für Siemens (PO, 28.10.2026).
 *
 * Die Erprobung bei Siemens zieht in eine interne Version um. Ab dem
 * 30.10.2026 fragt diese – die externe – Version einmal: „Arbeitest du bei
 * Siemens?" Wer „Ja" sagt, bekommt nur noch den Weg zur internen Version
 * (Viva-Engage-Gruppe, dort steht der neue Link); die App startet für ihn
 * nicht mehr. Dort wird die verschlüsselte Team-Datei neu eingelesen,
 * geplante Touren von hier gehen bewusst nicht mit. Wer extern ist, arbeitet
 * weiter wie bisher.
 *
 * Die Antwort bleibt nur in diesem Browser; nichts wird übertragen oder
 * gezählt. Automatisierte Prüfläufe (navigator.webdriver) sehen die Frage
 * nicht, sonst hinge jeder Lauf daran. Zum Ansehen vorab:
 * `?siemens-hinweis` in der Adresse erzwingt die Frage, auch vor dem Stichtag.
 */
import { CONFIG } from '../core/config.js';
import { t } from '../core/i18n.js';
import { localStore, sessionStore } from '../core/safeStorage.js';

export const CHOICE_KEY = 'tf_siemens_choice';
export const CUTOVER = new Date(2026, 9, 30); // 30.10.2026, 00:00 Ortszeit
export const COMMUNITY_URL = 'https://engage.cloud.microsoft/main/org/siemens.com/groups/eyJfdHlwZSI6Ikdyb3VwIiwiaWQiOiIyMTA0Nzc4MTUwMjU2NjQwIn0';
const FORCE_PARAM = 'siemens-hinweis';

function readChoice(storage) {
    try {
        const value = storage?.getItem(CHOICE_KEY);
        return value === 'siemens' || value === 'extern' ? value : null;
    } catch { return null; }
}

function writeChoice(storage, value) {
    try {
        if (value) storage?.setItem(CHOICE_KEY, value);
        else storage?.removeItem(CHOICE_KEY);
    } catch { /* gesperrter Speicher: dann fragt der nächste Start erneut */ }
}

/**
 * Was beim Start zu tun ist: 'start' (App normal), 'ask' (Frage zeigen) oder
 * 'blocked' (nur der Hinweis für Siemens).
 */
export function cutoverDecision({ now = new Date(), choice = null, automated = false, forced = false } = {}) {
    if (forced) return choice === 'siemens' ? 'blocked' : choice === 'extern' ? 'start' : 'ask';
    if (automated || now < CUTOVER) return 'start';
    if (choice === 'siemens') return 'blocked';
    if (choice === 'extern') return 'start';
    return 'ask';
}

/** Alle Daten dieser Adresse im Browser löschen – die App läuft dabei nicht. */
export async function wipeLocalData({ idb = globalThis.indexedDB, storage = localStore(), session = sessionStore() } = {}) {
    let names = [CONFIG.storage.dbName];
    try {
        const listed = await idb?.databases?.();
        if (Array.isArray(listed)) names = [...new Set([...names, ...listed.map((db) => db.name).filter(Boolean)])];
    } catch { /* ältere Browser: nur die bekannte Datenbank */ }
    await Promise.all(names.map((name) => new Promise((done) => {
        try {
            const request = idb.deleteDatabase(name);
            request.onsuccess = request.onerror = request.onblocked = () => done();
        } catch { done(); }
    })));
    try { storage?.clear(); } catch { /* egal */ }
    try { session?.clear(); } catch { /* egal */ }
    // Die Antwort bleibt, sonst stünde beim nächsten Öffnen wieder die Frage da.
    writeChoice(storage, 'siemens');
}

function el(tag, attrs = {}, text) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    return node;
}

function overlay() {
    const root = el('div', { class: 'siemens-cutover', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'siemens-cutover-title' });
    const card = el('div', { class: 'siemens-cutover-card' });
    card.append(el('div', { class: 'siemens-cutover-fox', 'aria-hidden': 'true' }, '🦊'));
    root.append(card);
    document.body.append(root);
    return { root, card };
}

function askQuestion(storage) {
    return new Promise((resolve) => {
        const { root, card } = overlay();
        const yes = el('button', { type: 'button', class: 'primary', id: 'siemens-cutover-yes' }, t('cutover.yes'));
        const no = el('button', { type: 'button', id: 'siemens-cutover-no' }, t('cutover.no'));
        const actions = el('div', { class: 'siemens-cutover-actions' });
        actions.append(yes, no);
        card.append(
            el('h2', { id: 'siemens-cutover-title' }, t('cutover.question')),
            el('p', {}, t('cutover.questionLead')),
            actions,
            el('p', { class: 'muted small' }, t('cutover.private'))
        );
        const answer = (value) => {
            writeChoice(storage, value);
            root.remove();
            resolve(value);
        };
        yes.addEventListener('click', () => answer('siemens'));
        no.addEventListener('click', () => answer('extern'));
        yes.focus();
    });
}

function showNotice(storage) {
    const { card } = overlay();
    const link = el('a', { class: 'primary siemens-cutover-link', id: 'siemens-cutover-community', href: COMMUNITY_URL, target: '_blank', rel: 'noopener noreferrer' }, t('cutover.community'));
    const wipe = el('button', { type: 'button', class: 'danger', id: 'siemens-cutover-wipe' }, t('cutover.wipe'));
    const status = el('p', { class: 'siemens-cutover-status', role: 'status', 'aria-live': 'polite' });
    const undo = el('button', { type: 'button', class: 'linklike', id: 'siemens-cutover-undo' }, t('cutover.undo'));
    const actions = el('div', { class: 'siemens-cutover-actions' });
    actions.append(link, wipe);
    card.append(
        el('h2', { id: 'siemens-cutover-title' }, t('cutover.noticeTitle')),
        el('p', {}, t('cutover.noticeLead')),
        el('p', {}, t('cutover.noticeData')),
        actions,
        status,
        undo
    );
    wipe.addEventListener('click', async () => {
        if (!confirm(t('cutover.wipeConfirm'))) return;
        wipe.disabled = true;
        await wipeLocalData({ storage });
        status.textContent = t('cutover.wiped');
    });
    undo.addEventListener('click', () => {
        writeChoice(storage, null);
        location.reload();
    });
    link.focus();
}

/**
 * Vor dem Start der App aufrufen. Gibt true zurück, wenn die App nicht
 * starten soll (Siemens: nur der Hinweis steht da).
 */
export async function runSiemensCutover({ storage = localStore(), now = new Date() } = {}) {
    let forced = false;
    try { forced = new URLSearchParams(location.search).has(FORCE_PARAM); } catch { /* egal */ }
    let decision = cutoverDecision({ now, choice: readChoice(storage), automated: Boolean(navigator.webdriver), forced });
    if (decision === 'ask') decision = (await askQuestion(storage)) === 'siemens' ? 'blocked' : 'start';
    if (decision !== 'blocked') return false;
    showNotice(storage);
    return true;
}
