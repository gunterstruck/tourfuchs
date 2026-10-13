import { describe, expect, it } from 'vitest';
import { customerNamesNeedNormalization, normalizeCustomerName } from '../src/features/customerName.js';
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
        expect(customerNamesNeedNormalization(oldDataset.customers)).toBe(true);

        setCustomers(oldDataset.customers);
        expect(state.customers[0].name).toBe('Schmitt & Co. KG');
        expect(state.customers[0].id).toBe(oldCustomer.id);
        expect(datasetSnapshot().customers[0].name).toBe('Schmitt & Co. KG');
        const popup = customerPopupHtml(state.customers[0]);
        expect(popup).toContain('Schmitt &amp; Co. KG');
        expect(popup).not.toContain('&amp;amp;');
        expect(customerNamesNeedNormalization(state.customers)).toBe(false);
        setCustomers([]);
    });
});
