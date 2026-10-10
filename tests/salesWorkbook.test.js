import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import { parseRows, readWorkbook } from '../src/services/excel.js';
import {
    SALES_SHEETS, customerOpps, customerProducts, enrichSalesCustomers, fileOverviewCheck, flag, handover,
    handoverRows, handoverSummary, isSalesWorkbook, prepareMainRows, productMix, salesBriefingLines, salesDimensionDefs, salesMainMapping, share
} from '../src/features/salesWorkbook.js';
import { mergeWithPrevious } from '../src/features/importMerge.js';
import { customerPopupHtml } from '../src/features/map.js';
import { buildCustomerBriefingPrompt } from '../src/features/customerBriefing.js';
import { MESSAGES } from '../src/i18n/messages.js';

// Struktur wie die echte Arbeitsmappe – Werte sind erfunden.
const MAIN = ['Herkunft_Gesamtdatei', 'Channel', 'Vertriebsgruppe', 'Quelldatei', 'IFA', 'Accountname', 'Land', 'PLZ', 'Stadt', 'Straße',
    'Company ID (Text)', 'Company ID Name', 'SAID', 'Debitor (Kundenmaster)', 'Debitor (VInfo)', 'SieSales Rolle Pricing Primary',
    'Übergabe notwendig', 'VBEZ (Alt)', 'VB (Alt)', 'VB E-Mail (Alt)', 'VBEZ (Neu)', 'VB (Neu)', 'VB E-Mail (Neu)',
    'Orders FY24', 'Orders FY25', 'Orders FY26', 'SCB Anteil % (GJ24-26)', 'SSI Anteil % (GJ24-26)', 'Service Anteil % (GJ24-26)',
    'Solution Anteil % (GJ24-26)', 'Software Anteil % (GJ24-26)', 'not defined Anteil % (GJ24-26)', 'Anzahl Kontakte',
    'Kontakte mit DOI', 'SieSales Link', 'Vetriebsgruppe', 'ca. Fahrstrecke ab Siemens NL (km)', 'Ø Orders FY24-26'];
const FILES = ['Gesamtdatei', 'Zeilen VBEZ Übersicht', 'Zeilen AE je PCK', 'Zeilen SieSales Kontakte', 'Zeilen SieSales Opps'];
const PRODUCTS = ['Herkunft_Gesamtdatei', 'Quelldatei', 'IFA', 'Accountname', 'VBEZ', 'PCK', 'PCK Beschreibung', '2024', '2025', '2026', 'AE GJ24-26'];
const CONTACTS = ['Herkunft_Gesamtdatei', 'Quelldatei', 'IFA Nr', 'Accountname', 'SieSales Link Kontakt', 'SieSales-ID', 'Nachname', 'Vorname',
    'Anrede', 'Akademischer Titel', 'Email', 'Telefon', 'Mobiltelefon', 'Sprache', 'Double Opt-In', 'Double Opt-In Datum', 'Opt-Out',
    'Opt-Out Datum', 'Kontaktverantwortlicher', 'Verantwortlicher Abteilung', 'Joblevel (Eloqua)', 'Jobrolle (Eloqua)', 'Abteilung',
    'Abteilungstyp', 'Management Ebene', 'Funktionsbeschreibung', 'Aufgabenbeschreibung', 'Technik-Attribute', 'Status',
    'Löschvormerkung', 'Werbesperre Post', 'Werbesperre Email', 'Nicht anrufen', 'Werbesperre Text', 'Zuletzt geändert am',
    'Erstelldatum', 'SieSales Link Kontakt_2'];
const OPPS = ['Herkunft_Gesamtdatei', 'Quelldatei', 'IfA', 'Accountname', 'Opportunity-ID', 'Opportunityname', 'Opportunityverantwortlicher',
    'Opportunityverantwortlicher: Abteilung', 'Beschreibung', 'erwartete Auftragseingang', 'Phase', 'Status', 'Gewinner',
    'Prognosekategorie', 'Relevant für Forecast', 'Auftragseingang Datum (PM070)', 'Angebotsunterbreitung', 'Rechnungsperiode',
    'Schlussmonat', 'Geschäftsjahr', 'Geschäftsart', 'Verkaufstyp', 'Strategische Priorität', 'Business Unit kurz',
    'Business Segment kurz', 'Übergeordnete Opportunity', 'Errichtungsland', 'SAP Nr.', 'Endkunde', 'Anzahl Wettbewerber',
    'Wettbewerber', 'Wettbewerbsbewertung', 'Erstellt von', 'Erstelldatum', 'Zuletzt geändert am', 'Letztes Phaseänderungsdatum'];

const row = (headers, values) => Object.fromEntries(headers.map((h) => [h, values[h] ?? '']));

const mainRows = () => [
    row(MAIN, { IFA: '000123', Accountname: 'Nord GmbH', PLZ: '50667', Stadt: 'Köln', Straße: 'Domkloster 4', 'Debitor (Kundenmaster)': '0042',
        Channel: 'Direkt', Vertriebsgruppe: 'VG 1', 'VBEZ (Neu)': 'VBEZ 11', 'VB (Neu)': 'Anna Neu', 'VB (Alt)': 'Bernd Alt', 'Übergabe notwendig': 'Ja',
        'Orders FY24': '1.000.000', 'Orders FY25': '1.100.000', 'Orders FY26': '990.000', 'Ø Orders FY24-26': '1.030.000',
        'Service Anteil % (GJ24-26)': '60%', 'Software Anteil % (GJ24-26)': '40%', 'SieSales Link': 'https://crm.example.test/account/1' }),
    // Derselbe Debitor später noch einmal: Diese Zeile gilt.
    row(MAIN, { IFA: '000123', Accountname: 'Nord GmbH & Co.', PLZ: '50667', Stadt: 'Köln', Straße: 'Domkloster 4', 'Debitor (Kundenmaster)': '0042',
        'VBEZ (Neu)': 'VBEZ 12', 'VB (Neu)': 'Anna Neu', 'VB (Alt)': 'Bernd Alt', 'Übergabe notwendig': 'Ja',
        'Orders FY24': '1.000.000', 'Orders FY25': '1.100.000', 'Orders FY26': '990.000',
        'Service Anteil % (GJ24-26)': '0,6', 'Software Anteil % (GJ24-26)': '0,4', 'SieSales Link': 'javascript:alert(1)' }),
    // Ohne Kundenmaster-Debitor: VInfo springt ein.
    row(MAIN, { IFA: '000777', Accountname: 'Süd AG', PLZ: '80331', Stadt: 'München', 'Debitor (VInfo)': '0099', 'VBEZ (Neu)': 'VBEZ 42', 'VB (Neu)': 'Ben Hof' })
];
const side = () => ({
    [SALES_SHEETS.files]: [row(FILES, { Gesamtdatei: 'A.xlsx', 'Zeilen VBEZ Übersicht': '3', 'Zeilen AE je PCK': '2', 'Zeilen SieSales Kontakte': '5', 'Zeilen SieSales Opps': '3' })],
    [SALES_SHEETS.products]: [
        row(PRODUCTS, { IFA: '000123', PCK: '0815', 'PCK Beschreibung': 'Antriebe', 2024: '100.000', 2025: '50.000', 'AE GJ24-26': '150.000' }),
        row(PRODUCTS, { IFA: '999999', PCK: '0816', 'PCK Beschreibung': 'Fremd', 'AE GJ24-26': '1' })
    ],
    [SALES_SHEETS.contacts]: [
        row(CONTACTS, { 'IFA Nr': '000123', Vorname: 'Clara', Nachname: 'Klein', Email: 'clara@nord.test', Telefon: '0221 111', Abteilung: 'Einkauf', 'Double Opt-In': 'Ja', 'SieSales-ID': 'C1' }),
        row(CONTACTS, { 'IFA Nr': '000123', Vorname: 'Dirk', Nachname: 'Dunkel', Telefon: '0221 222', Email: 'dirk@nord.test', 'Nicht anrufen': 'Ja', 'Werbesperre Email': 'X', 'SieSales-ID': 'C2' }),
        row(CONTACTS, { 'IFA Nr': '000123', Vorname: 'Erna', Nachname: 'Ex', Telefon: '0221 333', Löschvormerkung: 'Ja', 'SieSales-ID': 'C3' }),
        row(CONTACTS, { 'IFA Nr': '000123', Vorname: 'Fritz', Nachname: 'Fort', Telefon: '0221 444', Status: 'Inaktiv', 'SieSales-ID': 'C4' }),
        row(CONTACTS, { 'IFA Nr': '555555', Vorname: 'Gina', Nachname: 'Gast', 'SieSales-ID': 'C5' })
    ],
    [SALES_SHEETS.opps]: [
        row(OPPS, { IfA: '000123', 'Opportunity-ID': 'OP-1', Opportunityname: 'Retrofit Linie 3', 'erwartete Auftragseingang': '120.000', Phase: '3', Status: 'offen', Prognosekategorie: 'Commit', Schlussmonat: '31.03.2027', Opportunityverantwortlicher: 'Anna Neu', Wettbewerber: 'Geheim AG', Beschreibung: 'Vertraulicher Text' }),
        row(OPPS, { IfA: '000123', 'Opportunity-ID': 'OP-2', Opportunityname: 'Altprojekt', Phase: '5', Status: 'geschlossen', Prognosekategorie: 'gewonnen' }),
        row(OPPS, { IfA: '000123', 'Opportunity-ID': 'OP-3', Opportunityname: 'Serviceausbau', Phase: '1', Status: 'offen', 'erwartete Auftragseingang': '30.000' })
    ]
});

function importWorkbook() {
    const prepared = prepareMainRows(mainRows());
    const mapping = salesMainMapping(MAIN);
    const { customers } = parseRows(prepared.rows, mapping);
    const stats = enrichSalesCustomers(customers, side());
    return { prepared, mapping, customers, stats };
}

describe('Vertriebs-Arbeitsmappe erkennen und einlesen', () => {
    it('erkennt die Mappe an den Blattnamen', () => {
        expect(isSalesWorkbook(['VBEZ Übersicht', 'Dateiübersicht', 'AE je PCK', 'SieSales Kontakte', 'SieSales Opps'])).toBe(true);
        expect(isSalesWorkbook(['Kunden'])).toBe(false);
        expect(isSalesWorkbook(['VBEZ Übersicht'])).toBe(false);
    });

    it('liest alle Blätter einer echten .xlsx in einem Zug – ohne Zuordnungsdialog', async () => {
        const wb = XLSX.utils.book_new();
        const sheet = (headers, rows) => XLSX.utils.aoa_to_sheet([headers, ...rows.map((r) => headers.map((h) => r[h] ?? ''))]);
        XLSX.utils.book_append_sheet(wb, sheet(MAIN, mainRows()), SALES_SHEETS.main);
        for (const [name, headers] of [[SALES_SHEETS.files, FILES], [SALES_SHEETS.products, PRODUCTS], [SALES_SHEETS.contacts, CONTACTS], [SALES_SHEETS.opps, OPPS]]) {
            XLSX.utils.book_append_sheet(wb, sheet(headers, side()[name]), name);
        }
        const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
        const result = await readWorkbook({ name: 'Mappe.xlsx', type: '', arrayBuffer: async () => buffer });
        expect(result.workbookKind).toBe('sales');
        expect(result.rows).toHaveLength(3);
        expect(result.sideSheets[SALES_SHEETS.contacts]).toHaveLength(5);
        expect(result.sideSheets[SALES_SHEETS.opps]).toHaveLength(3);
        // Kennungen bleiben Text mit führenden Nullen.
        expect(result.rows[0].IFA).toBe('000123');
    });

    it('Debitor ist der Schlüssel, die spätere Zeile gilt, VInfo springt ein', () => {
        const { prepared, customers } = importWorkbook();
        expect(prepared.replaced).toBe(1);
        expect(customers.map((c) => c.nummer)).toEqual(['0042', '0099']);
        const nord = customers[0];
        expect(nord.name).toBe('Nord GmbH & Co.');
        expect(nord.bezirk).toBe('VBEZ 12');      // VBEZ (Neu)
        expect(nord.vb).toBe('Anna Neu');         // VB (Neu)
        expect(nord.extra.IFA).toBe('000123');
    });

    it('Orders FY24–26 werden Umsatzjahre, FY26 ist „der" Umsatz; Ø zählt nicht', () => {
        const { customers, mapping } = importWorkbook();
        expect(mapping.umsatz).toBe('Orders FY26');
        expect(customers[0].umsatz).toBe(990000);
        expect(customers[0].umsatzJahre).toEqual({ 2024: 1000000, 2025: 1100000, 2026: 990000 });
    });

    it('Kontakte: gelöschte und inaktive fehlen, Sperrvermerke und DOI kommen mit', () => {
        const { customers, stats } = importWorkbook();
        const names = customers[0].contacts.map((c) => c.name);
        expect(names).toEqual(['Clara Klein', 'Dirk Dunkel']);
        expect(customers[0].contacts[0]).toMatchObject({ doi: true, abteilung: 'Einkauf' });
        expect(customers[0].contacts[1]).toMatchObject({ nichtAnrufen: true, sperreEmail: true });
        expect(stats.unmatched.contacts).toBe(1);
        // Kein Arbeitsmappen-Kontakt wird von selbst Hauptansprechpartner.
        expect(customers[0].ansprechpartner || '').toBe('');
    });

    it('Opportunities: offen nach Status/Prognose, abgeschlossene nur gezählt', () => {
        const { customers } = importWorkbook();
        const { open, closed, openAmount } = customerOpps(customers[0]);
        expect(open.map((o) => o.name)).toEqual(['Retrofit Linie 3', 'Serviceausbau']);
        expect(closed).toHaveLength(1);
        expect(openAmount).toBe(150000);
        expect(open[0].close).toBe('2027-03-31');
    });

    it('Produkte und Produktmix, Übergabe, CRM-Link nur http(s)', () => {
        const { customers } = importWorkbook();
        expect(customerProducts(customers[0])).toEqual([expect.objectContaining({ beschreibung: 'Antriebe', summe: 150000 })]);
        expect(productMix(customers[0]).map((m) => [m.label, Math.round(m.share * 100)])).toEqual([['Service', 60], ['Software', 40]]);
        expect(handover(customers[0])).toMatchObject({ from: 'Bernd Alt', to: 'Anna Neu' });
        expect(share('35 %')).toBeCloseTo(0.35);
        expect(flag('Nein')).toBe(false);
        expect(flag('X')).toBe(true);
    });

    it('prüft die Zeilenzahlen gegen die Dateiübersicht', () => {
        expect(fileOverviewCheck(side()[SALES_SHEETS.files], {
            [SALES_SHEETS.main]: 3, [SALES_SHEETS.products]: 2, [SALES_SHEETS.contacts]: 5, [SALES_SHEETS.opps]: 2
        })).toEqual(['Blatt „SieSales Opps": laut Dateiübersicht 3 Zeilen, gelesen 2.']);
    });

    it('bietet Filter nach Opportunity, Phase und Produkt', () => {
        const { customers } = importWorkbook();
        const defs = salesDimensionDefs(customers);
        expect(defs.map((d) => d.label)).toEqual(['Opportunity', 'Opportunity-Phase', 'Übergabe', 'Übergabe von (VB alt)', 'Produkt (PCK)']);
        expect(defs[0].values(customers[0])).toEqual(['mit offener Opportunity']);
        expect(defs[0].values(customers[1])).toEqual(['ohne offene Opportunity']);
        expect(defs[1].values(customers[0])).toEqual(['Phase 3', 'Phase 1']);
    });
});

describe('Kundenkachel bleibt ruhig', () => {
    it('Details stecken hinter Knöpfen; Sperrvermerke ersetzen Anruf- und Mail-Link', () => {
        const { customers } = importWorkbook();
        const nord = { ...customers[0], id: 'k-1', besuche: [] };
        const html = customerPopupHtml(nord);
        expect(html).toContain('data-popup-section="contacts"');
        expect(html).toContain('data-popup-section="opps"');
        expect(html).toContain('data-popup-section="products"');
        // Alle Felder starten zugeklappt.
        expect(html.match(/data-popup-panel="[^"]+" hidden/g)).toHaveLength(html.match(/data-popup-panel=/g).length);
        expect(html).toContain('href="tel:0221111"');
        expect(html).not.toContain('href="tel:0221222"');
        expect(html).not.toContain('mailto:dirk@nord.test');
        expect(html).toContain('⛔');
        expect(html).toContain('✓ DOI');
        expect(html).toContain('🔁');
        // Der javascript:-Link aus der späteren Zeile wird nie zum Link.
        expect(html).not.toContain('javascript:');
    });

    it('zeigt den CRM-Link, wenn er sicher ist', () => {
        const html = customerPopupHtml({ id: 'k', name: 'X', plz: '50667', besuche: [], extra: { 'SieSales Link': 'https://crm.example.test/a/1' } });
        expect(html).toContain('href="https://crm.example.test/a/1" target="_blank" rel="noopener noreferrer"');
    });

    it('alle neuen Beschriftungen sind übersetzt', () => {
        for (const locale of ['de', 'en', 'fr', 'es']) {
            for (const key of ['customer.opps.title', 'customer.products.title', 'customer.contacts.noCall', 'customer.handover.badge', 'import.workbookTitle']) {
                expect(MESSAGES[locale][key], `${locale} ${key}`).toBeTruthy();
            }
        }
    });
});

describe('KI-Briefing aus der Arbeitsmappe', () => {
    it('nennt offene Opps mit Phase und Produktklassen – ohne Beträge, Wettbewerber, Freitexte und gesperrte Kontakte', () => {
        const { customers } = importWorkbook();
        expect(salesBriefingLines(customers[0])[0]).toBe('- Offene Opportunities: Retrofit Linie 3 (Phase 3, Abschluss 2027-03); Serviceausbau (Phase 1)');
        const prompt = buildCustomerBriefingPrompt(customers[0], { today: new Date(2026, 9, 10) });
        expect(prompt).toContain('Retrofit Linie 3');
        expect(prompt).toContain('Antriebe');
        expect(prompt).toContain('Clara Klein (Einkauf)');
        expect(prompt).not.toContain('Dirk Dunkel');
        expect(prompt).not.toContain('Geheim AG');
        expect(prompt).not.toContain('Vertraulicher Text');
        expect(prompt).not.toContain('120');
        expect(prompt).not.toContain('Altprojekt');
    });
});

describe('Erneuter Import der Arbeitsmappe', () => {
    it('ersetzt Kontakte und Opps aus der Mappe, statt alte stehen zu lassen', () => {
        const before = importWorkbook().customers;
        const next = importWorkbook();
        // In der neuen Fassung hat Nord keine Kontakte und Opps mehr.
        for (const c of next.customers) { delete c.contacts; delete c.opps; }
        mergeWithPrevious(before, next.customers, { mapping: next.mapping, headers: MAIN, contactsFromFile: true, fileProps: ['opps', 'produkte'] });
        expect(next.customers[0].contacts || []).toHaveLength(0);
        expect(next.customers[0].opps).toBeUndefined();
    });
});

describe('Übergaben (16.5)', () => {
    const withHandovers = () => {
        const { customers } = importWorkbook();
        // Ein zweiter Kunde von Bernd an Carla, einer ohne Übergabe bleibt Süd.
        const extra = { ...customers[1], id: 'k-x', nummer: '0100', name: 'West KG', vb: 'Carla Neu', umsatz: 50000,
            extra: { ...customers[1].extra, 'Übergabe notwendig': 'X', 'VB (Alt)': 'Bernd Alt', 'VBEZ (Alt)': 'VBEZ 11' } };
        return [customers[0], extra, customers[1]];
    };

    it('Übergabeliste: je Kunde, sortiert nach VB alt, VB neu, Umsatz', () => {
        const rows = handoverRows(withHandovers());
        expect(rows.map((r) => [r['VB (Alt)'], r['VB (Neu)'], r.Accountname])).toEqual([
            ['Bernd Alt', 'Anna Neu', 'Nord GmbH & Co.'],
            ['Bernd Alt', 'Carla Neu', 'West KG']
        ]);
        expect(rows[0]).toMatchObject({ Debitor: '0042', IFA: '000123', 'Umsatz (jüngstes GJ)': 990000, 'Offene Opportunities': 2, 'Erwarteter AE offen': 150000, Kontakte: 2 });
        // Ein unsicherer Link wird nicht in die Liste geschrieben.
        expect(rows[0]['SieSales Link']).toBe('');
    });

    it('Übersicht je VB-Paar', () => {
        expect(handoverSummary(withHandovers())).toEqual([
            { 'VB (Alt)': 'Bernd Alt', 'VB (Neu)': 'Anna Neu', Kunden: 1, 'Umsatz (jüngstes GJ)': 990000, 'Offene Opportunities': 2, 'Erwarteter AE offen': 150000 },
            { 'VB (Alt)': 'Bernd Alt', 'VB (Neu)': 'Carla Neu', Kunden: 1, 'Umsatz (jüngstes GJ)': 50000, 'Offene Opportunities': 0, 'Erwarteter AE offen': 0 }
        ]);
    });

    it('Filter „Übergabe" und „Übergabe von (VB alt)"', () => {
        const list = withHandovers();
        const defs = salesDimensionDefs(list);
        const byId = Object.fromEntries(defs.map((d) => [d.id, d]));
        expect(byId.uebergabe.values(list[0])).toEqual(['mit Übergabe']);
        expect(byId.uebergabe.values(list[2])).toEqual(['ohne Übergabe']);
        expect(byId['uebergabe-von'].values(list[1])).toEqual(['Bernd Alt']);
    });

    it('Marker zeigen die Übergabe, Daten-Reiter bietet die Liste an', () => {
        const map = readFileSync('src/features/map.js', 'utf8');
        expect(map).toContain("${transfer ? ' has-handover' : ''}");
        expect(readFileSync('src/styles/map.css', 'utf8')).toContain('.customer-marker-card.has-handover');
        expect(readFileSync('index.html', 'utf8')).toContain('id="btn-export-handover"');
        expect(readFileSync('src/ui/sidebar.js', 'utf8')).toContain('exportHandovers(visibleCustomers())');
        for (const locale of ['de', 'en', 'fr', 'es']) expect(MESSAGES[locale]['export.handover'], locale).toBeTruthy();
    });
});
