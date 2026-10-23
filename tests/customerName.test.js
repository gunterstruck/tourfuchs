import { describe, expect, it } from 'vitest';
import { cleanCustomerTexts, cleanImportedText, customerTextsNeedCleaning, normalizeCustomerName, readableCustomerName } from '../src/features/customerName.js';
import { customerResponsibilities } from '../src/features/responsibilities.js';
import { autoDetectMapping, parseRows } from '../src/services/excel.js';
import { datasetSnapshot, setCustomers, state } from '../src/core/state.js';
import { createSafeTransfer, decryptSafeTransfer, parseKeyQr } from '../src/features/safeTransfer.js';
import { customerPopupHtml } from '../src/features/map.js';

describe('Kundennamen mit kaufmännischem Und', () => {
    it('liest HTML-kodierte Excel-Namen als Klartext und behält echte Sonderzeichen', () => {
        const rows = [{ Kundenname: 'Schmitt &amp; Co. <KG>', PLZ: '90402', Kundennummer: '3303145' }];
        const { customers } = parseRows(rows, autoDetectMapping(Object.keys(rows[0])));
        expect(customers[0].name).toBe('Schmitt & Co. <KG>');
        expect(customers[0].nummer).toBe('3303145');
        expect(normalizeCustomerName('A &amp;amp; B')).toBe('A & B');
        expect(normalizeCustomerName('A & B')).toBe('A & B');
    });

    it('korrigiert auch alte verschlüsselte Bestände nach dem Entschlüsseln ohne IDs zu ändern', async () => {
        const oldCustomer = { id: 'k-nr:3303145', nummer: '3303145', name: 'Schmitt &amp; Co. KG', plz: '90402' };
        const { container, keyQr } = await createSafeTransfer({ customers: [oldCustomer] });
        const oldDataset = await decryptSafeTransfer(container, parseKeyQr(keyQr).keyB64);
        expect(oldDataset.customers[0].name).toBe('Schmitt &amp; Co. KG');
        expect(customerTextsNeedCleaning(oldDataset.customers)).toBe(true);

        setCustomers(oldDataset.customers);
        expect(state.customers[0].name).toBe('Schmitt & Co. KG');
        expect(state.customers[0].id).toBe(oldCustomer.id);
        expect(datasetSnapshot().customers[0].name).toBe('Schmitt & Co. KG');
        const popup = customerPopupHtml(state.customers[0]);
        expect(popup).toContain('Schmitt &amp; Co. KG');
        expect(popup).not.toContain('&amp;amp;');
        expect(customerTextsNeedCleaning(state.customers)).toBe(false);
        setCustomers([]);
    });
});

describe('HTML-Auszeichnung aus CRM-Exporten', () => {
    const span = (text) => `<span style="white-space: nowrap;">${text}</span>`;

    it('entfernt bekannte HTML-Tags und lässt echte spitze Klammern stehen', () => {
        expect(cleanImportedText(span('Ute, Sander '))).toBe('Ute, Sander');
        expect(cleanImportedText(`${span('ZETA (RC-DE)')}`)).toBe('ZETA (RC-DE)');
        expect(cleanImportedText('<b>Vera</b>&nbsp;Kunz<br>0171 2223344')).toBe('Vera Kunz 0171 2223344');
        expect(cleanImportedText(`${span('R&amp;D &lt;Nord&gt;')}`)).toBe('R&D <Nord>');
        expect(cleanImportedText('Schmitt &amp; Co. <KG>')).toBe('Schmitt & Co. <KG>');
        expect(cleanImportedText('a < b > c')).toBe('a < b > c');
        expect(cleanImportedText('Kein &lt;Tag&gt; hier')).toBe('Kein &lt;Tag&gt; hier');
    });

    it('macht aus Trennlinien und Listen im CRM-Feld einen lesbaren Trenner', () => {
        const hr = '<hr style="height: 1px; background-color: #848484; margin:0">';
        expect(cleanImportedText(`Musterchemie AG (RC-DE)${hr}Musterchemie Global`))
            .toBe('Musterchemie AG (RC-DE) / Musterchemie Global');
        expect(cleanImportedText(`Regional${hr}Corporate`)).toBe('Regional / Corporate');
        expect(cleanImportedText(`${hr}Nur einer${hr}`)).toBe('Nur einer');
        expect(cleanImportedText('<ul><li>Nord</li><li>Süd</li></ul>')).toBe('Nord / Süd');
        expect(cleanImportedText('<tr><td>A</td><td>B</td></tr>')).toBe('A B');
    });

    it('zeigt den Account aus mehreren Werten mit Trenner statt HTML', () => {
        const hr = '<hr style="height: 1px; background-color: #848484; margin:0">';
        setCustomers([{ id: 'k2', name: 'LOBO GMBH', extra: {
            'Account Name': `Musterchemie AG (RC-DE)${hr}Musterchemie Global`,
            'Account Cluster': `Regional${hr}Corporate`
        } }]);
        expect(customerResponsibilities(state.customers[0]).account)
            .toBe('Musterchemie AG (RC-DE) / Musterchemie Global · Regional / Corporate');
        setCustomers([]);
    });

    it('bereinigt alle Texte eines Kunden – IDs bleiben unverändert', () => {
        const customer = {
            id: `k-np:${span('x')}|1`, name: span('Muster GmbH'), plz: '47051',
            primaryContactId: 'ct-<b>1</b>',
            extra: { 'Account Manager': `${span('Ute, Sander ')} +49 (170) 1112233`, 'Account Name': span('ZETA (RC-DE)'), 'Partner Id': span('P-7') },
            contacts: [{ id: 'ct-1', name: span('Eva Ost'), telefon: '0201 1' }],
            opps: [{ name: '<i>Retrofit</i>', phase: 'Angebot' }]
        };
        expect(customerTextsNeedCleaning([customer])).toBe(true);
        cleanCustomerTexts(customer);
        expect(customer.name).toBe('Muster GmbH');
        expect(customer.extra['Account Manager']).toBe('Ute, Sander +49 (170) 1112233');
        expect(customer.extra['Account Name']).toBe('ZETA (RC-DE)');
        expect(customer.extra['Partner Id']).toBe('P-7');
        expect(customer.contacts[0].name).toBe('Eva Ost');
        expect(customer.opps[0].name).toBe('Retrofit');
        expect(customer.id).toBe(`k-np:${span('x')}|1`);
        expect(customer.primaryContactId).toBe('ct-<b>1</b>');
        expect(customerTextsNeedCleaning([customer])).toBe(false);
    });

    it('zeigt in „Zuständig" den Namen ohne Auszeichnung', () => {
        const customer = { id: 'k1', name: 'ZETA AUTOMATION DUISBURG GMBH', extra: {
            'Account Manager': `${span('Ute, Sander ')} +49 (170) 1112233`, 'Account Name': span('ZETA (RC-DE)')
        } };
        setCustomers([customer]);
        const { roles, account } = customerResponsibilities(state.customers[0]);
        expect(roles.find((r) => r.label === 'Account Manager')).toMatchObject({ name: 'Ute, Sander', tel: '+491701112233' });
        expect(account).toBe('ZETA (RC-DE)');
        setCustomers([]);
    });

    it('liest Excel-Zellen mit Auszeichnung ohne Tags ein', () => {
        const rows = [{ Kundenname: span('Muster GmbH'), PLZ: '47051', 'Account Manager': span('Ute, Sander ') }];
        const { customers } = parseRows(rows, autoDetectMapping(Object.keys(rows[0])));
        expect(customers[0].name).toBe('Muster GmbH');
        expect(customers[0].id).toBe('k-np:muster gmbh|47051');
    });
});

describe('Lesbare Kundennamen statt durchgehender Großbuchstaben (CRM)', () => {
    it('schreibt Namen in Großbuchstaben wie üblich – Rechtsformen und Kürzel richtig', () => {
        const cases = [
            ['GEBR. LOEW GMBH & CO. KG', 'Gebr. Loew GmbH & Co. KG'],
            ['LÖWENHOF MUSTERSTADT GMBH', 'Löwenhof Musterstadt GmbH'],
            ['EFG MEYER & LOEWEN BRAND KG', 'EFG Meyer & Loewen Brand KG'],
            ['MEYER & LOEWEN BREMEN KG FACHGROSSHANDEL', 'Meyer & Loewen Bremen KG Fachgrosshandel'],
            ['ZETA AUTOMATION DUISBURG GMBH', 'Zeta Automation Duisburg GmbH'],
            ['MÜLLER-LÜDENSCHEIDT MASCHINENBAU GMBH & CO. KGAA', 'Müller-Lüdenscheidt Maschinenbau GmbH & Co. KGaA'],
            ['4X DEUTSCHLAND GMBH', '4X Deutschland GmbH'],
            ['XYZ AG', 'XYZ AG'],
            ['SCHMIDT U. SÖHNE OHG', 'Schmidt u. Söhne OHG'],
            ['HAUS DER TECHNIK E.V.', 'Haus der Technik e.V.'],
            ['VON HAGEN GMBH', 'Von Hagen GmbH'],
            ['MEIER BAU GMBH (WERK 2)', 'Meier Bau GmbH (Werk 2)']
        ];
        for (const [raw, readable] of cases) expect(readableCustomerName(raw)).toBe(readable);
    });

    it('lässt gemischt geschriebene Namen, wie sie sind', () => {
        for (const name of ['Gebr. Mustermann GmbH', 'ZETA Automation GmbH', 'Kölner Handel', 'TourFuchs Demo · 12', '']) {
            expect(readableCustomerName(name)).toBe(name);
        }
    });

    it('gilt für Import und Bestand – IDs und Kundennummer bleiben', () => {
        const rows = [{ Kundennummer: '7000001', Kundenname: 'GEBR. LOEW GMBH & CO. KG', PLZ: '59757' }];
        const { customers } = parseRows(rows, autoDetectMapping(Object.keys(rows[0])));
        const [customer] = customers;
        expect(customer.id).toBe('k-nr:7000001');
        expect(customerTextsNeedCleaning([customer])).toBe(true);
        cleanCustomerTexts(customer);
        expect(customer.name).toBe('Gebr. Loew GmbH & Co. KG');
        expect(customerTextsNeedCleaning([customer])).toBe(false);

        const ohneNummer = { id: 'k-np:gebr. loew gmbh & co. kg|59757', name: 'GEBR. LOEW GMBH & CO. KG', plz: '59757' };
        setCustomers([ohneNummer]);
        expect(state.customers[0].name).toBe('Gebr. Loew GmbH & Co. KG');
        expect(state.customers[0].id).toBe('k-np:gebr. loew gmbh & co. kg|59757');
        setCustomers([]);
    });
});
