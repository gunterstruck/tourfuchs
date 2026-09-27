import { describe, it, expect, vi, afterEach } from 'vitest';
import { ShowcasePlayback, ShowcaseAbortError } from '../src/features/showcasePlayback.js';

afterEach(() => vi.useRealTimers());
describe('Live-Demo playback', () => {
    it('reduces motion but preserves narration time', async () => {
        vi.useFakeTimers();
        const playback = new ShowcasePlayback({ reducedMotion: true });
        const motion = vi.fn();
        playback.wait(3000).then(motion);
        await vi.advanceTimersByTimeAsync(280);
        expect(motion).toHaveBeenCalledOnce();
        const read = vi.fn();
        playback.wait(3000, { reading: true }).then(read);
        await vi.advanceTimersByTimeAsync(280);
        expect(read).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(2720);
        expect(read).toHaveBeenCalledOnce();
    });
    it('freezes a wait while paused and resumes the remaining duration', async () => {
        vi.useFakeTimers();
        const playback = new ShowcasePlayback();
        const done = vi.fn();
        playback.wait(1000, { reading: true }).then(done);
        await vi.advanceTimersByTimeAsync(400);
        playback.togglePause();
        await vi.advanceTimersByTimeAsync(5000);
        expect(done).not.toHaveBeenCalled();
        playback.togglePause();
        await vi.advanceTimersByTimeAsync(600);
        expect(done).toHaveBeenCalledOnce();
    });
    it('Next finishes narration, but cannot skip an action wait', async () => {
        vi.useFakeTimers();
        const playback = new ShowcasePlayback();
        const action = vi.fn();
        playback.wait(500).then(action);
        playback.next();
        await vi.advanceTimersByTimeAsync(100);
        expect(action).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(400);
        const read = playback.wait(4000, { reading: true });
        playback.togglePause();
        playback.next();
        await read;
        expect(playback.paused).toBe(false);
    });
    it('aborts safely even while paused', async () => {
        vi.useFakeTimers();
        const playback = new ShowcasePlayback();
        const wait = playback.wait(3000);
        playback.togglePause();
        const assertion = expect(wait).rejects.toBeInstanceOf(ShowcaseAbortError);
        playback.abort();
        await assertion;
        expect(playback.pending).toBeNull();
        await expect(playback.wait(100)).rejects.toBeInstanceOf(ShowcaseAbortError);
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe('Tempo, Weiter und Nochmal lesen', () => {
    it('spielt mit 1,0× um den Faktor 1,2 langsamer', async () => {
        const { SHOWCASE_TEMPI, showcaseTempo } = await import('../src/features/showcasePlayback.js');
        expect(showcaseTempo('slow').label).toBe('1,0×');
        expect(showcaseTempo('unbekannt')).toBe(SHOWCASE_TEMPI.normal);
        const slow = new ShowcasePlayback({ rate: SHOWCASE_TEMPI.slow.rate });
        const fast = new ShowcasePlayback();
        const t0 = Date.now();
        await fast.wait(240);
        const tFast = Date.now() - t0;
        const t1 = Date.now();
        await slow.wait(240);
        const tSlow = Date.now() - t1;
        expect(tSlow).toBeGreaterThan(tFast + 20);
        expect(tSlow).toBeGreaterThanOrEqual(270);
    });

    it('überspringt nur Lesezeiten, nie Aktionen', async () => {
        const playback = new ShowcasePlayback();
        const action = playback.wait(5000);
        expect(playback.canSkip).toBe(false);
        playback.next();
        expect(playback.pending).not.toBeNull();
        playback.abort();
        await expect(action).rejects.toBeInstanceOf(ShowcaseAbortError);

        const reading = new ShowcasePlayback();
        const text = reading.wait(5000, { reading: true });
        expect(reading.canSkip).toBe(true);
        reading.next();
        await expect(text).resolves.toBeUndefined();
    });

    it('gibt einer Erklärung nach „Nochmal lesen" die volle Zeit zurück', async () => {
        const playback = new ShowcasePlayback();
        const start = Date.now();
        const text = playback.wait(200, { reading: true });
        await new Promise((r) => setTimeout(r, 150));
        playback.restartReading();
        await text;
        expect(Date.now() - start).toBeGreaterThanOrEqual(330);
    });
});
