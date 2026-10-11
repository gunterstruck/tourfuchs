#!/usr/bin/env node
/**
 * Erzeugt die festen Importdateien für die Import-Referenz (Release 17.0a).
 * Einmal erzeugt, eingefroren: tests/fixtures/import/*.xlsx. Neu erzeugen nur,
 * wenn bewusst ein weiteres Szenario hinzukommt – vorhandene Dateien bleiben.
 *
 *   node tools/compat/import-dateien-erzeugen.mjs
 */
import * as XLSX from 'xlsx';
import { writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { SERVICE_CONTRACT_FIELDS } from '../../src/features/serviceContracts.js';
import { SERVICE_VISIT_FIELDS } from '../../src/features/serviceVisits.js';

const OUT = resolve(new URL('../../tests/fixtures/import/', import.meta.url).pathname);
const write = (name, sheets) => {
    const path = resolve(OUT, name);
    if (existsSync(path) && !process.argv.includes('--force')) { console.log(`bleibt: ${name}`); return; }
    const wb = XLSX.utils.book_new();
    for (const [sheetName, headers, rows] of sheets) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows.map((r) => headers.map((h) => r[h] ?? ''))]), sheetName);
    }
    writeFileSync(path, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true }));
    console.log(`erzeugt: ${name}`);
};

// 1. Kundenliste mit allem, was der Import kennt (erfundene Werte).
const LIST = ['Kundennummer', 'Kundenname', 'Straße & Hausnummer', 'PLZ', 'Ort', 'Vertriebsbeauftragter', 'Vertriebschannel',
    'Vertriebsgruppe', 'Vertriebsbezirk', 'Hauptansprechpartner', 'Telefon', 'E-Mail', 'Umsatz 2024', 'Umsatz 2025', 'Umsatz 2026',
    'Besuchsrhythmus (Wochen)', 'Letzter Besuch (Datum)', 'VK', 'Account Manager', 'Named Account', 'PA Kundenanfrage', 'Branche'];
const customers = [
    { Kundennummer: '000101', Kundenname: 'Bäckerei Krümel GmbH', 'Straße & Hausnummer': 'Hauptstraße 1', PLZ: '45127', Ort: 'Essen', Vertriebsbeauftragter: 'Vera Beispiel', Vertriebschannel: 'Direkt', Vertriebsgruppe: 'West', Vertriebsbezirk: 'Ruhr', Hauptansprechpartner: 'Klara Krümel', Telefon: '0201 12345', 'E-Mail': 'klara@kruemel.example.test', 'Umsatz 2024': '10.000', 'Umsatz 2025': '12.500,50', 'Umsatz 2026': '13000', 'Besuchsrhythmus (Wochen)': '4', 'Letzter Besuch (Datum)': '01.09.2026', VK: 'Vera Kunz 0171 2223344', 'Account Manager': 'Max Muster', 'Named Account': 'ja', 'PA Kundenanfrage': 'PI-Partner Kunde', Branche: 'Lebensmittel' },
    { Kundennummer: '000102', Kundenname: 'Müller & Söhne KG', 'Straße & Hausnummer': 'Königsallee 1', PLZ: '40212', Ort: 'Düsseldorf', Vertriebsbeauftragter: 'Vera Beispiel', Vertriebschannel: 'Direkt', Vertriebsgruppe: 'West', Vertriebsbezirk: 'Rhein', 'Umsatz 2024': '1234,56', 'Umsatz 2025': '48.500', 'Umsatz 2026': '51.000', Branche: 'Handel' },
    { Kundennummer: '000103', Kundenname: 'Ölmühle „Süd" e.K.', 'Straße & Hausnummer': 'Marienplatz 8', PLZ: '80331', Ort: 'München', Vertriebsbeauftragter: 'Bernd Muster', Vertriebschannel: 'Handel', Vertriebsgruppe: 'Süd', Vertriebsbezirk: 'Isar', Hauptansprechpartner: 'Ömer Öz', Telefon: '+49 89 987654', 'Umsatz 2026': '0', 'Besuchsrhythmus (Wochen)': '12', 'Letzter Besuch (Datum)': '15.07.2026', Branche: 'Lebensmittel' },
    { Kundennummer: '000104', Kundenname: 'Autohaus Blitz', 'Straße & Hausnummer': 'Ring 5', PLZ: '20095', Ort: 'Hamburg', Vertriebsbeauftragter: 'Bernd Muster', Vertriebschannel: 'Direkt', Vertriebsgruppe: 'Nord', Vertriebsbezirk: 'Elbe', 'Umsatz 2024': '1.234', 'Umsatz 2025': '2,5 €', 'Umsatz 2026': '250.000', 'Named Account': 'x', Branche: 'Automobil' },
    { Kundennummer: '000105', Kundenname: 'Druckerei Punkt', 'Straße & Hausnummer': 'Markt 2', PLZ: '04109', Ort: 'Leipzig', Vertriebsbeauftragter: 'Carla Beispiel', Vertriebschannel: 'Partner', Vertriebsgruppe: 'Ost', Vertriebsbezirk: 'Sachsen', 'Umsatz 2025': '7.000', Branche: 'Druck' },
    { Kundennummer: '000106', Kundenname: 'Unbekannte PLZ GmbH', 'Straße & Hausnummer': 'Nirgendwo 1', PLZ: '00000', Ort: 'Nirgendwo', Vertriebsbeauftragter: 'Carla Beispiel', Vertriebsbezirk: 'Sachsen' },
    { Kundennummer: '000107', Kundenname: '', PLZ: '45127', Vertriebsbezirk: 'Ruhr' },
    { Kundennummer: '000108', Kundenname: 'Doppelt GmbH', PLZ: '50667', Ort: 'Köln', Vertriebsbezirk: 'Rhein' },
    { Kundennummer: '000108', Kundenname: 'Doppelt GmbH', PLZ: '50667', Ort: 'Köln', Vertriebsbezirk: 'Rhein' }
];
write('kundenliste.xlsx', [['Kunden', LIST, customers]]);

// 2. Dieselbe Liste einen Monat später: geändert, entfallen, neu.
const later = customers.filter((c) => c.Kundennummer !== '000105').map((c) => ({ ...c }));
later.find((c) => c.Kundennummer === '000102')['Straße & Hausnummer'] = 'Königsallee 99';
later.find((c) => c.Kundennummer === '000102')['Umsatz 2026'] = '55.000';
later.push({ Kundennummer: '000109', Kundenname: 'Neukunde AG', 'Straße & Hausnummer': 'Zeil 10', PLZ: '60313', Ort: 'Frankfurt am Main', Vertriebsbeauftragter: 'Vera Beispiel', Vertriebschannel: 'Direkt', Vertriebsgruppe: 'Mitte', Vertriebsbezirk: 'Main', 'Umsatz 2026': '3.300' });
write('kundenliste-reimport.xlsx', [['Kunden', LIST, later]]);

// 3. Vertriebs-Arbeitsmappe (Aufbau wie die echte, Werte erfunden).
const MAIN = ['Herkunft_Gesamtdatei', 'Channel', 'Vertriebsgruppe', 'Quelldatei', 'IFA', 'Accountname', 'Land', 'PLZ', 'Stadt', 'Straße',
    'Debitor (Kundenmaster)', 'Debitor (VInfo)', 'Übergabe notwendig', 'VBEZ (Alt)', 'VB (Alt)', 'VBEZ (Neu)', 'VB (Neu)',
    'Orders FY24', 'Orders FY25', 'Orders FY26', 'SCB Anteil % (GJ24-26)', 'Service Anteil % (GJ24-26)', 'Software Anteil % (GJ24-26)',
    'Anzahl Kontakte', 'SieSales Link', 'Ø Orders FY24-26'];
const FILES = ['Gesamtdatei', 'Zeilen VBEZ Übersicht', 'Zeilen AE je PCK', 'Zeilen SieSales Kontakte', 'Zeilen SieSales Opps'];
const PRODUCTS = ['Herkunft_Gesamtdatei', 'Quelldatei', 'IFA', 'Accountname', 'VBEZ', 'PCK', 'PCK Beschreibung', '2024', '2025', '2026', 'AE GJ24-26'];
const CONTACTS = ['Quelldatei', 'IFA Nr', 'Accountname', 'SieSales Link Kontakt', 'SieSales-ID', 'Nachname', 'Vorname', 'Email', 'Telefon',
    'Mobiltelefon', 'Double Opt-In', 'Opt-Out', 'Abteilung', 'Funktionsbeschreibung', 'Status', 'Löschvormerkung', 'Werbesperre Email', 'Nicht anrufen'];
const OPPS = ['Quelldatei', 'IfA', 'Accountname', 'Opportunity-ID', 'Opportunityname', 'Opportunityverantwortlicher', 'erwartete Auftragseingang',
    'Phase', 'Status', 'Prognosekategorie', 'Schlussmonat', 'Beschreibung', 'Wettbewerber'];
const main = [
    { IFA: '000123', Accountname: 'Nord GmbH', PLZ: '50667', Stadt: 'Köln', Straße: 'Domkloster 4', 'Debitor (Kundenmaster)': '0042', Channel: 'Direkt', Vertriebsgruppe: 'VG 1', 'VBEZ (Neu)': 'VBEZ 11', 'VB (Neu)': 'Anna Neu', 'VB (Alt)': 'Bernd Alt', 'VBEZ (Alt)': 'VBEZ 10', 'Übergabe notwendig': 'Ja', 'Orders FY24': '1.000.000', 'Orders FY25': '1.100.000', 'Orders FY26': '990.000', 'Ø Orders FY24-26': '1.030.000', 'Service Anteil % (GJ24-26)': '60%', 'Software Anteil % (GJ24-26)': '40%', 'SieSales Link': 'https://crm.example.test/account/1' },
    { IFA: '000123', Accountname: 'Nord GmbH & Co.', PLZ: '50667', Stadt: 'Köln', Straße: 'Domkloster 4', 'Debitor (Kundenmaster)': '0042', Channel: 'Direkt', Vertriebsgruppe: 'VG 1', 'VBEZ (Neu)': 'VBEZ 12', 'VB (Neu)': 'Anna Neu', 'VB (Alt)': 'Bernd Alt', 'Übergabe notwendig': 'Ja', 'Orders FY24': '1.000.000', 'Orders FY25': '1.100.000', 'Orders FY26': '990.000', 'Service Anteil % (GJ24-26)': '0,6', 'Software Anteil % (GJ24-26)': '0,4', 'SieSales Link': 'javascript:alert(1)' },
    { IFA: '000777', Accountname: 'Süd AG', PLZ: '80331', Stadt: 'München', 'Debitor (VInfo)': '0099', Channel: 'Handel', Vertriebsgruppe: 'VG 2', 'VBEZ (Neu)': 'VBEZ 42', 'VB (Neu)': 'Ben Hof', 'Orders FY26': '75.000' },
    { IFA: '000888', Accountname: 'Ohne Debitor KG', PLZ: '20095', Stadt: 'Hamburg', Channel: 'Direkt', Vertriebsgruppe: 'VG 3', 'VBEZ (Neu)': 'VBEZ 7', 'VB (Neu)': 'Cleo Nord' }
];
write('vertriebs-arbeitsmappe.xlsx', [
    ['VBEZ Übersicht', MAIN, main],
    ['Dateiübersicht', FILES, [{ Gesamtdatei: 'A.xlsx', 'Zeilen VBEZ Übersicht': '4', 'Zeilen AE je PCK': '2', 'Zeilen SieSales Kontakte': '5', 'Zeilen SieSales Opps': '3' }]],
    ['AE je PCK', PRODUCTS, [
        { IFA: '000123', PCK: '0815', 'PCK Beschreibung': 'Antriebe', 2024: '100.000', 2025: '50.000', 'AE GJ24-26': '150.000' },
        { IFA: '999999', PCK: '0816', 'PCK Beschreibung': 'Fremd', 'AE GJ24-26': '1' }
    ]],
    ['SieSales Kontakte', CONTACTS, [
        { 'IFA Nr': '000123', Vorname: 'Clara', Nachname: 'Klein', Email: 'clara@nord.example.test', Telefon: '0221 111', Abteilung: 'Einkauf', 'Double Opt-In': 'Ja', 'SieSales-ID': 'C1' },
        { 'IFA Nr': '000123', Vorname: 'Dirk', Nachname: 'Dunkel', Telefon: '0221 222', Email: 'dirk@nord.example.test', 'Nicht anrufen': 'Ja', 'Werbesperre Email': 'X', 'SieSales-ID': 'C2' },
        { 'IFA Nr': '000123', Vorname: 'Erna', Nachname: 'Ex', Telefon: '0221 333', Löschvormerkung: 'Ja', 'SieSales-ID': 'C3' },
        { 'IFA Nr': '000777', Vorname: 'Fritz', Nachname: 'Fort', Mobiltelefon: '0171 444', Funktionsbeschreibung: 'Werksleiter', 'SieSales-ID': 'C4' },
        { 'IFA Nr': '555555', Vorname: 'Gina', Nachname: 'Gast', 'SieSales-ID': 'C5' }
    ]],
    ['SieSales Opps', OPPS, [
        { IfA: '000123', 'Opportunity-ID': 'OP-1', Opportunityname: 'Retrofit Linie 3', 'erwartete Auftragseingang': '120.000', Phase: '3', Status: 'offen', Prognosekategorie: 'Commit', Schlussmonat: '31.03.2027', Opportunityverantwortlicher: 'Anna Neu', Wettbewerber: 'Geheim AG', Beschreibung: 'Vertraulicher Text' },
        { IfA: '000123', 'Opportunity-ID': 'OP-2', Opportunityname: 'Altprojekt', Phase: '5', Status: 'geschlossen', Prognosekategorie: 'gewonnen' },
        { IfA: '000777', 'Opportunity-ID': 'OP-3', Opportunityname: 'Serviceausbau', Phase: '1', Status: 'offen', 'erwartete Auftragseingang': '30.000' }
    ]]
]);

// 4. Serviceverträge und 5. Serviceeinsätze – Überschriften = Feldbezeichnungen.
const labels = (fields) => fields.map((f) => f.label);
const byKey = (fields, values) => Object.fromEntries(fields.map((f) => [f.label, values[f.key] ?? '']));
write('servicevertraege.xlsx', [['Verträge', labels(SERVICE_CONTRACT_FIELDS), [
    byKey(SERVICE_CONTRACT_FIELDS, { sourceSystem: 'SAP', contractId: 'V-1001', customerNumber: '000101', title: 'Wartung Backstraße', type: 'Wartungsvertrag', status: 'aktiv', startDate: '01.01.2026', endDate: '31.12.2026', unlimited: 'nein', cancellationDeadline: '30.09.2026', autoRenewal: 'ja', renewalMonths: '12', noticeDays: '90', annualValue: '12.000', currency: 'EUR', owner: 'Max Muster', manager: 'Carla Beispiel', managerEmail: 'carla@example.test', dataAsOf: '01.10.2026', scope: 'Inspektion', sla: 'Gold', maintenanceIntervalMonths: '6', criticality: 'hoch' }),
    byKey(SERVICE_CONTRACT_FIELDS, { sourceSystem: 'SAP', contractId: 'V-1002', customerNumber: '000104', title: 'Hebebühnen', type: 'Servicevertrag', status: 'aktiv', startDate: '01.03.2025', unlimited: 'ja', autoRenewal: 'nein', annualValue: '4.800', currency: 'EUR', dataAsOf: '01.10.2026' }),
    byKey(SERVICE_CONTRACT_FIELDS, { sourceSystem: 'SAP', contractId: 'V-1003', customerNumber: '999999', title: 'Ohne Kunde', type: 'Servicevertrag', status: 'aktiv', unlimited: 'ja', autoRenewal: 'nein', dataAsOf: '01.10.2026' })
]]]);
write('serviceeinsaetze.xlsx', [['Einsätze', labels(SERVICE_VISIT_FIELDS), [
    byKey(SERVICE_VISIT_FIELDS, { sourceSystem: 'SAP', workOrderId: 'WO-1', operationId: '10', customerNumber: '000101', contractSourceSystem: 'SAP', contractId: 'V-1001', reason: 'Inspektion Ofen', dueDate: '15.10.2026', timeWindowStart: '08:00', timeWindowEnd: '12:00', durationMin: '90', priority: 'hoch', requiredSkills: 'Elektro', assignedTo: 'Team West', status: 'offen', dataAsOf: '01.10.2026', assetId: 'A-7', note: 'Zugang über Tor 2' }),
    byKey(SERVICE_VISIT_FIELDS, { sourceSystem: 'SAP', workOrderId: 'WO-2', customerNumber: '000104', reason: 'Störung Hebebühne', dueDate: '12.10.2026', durationMin: '60', priority: 'kritisch', status: 'offen', dataAsOf: '01.10.2026' })
]]]);
