import { describe, expect, it } from 'vitest';
import { cleanCustomerTexts, cleanImportedText, customerTextsNeedCleaning, normalizeCustomerName } from '../src/features/customerName.js';
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
