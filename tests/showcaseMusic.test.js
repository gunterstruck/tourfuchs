import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ShowcaseMusic, SHOWCASE_MUSIC_URL } from '../src/features/showcaseMusic.js';

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
