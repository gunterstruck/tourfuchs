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

describe('Verortung: Status, Anhalten und Dienstfehler', () => {
    const own = (i) => ({ id: `k-${i}`, name: `Kunde ${i}`, strasse: `Weg ${i}`, plz: '45127', ort: 'Essen', geo: 'plz' });

    it('speichert „Dienst nicht bereit" (429/5xx) nicht als „nicht gefunden" und hört nach drei Fehlern auf', async () => {
        const { CONFIG } = await import('../src/core/config.js');
        const { geocodeExact } = await import('../src/services/geocode.js');
        const delay = CONFIG.nominatim.delayMs;
        CONFIG.nominatim.delayMs = 0;
        let calls = 0;
        const realFetch = globalThis.fetch;
        globalThis.fetch = async () => { calls += 1; return { ok: false, status: 503, json: async () => [] }; };
        try {
            const customers = [own(1), own(2), own(3), own(4), own(5)];
            const result = await geocodeExact(customers).run;
            expect(result.serviceDown).toBe(true);
            expect(calls).toBe(3);
            expect(result.failed).toBe(0);            // nichts fälschlich als „nicht gefunden"
            expect(customers.every((c) => c.geo === 'plz')).toBe(true);
        } finally {
            globalThis.fetch = realFetch;
            CONFIG.nominatim.delayMs = delay;
        }
    });

    it('bricht beim Anhalten auch eine laufende Anfrage sofort ab', async () => {
        const { geocodeExact } = await import('../src/services/geocode.js');
        const realFetch = globalThis.fetch;
        globalThis.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(new Error('aborted')));
        });
        try {
            const handle = geocodeExact([own(1), own(2)]);
            setTimeout(() => handle.cancel(), 20);
            const started = Date.now();
            const result = await handle.run;
            expect(result.cancelled).toBe(true);
            expect(Date.now() - started).toBeLessThan(2000);
        } finally {
            globalThis.fetch = realFetch;
        }
    });

    it('räumt immer auf, stoppt beim Sperren des Tresors und zeigt den Stand in der Info', () => {
        const module = read('src/ui/exactGeocoding.js');
        expect(module).toContain('} finally {');
        expect(module).toContain("onVault('locked'");
        expect(module).toContain('function renderInfoState()');
        const html = read('index.html');
        expect(html).toContain('id="exact-geocode-state" class="geocode-state" role="status"');
        expect(html).toContain('id="exact-geocode-now"');
    });
});

describe('Fortschritts-Pille', () => {
    it('hält Platz für fünfstellige Zahlen frei („10000/10000")', async () => {
        const { readFileSync } = await import('node:fs');
        const css = readFileSync('src/styles/components.css', 'utf8');
        const rule = css.slice(css.indexOf('.geocode-status b {'), css.indexOf('}', css.indexOf('.geocode-status b {')));
        expect(rule).toContain('min-width: 11ch');
        expect(rule).toContain('tabular-nums');
        expect(css).toMatch(/\.geocode-status button \{ flex: 0 0 auto;/);
    });
});
