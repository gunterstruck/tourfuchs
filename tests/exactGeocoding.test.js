import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    EXACT_GEOCODE_PREF_KEY,
    estimateMinutes,
    exactGeocodePreference,
    pendingExactAddresses,
    runExactGeocoding,
    setExactGeocodePreference
} from '../src/ui/exactGeocoding.js';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('Adressgenaue Verortung auf allen Geräten', () => {
    beforeEach(() => localStorage.removeItem(EXACT_GEOCODE_PREF_KEY));

    it('merkt sich die einmalige Antwort', () => {
        expect(exactGeocodePreference()).toBeNull();
        setExactGeocodePreference('yes');
        expect(exactGeocodePreference()).toBe('yes');
        setExactGeocodePreference('no');
        expect(exactGeocodePreference()).toBe('no');
    });

    it('schätzt die Dauer ehrlich (etwa eine Adresse pro Sekunde, aufgerundet)', () => {
        expect(estimateMinutes(1)).toBe(1);
        expect(estimateMinutes(214)).toBe(4);
        expect(estimateMinutes(2000)).toBe(37);
    });

    it('zählt nur eigene Kunden mit Straße, die noch nicht genau verortet sind – je Adresse einmal', () => {
        const customers = [
            { strasse: 'Hauptstr. 1', plz: '45136', ort: 'Essen', geo: 'plz' },
            { strasse: 'Hauptstr. 1', plz: '45136', ort: 'Essen', geo: 'plz' },
            { strasse: 'Ring 2', plz: '44135', ort: 'Dortmund', geo: 'exakt' },
            { strasse: '', plz: '50667', ort: 'Köln', geo: 'plz' },
            { strasse: 'Beispielweg 3', plz: '40213', ort: 'Düsseldorf', geo: 'plz', demo: true }
        ];
        expect(pendingExactAddresses(customers)).toBe(1);
    });

    it('läuft ohne ausdrückliches Ja nicht von selbst', async () => {
        expect(await runExactGeocoding()).toBeNull();
        setExactGeocodePreference('no');
        expect(await runExactGeocoding()).toBeNull();
    });

    it('fragt nach dem Import, läuft bei Ja im Hintergrund und setzt nach einem Funkloch fort', () => {
        const module = read('src/ui/exactGeocoding.js');
        expect(module).toContain("on('data:imported', onDataImported);");
        expect(module).toContain("window.addEventListener('online', () => runExactGeocoding());");
        expect(module).toContain("on('app:ready'");
    });

    it('sagt in der Rückfrage genau, was übertragen wird – und bietet den Schalter in der Info', () => {
        const html = read('index.html');
        const dialog = html.slice(html.indexOf('id="geocode-offer-dialog"'), html.indexOf('</dialog>', html.indexOf('id="geocode-offer-dialog"')));
        expect(dialog).toContain('<b>nur Straße, PLZ und Ort</b>');
        expect(dialog).toContain('keine Namen, Kundennummern, Umsätze oder Kontakte');
        expect(dialog).toContain('Ja, immer genau verorten');
        expect(dialog).toContain('Nein, PLZ reicht');
        expect(html).toContain('id="exact-geocode-toggle"');
    });

    it('verortet nie in der Handy-Vorschau – nur die echte App fragt an', () => {
        const module = read('src/ui/exactGeocoding.js');
        expect(module).toContain("if (handle || insideMobilePreview) return null;");
        expect(module).toMatch(/function onDataImported\(payload\) \{\s*if \(insideMobilePreview\) return;/);
    });

    it('teilt sich am Schreibtisch den Lauf mit dem Knopf „Adressen exakt verorten"', () => {
        const sidebar = read('src/ui/sidebar.js');
        expect(sidebar).toContain('await runExactGeocoding({ manual: true });');
        expect(sidebar).not.toContain('geocodeExact(');
    });
});
