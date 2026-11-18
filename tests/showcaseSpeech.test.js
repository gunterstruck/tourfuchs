import { it, expect, vi, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { ShowcasePlayback, ShowcaseAbortError } from '../src/features/showcasePlayback.js';
import { ShowcaseSpeech } from '../src/features/showcaseSpeech.js';
import { speechTexts } from '../tools/speech-texts.mjs';
const clips = JSON.parse(readFileSync(resolve('public/audio/thorsten/index.json'), 'utf8'));

function fakeAudio() {
    const listeners = new Map();
    const audio = {
        paused: true, currentTime: 0,
        addEventListener: (event, fn) => listeners.set(event, fn),
        removeEventListener: event => listeners.delete(event),
        fire: event => listeners.get(event)?.(),
        pause: vi.fn(() => { audio.paused = true; }),
        play: vi.fn(() => { audio.paused = false; audio.fire('playing'); return Promise.resolve(); })
    };
    return audio;
}
afterEach(() => vi.useRealTimers());

it('ships every fixed desktop/mobile/helper sentence with a content-addressed MP3', () => {
    expect(Object.keys(clips).sort()).toEqual(speechTexts());
    for (const [text, file] of Object.entries(clips)) {
        expect(file).toBe(`${createHash('sha256').update(text).digest('hex')}.mp3`);
        expect(readFileSync(resolve(`public/audio/thorsten/${file}`)).length).toBeGreaterThan(1000);
    }
    expect(existsSync(resolve('public/audio/thorsten/ready.mp3'))).toBe(true);
});
it('defaults to enabled, loads only when a tutorial starts and never speaks customer text', async () => {
    const createAudio = vi.fn(fakeAudio);
    const loadClips = vi.fn(async () => clips);
    const speech = new ShowcaseSpeech({ createAudio, loadClips });
    expect(speech.enabled).toBe(true);
    expect(await speech.speak(Object.keys(clips)[0], new ShowcasePlayback())).toBe(false);
    expect(createAudio).not.toHaveBeenCalled();
    expect(loadClips).not.toHaveBeenCalled();
    speech.start();
    expect(createAudio).toHaveBeenCalledOnce();
    await speech.loading;
    expect(await speech.speak('A private customer text', new ShowcasePlayback())).toBe(false);
    speech.stop();
});
it('keeps a deliberate switch-off when the next tutorial starts', () => {
    const createAudio = vi.fn(fakeAudio), loadClips = vi.fn(async () => clips);
    const speech = new ShowcaseSpeech({ createAudio, loadClips });
    speech.setEnabled(false);
    speech.start();
    expect(speech.enabled).toBe(false);
    expect(createAudio).not.toHaveBeenCalled();
    expect(loadClips).not.toHaveBeenCalled();
});
it('waits for the spoken sentence, pauses/resumes and lets Next stop it', async () => {
    vi.useFakeTimers();
    const audio = fakeAudio(), playback = new ShowcasePlayback(), speaking = vi.fn();
    const done = vi.fn();
    const result = playback.waitForAudio(audio, { onSpeaking: speaking });
    result.then(done);
    audio.currentTime = 3;
    await vi.advanceTimersByTimeAsync(3000);
    expect(done).not.toHaveBeenCalled();
    playback.togglePause();
    expect(audio.paused).toBe(true);
    await vi.advanceTimersByTimeAsync(10000);
    expect(done).not.toHaveBeenCalled();
    playback.togglePause();
    expect(audio.paused).toBe(false);
    playback.next();
    expect(await result).toBe(true);
    expect(audio.paused).toBe(true);
    expect(speaking).toHaveBeenLastCalledWith(false);
});
it('ends naturally and supports step mode and abort without orphaned sound', async () => {
    const audio = fakeAudio(), playback = new ShowcasePlayback();
    const result = playback.waitForAudio(audio);
    audio.fire('ended');
    expect(await result).toBe(true);
    playback.stepMode = true;
    const paused = playback.waitForAudio(audio);
    expect(playback.paused).toBe(true);
    expect(audio.paused).toBe(true);
    const assertion = expect(paused).rejects.toBeInstanceOf(ShowcaseAbortError);
    playback.abort();
    await assertion;
    expect(audio.paused).toBe(true);
    expect(playback.pending).toBeNull();
});
it('falls back after blocked playback, missing audio and a hung request', async () => {
    vi.useFakeTimers();
    const blocked = fakeAudio();
    blocked.play.mockRejectedValue(new Error('NotAllowedError'));
    expect(await new ShowcasePlayback().waitForAudio(blocked)).toBe(false);
    const missing = fakeAudio();
    const failed = new ShowcasePlayback().waitForAudio(missing);
    missing.fire('error');
    expect(await failed).toBe(false);
    const hung = fakeAudio();
    hung.play.mockReturnValue(new Promise(() => {}));
    const stalled = new ShowcasePlayback().waitForAudio(hung);
    await vi.advanceTimersByTimeAsync(8100);
    expect(await stalled).toBe(false);
    expect(hung.paused).toBe(true);
});
it('turning Thorsten off cancels the current sentence and restores reading', async () => {
    const audio = fakeAudio(), speech = new ShowcaseSpeech({ createAudio: () => audio, loadClips: async () => clips });
    speech.setEnabled(true);
    await speech.loading;
    const result = speech.speak(Object.keys(clips)[0], new ShowcasePlayback());
    speech.setEnabled(false);
    expect(await result).toBe(false);
    expect(audio.paused).toBe(true);
    expect(speech.speaking).toBe(false);
    expect(speech.error).toBe('');
});
it('a missing or still-loading index never blocks a training step', async () => {
    const speech = new ShowcaseSpeech({ createAudio: fakeAudio, loadClips: async () => { throw new Error('offline'); } });
    speech.setEnabled(true);
    expect(await speech.speak(Object.keys(clips)[0], new ShowcasePlayback())).toBe(false);
    await speech.loading;
    expect(speech.error).toContain('Sprechblase');
    speech.stop();
});
