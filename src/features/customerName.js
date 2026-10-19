/**
 * Importierte Texte sind Daten, kein HTML; die Ausgabe kodiert sie separat sicher.
 *
 * Manche Quellsysteme liefern trotzdem HTML mit: ein bereits kodiertes
 * Kaufmanns-Und („Schmitt &amp; Co.") oder ganze Auszeichnung aus CRM-Berichten
 * (`<span style="white-space: nowrap;">Ute, Sander </span>`). Entfernt werden
 * nur bekannte HTML-Tags – „Schmitt <KG>" oder „a < b" bleiben, wie sie sind.
 * Trennlinien und Listenpunkte (`<hr>`, `<li>`) trennen im CRM mehrere Werte
 * eines Felds; daraus wird „ / ".
 */
const TAG = /<\/?(?:a|b|br|div|em|font|hr|i|li|nobr|ol|p|small|span|strong|sub|sup|t[dhr]|u|ul|wbr)(?:\s[^<>]*)?\/?>/gi;
const HAS_TAG = new RegExp(TAG.source, 'i');
const ENTITIES = { nbsp: ' ', '#160': ' ', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'" };
const SEPARATOR = '\u0000';

export function cleanImportedText(value) {
    let text = String(value ?? '');
    if (HAS_TAG.test(text)) {
        text = text
            .replace(TAG, (tag) => (/^<(?:hr|li)\b/i.test(tag) ? SEPARATOR
                : /^<\/?(?:br|div|p|t[dhr])\b/i.test(tag) ? ' ' : ''))
            .replace(/&(nbsp|#160|lt|gt|quot|#39|apos);/gi, (_, name) => ENTITIES[name.toLowerCase()])
            .split(SEPARATOR)
            .map((part) => part.replace(/\s+/g, ' ').trim())
            .filter(Boolean)
            .join(' / ');
    }
    let previous;
    do {
        previous = text;
        text = text.replace(/&(?:amp|#0*38|#x0*26);/gi, '&');
    } while (text !== previous);
    return text;
}

/** Kundenname – dieselbe Bereinigung; Grundlage von ID und Tour-Schlüssel ohne Kundennummer. */
export const normalizeCustomerName = cleanImportedText;

// IDs bleiben unverändert: Touren, Szenarien und Kontaktverweise hängen daran.
const isIdKey = (key) => key === 'id' || /^[a-z][A-Za-z]*Ids?$/.test(key);

function cleanTexts(value, apply) {
    let changed = false;
    if (Array.isArray(value)) {
        value.forEach((item, index) => {
            if (typeof item === 'string') {
                const clean = cleanImportedText(item);
                if (clean !== item) { changed = true; if (apply) value[index] = clean; }
            } else if (item && typeof item === 'object') changed = cleanTexts(item, apply) || changed;
        });
        return changed;
    }
    for (const [key, item] of Object.entries(value)) {
        if (isIdKey(key)) continue;
        if (typeof item === 'string') {
            if (!item.includes('<') && !item.includes('&')) continue;
            const clean = cleanImportedText(item);
            if (clean !== item) { changed = true; if (apply) value[key] = clean; }
        } else if (item && typeof item === 'object') changed = cleanTexts(item, apply) || changed;
    }
    return changed;
}

/** Alle Texte eines Kunden an Ort und Stelle bereinigen (Name, Zusatzspalten, Kontakte …). */
export function cleanCustomerTexts(customer) {
    if (!customer || typeof customer !== 'object') return false;
    const changed = cleanTexts(customer, true);
    if (typeof customer.name !== 'string') return changed;
    const readable = readableCustomerName(customer.name);
    if (readable === customer.name) return changed;
    customer.name = readable;
    return true;
}

/** Braucht ein gespeicherter Bestand die Bereinigung? Dann wird er danach neu gespeichert. */
export function customerTextsNeedCleaning(customers) {
    return (customers || []).some((customer) => customer && typeof customer === 'object'
        && (cleanTexts(customer, false) || readableCustomerName(customer.name) !== (customer.name ?? '')));
}

/*
 * Namen ganz in Großbuchstaben (so liefern manche CRM-Berichte) lesbar
 * schreiben: „GEBR. LOEW GMBH & CO. KG" → „Gebr. Loew GmbH & Co. KG".
 * Rechtsformen und kleine Wörter nach Liste, Kürzel bis drei Buchstaben
 * („EFG", „ABB", „AG") bleiben groß, Wörter mit Ziffern („3M") unverändert.
 * Gemischt geschriebene Namen bleiben, wie sie sind. ID und Tour-Schlüssel
 * hängen am kleingeschriebenen Namen und ändern sich dadurch nicht.
 */
const WORDS = {
    GMBH: 'GmbH', MBH: 'mbH', GBR: 'GbR', KGAA: 'KGaA', 'E.K.': 'e.K.', 'E.V.': 'e.V.', 'CO.': 'Co.', CO: 'Co',
    'U.': 'u.', UND: 'und', VON: 'von', VOM: 'vom', DER: 'der', DIE: 'die', DAS: 'das', DEN: 'den', DES: 'des',
    FÜR: 'für', IM: 'im', AM: 'am', AN: 'an', IN: 'in', ZU: 'zu', ZUR: 'zur', ZUM: 'zum', BEI: 'bei', MIT: 'mit'
};
const WORDS3 = new Set(['BAU', 'HOF', 'NEU', 'ALT', 'OST', 'SÜD', 'GUT', 'BIO']);

function readableWord(part, first) {
    const known = WORDS[part];
    if (known) return first ? known[0].toUpperCase() + known.slice(1) : known;
    if (/\d|\.[^.]/.test(part)) return part;
    if (part.replace(/[^A-ZÄÖÜ]/g, '').length <= 3 && !part.endsWith('.') && !WORDS3.has(part)) return part;
    return part[0] + part.slice(1).toLocaleLowerCase('de-DE');
}

export function readableCustomerName(value) {
    const name = String(value ?? '');
    if (!/[A-ZÄÖÜ]/.test(name) || /[a-zäöüß]/.test(name)) return name;
    let first = true;
    return name.replace(/\S+/g, (token) => {
        const [, pre, core, post] = token.match(/^([^A-ZÄÖÜ0-9]*)(.*?)([^A-ZÄÖÜ0-9.]*)$/);
        if (!core) return token;
        const readable = core.split(/([-/])/).map((part) => (/[A-ZÄÖÜ0-9]/.test(part) ? readableWord(part, first) : part)).join('');
        first = false;
        return pre + readable + post;
    });
}
