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
        expect(cleanImportedText(span('Ulrike, Sammer '))).toBe('Ulrike, Sammer');
        expect(cleanImportedText(`${span('SCIO (RC-DE)')}`)).toBe('SCIO (RC-DE)');
        expect(cleanImportedText('<b>Vera</b>&nbsp;Kunz<br>0171 2223344')).toBe('Vera Kunz 0171 2223344');
        expect(cleanImportedText(`${span('R&amp;D &lt;Nord&gt;')}`)).toBe('R&D <Nord>');
        expect(cleanImportedText('Schmitt &amp; Co. <KG>')).toBe('Schmitt & Co. <KG>');
        expect(cleanImportedText('a < b > c')).toBe('a < b > c');
        expect(cleanImportedText('Kein &lt;Tag&gt; hier')).toBe('Kein &lt;Tag&gt; hier');
    });

    it('macht aus Trennlinien und Listen im CRM-Feld einen lesbaren Trenner', () => {
        const hr = '<hr style="height: 1px; background-color: #848484; margin:0">';
        expect(cleanImportedText(`Evonik Industries AG (RC-DE)${hr}Evonik Global`))
            .toBe('Evonik Industries AG (RC-DE) / Evonik Global');
        expect(cleanImportedText(`Regional${hr}Corporate`)).toBe('Regional / Corporate');
        expect(cleanImportedText(`${hr}Nur einer${hr}`)).toBe('Nur einer');
        expect(cleanImportedText('<ul><li>Nord</li><li>Süd</li></ul>')).toBe('Nord / Süd');
        expect(cleanImportedText('<tr><td>A</td><td>B</td></tr>')).toBe('A B');
    });

    it('zeigt den Account aus mehreren Werten mit Trenner statt HTML', () => {
        const hr = '<hr style="height: 1px; background-color: #848484; margin:0">';
        setCustomers([{ id: 'k2', name: 'SABO GMBH', extra: {
            'Account Name': `Evonik Industries AG (RC-DE)${hr}Evonik Global`,
            'Account Cluster': `Regional${hr}Corporate`
        } }]);
        expect(customerResponsibilities(state.customers[0]).account)
            .toBe('Evonik Industries AG (RC-DE) / Evonik Global · Regional / Corporate');
        setCustomers([]);
    });

    it('bereinigt alle Texte eines Kunden – IDs bleiben unverändert', () => {
        const customer = {
            id: `k-np:${span('x')}|1`, name: span('Muster GmbH'), plz: '47051',
            primaryContactId: 'ct-<b>1</b>',
            extra: { 'Account Manager': `${span('Ulrike, Sammer ')} +49 (173) 9795659`, 'Account Name': span('SCIO (RC-DE)'), 'Partner Id': span('P-7') },
            contacts: [{ id: 'ct-1', name: span('Eva Ost'), telefon: '0201 1' }],
            opps: [{ name: '<i>Retrofit</i>', phase: 'Angebot' }]
        };
        expect(customerTextsNeedCleaning([customer])).toBe(true);
        cleanCustomerTexts(customer);
        expect(customer.name).toBe('Muster GmbH');
        expect(customer.extra['Account Manager']).toBe('Ulrike, Sammer +49 (173) 9795659');
        expect(customer.extra['Account Name']).toBe('SCIO (RC-DE)');
        expect(customer.extra['Partner Id']).toBe('P-7');
        expect(customer.contacts[0].name).toBe('Eva Ost');
        expect(customer.opps[0].name).toBe('Retrofit');
        expect(customer.id).toBe(`k-np:${span('x')}|1`);
        expect(customer.primaryContactId).toBe('ct-<b>1</b>');
        expect(customerTextsNeedCleaning([customer])).toBe(false);
    });

    it('zeigt in „Zuständig" den Namen ohne Auszeichnung', () => {
        const customer = { id: 'k1', name: 'SCIO AUTOMATION DUISBURG GMBH', extra: {
            'Account Manager': `${span('Ulrike, Sammer ')} +49 (173) 9795659`, 'Account Name': span('SCIO (RC-DE)')
        } };
        setCustomers([customer]);
        const { roles, account } = customerResponsibilities(state.customers[0]);
        expect(roles.find((r) => r.label === 'Account Manager')).toMatchObject({ name: 'Ulrike, Sammer', tel: '+491739795659' });
        expect(account).toBe('SCIO (RC-DE)');
        setCustomers([]);
    });

    it('liest Excel-Zellen mit Auszeichnung ohne Tags ein', () => {
        const rows = [{ Kundenname: span('Muster GmbH'), PLZ: '47051', 'Account Manager': span('Ulrike, Sammer ') }];
        const { customers } = parseRows(rows, autoDetectMapping(Object.keys(rows[0])));
        expect(customers[0].name).toBe('Muster GmbH');
        expect(customers[0].id).toBe('k-np:muster gmbh|47051');
    });
});

describe('Lesbare Kundennamen statt durchgehender Großbuchstaben (CRM)', () => {
    it('schreibt Namen in Großbuchstaben wie üblich – Rechtsformen und Kürzel richtig', () => {
        const cases = [
            ['GEBR. GRAEF GMBH & CO. KG', 'Gebr. Graef GmbH & Co. KG'],
            ['GRÄFLICHES HOFBRAUHAUS FREISING GMBH', 'Gräfliches Hofbrauhaus Freising GmbH'],
            ['EFG CORDES & GRAEFE BRAND KG', 'EFG Cordes & Graefe Brand KG'],
            ['CORDES & GRAEFE BREMEN KG FACHGROSSHANDEL', 'Cordes & Graefe Bremen KG Fachgrosshandel'],
            ['SCIO AUTOMATION DUISBURG GMBH', 'Scio Automation Duisburg GmbH'],
            ['MÜLLER-LÜDENSCHEIDT MASCHINENBAU GMBH & CO. KGAA', 'Müller-Lüdenscheidt Maschinenbau GmbH & Co. KGaA'],
            ['3M DEUTSCHLAND GMBH', '3M Deutschland GmbH'],
            ['ABB AG', 'ABB AG'],
            ['SCHMIDT U. SÖHNE OHG', 'Schmidt u. Söhne OHG'],
            ['HAUS DER TECHNIK E.V.', 'Haus der Technik e.V.'],
            ['VON ARDENNE GMBH', 'Von Ardenne GmbH'],
            ['MEIER BAU GMBH (WERK 2)', 'Meier Bau GmbH (Werk 2)']
        ];
        for (const [raw, readable] of cases) expect(readableCustomerName(raw)).toBe(readable);
    });

    it('lässt gemischt geschriebene Namen, wie sie sind', () => {
        for (const name of ['Gebr. Grieshaber GmbH', 'SCIO Automation GmbH', 'Kölner Handel', 'TourFuchs Demo · 12', '']) {
            expect(readableCustomerName(name)).toBe(name);
        }
    });

    it('gilt für Import und Bestand – IDs und Kundennummer bleiben', () => {
        const rows = [{ Kundennummer: '8681021', Kundenname: 'GEBR. GRAEF GMBH & CO. KG', PLZ: '59757' }];
        const { customers } = parseRows(rows, autoDetectMapping(Object.keys(rows[0])));
        const [customer] = customers;
        expect(customer.id).toBe('k-nr:8681021');
        expect(customerTextsNeedCleaning([customer])).toBe(true);
        cleanCustomerTexts(customer);
        expect(customer.name).toBe('Gebr. Graef GmbH & Co. KG');
        expect(customerTextsNeedCleaning([customer])).toBe(false);

        const ohneNummer = { id: 'k-np:gebr. graef gmbh & co. kg|59757', name: 'GEBR. GRAEF GMBH & CO. KG', plz: '59757' };
        setCustomers([ohneNummer]);
        expect(state.customers[0].name).toBe('Gebr. Graef GmbH & Co. KG');
        expect(state.customers[0].id).toBe('k-np:gebr. graef gmbh & co. kg|59757');
        setCustomers([]);
    });
});
