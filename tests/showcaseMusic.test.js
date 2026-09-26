import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ShowcaseMusic, SHOWCASE_MUSIC_URL, MUSIC_BREAK_IDLE_MS } from '../src/features/showcaseMusic.js';

let music, audio, createAudio;
function fakeAudio() {
    const listeners = {};
    const result = {
        paused: true, volume: 1, currentTime: 0,
        addEventListener: vi.fn((name, fn) => { listeners[name] = fn; }),
        removeAttribute: vi.fn(),
        fire: (name) => listeners[name]?.(),
        play: vi.fn(() => { result.paused = false; return Promise.resolve(); }),
        pause: vi.fn(() => { result.paused = true; })
    };
    return result;
}
beforeEach(() => {
    vi.useFakeTimers();
    audio = fakeAudio();
    createAudio = vi.fn(() => audio);
    music = new ShowcaseMusic({ createAudio });
});
afterEach(() => { music.dispose(); vi.useRealTimers(); });
const settle = () => vi.advanceTimersByTimeAsync(400);
async function start() {
    music.setPlayback({ active: true });
    await settle();
}

describe('Optional tutorial music', () => {
    it('is enabled by default but does not load audio before a tutorial starts', () => {
        expect(createAudio).not.toHaveBeenCalled();
        expect(music.enabled).toBe(true);
    });
    it('starts synchronously with the tutorial, loops the local file and fades to 18%', async () => {
        music.setPlayback({ active: true });
        expect(audio.play).toHaveBeenCalledOnce();
        expect(audio.src).toBe(SHOWCASE_MUSIC_URL);
        expect(audio.src).toMatch(/^\/audio\//);
        expect(audio.loop).toBe(true);
        expect(audio.preload).toBe('none');
        expect(audio.volume).toBe(0);
        await settle();
        expect(audio.volume).toBeCloseTo(0.18);
    });
    it('pauses and resumes at the same position without creating a second player', async () => {
        await start(); audio.currentTime = 12;
        music.setPlayback({ paused: true }); await settle();
        expect(audio.paused).toBe(true);
        expect(audio.volume).toBe(0);
        expect(audio.currentTime).toBe(12);
        music.setPlayback({ paused: false }); await settle();
        expect(audio.paused).toBe(false);
        expect(createAudio).toHaveBeenCalledOnce();
    });
    it('stops at completion/abort and resets for the next tutorial', async () => {
        await start(); audio.currentTime = 42;
        music.setPlayback({ active: false }); await settle();
        // Klingt aus statt abzureißen …
        expect(audio.paused).toBe(false);
        expect(audio.volume).toBeGreaterThan(0);
        await vi.advanceTimersByTimeAsync(1700);
        // … und ist nach zwei Sekunden still und zurückgespult.
        expect(audio.paused).toBe(true);
        expect(audio.currentTime).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
        music.setPlayback({ active: true }); await settle();
        expect(audio.paused).toBe(false);
        expect(createAudio).toHaveBeenCalledOnce();
    });
    it('also resets when ending an already paused tutorial', async () => {
        await start(); audio.currentTime = 42;
        music.setPlayback({ paused: true }); await settle();
        music.setPlayback({ active: false });
        expect(audio.currentTime).toBe(0);
    });
    it('silences hidden tabs immediately and does not resume a paused tutorial', async () => {
        await start();
        music.setPlayback({ hidden: true });
        expect(audio.volume).toBe(0);
        expect(audio.paused).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
        music.setPlayback({ paused: true, hidden: false }); await settle();
        expect(audio.paused).toBe(true);
        music.setPlayback({ paused: false }); await settle();
        expect(audio.paused).toBe(false);
    });
    it('does not restart on each narration state change', async () => {
        await start();
        for (let i = 0; i < 20; i++) music.setPlayback({ paused: false });
        expect(audio.play).toHaveBeenCalledOnce();
    });
    it('keeps a pending play promise silent after cancellation', async () => {
        let resolve;
        audio.play.mockImplementation(() => new Promise(done => { resolve = done; }));
        music.setPlayback({ active: true }); music.setEnabled(true);
        music.setPlayback({ active: false });
        resolve(); await settle();
        expect(audio.volume).toBe(0);
        expect(audio.paused).toBe(true);
        expect(music.loading).toBe(false);
    });
    it('ignores a stale rejection after rapid off/on toggling', async () => {
        let reject;
        audio.play.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
        music.setPlayback({ active: true }); music.setEnabled(true);
        music.setEnabled(false); music.setEnabled(true);
        reject(new Error('stale')); await settle();
        expect(music.enabled).toBe(true);
        expect(music.error).toBe('');
        expect(audio.volume).toBeCloseTo(0.18);
    });
    it('handles rejected autoplay without interrupting the tutorial and allows retry', async () => {
        audio.play.mockRejectedValueOnce(new Error('NotAllowedError'));
        await start();
        expect(music.enabled).toBe(false);
        expect(music.active).toBe(true);
        expect(music.error).toContain('ohne Musik');
        expect(audio.paused).toBe(true);
        music.setEnabled(true); await settle();
        expect(music.error).toBe('');
        expect(audio.paused).toBe(false);
    });
    it('switches silently to "Musik ein" when the browser blocks autoplay without a tap', async () => {
        const blocked = new Error('play() failed because the user did not interact');
        blocked.name = 'NotAllowedError';
        audio.play.mockRejectedValueOnce(blocked);
        await start();
        expect(music.enabled).toBe(false);
        expect(music.error).toBe('');
        expect(audio.paused).toBe(true);
        // Ein Tipp auf „Musik ein" ist die fehlende Nutzergeste.
        music.setEnabled(true); await settle();
        expect(audio.paused).toBe(false);
    });
    it('handles file/decode errors and ignores errors from a released player', async () => {
        await start();
        const oldAudio = audio;
        oldAudio.fire('error');
        expect(music.enabled).toBe(false);
        audio = fakeAudio();
        music.setEnabled(true); await settle();
        oldAudio.fire('error');
        expect(music.enabled).toBe(true);
        expect(audio.paused).toBe(false);
    });
    it('bounds volume, permits mute and ignores invalid values', async () => {
        await start();
        music.setVolume(5); await settle(); expect(audio.volume).toBe(0.5);
        music.setVolume(-1); await settle(); expect(audio.volume).toBe(0);
        music.setVolume(NaN); expect(music.volume).toBe(0);
    });
    it('keeps playing, quieter, while the choice dialog is open after a film', async () => {
        await start(); audio.currentTime = 30;
        music.setPlayback({ active: false, onBreak: true }); await vi.advanceTimersByTimeAsync(1100);
        expect(audio.paused).toBe(false);
        expect(audio.volume).toBeCloseTo(0.18 * 0.6);
        expect(audio.currentTime).toBe(30);
        // Nächster Film: dieselbe Aufnahme läuft weiter, wieder in voller Lautstärke.
        music.setPlayback({ active: true, onBreak: false }); await vi.advanceTimersByTimeAsync(1100);
        expect(audio.play).toHaveBeenCalledOnce();
        expect(audio.volume).toBeCloseTo(0.18);
        expect(audio.currentTime).toBe(30);
    });
    it('fades out gently when the choice dialog is left', async () => {
        await start();
        music.setPlayback({ active: false, onBreak: true }); await vi.advanceTimersByTimeAsync(1100);
        music.setPlayback({ onBreak: false }); await settle();
        expect(audio.paused).toBe(false);
        await vi.advanceTimersByTimeAsync(1700);
        expect(audio.paused).toBe(true);
        expect(audio.currentTime).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
    });
    it('fades out after a minute without interaction; any interaction restarts the minute', async () => {
        await start();
        music.setPlayback({ active: false, onBreak: true });
        await vi.advanceTimersByTimeAsync(MUSIC_BREAK_IDLE_MS - 5000);
        music.touch();
        await vi.advanceTimersByTimeAsync(MUSIC_BREAK_IDLE_MS - 5000);
        expect(music.onBreak).toBe(true);
        expect(audio.paused).toBe(false);
        await vi.advanceTimersByTimeAsync(5000 + 2100);
        expect(music.onBreak).toBe(false);
        expect(audio.paused).toBe(true);
    });
    it('does not start music on the break when it was switched off', async () => {
        music.setEnabled(false);
        music.setPlayback({ onBreak: true }); await settle();
        expect(createAudio).not.toHaveBeenCalled();
    });
    it('releases playback and timers on page exit', async () => {
        await start(); music.dispose();
        expect(audio.paused).toBe(true);
        expect(audio.removeAttribute).toHaveBeenCalledWith('src');
        expect(vi.getTimerCount()).toBe(0);
        expect(music.enabled).toBe(false);
    });
    it('ships the unchanged licensed MP3 with attribution and no precache download', () => {
        const bytes = readFileSync('public/audio/tropical-island-house-2024.mp3');
        expect(createHash('sha256').update(bytes).digest('hex')).toBe('7e360dd8e94cf2b5c945db158d86b7dca790f90724d965b0ca7e7580d7b4bcc3');
        const notice = readFileSync('public/license.html', 'utf8');
        expect(notice).toContain('Tropical Island House 2024');
        expect(notice).toContain('Sascha Ende');
        expect(notice).toContain('https://creativecommons.org/licenses/by/4.0/deed.de');
        const config = readFileSync('vite.config.js', 'utf8');
        expect(config).not.toContain('mp3');
        const showcase = readFileSync('src/ui/showcase.js', 'utf8');
        expect(showcase).toContain("music.enabled ? '♫ Musik aus' : '♫ Musik ein'");
    });
});

describe('Schleife der Mini-Schulungen', () => {
    const showcase = readFileSync('src/ui/showcase.js', 'utf8');
    const css = readFileSync('src/styles/showcase.css', 'utf8');
    it('zeigt nach einem Film einen Countdown, der die nächste Demo startet', () => {
        expect(showcase).toContain('startAutoAdvance(next);');
        expect(showcase).toContain('clearAutoAdvance();\n                startStory(next);');
    });
    it('hält den Countdown bei jeder Bedienung außer am Kreis an und beendet ihn bei ausgeblendetem Tab', () => {
        expect(showcase).toContain("if (!event.target?.closest?.('.sc-countdown')) stopAutoAdvance();");
        expect(showcase).toContain('if (document.hidden) stopAutoAdvance();');
    });
    it('hat keinen Countdown nach einer abgebrochenen Demo', () => {
        const failure = showcase.slice(showcase.indexOf('function showStoryFailure'), showcase.indexOf('// ---- Intro-Panel'));
        expect(failure).not.toContain('countdownHtml');
        expect(failure).toContain('clearAutoAdvance();');
    });
    it('baut den Ring rechtsherum ab (im Uhrzeigersinn)', () => {
        expect(css).toMatch(/@keyframes sc-countdown \{\s*to \{ stroke-dashoffset: -276\.46; \}/);
    });
    it('respektiert reduzierte Bewegung', () => {
        expect(css).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.sc-countdown-ring \{ animation: none; \}/);
    });
});

describe('Tippen während einer Vorführung', () => {
    const showcase = readFileSync('src/ui/showcase.js', 'utf8');
    const onboarding = readFileSync('src/services/showcaseOnboarding.js', 'utf8');
    it('hält an und fragt nach, statt den Tipp wortlos zu schlucken', () => {
        expect(showcase).toMatch(/function createShield\(\) \{[\s\S]*?showPauseCard\(\);/);
        expect(showcase).toContain('✋ Selbst ausprobieren');
        expect(showcase).toContain('▶ Weiter ansehen');
    });
    it('lässt die Musik während der Frage weiterlaufen', () => {
        expect(showcase).toContain('music.setPlayback({ paused: (playback?.paused ?? false) && !pausedByTouch });');
    });
    it('geht nach acht Sekunden ohne Antwort von selbst weiter', () => {
        expect(onboarding).toContain('export const SHOWCASE_TOUCH_RESUME_SECONDS = 8;');
        expect(showcase).toContain('if (left <= 0) hidePauseCard({ resume: true });');
    });
    it('beendet mit „Selbst ausprobieren" die Runde, bevor die Karte schließt', () => {
        const abort = showcase.slice(showcase.indexOf('function abortNow()'), showcase.indexOf('// ---- Element-Auflösung'));
        expect(abort.indexOf('music.setPlayback({ active: false });')).toBeLessThan(abort.indexOf('hidePauseCard'));
    });
    it('sperrt auch offene Dialoge, damit Tipps dort keine echten Knöpfe auslösen', () => {
        expect(showcase).toContain('dialogShieldEl ||= createShield();');
    });
});

describe('Ende einer Schulungsrunde am Handy', () => {
    const showcase = readFileSync('src/ui/showcase.js', 'utf8');
    const sidebar = readFileSync('src/ui/sidebar.js', 'utf8');
    const responsive = readFileSync('src/styles/responsive.css', 'utf8');
    const html = readFileSync('index.html', 'utf8');
    it('klappt das Blatt im Takt der ausklingenden Musik langsam ein', () => {
        expect(sidebar).toContain('export function settleSheetAfterShowcase()');
        expect(responsive).toContain('.sidebar.sheet-settling { transition: transform 2s ease-in-out, height 2s ease-in-out; }');
        // Nach bewusstem Beenden und beim Schließen des Fensters nach einem Film.
        expect(showcase).toContain('else endRound();');
        expect(showcase).toMatch(/music\.setPlayback\(\{ onBreak: false \}\);\s*endRound\(\);/);
    });
    it('blendet „Erste Schritte anzeigen" in der Handy-Ansicht aus', () => {
        expect(html).toContain('id="btn-first-steps-restore" class="only-desktop"');
    });
});
