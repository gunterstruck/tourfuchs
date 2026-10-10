import { afterEach, describe, expect, it } from 'vitest';
import { attachContacts, autoDetectMapping, customerExportRows, parseRows } from '../src/services/excel.js';
import { mergeWithPrevious } from '../src/features/importMerge.js';
import { customerContactGroups, promotorDimensionDefs, showsCustomerContacts } from '../src/features/customerContacts.js';
import { teamDimensionDefs } from '../src/features/responsibilities.js';
import {
    pickLatestRevenueHeader, revenueBriefingLine, revenueYearOfHeader, revenueYearRows
} from '../src/features/revenueYears.js';
import { planningScopeCustomers, planningValueCounts } from '../src/features/planningScope.js';
import { buildCustomerBriefingPrompt } from '../src/features/customerBriefing.js';
import { customerPopupHtml } from '../src/features/map.js';
import { MESSAGES } from '../src/i18n/messages.js';
import { filterDimensionDefs, isVisible, setCustomers, state } from '../src/core/state.js';

const TODAY = new Date(2026, 9, 10);

function read(headers, rows) {
    const mapping = autoDetectMapping(headers);
    const objects = rows.map((cells) => Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ''])));
    return { mapping, headers, ...parseRows(objects, mapping) };
}

const stamm = () => read(['Kd-Nr.', 'Kundenname', 'PLZ', 'Ort', 'Ansprechpartner', 'Telefon'], [
    ['1001', 'Nord GmbH', '50667', 'Köln', 'Frau Klein', '0221 1'],
    ['1002', 'Süd AG', '80331', 'München', '', '']
]).customers;

describe('Promotorenliste', () => {
    const file = () => read(['Kd-Nr.', 'Name', 'Telefon', 'E-Mail', 'Thema'], [
        ['1001', 'Paul Prom', '0171 5550001', 'paul@promo.test', 'Akku-Werkzeuge'],
        ['1001', 'Petra Prom', '', 'petra@promo.test', 'Messtechnik'],
        ['1002', 'Paul Prom', '0171 5550001', 'paul@promo.test', 'Akku-Werkzeuge']
    ]);

    it('„Name" ist in einer Kontaktliste die Person, nicht der Kunde', () => {
        const { mapping, customers, contactRows } = file();
        expect(mapping).toMatchObject({ nummer: 'Kd-Nr.', ansprechpartner: 'Name', name: null, thema: 'Thema' });
        expect(customers).toHaveLength(0);
        expect(contactRows.map((c) => [c.name, c.art, c.thema])).toEqual([
            ['Paul Prom', 'promotor', 'Akku-Werkzeuge'],
            ['Petra Prom', 'promotor', 'Messtechnik'],
            ['Paul Prom', 'promotor', 'Akku-Werkzeuge']
        ]);
    });

    it('wird dazugeladen, ohne den Hauptansprechpartner zu ersetzen', () => {
        const customers = stamm();
        const { contactRows } = file();
        attachContacts(customers, contactRows);
        const nord = customerContactGroups(customers[0]);
        expect(nord.promotors.map((p) => p.name)).toEqual(['Paul Prom', 'Petra Prom']);
        expect(customers[0].ansprechpartner).toBe('Frau Klein');
        expect(customers[0].telefon).toBe('0221 1');
        // Süd AG hat keinen eigenen Ansprechpartner – ein Promotor wird es trotzdem nicht.
        expect(customers[1].ansprechpartner).toBe('');
        expect(customers[1].primaryContactId).toBeUndefined();
    });

    it('eine Spalte „Promotor" ist der Name', () => {
        const { mapping, contactRows } = read(['Kundennummer', 'Promotor', 'Mobil'], [['1001', 'Paul Prom', '0171 1']]);
        expect(mapping.ansprechpartner).toBe('Promotor');
        expect(contactRows[0]).toMatchObject({ name: 'Paul Prom', art: 'promotor' });
    });
});

describe('Kontaktliste mit Abteilung und Kontaktart', () => {
    it('Kundenansprechpartner mit Abteilung, Promotoren an der Kontaktart', () => {
        const { mapping, contactRows } = read(['Kd-Nr.', 'Ansprechpartner', 'Abteilung', 'Kontaktart', 'Thema', 'E-Mail'], [
            ['1001', 'Herr Groß', 'Einkauf', 'Kunde', '', 'gross@nord.test'],
            ['1001', 'Paul Prom', '', 'Promotor', 'Akku', '']
        ]);
        expect(mapping).toMatchObject({ abteilung: 'Abteilung', kontaktArt: 'Kontaktart' });
        expect(contactRows.map((c) => [c.name, c.art || 'kunde', c.abteilung || '', c.thema || ''])).toEqual([
            ['Herr Groß', 'kunde', 'Einkauf', ''],
            ['Paul Prom', 'promotor', '', 'Akku']
        ]);
        const customers = stamm();
        attachContacts(customers, contactRows);
        const { customerContacts, promotors } = customerContactGroups(customers[0]);
        expect(customerContacts.map((c) => [c.name, c.abteilung, c.primary])).toEqual([
            ['Frau Klein', '', true], ['Herr Groß', 'Einkauf', false]
        ]);
        expect(promotors).toHaveLength(1);
        expect(showsCustomerContacts(customerContacts)).toBe(true);
    });

    it('eine Kundenliste mit Koordinaten statt PLZ bleibt Kundenliste, auch mit „Abteilung"', () => {
        const mapping = autoDetectMapping(['Kd-Nr.', 'Name', 'Lat', 'Lng', 'Ansprechpartner', 'Abteilung']);
        expect(mapping).toMatchObject({ name: 'Name', ansprechpartner: 'Ansprechpartner', abteilung: 'Abteilung' });
    });

    it('ein einzelner Hauptansprechpartner ohne Abteilung braucht keinen eigenen Knopf', () => {
        expect(showsCustomerContacts(customerContactGroups(stamm()[0]).customerContacts)).toBe(false);
    });
});

describe('Reimport des Kundenstamms', () => {
    it('lässt Promotoren und Kontakte aus der Kontaktliste stehen', () => {
        const previous = stamm();
        attachContacts(previous, read(['Kd-Nr.', 'Name', 'Thema'], [['1001', 'Paul Prom', 'Akku']]).contactRows);
        attachContacts(previous, read(['Kd-Nr.', 'Ansprechpartner', 'Abteilung'], [['1001', 'Herr Groß', 'Einkauf']]).contactRows);
        const next = read(['Kd-Nr.', 'Kundenname', 'PLZ', 'Ort', 'Ansprechpartner', 'Telefon'], [
            ['1001', 'Nord GmbH', '50667', 'Köln', 'Frau Neu', '0221 2']
        ]);
        mergeWithPrevious(previous, next.customers, next);
        const groups = customerContactGroups(next.customers[0]);
        expect(next.customers[0].ansprechpartner).toBe('Frau Neu');
        expect(groups.customerContacts.map((c) => c.name)).toEqual(['Frau Neu', 'Herr Groß']);
        expect(groups.promotors.map((p) => p.name)).toEqual(['Paul Prom']);
    });
});

describe('Export und Wiedereinlesen', () => {
    it('Promotoren mit Thema und Abteilungen bleiben erhalten', () => {
        const customers = stamm();
        attachContacts(customers, read(['Kd-Nr.', 'Name', 'Telefon', 'Thema'], [['1001', 'Paul Prom', '0171 5550001', 'Akku']]).contactRows);
        attachContacts(customers, read(['Kd-Nr.', 'Ansprechpartner', 'Abteilung', 'E-Mail'], [['1001', 'Herr Groß', 'Einkauf', 'g@nord.test']]).contactRows);
        customers[0].contacts.find((c) => c.primary).abteilung = 'Geschäftsführung';
        const rows = customerExportRows(customers);
        expect(rows[0]['Promotoren']).toBe('Paul Prom · Akku · 0171 5550001');
        expect(rows[0]['Weitere Ansprechpartner']).toBe('Herr Groß · Einkauf · g@nord.test');
        const again = parseRows(rows, autoDetectMapping(Object.keys(rows[0]))).customers[0];
        const groups = customerContactGroups(again);
        expect(groups.promotors.map((p) => [p.name, p.thema, p.phone])).toEqual([['Paul Prom', 'Akku', '0171 5550001']]);
        expect(groups.customerContacts.map((c) => [c.name, c.abteilung])).toEqual([
            ['Frau Klein', 'Geschäftsführung'], ['Herr Groß', 'Einkauf']
        ]);
    });

    it('ohne Promotoren und Abteilungen bleibt die Exportliste wie bisher', () => {
        const row = customerExportRows(stamm())[0];
        expect(row).not.toHaveProperty('Promotoren');
        expect(row).not.toHaveProperty('Abteilung');
    });
});

describe('Filter nach Promotor, Thema und Zuständig', () => {
    const customers = () => {
        const list = stamm();
        list[0].extra = { VK: 'Vera Kunz 0171 2223344', OM: 'Olaf Meier' };
        list[1].extra = { VK: 'Vera Kunz +49 171 2223344' };
        attachContacts(list, read(['Kd-Nr.', 'Name', 'Thema'], [
            ['1001', 'Paul Prom', 'Akku'], ['1001', 'Petra Prom', 'Messtechnik'], ['1002', 'Petra Prom', 'Messtechnik']
        ]).contactRows);
        return list;
    };

    afterEach(() => setCustomers([]));

    it('Zuständig · VK filtert nach dem Namen – die Telefonnummer spielt keine Rolle', () => {
        const defs = teamDimensionDefs(customers());
        expect(defs.map((d) => d.label)).toEqual(['Zuständig · VK', 'Zuständig · OM']);
        const vk = defs[0];
        const counts = planningValueCounts(customers(), [vk], new Map(), vk.id);
        expect([...counts]).toEqual([['Vera Kunz', 2]]);
    });

    it('ein Kunde mit zwei Promotoren erscheint bei beiden', () => {
        const list = customers();
        const [promotor, thema] = promotorDimensionDefs(list);
        expect([promotor.label, thema.label]).toEqual(['Promotor', 'Promotor-Thema']);
        const only = (def, value) => planningScopeCustomers(list, [def], new Map([[def.id, new Set([value])]])).map((c) => c.name);
        expect(only(promotor, 'Paul Prom')).toEqual(['Nord GmbH']);
        expect(only(promotor, 'Petra Prom')).toEqual(['Nord GmbH', 'Süd AG']);
        expect(only(thema, 'Akku')).toEqual(['Nord GmbH']);
    });

    it('wirkt auf der Karte: Werte abwählen blendet Kunden aus', () => {
        const list = customers();
        setCustomers(list);
        const ids = filterDimensionDefs().map((d) => d.id);
        expect(ids).toEqual(expect.arrayContaining(['team:vk', 'team:om', 'promotor', 'promotor-thema']));
        // Die rohe Spalte „VK" (mit Telefonnummern) ist keine zweite Ebene mehr.
        expect(ids.some((id) => id.startsWith('extra:') && id.includes('vk'))).toBe(false);
        state.dims.promotor.values.get('Petra Prom').visible = false;
        expect(isVisible(list[0])).toBe(true); // Paul ist noch ausgewählt
        expect(isVisible(list[1])).toBe(false);
    });
});

describe('Umsätze nach Geschäftsjahr', () => {
    it('erkennt das Geschäftsjahr in der Überschrift', () => {
        expect(revenueYearOfHeader('Umsatz 2025')).toBe(2025);
        expect(revenueYearOfHeader('Umsatz GJ 24')).toBe(2024);
        expect(revenueYearOfHeader('Umsatz 2024/25')).toBe(2025);
        expect(revenueYearOfHeader('GJ 2023')).toBe(2023);
        expect(revenueYearOfHeader('Jahresumsatz 2022 T€')).toBe(2022);
        expect(revenueYearOfHeader('Umsatz')).toBeNull();
        expect(revenueYearOfHeader('Umsatzziel 2026')).toBeNull();
        expect(revenueYearOfHeader('Plan 2026')).toBeNull();
        expect(revenueYearOfHeader('Gründungsjahr 1998')).toBeNull();
    });

    it('der jüngste Jahrgang wird „der" Umsatz, alle Jahre landen am Kunden', () => {
        const headers = ['Kd-Nr.', 'Kundenname', 'PLZ', 'Umsatz 2023', 'Umsatz 2024', 'Umsatz 2025'];
        expect(pickLatestRevenueHeader('Umsatz 2023', headers)).toBe('Umsatz 2025');
        const { mapping, customers } = read(headers, [['1001', 'Nord GmbH', '50667', '1.000.000', '1.100.000', '1.210.000']]);
        expect(mapping.umsatz).toBe('Umsatz 2025');
        expect(customers[0].umsatz).toBe(1210000);
        expect(customers[0].umsatzJahre).toEqual({ 2023: 1000000, 2024: 1100000, 2025: 1210000 });
        // Für Export und Reimport bleiben die Originalspalten erhalten.
        expect(Object.keys(customers[0].extra)).toEqual(['Umsatz 2023', 'Umsatz 2024', 'Umsatz 2025']);
    });

    it('GJ läuft (2026, noch ohne Zahlen), GJ-1 bis GJ-3 mit Veränderung zum Vorjahr', () => {
        const customer = { umsatzJahre: { 2023: 1000000, 2024: 1100000, 2025: 990000 } };
        expect(revenueYearRows(customer, TODAY)).toEqual([
            { offset: 0, year: 2026, value: null, change: null },
            { offset: 1, year: 2025, value: 990000, change: -10 },
            { offset: 2, year: 2024, value: 1100000, change: 10 },
            { offset: 3, year: 2023, value: 1000000, change: null }
        ]);
        expect(revenueBriefingLine(customer, (v) => `${v / 1000} T€`, TODAY))
            .toBe('- Umsatz nach Geschäftsjahr: GJ-1 2025: 990 T€ (-10 % zum Vorjahr); GJ-2 2024: 1100 T€ (+10 % zum Vorjahr); GJ-3 2023: 1000 T€');
    });

    it('ein Reimport mit neueren Jahren behält ältere', () => {
        const previous = read(['Kd-Nr.', 'Kundenname', 'PLZ', 'Umsatz 2023', 'Umsatz 2024'], [['1001', 'Nord GmbH', '50667', '100', '110']]).customers;
        const next = read(['Kd-Nr.', 'Kundenname', 'PLZ', 'Umsatz 2024', 'Umsatz 2025'], [['1001', 'Nord GmbH', '50667', '111', '120']]);
        mergeWithPrevious(previous, next.customers, next);
        expect(next.customers[0].umsatzJahre).toEqual({ 2023: 100, 2024: 111, 2025: 120 });
    });
});

describe('Kundenkachel', () => {
    const kunde = () => {
        const [nord] = stamm();
        nord.id = 'k1';
        nord.besuche = [];
        nord.extra = { VK: 'Vera Kunz 0171 2223344' };
        nord.umsatz = 1210000;
        nord.umsatzJahre = { [TODAY.getFullYear() - 1]: 1210000, [TODAY.getFullYear() - 2]: 1100000 };
        attachContacts([nord], read(['Kd-Nr.', 'Name', 'Telefon', 'E-Mail', 'Thema'], [['1001', 'Paul Prom', '0171 5550001', 'paul@promo.test', 'Akku']]).contactRows);
        attachContacts([nord], read(['Kd-Nr.', 'Ansprechpartner', 'Abteilung'], [['1001', 'Herr Groß', 'Einkauf']]).contactRows);
        return nord;
    };

    it('zeigt Zuständig, Promotoren und Kundenansprechpartner nebeneinander', () => {
        const html = customerPopupHtml(kunde());
        expect(html).toContain('data-popup-section="team"');
        expect(html).toContain('data-popup-section="promotors"');
        expect(html).toContain('data-popup-section="contacts"');
        expect(html).toContain('📣 Promotoren');
        expect(html).toContain('🤝 Kundenansprechpartner');
        expect(html).toContain('href="tel:01715550001"');
        expect(html).toContain('href="mailto:paul@promo.test"');
        expect(html).toContain('Akku');
        expect(html).toContain('Einkauf');
    });

    it('der Umsatz bekommt den Knopf „Jahre"', () => {
        const html = customerPopupHtml(kunde());
        expect(html).toContain('data-popup-section="revenue"');
        const year = new Date().getFullYear();
        expect(html).toContain(`GJ-1 ${year - 1}`);
        expect(html).toContain('noch keine Zahlen');
    });

    it('ohne Jahreswerte kein Knopf', () => {
        const html = customerPopupHtml({ ...kunde(), umsatzJahre: undefined });
        expect(html).not.toContain('data-popup-section="revenue"');
    });

    it('alle Beschriftungen sind übersetzt', () => {
        for (const locale of ['de', 'en', 'fr', 'es']) {
            for (const key of ['customer.promotors.title', 'customer.contacts.title', 'customer.revenue.years', 'customer.revenue.fy']) {
                expect(MESSAGES[locale][key], `${locale} ${key}`).toBeTruthy();
            }
        }
    });
});

describe('KI-Briefing', () => {
    it('nennt Promotoren mit Thema, Ansprechpartner mit Abteilung und die Umsatzentwicklung – ohne Telefon und E-Mail', () => {
        const [nord] = stamm();
        nord.umsatzJahre = { 2025: 990000, 2024: 1100000 };
        attachContacts([nord], read(['Kd-Nr.', 'Name', 'Telefon', 'E-Mail', 'Thema'], [['1001', 'Paul Prom', '0171 5550001', 'paul@promo.test', 'Akku']]).contactRows);
        attachContacts([nord], read(['Kd-Nr.', 'Ansprechpartner', 'Abteilung', 'E-Mail'], [['1001', 'Herr Groß', 'Einkauf', 'g@nord.test']]).contactRows);
        const prompt = buildCustomerBriefingPrompt(nord, { today: TODAY });
        expect(prompt).toContain('- Promotoren: Paul Prom (Akku)');
        expect(prompt).toContain('- Ansprechpartner beim Kunden: Herr Groß (Einkauf)');
        expect(prompt).toContain('- Umsatz nach Geschäftsjahr: GJ-1 2025: 990 T€ (-10 % zum Vorjahr); GJ-2 2024: 1.100 T€');
        expect(prompt).toContain('nenne den passenden Promotor');
        expect(prompt).toContain('Umsatzentwicklung bei Chance und Risiko');
        expect(prompt).not.toContain('0171');
        expect(prompt).not.toContain('paul@promo.test');
        expect(prompt).not.toContain('g@nord.test');
    });

    it('ohne Promotoren und Jahreswerte bleibt der Prompt wie bisher', () => {
        const prompt = buildCustomerBriefingPrompt(stamm()[0], { today: TODAY });
        expect(prompt).not.toContain('Promotor');
        expect(prompt).not.toContain('Geschäftsjahr');
    });
});
