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
