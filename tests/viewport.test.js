/**
 * Die eine Definition von „mobil" – und das Tor gegen eine fünfte.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { faceFor, PHONE_FACE_MEDIA, PHONE_MAX_WIDTH, TABLET_MAX_WIDTH } from '../src/core/viewport.js';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

/** Echte Geräte in CSS-Pixeln. */
const GERAETE = [
    // [Name, Breite, Höhe, erwartetes Gesicht]
    ['iPhone 15 hochkant', 393, 852, 'phone'],
    ['iPhone 15 quer', 852, 393, 'phone'],           // zu flach für den Schreibtisch
    ['iPad mini hochkant', 744, 1133, 'phone'],
    ['iPad mini quer', 1133, 744, 'desktop'],
    ['Galaxy Tab S6 Lite hochkant', 800, 1333, 'phone'],
    ['Galaxy Tab S6 Lite quer', 1333, 800, 'desktop'],
    ['iPad 11" hochkant', 834, 1194, 'phone'],
    ['iPad 11" quer', 1194, 834, 'desktop'],
    ['iPad 12,9" hochkant', 1024, 1366, 'phone'],
    ['iPad 12,9" quer', 1366, 1024, 'desktop'],
    ['Laptop', 1440, 900, 'desktop'],
    ['Monitor hochkant', 1440, 2560, 'desktop']      // über der Tablet-Grenze
];

describe('Viewport – zwei Gesichter', () => {
    it.each(GERAETE)('%s (%ix%i) ist %s', (_name, width, height, expected) => {
        expect(faceFor({ width, height })).toBe(expected);
    });

    it('macht aus derselben Haltung dasselbe Produkt', () => {
        // Der eigentliche Defekt vor Version 3.2: Hochkant war nicht gleich
        // hochkant. 744 px ergab ein sauberes Handy, 800 px einen Zwitter,
        // 1024 px noch mehr davon – dieselbe Haltung, drei Produkte.
        const hochkant = [744, 800, 834, 1024, 1200]
            .map((width) => faceFor({ width, height: width + 300 }));
        expect(new Set(hochkant)).toEqual(new Set(['phone']));
    });

    it('respektiert die ausdrückliche Orientierung vor dem Seitenverhältnis', () => {
        expect(faceFor({ width: 1000, height: 1400, portrait: false })).toBe('desktop');
        expect(faceFor({ width: 1000, height: 800, portrait: true })).toBe('phone');
    });

    it('hält die beiden Grenzen genau ein', () => {
        expect(faceFor({ width: PHONE_MAX_WIDTH, height: 400 })).toBe('phone');
        // Höhe 400 wäre ein flaches Querformat und damit ohnehin Touransicht –
        // die Breitengrenze prüft sich nur an einem hohen genug Fenster.
        expect(faceFor({ width: PHONE_MAX_WIDTH + 1, height: 700, portrait: false })).toBe('desktop');
        expect(faceFor({ width: TABLET_MAX_WIDTH, portrait: true })).toBe('phone');
        expect(faceFor({ width: TABLET_MAX_WIDTH + 1, portrait: true })).toBe('desktop');
    });

    it('fällt ohne brauchbare Angaben auf den Schreibtisch zurück', () => {
        expect(faceFor()).toBe('desktop');
        expect(faceFor({ width: Number.NaN })).toBe('desktop');
        expect(faceFor({ width: undefined, height: 800 })).toBe('desktop');
    });
});

describe('Tor: keine fünfte Definition von „mobil"', () => {
    const QUELLEN = [
        'src/ui/sidebar.js', 'src/ui/tourPanel.js', 'src/features/map.js',
        'src/ui/firstSteps.js', 'src/ui/importWizard.js', 'src/ui/contractRadar.js',
        'src/ui/showcase.js', 'src/main.js', 'src/core/state.js',
        'src/ui/planningViewport.js'
    ];

    it.each(QUELLEN)('%s definiert keine eigene Breitenschwelle', (file) => {
        const source = read(file);
        // Genau die Schwellen, aus denen der Zwitter entstanden ist.
        expect(source).not.toMatch(/matchMedia\(\s*['"`]\(max-width: (768|900)px\)/);
        expect(source).not.toMatch(/matchMedia\(\s*['"`]\(min-width: (769|901)px\)/);
        expect(source).not.toMatch(/innerWidth\s*[<>]=?\s*(768|769|900|901)\b/);
    });

    it('hält die Grenze an genau einer Stelle', () => {
        const viewport = read('src/core/viewport.js');
        expect(viewport).toContain('PHONE_FACE_MEDIA');
        // Drei Teilbedingungen, nicht mehr: Handy, Tablet hochkant, flaches Quer.
        expect(PHONE_FACE_MEDIA.split(',')).toHaveLength(3);
    });

    it('bindet das CSS wortgleich an dieselbe Zeichenkette', () => {
        const css = read('src/styles/responsive.css');
        for (const clause of PHONE_FACE_MEDIA.split(',').map((part) => part.trim())) {
            expect(css).toContain(clause);
        }
    });
});
