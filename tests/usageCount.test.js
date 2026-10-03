import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { shouldCount, startUsageCount, trimEvent } from '../src/services/usageCount.js';
import { CONFIG } from '../src/core/config.js';

const read = (file) => readFileSync(file, 'utf8');
const live = { hostname: 'tourfuchs.vercel.app' };

describe('Anonyme Nutzungszählung', () => {
    it('zählt nur auf der eingetragenen Adresse', () => {
        expect(shouldCount(live)).toBe(true);
        expect(shouldCount({ hostname: 'localhost' })).toBe(false);
        expect(shouldCount({ hostname: 'tourfuchs-git-x-gunter-strucks-projects.vercel.app' })).toBe(false);
        expect(shouldCount({ hostname: 'tourfuchs.firma.intern' })).toBe(false);
        expect(shouldCount({ ...live, hosts: [] })).toBe(false);
    });

    it('respektiert Do Not Track, Global Privacy Control und die eingebettete Vorschau', () => {
        expect(shouldCount({ ...live, doNotTrack: '1' })).toBe(false);
        expect(shouldCount({ ...live, globalPrivacyControl: true })).toBe(false);
        expect(shouldCount({ ...live, embedded: true })).toBe(false);
        expect(shouldCount({ ...live, doNotTrack: '0' })).toBe(true);
    });

    it('meldet nur Ursprung und Pfad – nie eine Tour im Fragment oder Suchteil', () => {
        const event = trimEvent({ type: 'pageview', url: 'https://tourfuchs.vercel.app/?mobilePreview=1#tour=Essen;Dortmund' });
        expect(event.url).toBe('https://tourfuchs.vercel.app/');
        expect(trimEvent({ type: 'event', url: 'https://tourfuchs.vercel.app/' })).toBeNull();
        expect(trimEvent({ type: 'pageview', url: 'kaputt' })).toBeNull();
    });

    it('lädt das Skript nur, wenn gezählt werden darf, und hängt den Filter davor', () => {
        const fake = (hostname, extra = {}) => {
            const head = { children: [], appendChild(el) { this.children.push(el); } };
            const win = {
                location: { hostname }, navigator: { ...extra },
                document: { head, createElement: () => ({}) }
            };
            win.self = win; win.top = win;
            return win;
        };
        const off = fake('localhost');
        expect(startUsageCount(off)).toBe(false);
        expect(off.document.head.children).toHaveLength(0);

        const on = fake('tourfuchs.vercel.app');
        expect(startUsageCount(on)).toBe(true);
        expect(on.document.head.children[0].src).toBe(CONFIG.usageCount.scriptSrc);
        expect(on.vaq[0][0]).toBe('beforeSend');
        expect(on.vaq[0][1]).toBe(trimEvent);

        expect(startUsageCount(fake('tourfuchs.vercel.app', { doNotTrack: '1' }))).toBe(false);
    });

    it('keine eigenen Ereignisse: die App ruft va() nirgends selbst mit Ereignisdaten auf', () => {
        const source = read('src/services/usageCount.js');
        expect(source).not.toMatch(/va\(\s*['"]event['"]/);
        expect(source).not.toMatch(/track\(/);
    });

    it('Datenschutzerklärung und Merkblatt beschreiben die Zählung', () => {
        const privacy = read('public/datenschutz.html');
        expect(privacy).toContain('4a. Hosting und anonyme Nutzungszählung');
        expect(privacy).toContain('Keine Cookies');
        expect(privacy).not.toContain('es gibt kein Tracking');
        expect(read('docs/nutzungsnachweis.md')).toContain('Für den Betriebsrat');
    });
});
