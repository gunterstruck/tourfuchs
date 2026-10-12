import { describe, expect, it } from 'vitest';
import { automaticLevelActive, automaticLevelForZoom, effectiveMapLevel } from '../src/features/mapLevel.js';

describe('Mobile Gebietsflächen behalten dreistellige PLZ', () => {
    const view = { levelMode: 'auto', fixedLevel: 'kreise', currentLevel: 'plz3', mobileTour: true };
    it.each([5, 6, 7, 9, 19])('bleibt beim Zoom %s auf PLZ 3', (zoom) => {
        expect(effectiveMapLevel({ ...view, zoom })).toBe('plz3');
    });
    it('behält die Desktop-Ebenenwahl und ausgeschaltete Flächen bei', () => {
        expect(effectiveMapLevel({ ...view, zoom: 5, mobileTour: false })).toBe('plz1');
        expect(effectiveMapLevel({ ...view, zoom: 5, levelMode: 'fixed' })).toBe('plz3');
        expect(effectiveMapLevel({ ...view, zoom: 5, levelMode: 'fixed', mobileTour: false })).toBe('kreise');
        expect(effectiveMapLevel({ ...view, zoom: 5, levelMode: 'fixed', fixedLevel: 'none' })).toBe('none');
    });
});

describe('Automatische Gebietsebene', () => {
    it('folgt den stabilen Zoomstufen und lädt PLZ 5 nie automatisch', () => {
        expect(automaticLevelForZoom(5)).toBe('plz1');
        expect(automaticLevelForZoom(6)).toBe('plz2');
        expect(automaticLevelForZoom(7)).toBe('kreise');
        expect(automaticLevelForZoom(9)).toBe('plz3');
        expect(automaticLevelForZoom(19)).toBe('plz3');
    });

    it('verhindert Flattern an einer Zoomgrenze', () => {
        expect(automaticLevelForZoom(7.24, 'plz2')).toBe('plz2');
        expect(automaticLevelForZoom(7.25, 'plz2')).toBe('kreise');
        expect(automaticLevelForZoom(6.75, 'kreise')).toBe('kreise');
        expect(automaticLevelForZoom(6.74, 'kreise')).toBe('plz2');
    });

    it('lässt konkrete Ebenen in Basis, Profi und mobil fixiert', () => {
        expect(automaticLevelActive('basis', 'fixed')).toBe(false);
        expect(automaticLevelActive('profi', 'auto')).toBe(true);
        expect(automaticLevelActive('profi', 'fixed')).toBe(false);
        expect(automaticLevelActive('profi', 'fixed', true)).toBe(false);
    });
});
