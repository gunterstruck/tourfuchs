/**
 * Sicherer Umzug (Etappe 2 „Tresor"): verschlüsselter Export der Kundendaten
 * als Container-Datei plus getrennt reisender Schlüssel als QR-Code.
 *
 * Sicherheitsmodell – Kanaltrennung:
 *   • Die Container-Datei (.tfsafe) ist mit einem zufälligen 256-Bit-Schlüssel
 *     AES-256-GCM-verschlüsselt und darf beliebig transportiert werden
 *     (Mail, Cloud, USB) – ohne Schlüssel ist sie wertlos.
 *   • Der Schlüssel wandert ausschließlich per Bildschirm → Kamera (QR),
 *     niemals übers Netz und bewusst nicht als anklickbarer Link.
 * Ein Angreifer braucht BEIDES; ein Kanal allein gibt nichts preis.
 *
 * Dieses Modul ist reine, DOM-freie Logik (in Node testbar). Es nutzt
 * ausschließlich den WebCrypto-Kern aus services/crypto.js.
 */

import {
    generateDek, importDek, encryptJson, decryptJson,
    randomBytes, toB64, fromB64
} from '../services/crypto.js';

export const SAFE_MAGIC = '__tfsafe';
export const SAFE_VERSION = 1;
export const SAFE_KEY_PREFIX = 'TFK1:';   // Schlüssel-QR: TFK1:<id>:<base64key>
export const SAFE_FILE_EXT = '.tfsafe';

/** Kurze Zufalls-ID (Hex) zum Paaren von Datei und Schlüssel. */
function randomId(bytes = 6) {
    return Array.from(randomBytes(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Datensatz in einen verschlüsselten Container packen und den zugehörigen
 * Schlüssel als QR-Text zurückgeben.
 * @param {{customers:Array, serviceContracts?:Array, serviceVisits?:Array, fileName?:string, importedAt?:string, territories?:object}} dataset
 * @returns {Promise<{container:object, keyQr:string, id:string, count:number,contractCount:number,visitCount:number,territoryCount:number}>}
 */
export async function createSafeTransfer(dataset) {
    const { raw, key } = await generateDek();
    const id = randomId(6); // 12 Hex-Zeichen
    const blob = await encryptJson(key, dataset ?? {}); // { iv, ct } (Base64)
    const count = Array.isArray(dataset?.customers) ? dataset.customers.length : 0;
    const contractCount = Array.isArray(dataset?.serviceContracts) ? dataset.serviceContracts.length : 0;
    const visitCount = Array.isArray(dataset?.serviceVisits) ? dataset.serviceVisits.length : 0;
    const territoryCount = Object.keys(dataset?.territories || {}).length;
    const container = {
        [SAFE_MAGIC]: 1,
        v: SAFE_VERSION,
        alg: 'AES-256-GCM',
        id,
        createdAt: new Date().toISOString(),
        count,            // nur Metadaten (Anzahl) – kein Inhalt im Klartext
        contractCount,
        visitCount,
        territoryCount,
        iv: blob.iv,
        ct: blob.ct
    };
    const keyQr = `${SAFE_KEY_PREFIX}${id}:${toB64(raw)}`;
    return { container, keyQr, id, count, contractCount, visitCount, territoryCount };
}

/** Prüft, ob ein Objekt ein gültiger TourFuchs-Container ist. */
export function isSafeContainer(obj) {
    return Boolean(obj)
        && obj[SAFE_MAGIC] === 1
        && typeof obj.id === 'string'
        && typeof obj.iv === 'string'
        && typeof obj.ct === 'string';
}

/**
 * Container aus String (Dateiinhalt) oder Objekt lesen.
 * @returns {object|null} der Container oder null, wenn ungültig
 */
export function parseSafeContainer(input) {
    let obj = input;
    if (typeof input === 'string') {
        try { obj = JSON.parse(input); } catch { return null; }
    }
    return isSafeContainer(obj) ? obj : null;
}

/**
 * Eine gewählte Datei lesen – tolerant und mit Befund, falls es nicht klappt.
 *
 * Unterwegs (Mail, Cloud, Firmenfilter) kommt eine .tfsafe-Datei nicht immer
 * unverändert an: leer, weil die Cloud nur einen Platzhalter geliefert hat;
 * als UTF-16 neu gespeichert; mit vorangestelltem Text; Base64-verpackt; oder
 * ganz ersetzt durch die Hinweisseite eines Filters. Was sich retten lässt,
 * wird gerettet – sonst sagt der Befund, was mit der Datei los ist, statt nur
 * „ungültig".
 *
 * @param {ArrayBuffer|Uint8Array} input  Dateiinhalt
 * @returns {{container:object}|{problem:'empty'|'zip'|'pdf'|'html'|'binary'|'truncated'|'foreign'}}
 */
export function readSafeFile(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || new ArrayBuffer(0));
    if (bytes.length === 0) return { problem: 'empty' };
    const text = decodeText(bytes).trim();
    if (!text) return { problem: 'empty' };
    for (const candidate of containerCandidates(text)) {
        const container = parseSafeContainer(candidate);
        if (container) return { container };
    }
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) return { problem: 'zip' };
    if (text.startsWith('%PDF')) return { problem: 'pdf' };
    if (/^<(!doctype|html|\?xml|head|body|div|p\b|meta)/i.test(text)) return { problem: 'html' };
    if (text.includes(SAFE_MAGIC)) return { problem: 'truncated' };
    if (looksBinary(bytes)) return { problem: 'binary' };
    return { problem: 'foreign' };
}

function decodeText(bytes) {
    const le = bytes[0] === 0xff && bytes[1] === 0xfe;
    const be = bytes[0] === 0xfe && bytes[1] === 0xff;
    // UTF-16 ohne BOM: jedes zweite Byte ist bei JSON-Text eine Null.
    const zeros = bytes.length > 8 && bytes[1] === 0 && bytes[3] === 0 && bytes[5] === 0;
    const encoding = be ? 'utf-16be' : (le || zeros) ? 'utf-16le' : 'utf-8';
    try { return new TextDecoder(encoding).decode(bytes); } catch { return ''; }
}

function* containerCandidates(text) {
    yield text;
    // Text davor oder danach (Signatur, Hinweiszeile): den JSON-Kern herausschneiden.
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start > 0 || (end >= 0 && end < text.length - 1)) {
        if (start >= 0 && end > start) yield text.slice(start, end + 1);
    }
    // Base64-verpackt (manche Mail- oder Cloudwege)
    const compact = text.replace(/\s+/g, '');
    if (compact.length >= 16 && /^[A-Za-z0-9+/_-]+={0,2}$/.test(compact)) {
        try {
            const decoded = new TextDecoder().decode(fromB64(compact.replace(/-/g, '+').replace(/_/g, '/')));
            if (decoded.trim().startsWith('{')) yield decoded.trim();
        } catch { /* kein Base64 */ }
    }
}

function looksBinary(bytes) {
    const sample = bytes.subarray(0, 512);
    let control = 0;
    for (const b of sample) if (b === 0 || (b < 9) || (b > 13 && b < 32)) control += 1;
    return control > sample.length * 0.05;
}

/**
 * Schlüssel-QR „TFK1:<id>:<base64key>" zerlegen.
 * @returns {{id:string, keyB64:string}|null}
 */
export function parseKeyQr(text) {
    const raw = String(text ?? '').trim();
    if (!raw.startsWith(SAFE_KEY_PREFIX)) return null;
    const rest = raw.slice(SAFE_KEY_PREFIX.length);
    const idx = rest.indexOf(':');
    if (idx <= 0) return null;
    const id = rest.slice(0, idx);
    const keyB64 = rest.slice(idx + 1);
    if (!id || !keyB64) return null;
    return { id, keyB64 };
}

/** Gehört der Schlüssel zu genau diesem Container? (ID-Abgleich) */
export function keyMatchesContainer(container, parsedKey) {
    return Boolean(container) && Boolean(parsedKey) && container.id === parsedKey.id;
}

/**
 * Container mit dem Base64-Schlüssel entschlüsseln.
 * @returns {Promise<object>} der Datensatz
 * @throws bei falschem Schlüssel oder Manipulation (GCM-Tag) sowie ungültigem Container
 */
export async function decryptSafeTransfer(container, keyB64) {
    const c = parseSafeContainer(container);
    if (!c) throw new Error('kein-gueltiger-container');
    const key = await importDek(fromB64(keyB64));
    // decryptJson wirft bei falschem Schlüssel/Manipulation.
    return decryptJson(key, { iv: c.iv, ct: c.ct });
}
