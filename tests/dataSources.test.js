import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
    DATA_SOURCES_KEY, MAX_DATA_SOURCES, addDataSource, forgetDataSourceFiles,
    loadDataSources, removeDataSource, saveDataSources, updateDataSource, validSourceLink
} from '../src/features/dataSources.js';
import { EXPORT_MESSAGES } from '../src/i18n/exportMessages.js';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Datenquellen – Logik', () => {
    beforeEach(() => localStorage.clear());

    it('lässt nur http(s)-Links zu', () => {
        expect(validSourceLink('https://firma.sharepoint.com/sites/vertrieb/Mappe.xlsx')).toMatch(/^https:/);
        expect(validSourceLink('http://intranet/liste.xlsx')).toMatch(/^http:/);
        expect(validSourceLink('javascript:alert(1)')).toBe('');
        expect(validSourceLink('file:///C:/daten.xlsx')).toBe('');
        expect(validSourceLink('kein link')).toBe('');
        expect(validSourceLink('')).toBe('');
    });

    it('legt Quellen an und meldet Gründe statt still zu scheitern', () => {
        const first = addDataSource([], { name: 'Vertriebs-Arbeitsmappe', url: 'https://firma.sharepoint.com/x.xlsx' });
        expect(first.ok).toBe(true);
        expect(first.source).toMatchObject({ name: 'Vertriebs-Arbeitsmappe', lastRun: '', fileName: '' });
        expect(addDataSource([], { name: 'X', url: 'javascript:alert(1)' })).toEqual({ ok: false, reason: 'link' });
        expect(addDataSource([], { name: ' ', url: '' })).toEqual({ ok: false, reason: 'empty' });
        // Nur Link: Name aus dem Host.
        expect(addDataSource([], { name: '', url: 'https://firma.sharepoint.com/a.xlsx' }).source.name).toBe('firma.sharepoint.com');
        const full = Array.from({ length: MAX_DATA_SOURCES }, (_, i) => ({ id: `q${i}`, name: `Q${i}`, url: '' }));
        expect(addDataSource(full, { name: 'zu viel' })).toEqual({ ok: false, reason: 'full' });
    });

    it('speichert nur Name, Link, Zeitpunkt und Dateiname – und liest robust', () => {
        const { list } = addDataSource([], { name: 'Mappe', url: 'https://firma.sharepoint.com/m.xlsx' });
        const updated = updateDataSource(list, list[0].id, { lastRun: '2026-10-10T08:12:00.000Z', fileName: 'Mappe.xlsx', kunden: ['geheim'] });
        saveDataSources(updated);
        const stored = JSON.parse(localStorage.getItem(DATA_SOURCES_KEY));
        expect(Object.keys(stored[0]).sort()).toEqual(['fileName', 'id', 'lastRun', 'name', 'url']);
        expect(loadDataSources()[0]).toMatchObject({ name: 'Mappe', fileName: 'Mappe.xlsx' });

        localStorage.setItem(DATA_SOURCES_KEY, '{kaputt');
        expect(loadDataSources()).toEqual([]);
        localStorage.setItem(DATA_SOURCES_KEY, JSON.stringify([{ name: 'X', url: 'javascript:alert(1)' }, null]));
        expect(loadDataSources()).toEqual([expect.objectContaining({ name: 'X', url: '' })]);
    });

    it('„Daten löschen" vergisst Datei und Zeitpunkt, die Links bleiben', () => {
        const list = [{ id: 'a', name: 'Mappe', url: 'https://x.example/m.xlsx', lastRun: '2026-10-10T08:00:00Z', fileName: 'm.xlsx' }];
        expect(forgetDataSourceFiles(list)).toEqual([{ id: 'a', name: 'Mappe', url: 'https://x.example/m.xlsx', lastRun: '', fileName: '' }]);
        expect(removeDataSource(list, 'a')).toEqual([]);
    });
});

describe('Datenquellen – Verdrahtung', () => {
    const ui = read('src/ui/dataSources.js');

    it('ruft keinen Link selbst ab und öffnet ihn nur als neuen Tab', () => {
        expect(ui).not.toMatch(/\bfetch\(|XMLHttpRequest|window\.open\(/);
        expect(ui).toContain('target="_blank" rel="noopener noreferrer"');
    });

    it('liest über den gewohnten Import ein und merkt sich die Datei nur lokal', () => {
        expect(ui).toContain("import { importExternalFile } from './importWizard.js'");
        expect(ui).toContain('showOpenFilePicker');
        expect(ui).toContain("on('dataset:cleared', forgetFiles)");
        // Stand erst, wenn die Liste wirklich gespeichert ist – unabhängig von Folge-Dialogen.
        expect(ui).toContain("on('import:completed', onImported)");
        expect(read('src/ui/importWizard.js')).toContain("if (persisted) emit('import:completed', { fileName: parsed.fileName });");
        expect(read('src/main.js')).toContain('initDataSources();');
    });

    it('steht im Reiter Daten und ist übersetzt', () => {
        const html = read('index.html');
        expect(html).toContain('id="data-sources"');
        const keys = Object.keys(EXPORT_MESSAGES.de).filter((key) => key.startsWith('sources.'));
        expect(keys.length).toBeGreaterThan(15);
        for (const locale of ['en', 'fr', 'es']) {
            for (const key of keys) expect(EXPORT_MESSAGES[locale][key], `${locale} ${key}`).toBeTruthy();
        }
    });

    it('Wissensbasis, Datenschutz und README nennen die Beschriftungen', () => {
        const normalize = (value) => value.replace(/[„“”"']/g, '"');
        const guide = normalize(read('docs/guide-ki-wissensbasis.md'));
        for (const key of ['sources.title', 'sources.open', 'sources.refresh', 'sources.unlink', 'sources.add']) {
            expect(guide).toContain(normalize(EXPORT_MESSAGES.de[key]));
        }
        expect(read('public/datenschutz.html')).toContain('Datenquellen &amp; Aktualisieren');
        expect(read('README.md')).toContain('Datenquellen');
    });
});
