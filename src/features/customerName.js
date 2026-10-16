/**
 * Importierte Texte sind Daten, kein HTML; die Ausgabe kodiert sie separat sicher.
 *
 * Manche Quellsysteme liefern trotzdem HTML mit: ein bereits kodiertes
 * Kaufmanns-Und („Schmitt &amp; Co.") oder ganze Auszeichnung aus CRM-Berichten
 * (`<span style="white-space: nowrap;">Ulrike, Sammer </span>`). Entfernt werden
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
    return customer && typeof customer === 'object' ? cleanTexts(customer, true) : false;
}

/** Braucht ein gespeicherter Bestand die Bereinigung? Dann wird er danach neu gespeichert. */
export function customerTextsNeedCleaning(customers) {
    return (customers || []).some((customer) => customer && typeof customer === 'object' && cleanTexts(customer, false));
}
