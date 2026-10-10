/**
 * Vertriebs-Arbeitsmappe (Release 16): eine Excel-Datei mit fünf Blättern.
 *
 *   VBEZ Übersicht     Kundenstamm – je Debitor eine Zeile, die jüngere gewinnt
 *   Dateiübersicht     Kontrollzahlen: wie viele Zeilen je Blatt erwartet werden
 *   AE je PCK          Auftragseingang je Produktklasse (PCK) und Geschäftsjahr
 *   SieSales Kontakte  Kontakte mit Einwilligung, Sperrvermerken, Funktion
 *   SieSales Opps      Opportunities mit Phase, Status, erwartetem AE
 *
 * Schlüssel des Kunden ist der Debitor. Die drei Detailblätter tragen nur die
 * IFA („IFA", „IFA Nr", „IfA"); sie hängen deshalb an allen Kunden, deren
 * Zeile in „VBEZ Übersicht" dieselbe IFA trägt.
 *
 * Alles bleibt lokal. Was an die Firmen-KI geht (Briefing), entscheidet
 * `salesBriefingLines`: Namen und Phasen, keine Beträge, keine Freitexte,
 * keine Kontakte mit Sperrvermerk. Reine Logik, ohne DOM.
 */

export const SALES_SHEETS = Object.freeze({
    main: 'VBEZ Übersicht',
    files: 'Dateiübersicht',
    products: 'AE je PCK',
    contacts: 'SieSales Kontakte',
    opps: 'SieSales Opps'
});
export const SALES_SIDE_SHEETS = [SALES_SHEETS.files, SALES_SHEETS.products, SALES_SHEETS.contacts, SALES_SHEETS.opps];

const text = (value) => String(value ?? '').trim();
const normHeader = (value) => text(value).toLowerCase().replace(/\s+/g, ' ');

/** Erkannt an den exakten Blattnamen: Hauptblatt plus mindestens ein Detailblatt. */
export function isSalesWorkbook(sheetNames = []) {
    const names = new Set(sheetNames.map(text));
    return names.has(SALES_SHEETS.main) && SALES_SIDE_SHEETS.some((name) => names.has(name));
}

/** Wert einer Zeile über die Überschrift – Groß/Klein und Umbrüche egal. */
function cell(row, ...headers) {
    if (!row) return '';
    for (const header of headers) {
        if (header in row) { const value = text(row[header]); if (value) return value; continue; }
        const wanted = normHeader(header);
        const key = Object.keys(row).find((candidate) => normHeader(candidate) === wanted);
        if (key) { const value = text(row[key]); if (value) return value; }
    }
    return '';
}

const YES = new Set(['ja', 'j', 'x', '1', 'yes', 'y', 'true', 'wahr', 'wahr.']);
const NO = new Set(['', 'nein', 'n', '0', 'no', 'false', 'falsch', '-']);
/** Kennzeichenfeld: „Ja", „X", „1", „Wahr" … sind gesetzt; alles Leere/„Nein" nicht. */
export function flag(value) {
    const v = text(value).toLowerCase();
    if (YES.has(v)) return true;
    if (NO.has(v)) return false;
    // Freitext wie „Bestätigt", „Opted out", „Gesperrt" zählt als gesetzt.
    return !/^(nicht|kein|offen|unbekannt)/.test(v);
}

/** Zahl aus deutsch oder englisch formatiertem Text; null, wenn keine. */
export function amount(value) {
    const raw = text(value).replace(/[^\d.,\-]/g, '');
    if (!raw || raw === '-') return null;
    let str = raw;
    const lastDot = str.lastIndexOf('.');
    const lastComma = str.lastIndexOf(',');
    if (lastDot !== -1 && lastComma !== -1) {
        str = lastComma > lastDot ? str.replace(/\./g, '').replace(',', '.') : str.replace(/,/g, '');
    } else if (lastComma !== -1) {
        const parts = str.split(',');
        str = parts.length > 2 || parts[1]?.length === 3 && parts[0] !== '0' ? parts.join('') : str.replace(',', '.');
    } else if (lastDot !== -1) {
        const parts = str.split('.');
        if (parts.length > 2 || (parts[1]?.length === 3 && parts[0] !== '0' && parts[0] !== '-0')) str = parts.join('');
    }
    const n = Number(str);
    return Number.isFinite(n) ? n : null;
}

/** „35 %", „35", „0,35" → 0,35 (Anteil zwischen 0 und 1). */
export function share(value) {
    const raw = text(value);
    if (!raw) return null;
    const n = amount(raw);
    if (n === null) return null;
    if (raw.includes('%') || n > 1.0001) return n / 100;
    return n;
}

/** Datum „TT.MM.JJJJ", ISO oder Excel-Seriennummer → „JJJJ-MM-TT"; sonst der Text, wie er ist. */
export function dateText(value) {
    const raw = text(value);
    if (!raw) return '';
    let m = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
    if (m) {
        const y = m[3].length === 2 ? `20${m[3]}` : m[3];
        return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    if (/^\d{5}(\.\d+)?$/.test(raw)) {
        const ms = (Math.floor(Number(raw)) - 25569) * 86400000;
        const d = new Date(ms);
        if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    return raw;
}

// ---- Hauptblatt ----

const DEBITOR = 'Debitor (Kundenmaster)';
const DEBITOR_FALLBACK = 'Debitor (VInfo)';

/** Feste Zuordnung für „VBEZ Übersicht" – kein Dialog. */
export function salesMainMapping(headers = []) {
    const has = (header) => headers.includes(header);
    const pick = (...candidates) => candidates.find(has) || null;
    const orders = headers
        .map((header) => ({ header, year: Number(header.match(/^orders\s*fy\s*(\d{2})$/i)?.[1]) }))
        .filter((entry) => entry.year)
        .sort((a, b) => b.year - a.year);
    return {
        nummer: DEBITOR,
        name: pick('Accountname', 'Company ID Name'),
        strasse: pick('Straße'),
        plz: pick('PLZ'),
        ort: pick('Stadt'),
        vb: pick('VB (Neu)'),
        channel: pick('Channel'),
        gruppe: pick('Vertriebsgruppe'),
        bezirk: pick('VBEZ (Neu)'),
        umsatz: orders[0]?.header || null
    };
}

/**
 * Debitor ergänzen (Kundenmaster, sonst VInfo) und Dubletten auflösen:
 * Kommt ein Debitor mehrfach vor, gilt die spätere Zeile.
 * @returns {{ rows: object[], replaced: number, withoutKey: number }}
 */
export function prepareMainRows(rows = []) {
    const byKey = new Map();
    let replaced = 0;
    let withoutKey = 0;
    const loose = [];
    for (const original of rows) {
        const row = { ...original };
        const debitor = cell(row, DEBITOR) || cell(row, DEBITOR_FALLBACK);
        row[DEBITOR] = debitor;
        if (!debitor) { withoutKey++; loose.push(row); continue; }
        if (byKey.has(debitor)) { replaced++; byKey.delete(debitor); }
        byKey.set(debitor, row);
    }
    return { rows: [...byKey.values(), ...loose], replaced, withoutKey };
}

/** IFA → Kunden (eine IFA kann mehrere Debitoren haben). */
export function ifaIndex(customers = []) {
    const index = new Map();
    for (const customer of customers) {
        const ifa = text(customer?.extra?.IFA);
        if (!ifa) continue;
        if (!index.has(ifa)) index.set(ifa, []);
        index.get(ifa).push(customer);
    }
    return index;
}

// ---- Kontakte ----

const INACTIVE = /inaktiv|inactive|gelöscht|geloescht|deleted|archiv/i;

export function contactFromRow(row, index = 0) {
    if (flag(cell(row, 'Löschvormerkung'))) return null;
    if (INACTIVE.test(cell(row, 'Status'))) return null;
    const name = [cell(row, 'Akademischer Titel'), cell(row, 'Vorname'), cell(row, 'Nachname')].filter(Boolean).join(' ');
    const email = cell(row, 'Email');
    const telefon = cell(row, 'Telefon');
    const mobil = cell(row, 'Mobiltelefon');
    if (!name && !email && !telefon && !mobil) return null;
    const crm = safeLink(cell(row, 'SieSales Link Kontakt', 'SieSales Link Kontakt_2'));
    const contact = {
        id: `ss-${cell(row, 'SieSales-ID') || `${cell(row, 'IFA Nr')}-${index}`}`,
        name,
        anrede: cell(row, 'Anrede'),
        abteilung: cell(row, 'Abteilung'),
        funktion: cell(row, 'Funktionsbeschreibung') || cell(row, 'Jobrolle (Eloqua)'),
        telefon,
        mobil,
        email,
        primary: false,
        quelle: 'arbeitsmappe',
        doi: flag(cell(row, 'Double Opt-In')),
        optOut: flag(cell(row, 'Opt-Out')),
        nichtAnrufen: flag(cell(row, 'Nicht anrufen')),
        sperreEmail: flag(cell(row, 'Werbesperre Email')),
        sperrePost: flag(cell(row, 'Werbesperre Post')),
        verantwortlich: cell(row, 'Kontaktverantwortlicher')
    };
    if (crm) contact.crm = crm;
    return contact;
}

// ---- Opportunities ----

const CLOSED = /geschlossen|closed|gewonnen|won\b|verloren|lost|storniert|abgebrochen|cancel/i;

export function oppFromRow(row) {
    const name = cell(row, 'Opportunityname');
    const id = cell(row, 'Opportunity-ID');
    if (!name && !id) return null;
    const opp = {
        id,
        name: name || id,
        owner: cell(row, 'Opportunityverantwortlicher'),
        amount: amount(cell(row, 'erwartete Auftragseingang')),
        phase: cell(row, 'Phase'),
        status: cell(row, 'Status'),
        prognose: cell(row, 'Prognosekategorie'),
        forecast: flag(cell(row, 'Relevant für Forecast')),
        close: dateText(cell(row, 'Schlussmonat')) || dateText(cell(row, 'Auftragseingang Datum (PM070)')),
        gj: cell(row, 'Geschäftsjahr'),
        changed: dateText(cell(row, 'Letztes Phaseänderungsdatum'))
    };
    return opp;
}

/** Offen, solange weder Status noch Prognosekategorie „geschlossen/gewonnen/verloren" sagen. */
export function isOpenOpp(opp) {
    return !CLOSED.test(`${opp?.status || ''} ${opp?.prognose || ''}`);
}

export function customerOpps(customer) {
    const all = Array.isArray(customer?.opps) ? customer.opps : [];
    const open = all.filter(isOpenOpp)
        .sort((a, b) => (Number(b.phase) || 0) - (Number(a.phase) || 0) || (b.amount || 0) - (a.amount || 0));
    const closed = all.filter((opp) => !isOpenOpp(opp));
    const openAmount = open.reduce((sum, opp) => sum + (opp.amount || 0), 0);
    return { open, closed, openAmount };
}

// ---- Produkte (AE je PCK) ----

export function productFromRow(row) {
    const pck = cell(row, 'PCK');
    const beschreibung = cell(row, 'PCK Beschreibung');
    if (!pck && !beschreibung) return null;
    return {
        pck,
        beschreibung,
        jahre: { 2024: amount(cell(row, '2024')), 2025: amount(cell(row, '2025')), 2026: amount(cell(row, '2026')) },
        summe: amount(cell(row, 'AE GJ24-26'))
    };
}

/** Produkte eines Kunden, größter Auftragseingang zuerst; gleiche PCK zusammengefasst. */
export function customerProducts(customer) {
    const merged = new Map();
    for (const product of Array.isArray(customer?.produkte) ? customer.produkte : []) {
        const key = product.pck || product.beschreibung;
        const prev = merged.get(key);
        if (!prev) { merged.set(key, { ...product, jahre: { ...product.jahre } }); continue; }
        prev.summe = (prev.summe || 0) + (product.summe || 0);
        for (const year of Object.keys(product.jahre || {})) {
            prev.jahre[year] = (prev.jahre[year] || 0) + (product.jahre[year] || 0);
        }
    }
    return [...merged.values()].sort((a, b) => (b.summe || 0) - (a.summe || 0));
}

const MIX = [
    ['SCB', 'SCB Anteil % (GJ24-26)'],
    ['SSI', 'SSI Anteil % (GJ24-26)'],
    ['Service', 'Service Anteil % (GJ24-26)'],
    ['Solution', 'Solution Anteil % (GJ24-26)'],
    ['Software', 'Software Anteil % (GJ24-26)'],
    ['nicht zugeordnet', 'not defined Anteil % (GJ24-26)']
];

/** Produktmix aus dem Hauptblatt: [{ label, share }] mit Anteil > 0, größter zuerst. */
export function productMix(customer) {
    const extra = customer?.extra || {};
    return MIX.map(([label, header]) => ({ label, share: share(cell(extra, header)) }))
        .filter((entry) => entry.share !== null && entry.share > 0.0005)
        .sort((a, b) => b.share - a.share);
}

// ---- Übergabe, CRM-Link ----

/** Nur http(s)-Links öffnen – nie „javascript:" o. Ä. aus einer Zelle. */
export function safeLink(value) {
    const raw = text(value);
    return /^https?:\/\/[^\s"'<>]+$/i.test(raw) ? raw : '';
}

export function crmLink(customer) {
    return safeLink(cell(customer?.extra, 'SieSales Link'));
}

/** „Übergabe notwendig": von wem an wen. null, wenn keine. */
export function handover(customer) {
    const extra = customer?.extra || {};
    const needed = flag(cell(extra, 'Übergabe notwendig'));
    const from = cell(extra, 'VB (Alt)');
    const to = text(customer?.vb);
    if (!needed || !from || from === to) return null;
    return { from, to, fromBezirk: cell(extra, 'VBEZ (Alt)'), toBezirk: text(customer?.bezirk) };
}

/** Übergabe-Zahlen eines Kunden für Liste und Übersicht. */
function handoverFigures(customer) {
    const { open, openAmount } = customerOpps(customer);
    const revenue = Number(customer?.umsatz);
    return {
        revenue: Number.isFinite(revenue) ? revenue : 0,
        openOpps: open.length,
        openAmount,
        contacts: (customer?.contacts || []).filter((c) => c && c.art !== 'promotor').length
    };
}

/**
 * Übergabeliste (16.5): eine Zeile je Kunde mit Übergabe, sortiert nach
 * abgebendem VB, dann übernehmendem VB, dann Umsatz. Spaltenköpfe deutsch –
 * die Datei geht an die Beteiligten.
 */
export function handoverRows(customers = []) {
    return customers
        .map((customer) => ({ customer, transfer: handover(customer) }))
        .filter(({ transfer }) => transfer)
        .map(({ customer, transfer }) => ({ customer, transfer, figures: handoverFigures(customer) }))
        .sort((a, b) => a.transfer.from.localeCompare(b.transfer.from, 'de')
            || (a.transfer.to || '').localeCompare(b.transfer.to || '', 'de')
            || b.figures.revenue - a.figures.revenue)
        .map(({ customer, transfer, figures }) => ({
            'VB (Alt)': transfer.from,
            'VB (Neu)': transfer.to,
            'VBEZ (Alt)': transfer.fromBezirk,
            'VBEZ (Neu)': transfer.toBezirk,
            'Debitor': text(customer.nummer),
            'IFA': text(customer.extra?.IFA),
            'Accountname': text(customer.name),
            'Straße': text(customer.strasse),
            'PLZ': text(customer.plz),
            'Ort': text(customer.ort),
            'Umsatz (jüngstes GJ)': figures.revenue,
            'Offene Opportunities': figures.openOpps,
            'Erwarteter AE offen': figures.openAmount,
            'Kontakte': figures.contacts,
            'SieSales Link': crmLink(customer)
        }));
}

/** Übersicht je Paar „VB alt → VB neu": Anzahl, Umsatz, offene Opportunities. */
export function handoverSummary(customers = []) {
    const pairs = new Map();
    for (const customer of customers) {
        const transfer = handover(customer);
        if (!transfer) continue;
        const key = `${transfer.from}\u0000${transfer.to}`;
        const figures = handoverFigures(customer);
        const entry = pairs.get(key) || { 'VB (Alt)': transfer.from, 'VB (Neu)': transfer.to, 'Kunden': 0, 'Umsatz (jüngstes GJ)': 0, 'Offene Opportunities': 0, 'Erwarteter AE offen': 0 };
        entry['Kunden'] += 1;
        entry['Umsatz (jüngstes GJ)'] += figures.revenue;
        entry['Offene Opportunities'] += figures.openOpps;
        entry['Erwarteter AE offen'] += figures.openAmount;
        pairs.set(key, entry);
    }
    return [...pairs.values()].sort((a, b) => a['VB (Alt)'].localeCompare(b['VB (Alt)'], 'de') || a['VB (Neu)'].localeCompare(b['VB (Neu)'], 'de'));
}

// ---- Zusammenführen ----

/**
 * Detailblätter an die Kunden hängen (verändert die Kunden).
 * @returns {{ contacts:number, opps:number, products:number, unmatched:{contacts:number, opps:number, products:number} }}
 */
export function enrichSalesCustomers(customers, sideSheets = {}) {
    const index = ifaIndex(customers);
    const stats = { contacts: 0, opps: 0, products: 0, unmatched: { contacts: 0, opps: 0, products: 0 } };
    const attach = (rows, ifaHeaders, build, prop, key) => {
        rows.forEach((row, i) => {
            const ifa = cell(row, ...ifaHeaders);
            const item = build(row, i);
            if (!item) return;
            const targets = index.get(ifa);
            if (!targets) { stats.unmatched[key]++; return; }
            stats[key]++;
            for (const customer of targets) (customer[prop] ||= []).push(item);
        });
    };
    for (const customer of customers) { delete customer.opps; delete customer.produkte; }
    attach(sideSheets[SALES_SHEETS.contacts] || [], ['IFA Nr', 'IFA'], contactFromRow, 'contacts', 'contacts');
    attach(sideSheets[SALES_SHEETS.opps] || [], ['IfA', 'IFA'], oppFromRow, 'opps', 'opps');
    attach(sideSheets[SALES_SHEETS.products] || [], ['IFA', 'IFA Nr'], productFromRow, 'produkte', 'products');
    return stats;
}

/**
 * Kontrollzahlen aus „Dateiübersicht" gegen das Gelesene.
 * @returns {string[]} Hinweise, nur bei Abweichung
 */
export function fileOverviewCheck(fileRows = [], read = {}) {
    if (!fileRows.length) return [];
    const columns = [
        ['Zeilen VBEZ Übersicht', SALES_SHEETS.main],
        ['Zeilen AE je PCK', SALES_SHEETS.products],
        ['Zeilen SieSales Kontakte', SALES_SHEETS.contacts],
        ['Zeilen SieSales Opps', SALES_SHEETS.opps]
    ];
    const notes = [];
    for (const [column, sheet] of columns) {
        const expected = fileRows.reduce((sum, row) => sum + (amount(cell(row, column)) || 0), 0);
        const actual = read[sheet] ?? 0;
        if (expected > 0 && expected !== actual) {
            notes.push(`Blatt „${sheet}": laut Dateiübersicht ${expected.toLocaleString('de-DE')} Zeilen, gelesen ${actual.toLocaleString('de-DE')}.`);
        }
    }
    return notes;
}

// ---- Filter ----

const OPEN_LABEL = 'mit offener Opportunity';
const NONE_LABEL = 'ohne offene Opportunity';

/** Filterebenen „Opportunity", „Opportunity-Phase", „Produkt (PCK)" – nur, wenn die Daten sie haben. */
export function salesDimensionDefs(customers = []) {
    const defs = [];
    if (customers.some((c) => Array.isArray(c?.opps) && c.opps.length)) {
        defs.push({ id: 'opp-offen', field: 'opp-offen', label: 'Opportunity', values: (c) => [customerOpps(c).open.length ? OPEN_LABEL : NONE_LABEL] });
        defs.push({ id: 'opp-phase', field: 'opp-phase', label: 'Opportunity-Phase', values: (c) => [...new Set(customerOpps(c).open.map((o) => (o.phase ? `Phase ${o.phase}` : '')).filter(Boolean))] });
    }
    if (customers.some((c) => handover(c))) {
        // „Welche Kunden übernehme ich?" = Übergabe „mit" + VB (neu) – „Wen gebe ich ab?" = „Übergabe von".
        defs.push({ id: 'uebergabe', field: 'uebergabe', label: 'Übergabe', values: (c) => [handover(c) ? 'mit Übergabe' : 'ohne Übergabe'] });
        defs.push({ id: 'uebergabe-von', field: 'uebergabe-von', label: 'Übergabe von (VB alt)', values: (c) => { const h = handover(c); return h ? [h.from] : []; } });
    }
    if (customers.some((c) => Array.isArray(c?.produkte) && c.produkte.length)) {
        defs.push({ id: 'produkt', field: 'produkt', label: 'Produkt (PCK)', values: (c) => [...new Set((c.produkte || []).map((p) => p.beschreibung || p.pck).filter(Boolean))] });
    }
    return defs;
}

// ---- Briefing ----

/**
 * Für das KI-Briefing: offene Opportunities mit Namen und Phase, die
 * wichtigsten Produktklassen – ohne Beträge, Wettbewerber und Freitexte.
 */
export function salesBriefingLines(customer) {
    const lines = [];
    const { open } = customerOpps(customer);
    if (open.length) {
        const items = open.slice(0, 5).map((opp) => {
            const details = [opp.phase ? `Phase ${opp.phase}` : '', opp.close ? `Abschluss ${opp.close.slice(0, 7)}` : ''].filter(Boolean).join(', ');
            return details ? `${opp.name} (${details})` : opp.name;
        });
        lines.push(`- Offene Opportunities: ${items.join('; ')}`);
    }
    const products = customerProducts(customer).slice(0, 5).map((p) => p.beschreibung || p.pck).filter(Boolean);
    if (products.length) lines.push(`- Wichtigste Produktklassen (Auftragseingang GJ24–26): ${products.join('; ')}`);
    return lines;
}
