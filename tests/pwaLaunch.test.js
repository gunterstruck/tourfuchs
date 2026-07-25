import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    SHARE_CACHE,
    SHARE_ENTRY,
    readLaunchIntent,
    shouldOfferInstall,
    takeSharedFile,
    urlWithoutLaunchParams
} from '../src/services/pwaLaunch.js';

describe('Startabsichten der installierten App', () => {
    it('erkennt nur die vorgesehenen Shortcut-Ziele', () => {
        expect(readLaunchIntent('?start=tour')).toEqual({ start: 'tour', share: false });
        expect(readLaunchIntent('?start=nearby')).toEqual({ start: 'nearby', share: false });
        expect(readLaunchIntent('?start=import')).toEqual({ start: 'import', share: false });
        expect(readLaunchIntent('?start=alles-loeschen').start).toBeNull();
        expect(readLaunchIntent('')).toEqual({ start: null, share: false });
    });

    it('erkennt die geteilte Datei', () => {
        expect(readLaunchIntent('?share=1').share).toBe(true);
        expect(readLaunchIntent('?share=0').share).toBe(false);
    });

    it('räumt die Startparameter weg, ohne andere zu verlieren', () => {
        expect(urlWithoutLaunchParams('https://tourfuchs.app/?start=tour'))
            .toBe('/');
        expect(urlWithoutLaunchParams('https://tourfuchs.app/?mobilePreview&share=1'))
            .toBe('/?mobilePreview=');
        expect(urlWithoutLaunchParams('https://tourfuchs.app/?start=tour#t=abc'))
            .toBe('/#t=abc');
    });
});

describe('Geteilte Datei übernehmen', () => {
    function fakeCaches(entry) {
        const store = new Map(entry ? [[SHARE_ENTRY, entry]] : []);
        return {
            deleted: store,
            open: async () => ({
                match: async (key) => store.get(key) || undefined,
                delete: async (key) => store.delete(key)
            })
        };
    }

    it('liest Inhalt und Dateinamen und leert den Posteingang', async () => {
        const response = new Response('Name;PLZ\nA;45136', {
            headers: { 'content-type': 'text/csv', 'x-tf-filename': encodeURIComponent('Kundenliste Süd.csv') }
        });
        const caches = fakeCaches(response);
        const file = await takeSharedFile(caches);

        expect(file.name).toBe('Kundenliste Süd.csv');
        expect(await file.text()).toContain('45136');
        // genau einmal gemeint: der Eintrag ist danach weg
        expect(await takeSharedFile(caches)).toBeNull();
    });

    it('bleibt still, wenn nichts geteilt wurde', async () => {
        expect(await takeSharedFile(fakeCaches(null))).toBeNull();
        expect(await takeSharedFile(undefined)).toBeNull();
    });

    it('benennt den Cache stabil – der Service Worker schreibt dorthin', () => {
        const sw = readFileSync(resolve(process.cwd(), 'public/share-target.js'), 'utf8');
        expect(sw).toContain(`'${SHARE_CACHE}'`);
        expect(sw).toContain(`'${SHARE_ENTRY}'`);
        expect(sw).toContain('/share-target');
        expect(sw).toContain('?share=1');
    });
});

describe('Installations-Angebot', () => {
    const working = { promptAvailable: true, hasOwnData: true, tourStopCount: 2 };

    it('kommt erst, wenn mit eigenen Daten gearbeitet wird', () => {
        expect(shouldOfferInstall(working)).toBe(true);
        expect(shouldOfferInstall({ ...working, hasOwnData: false })).toBe(false);
        expect(shouldOfferInstall({ ...working, tourStopCount: 0 })).toBe(false);
    });

    it('drängt sich nicht auf', () => {
        expect(shouldOfferInstall({ ...working, promptAvailable: false })).toBe(false);
        expect(shouldOfferInstall({ ...working, installed: true })).toBe(false);
        expect(shouldOfferInstall({ ...working, dismissed: true })).toBe(false);
        expect(shouldOfferInstall({ ...working, insideMobilePreview: true })).toBe(false);
        expect(shouldOfferInstall()).toBe(false);
    });
});

describe('Manifest-Haken ins Betriebssystem', () => {
    const config = readFileSync(resolve(process.cwd(), 'vite.config.js'), 'utf8');

    it('meldet Shortcuts, Datei-Handler, Teilen-Ziel und Screenshot an', () => {
        expect(config).toContain('shortcuts:');
        expect(config).toContain('file_handlers:');
        expect(config).toContain('share_target:');
        expect(config).toContain('screenshots:');
        expect(config).toContain("launch_handler: { client_mode: 'navigate-existing' }");
    });

    it('verdrahtet die Shortcut-Ziele mit denen, die die App kennt', () => {
        for (const target of ['tour', 'nearby', 'import']) {
            expect(config).toContain(`/?start=${target}`);
            expect(readLaunchIntent(`?start=${target}`).start).toBe(target);
        }
    });

    it('bindet den Teilen-Handler in den Service Worker ein', () => {
        expect(config).toContain("importScripts: ['share-target.js']");
        expect(config).toContain("globIgnores: ['share-target.js']");
    });
});
