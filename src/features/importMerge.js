/**
 * Abgleich beim Reimport: Die neue Datei ist die Wahrheit für das, was sie
 * enthält – und nur dafür.
 *
 * Anlass: Im Vertrieb kommen mehrere Komplettlisten mit unterschiedlichen
 * Spalten, z. B. die Kundenstammliste (Straße, PLZ, VBEZ …) und eine
 * Zuständigkeitsliste (Kd-Nr., VK, OM, TAM, Account Manager …, aber ohne
 * Straße). Bisher ersetzte jeder Import den ganzen Kunden: Nach der
 * Zuständigkeitsliste waren Straße und adressgenaue Verortung weg, nach der
 * nächsten Stammliste die Zuständigkeiten.
 *
 * Regel je Kunde (gleicher Kunde = Kundennummer, sonst Name + PLZ):
 *   - Spalte steht in der Datei → Wert aus der Datei, auch wenn die Zelle leer
 *     ist (ein ausgetragener VK ist eine Information).
 *   - Spalte steht nicht in der Datei → bisheriger Wert bleibt.
 *   - Koordinaten bleiben, solange die Anschrift gleich ist.
 *   - Was TourFuchs selbst am Kunden pflegt (Besuche, gesetzte Pins …), bleibt.
 *
 * Welche Kunden es gibt, entscheidet der Nutzer im Änderungsbericht: Fehlende
 * Kunden entfernen (neue Fassung derselben Liste) oder behalten (eine zweite
 * Liste ergänzt). Reine Logik, ohne DOM.
 */
import { customerKey } from './datasetDiff.js';
import { isColumnPromotor, promotorColumns } from './promotorColumns.js';
import { revenueYearHeaders, revenueYearOfHeader } from './revenueYears.js';
import { revenueKindOf, revenueKindOfHeader, revenueTerm } from './revenueTerm.js';

/** Einfache Felder: Zuordnungsschlüssel = Eigenschaft am Kunden. */
const SIMPLE_FIELDS = [
    { key: 'strasse', label: 'Straße' },
    { key: 'ort', label: 'Ort' },
    { key: 'vb', label: 'Vertriebsbeauftragter' },
    { key: 'channel', label: 'Vertriebschannel' },
    { key: 'gruppe', label: 'Vertriebsgruppe' },
    { key: 'bezirk', label: 'Vertriebsbezirk' },
    { key: 'kundentyp', label: 'Kundentyp' },
    { key: 'umsatz', label: 'Umsatz' },
    { key: 'rhythmusWochen', label: 'Besuchsrhythmus' }
];

/** Kontakte kommen als Gruppe: eine dieser Spalten genügt, und die Datei führt. */
const CONTACT_MAPPING_KEYS = ['ansprechpartner', 'telefon', 'email', 'kontaktPrimaer', 'weitereKontakte'];
const CONTACT_PROPS = ['ansprechpartner', 'telefon', 'email', 'contacts', 'primaryContactId'];

/** Eigenschaften, die der Import selbst setzt – alles andere pflegt TourFuchs. */
const FILE_PROPS = new Set([
    'id', 'nummer', 'name', 'plz', 'lat', 'lng', 'geo', 'extra', 'besuche', 'umsatzJahre', 'umsatzArt',
    ...SIMPLE_FIELDS.map((field) => field.key), ...CONTACT_PROPS
]);

const text = (value) => String(value ?? '').trim();
const filled = (value) => value !== null && value !== undefined && text(value) !== '';
const norm = (value) => text(value).toLowerCase().replace(/\s+/g, ' ');

function sameAddress(a, b) {
    return norm(a.strasse) === norm(b.strasse) && norm(a.plz) === norm(b.plz) && norm(a.ort) === norm(b.ort);
}

function byKey(customers) {
    const map = new Map();
    for (const customer of customers) {
        const key = customerKey(customer);
        if (!map.has(key)) map.set(key, customer);
    }
    return map;
}

const contactIdentity = (contact) => [contact?.name, contact?.telefon, contact?.email, contact?.art || 'kunde']
    .map((value) => norm(value)).join('|');

function hasContacts(customer) {
    return CONTACT_PROPS.some((prop) => (prop === 'contacts' ? customer.contacts?.length > 0 : filled(customer[prop])));
}

/**
 * Welche Angaben des Bestands kennt die neue Datei nicht? Sie bleiben beim
 * Abgleich erhalten – und sind zugleich das Zeichen, dass die Datei eine
 * zweite, ergänzende Liste ist.
 *
 * @returns {string[]} sprechende Spaltennamen, z. B. ['Straße', 'VK', 'OM']
 */
export function columnsNotInFile(previous = [], { mapping = {}, headers = [] } = {}) {
    const fileHeaders = new Set(headers);
    const missing = [];
    for (const { key, label } of SIMPLE_FIELDS) {
        if (!mapping[key] && previous.some((customer) => filled(customer[key]))) missing.push(key === 'umsatz' ? revenueTerm(revenueKindOf(previous)).name : label);
    }
    if (!CONTACT_MAPPING_KEYS.some((key) => mapping[key]) && previous.some(hasContacts)) missing.push('Ansprechpartner');
    const extraHeaders = new Set();
    for (const customer of previous) {
        for (const [header, value] of Object.entries(customer.extra || {})) {
            if (!fileHeaders.has(header) && filled(value)) extraHeaders.add(header);
        }
    }
    return [...missing, ...[...extraHeaders].sort((a, b) => a.localeCompare(b, 'de'))];
}

/**
 * Bisherige Angaben, die die Datei nicht liefert, in die neuen Kunden
 * übernehmen. Ändert `incoming` an Ort und Stelle.
 *
 * @param {object[]} previous  bisheriger Bestand (bleibt unverändert)
 * @param {object[]} incoming  frisch eingelesene Kunden
 * @param {{ mapping: object, headers: string[], contactsFromFile?: boolean, fileProps?: string[] }} source
 *        Zuordnung und Überschriften der Datei; `contactsFromFile`/`fileProps`: Angaben, die die
 *        Datei auf anderem Weg vollständig liefert (Vertriebs-Arbeitsmappe)
 * @returns {{ matched: number, keptCoordinates: number }}
 */
export function mergeWithPrevious(previous = [], incoming = [], { mapping = {}, headers = [], contactsFromFile = false, fileProps = [] } = {}) {
    const before = byKey(previous);
    const fileHeaders = new Set(headers);
    // Vertriebs-Arbeitsmappe: Kontakte, Opportunities und Produkte kommen aus
    // ihren eigenen Blättern – die Datei führt dann auch dort.
    const fileHasContacts = contactsFromFile || CONTACT_MAPPING_KEYS.some((key) => mapping[key]);
    const ownedByFile = new Set(fileProps);
    const fileHasCoordinates = Boolean(mapping.lat && mapping.lng);
    // Führt die Datei Promotor-Spalten, gelten ihre Promotoren – auch leer.
    const fileHasPromotorColumns = promotorColumns(headers).length > 0;
    let matched = 0;
    let keptCoordinates = 0;

    for (const customer of incoming) {
        const match = before.get(customerKey(customer));
        if (!match) continue;
        matched++;

        for (const { key } of SIMPLE_FIELDS) {
            if (!mapping[key] && match[key] !== undefined) customer[key] = match[key];
        }
        // Betrag und seine Art gehören zusammen: Bleibt der bisherige Betrag,
        // bleibt auch „Auftragseingang" – sofern die Datei keine eigenen
        // Betrags- oder Jahresspalten mitbringt (Prüfbefund 25.10.2026).
        if (!mapping.umsatz && match.umsatz !== undefined && revenueYearHeaders(headers).length === 0) {
            if (match.umsatzArt) customer.umsatzArt = match.umsatzArt;
            else delete customer.umsatzArt;
        }
        const ownPromotors = fileHasPromotorColumns ? (customer.contacts || []).filter(isColumnPromotor) : [];
        if (!fileHasContacts) {
            for (const prop of CONTACT_PROPS) {
                if (match[prop] === undefined) delete customer[prop];
                else customer[prop] = prop === 'contacts' ? structuredClone(match[prop]) : match[prop];
            }
            if (fileHasPromotorColumns) {
                const contacts = [...(customer.contacts || []).filter((contact) => !isColumnPromotor(contact)), ...ownPromotors];
                if (contacts.length) customer.contacts = contacts;
                else delete customer.contacts;
            }
        } else {
            // Die Datei führt bei ihren Kontakten – Promotoren und Kontakte aus
            // einer eigenen Kontaktliste kennt sie aber gar nicht: Sie bleiben.
            // Promotoren aus Spalten gelten nur, solange die Datei keine eigenen führt.
            const kept = (match.contacts || []).filter((contact) => (contact?.kontaktliste || contact?.art === 'promotor')
                && !(fileHasPromotorColumns && isColumnPromotor(contact)));
            const known = new Set((customer.contacts || []).map(contactIdentity));
            const add = kept.filter((contact) => !known.has(contactIdentity(contact)))
                .map((contact) => ({ ...structuredClone(contact), primary: false }));
            if (add.length) customer.contacts = [...(customer.contacts || []), ...add];
        }

        // Umsatzjahre: Jahre aus der Datei gelten, ältere Jahre bleiben.
        if (match.umsatzJahre) {
            const fileYears = new Set(revenueYearHeaders(headers).map((entry) => String(entry.year)));
            const keptYears = Object.fromEntries(Object.entries(match.umsatzJahre)
                .filter(([year]) => !fileYears.has(String(year))));
            if (Object.keys(keptYears).length || !customer.umsatzJahre) {
                customer.umsatzJahre = { ...keptYears, ...(customer.umsatzJahre || {}) };
            }
        }

        // Zusatzspalten: Was die Datei als Überschrift führt, gilt – auch leer.
        const extra = {};
        for (const [header, value] of Object.entries(match.extra || {})) {
            if (!fileHeaders.has(header)) extra[header] = value;
        }
        customer.extra = { ...extra, ...(customer.extra || {}) };
        // Die Datei bringt eigene Beträge als Umsatz, aber übernommene alte
        // Spalten wie „AE GJ25" liegen noch in `extra`: Ohne ausdrückliche Art
        // machte die Altbestands-Ergänzung (state.js) daraus wieder
        // Auftragseingang (Prüfbefund 25.10.2026).
        const fileHasRevenue = Boolean(mapping.umsatz) || revenueYearHeaders(headers).length > 0;
        const oldAeColumns = Object.keys(extra).some((header) => revenueYearOfHeader(header) !== null && revenueKindOfHeader(header) === 'ae');
        if (fileHasRevenue && !customer.umsatzArt && oldAeColumns) customer.umsatzArt = 'umsatz';

        // Genaue Position behalten, solange die Anschrift dieselbe ist – sonst
        // sprängen adressgenau verortete Kunden zurück auf die PLZ-Mitte.
        const located = Number.isFinite(match.lat) && Number.isFinite(match.lng) && match.geo && match.geo !== 'none';
        if (!fileHasCoordinates && customer.lat == null && located && sameAddress(match, customer)) {
            customer.lat = match.lat;
            customer.lng = match.lng;
            customer.geo = match.geo;
            keptCoordinates++;
        }

        // Was TourFuchs selbst am Kunden führt (z. B. Herkunft eines gesetzten Pins).
        for (const [prop, value] of Object.entries(match)) {
            if (!FILE_PROPS.has(prop) && !ownedByFile.has(prop) && !prop.startsWith('_') && !(prop in customer)) customer[prop] = value;
        }
    }
    return { matched, keptCoordinates };
}

/** Kunden des Bestands, die in der neuen Datei fehlen. */
export function missingCustomers(previous = [], incoming = []) {
    const now = new Set(incoming.map(customerKey));
    return [...byKey(previous).entries()].filter(([key]) => !now.has(key)).map(([, customer]) => customer);
}

/**
 * Bestandskunden ohne Kundennummer, die die neue Datei mit Nummer führt
 * (PO 23.10.2026): Gleicher Kunde ist sonst nur, wer dieselbe Nummer hat –
 * der Kunde von früher ohne Nummer galt als „entfallen", seine Besuche gingen
 * nicht mit, und „Behalten" ließ ihn als Doppel ohne Kundennummer auf der
 * Karte stehen. Er bekommt für den Abgleich die Nummer aus der Datei, sofern
 * Name + PLZ dort genau einen Kunden treffen.
 * @returns {object[]} Bestand für den Abgleich – angepasste Kunden als Kopie
 */
export function adoptNumbers(previous = [], incoming = []) {
    const byNamePlz = new Map();
    for (const customer of incoming) {
        const key = customerKey({ name: customer?.name, plz: customer?.plz });
        // Zweimal derselbe Name an derselben PLZ: nicht raten.
        byNamePlz.set(key, byNamePlz.has(key) || !text(customer?.nummer) ? null : customer);
    }
    return previous.map((customer) => {
        if (text(customer?.nummer)) return customer;
        const match = byNamePlz.get(customerKey(customer));
        return match ? { ...customer, nummer: match.nummer } : customer;
    });
}
