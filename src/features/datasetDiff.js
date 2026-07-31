/**
 * „Was hat sich verändert?" – Vergleich zwischen bisherigem Kundenbestand und
 * neu eingelesener Liste.
 *
 * Der Reimport ist der häufigste wiederkehrende Vorgang: einmal im Monat kommt
 * eine frische Liste aus SAP/CRM. Bisher war er nur eine Warnung („ersetzt den
 * Bestand") – also gefühlt ein Risiko. Derselbe Vorgang beantwortet aber die
 * Frage, die im Vertrieb wirklich zählt: Wer ist neu, wer ist weg, wer hat den
 * Bezirk gewechselt, wie verschiebt sich der Umsatz?
 *
 * Zugeordnet wird nach derselben Regel wie beim Import selbst: Kundennummer,
 * sonst Name + PLZ. Reine Logik, ohne DOM – Rechenweg und Anzeige getrennt.
 */

const OHNE_BEZIRK = 'Ohne Zuordnung';

function text(value) {
    return String(value ?? '').trim();
}

function amount(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

/** Identität eines Kunden über Importe hinweg: Nummer, sonst Name + PLZ. */
export function customerKey(customer) {
    const nummer = text(customer?.nummer);
    if (nummer) return `nr:${nummer.toLowerCase()}`;
    return `np:${text(customer?.name).toLowerCase()}|${text(customer?.plz)}`;
}

function districtOf(customer) {
    return text(customer?.bezirk) || OHNE_BEZIRK;
}

function summarize(customer) {
    return {
        key: customerKey(customer),
        name: text(customer?.name),
        nummer: text(customer?.nummer),
        ort: text(customer?.ort),
        plz: text(customer?.plz),
        bezirk: districtOf(customer),
        umsatz: amount(customer?.umsatz)
    };
}

/**
 * Felder, deren Änderung der Nutzer vor dem Ersetzen sehen muss.
 *
 * Verglichen wurde bisher nur der Vertriebsbezirk. Ein Kunde, bei dem sich
 * Name, Anschrift, Kontakt, Rhythmus und Umsatz änderten, galt als
 * „unverändert" – und der Bericht meldete „Keine Unterschiede zum bisherigen
 * Bestand", unmittelbar bevor der Bestand vollständig ersetzt wurde. Genau die
 * Rückfrage, die schützen soll, gab Entwarnung.
 *
 * Der Bezirk bleibt bewusst außen vor: Er hat mit `moved` seine eigene,
 * prominentere Kategorie.
 */
const COMPARED_FIELDS = [
    { key: 'name', label: 'Name' },
    { key: 'strasse', label: 'Straße' },
    { key: 'plz', label: 'PLZ' },
    { key: 'ort', label: 'Ort' },
    { key: 'gruppe', label: 'Vertriebsgruppe' },
    { key: 'ansprechpartner', label: 'Ansprechpartner' },
    { key: 'telefon', label: 'Telefon' },
    { key: 'email', label: 'E-Mail' },
    { key: 'rhythmusWochen', label: 'Besuchsrhythmus' },
    { key: 'umsatz', label: 'Umsatz' }
];

const NUMERIC_FIELDS = new Set(['umsatz', 'rhythmusWochen']);

/** Welche der verglichenen Felder unterscheiden sich? */
function changedFields(before, after) {
    const fields = [];
    for (const { key, label } of COMPARED_FIELDS) {
        const a = NUMERIC_FIELDS.has(key) ? amount(before?.[key]) : text(before?.[key]);
        const b = NUMERIC_FIELDS.has(key) ? amount(after?.[key]) : text(after?.[key]);
        if (a !== b) fields.push({ key, label, from: a, to: b });
    }
    return fields;
}

function districtTotals(customers) {
    const totals = new Map();
    for (const customer of customers) {
        const bezirk = districtOf(customer);
        const entry = totals.get(bezirk) || { count: 0, umsatz: 0 };
        entry.count++;
        entry.umsatz += amount(customer.umsatz);
        totals.set(bezirk, entry);
    }
    return totals;
}

/**
 * @returns {{
 *   added: object[], removed: object[], moved: object[], keptCount: number,
 *   districts: object[], totals: object, hasChanges: boolean
 * }}
 */
export function diffCustomerDatasets(previous = [], incoming = []) {
    const before = new Map();
    // Bei doppelten Schlüsseln im Altbestand zählt der erste Treffer – genau wie
    // der Import selbst, der Dubletten aussortiert.
    for (const customer of previous) {
        const key = customerKey(customer);
        if (!before.has(key)) before.set(key, customer);
    }

    const added = [];
    const moved = [];
    const changed = [];
    const seen = new Set();
    let keptCount = 0;

    for (const customer of incoming) {
        const key = customerKey(customer);
        const match = before.get(key);
        if (!match || seen.has(key)) {
            added.push(summarize(customer));
            continue;
        }
        seen.add(key);
        const from = districtOf(match);
        const to = districtOf(customer);
        if (from !== to) {
            moved.push({ ...summarize(customer), from, to });
        }
        const fields = changedFields(match, customer);
        if (fields.length) {
            changed.push({ ...summarize(customer), fields });
        }
        // „Unverändert" heißt jetzt wirklich unverändert – Bezirk wie Felder.
        if (from === to && fields.length === 0) keptCount++;
    }

    const removed = [...before.entries()]
        .filter(([key]) => !seen.has(key))
        .map(([, customer]) => summarize(customer));

    const beforeTotals = districtTotals(previous);
    const afterTotals = districtTotals(incoming);
    const districts = [...new Set([...beforeTotals.keys(), ...afterTotals.keys()])]
        .map((bezirk) => {
            const b = beforeTotals.get(bezirk) || { count: 0, umsatz: 0 };
            const a = afterTotals.get(bezirk) || { count: 0, umsatz: 0 };
            return {
                bezirk,
                beforeCount: b.count,
                afterCount: a.count,
                beforeUmsatz: b.umsatz,
                afterUmsatz: a.umsatz,
                deltaCount: a.count - b.count,
                deltaUmsatz: a.umsatz - b.umsatz
            };
        })
        // Größte Bewegung zuerst; bei Gleichstand alphabetisch, damit die Liste
        // zwischen zwei Importen nicht springt.
        .sort((x, y) => Math.abs(y.deltaCount) - Math.abs(x.deltaCount)
            || Math.abs(y.deltaUmsatz) - Math.abs(x.deltaUmsatz)
            || x.bezirk.localeCompare(y.bezirk, 'de'));

    const sum = (list, field) => list.reduce((total, customer) => total + amount(customer[field]), 0);
    const totals = {
        beforeCount: previous.length,
        afterCount: incoming.length,
        beforeUmsatz: sum(previous, 'umsatz'),
        afterUmsatz: sum(incoming, 'umsatz')
    };

    return {
        added,
        removed,
        moved,
        changed,
        keptCount,
        districts,
        totals,
        hasChanges: added.length > 0 || removed.length > 0 || moved.length > 0 || changed.length > 0
    };
}

/** Eine Zeile Klartext für die Bestätigung: „12 neu · 4 entfallen · 9 Bezirkswechsel". */
export function diffHeadline(diff) {
    const parts = [];
    if (diff.added.length) parts.push(`${diff.added.length} neu`);
    if (diff.removed.length) parts.push(`${diff.removed.length} ${diff.removed.length === 1 ? 'entfällt' : 'entfallen'}`);
    if (diff.moved.length) parts.push(`${diff.moved.length} ${diff.moved.length === 1 ? 'Bezirkswechsel' : 'Bezirkswechsel'}`);
    if (diff.changed?.length) parts.push(`${diff.changed.length} geändert`);
    if (!parts.length) return 'Keine Unterschiede zum bisherigen Bestand.';
    return parts.join(' · ');
}
