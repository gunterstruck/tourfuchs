// Erzeugt mit dem Code DIESES (historischen) Stands eine echte Umzugsdatei.
// Läuft in einer Arbeitskopie des jeweiligen Commits; nutzt nur dessen APIs.
import { it } from 'vitest';
import { writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = process.env.TFSAFE_OUT;
const TAG = process.env.TFSAFE_TAG;
const has = (p) => existsSync(resolve(process.cwd(), p));

it('erzeugt eine Umzugsdatei mit dem damaligen Code', async () => {
    const excel = await import('../src/services/excel.js');
    const st = await import('../src/core/state.js');
    const safe = await import('../src/features/safeTransfer.js');

    // Kundenliste wie aus Excel: Überschriften = Feldbezeichnungen dieses Stands.
    const label = (key) => excel.FIELDS.find((f) => f.key === key)?.label;
    const base = [
        { nummer: '10001', name: 'Altbestand Nord GmbH', strasse: 'Domkloster 4', plz: '50667', ort: 'Köln', vb: 'Vera Beispiel', channel: 'Direkt', gruppe: 'West', bezirk: 'Rhein', ansprechpartner: 'Anna Alt', telefon: '0221 123456', email: 'anna@example.test', umsatz: '125.000', rhythmusWochen: '4', letzterBesuch: '01.09.2026', lat: '50.9413', lng: '6.9583' },
        { nummer: '10002', name: 'Müller & Söhne KG', strasse: 'Königsallee 1', plz: '40212', ort: 'Düsseldorf', vb: 'Vera Beispiel', channel: 'Direkt', gruppe: 'West', bezirk: 'Rhein', ansprechpartner: '', telefon: '', email: '', umsatz: '48.500,50', rhythmusWochen: '', letzterBesuch: '', lat: '51.2254', lng: '6.7763' },
        { nummer: '0815', name: 'Ölmühle „Süd" e.K.', strasse: 'Marienplatz 8', plz: '80331', ort: 'München', vb: 'Bernd Muster', channel: 'Handel', gruppe: 'Süd', bezirk: 'Isar', ansprechpartner: 'Ömer Öz', telefon: '+49 89 987654', email: '', umsatz: '0', rhythmusWochen: '12', letzterBesuch: '15.07.2026', lat: '48.1374', lng: '11.5755' }
    ];
    const rows = base.map((c) => {
        const row = {};
        for (const [key, value] of Object.entries(c)) if (label(key)) row[label(key)] = value;
        row.VK = 'Vera 0171 1';      // Zusatzspalte (landet in extra)
        return row;
    });
    const headers = Object.keys(rows[0]);
    const mapping = excel.autoDetectMapping(headers);
    const { customers } = excel.parseRows(rows, mapping);
    if (!customers.length) throw new Error('keine Kunden erzeugt');
    for (const c of customers) {
        if (c.lat == null && c.lng == null) { c.lat = 50.94; c.lng = 6.96; c.geo = 'plz'; }
        c.geo = c.geo || 'exakt';
    }
    // Variante: ein Kunde ohne Position (Verortung damals gescheitert) – beim
    // Einlösen muss TourFuchs ihn über die PLZ wieder auf die Karte setzen.
    if (process.env.TFSAFE_NOCOORDS) {
        Object.assign(customers[1], { lat: null, lng: null });
        delete customers[1].geo;
    }
    if (process.env.TFSAFE_RICH) {
        Object.assign(customers[0], {
            umsatzJahre: { 2024: 100000, 2025: 118000, 2026: 125000 },
            contacts: [
                { id: 'p1', name: 'Paul Prom', art: 'promotor', thema: 'Akku', primary: false },
                { id: 'ss-1', name: 'Dirk Dunkel', quelle: 'arbeitsmappe', abteilung: 'Einkauf', nichtAnrufen: true, sperreEmail: true, doi: false, primary: false },
                { id: 'ss-2', name: 'Erika Einkauf', quelle: 'arbeitsmappe', telefon: '+49 221 555', email: 'erika@example.test', doi: true, primary: true }
            ],
            opps: [{ id: 'OP-1', name: 'Retrofit Linie 2', phase: '3', status: 'offen', amount: 120000, close: '2027-03-31', owner: 'Vera Beispiel' }],
            produkte: [{ pck: '0815', beschreibung: 'Antriebe', jahre: { 2024: 100, 2025: 50 }, summe: 150 }]
        });
        customers[0].extra = { ...(customers[0].extra || {}), 'SieSales Link': 'https://crm.example.test/a/1', 'Übergabe notwendig': 'ja', 'VB (Alt)': 'Bernd Muster' };
    }
    st.setCustomers(customers, { fileName: `Kundenliste-${TAG}.xlsx`, importedAt: '2026-09-01T08:00:00.000Z' });
    st.setTerritory?.('bezirk', 'Rhein', 'vb', 'Vera Beispiel', 'Rhein');

    let contracts = [];
    if (has('src/features/serviceContracts.js') && st.setServiceContracts) {
        const sc = await import(/* @vite-ignore */ ['..', 'src', 'features', 'serviceContracts.js'].join('/'));
        const value = {
            sourceSystem: 'SAP', contractId: 'V-1001', sourceCustomerId: 'S-10001', customerNumber: '10001', title: 'Wartung Halle 3',
            type: 'Wartungsvertrag', status: 'aktiv', startDate: '01.01.2026', endDate: '31.12.2026', unlimited: 'nein',
            cancellationDeadline: '30.09.2026', actionBy: '01.09.2026', autoRenewal: 'ja', renewalMonths: '12', noticeDays: '90',
            annualValue: '12.000', currency: 'EUR', owner: 'Max Muster', manager: 'Carla Beispiel', managerEmail: 'carla@example.test',
            dataAsOf: '01.07.2026', scope: 'Inspektion', sla: 'Gold', maintenanceIntervalMonths: '6', criticality: 'hoch'
        };
        const row = {};
        for (const f of sc.SERVICE_CONTRACT_FIELDS) row[f.label] = value[f.key] ?? '';
        const parsed = sc.parseServiceContractRows([row], sc.autoDetectServiceContractMapping(Object.keys(row)), { today: new Date('2026-08-01') });
        contracts = parsed.contracts || parsed.valid || parsed.items || [];
        if (!contracts.length) throw new Error(`keine Verträge: ${JSON.stringify(parsed).slice(0, 400)}`);
        const sources = { SAP: { fileName: `Vertraege-${TAG}.xlsx`, importedAt: '2026-09-01T08:00:00.000Z', dataAsOf: '2026-07-01' } };
        st.setServiceContracts(contracts, sources);
    }

    let visits = [];
    if (has('src/features/serviceVisits.js') && st.setServiceVisits) {
        const sv = await import(/* @vite-ignore */ ['..', 'src', 'features', 'serviceVisits.js'].join('/'));
        const value = {
            sourceSystem: 'SAP', workOrderId: 'WO-1', operationId: '10', customerNumber: '10001', contractSourceSystem: 'SAP', contractId: 'V-1001',
            reason: 'Inspektion', dueDate: '15.10.2026', slaDueAt: '20.10.2026', timeWindowStart: '08:00', timeWindowEnd: '12:00',
            durationMin: '90', priority: 'hoch', requiredSkills: 'Elektro', assignedTo: 'Team Nord', status: 'offen', dataAsOf: '01.10.2026',
            siteId: 'W1', assetId: 'A-7', sourceUrl: 'https://sap.example.test/wo/1', note: 'Zugang über Tor 2'
        };
        const row = {};
        for (const f of sv.SERVICE_VISIT_FIELDS) row[f.label] = value[f.key] ?? '';
        const parsed = sv.parseServiceVisitRows([row], sv.autoDetectServiceVisitMapping(Object.keys(row)), { fileName: `Einsaetze-${TAG}.xlsx` });
        visits = parsed.visits || parsed.valid || parsed.items || [];
        if (!visits.length) throw new Error(`keine Einsätze: ${JSON.stringify(parsed).slice(0, 400)}`);
        st.setServiceVisits(visits, { SAP: { fileName: `Einsaetze-${TAG}.xlsx`, importedAt: '2026-10-01T08:00:00.000Z', dataAsOf: '2026-10-01' } });
    }

    if (st.setPlaces) st.setPlaces([{ id: 'place-1', name: 'Büro Köln', lat: 50.94, lng: 6.95, kind: 'office' }]);

    const snap = st.datasetSnapshot();
    const { container, keyQr } = await safe.createSafeTransfer(snap);
    const stem = `TourFuchs-Umzug-${TAG}`;
    writeFileSync(resolve(OUT, `${stem}.tfsafe`), JSON.stringify(container));
    writeFileSync(resolve(OUT, `${stem}.key.txt`), keyQr);
    writeFileSync(resolve(OUT, `${stem}.erwartet.json`), JSON.stringify(JSON.parse(JSON.stringify(snap)), null, 2));
    console.log(TAG, 'Kunden', customers.length, 'Verträge', contracts.length, 'Einsätze', visits.length, 'Orte', (snap.places || []).length);
});
