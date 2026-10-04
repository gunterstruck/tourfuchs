import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { preferPlaybackSession, shouldShowSoundHint } from '../src/features/showcaseMusic.js';

function memory(initial = {}) {
    const data = new Map(Object.entries(initial));
    return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)) };
}

describe('Ton zum Demo-Start', () => {
    it('Safari: Demo-Musik spielt trotz Lautlos-Schalter (audioSession „playback")', () => {
        const nav = { audioSession: { type: 'auto' } };
        expect(preferPlaybackSession(nav)).toBe(true);
        expect(nav.audioSession.type).toBe('playback');
        // Android/Chrome/Firefox kennen die Schnittstelle nicht – kein Fehler.
        expect(preferPlaybackSession({})).toBe(false);
        expect(preferPlaybackSession(undefined)).toBe(false);
    });

    it('zeigt den Ton-Hinweis einmal je Sitzung auf Touch-Geräten (alle Browser)', () => {
        const touch = { matchMedia: () => ({ matches: true }) };
        const mouse = { matchMedia: () => ({ matches: false }) };
        expect(shouldShowSoundHint({ win: touch, storage: memory() })).toBe(true);
        expect(shouldShowSoundHint({ win: touch, storage: memory({ tf_sound_hint_shown: '1' }) })).toBe(false);
        expect(shouldShowSoundHint({ win: mouse, storage: memory() })).toBe(false);
    });

    it('der Hinweis steht in der Laufleiste und verschwindet von selbst', () => {
        const src = readFileSync(`${process.cwd()}/src/ui/showcase.js`, 'utf8');
        expect(src).toContain("const SOUND_HINT_TEXT = '🔊 Ton an? Lautstärke aufdrehen.';");
        expect(src).toContain('showSoundHint();');
        expect(src).toMatch(/soundHintVisible && music\.enabled \? SOUND_HINT_TEXT/);
    });
});
