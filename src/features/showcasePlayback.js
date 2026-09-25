/** Playback waits distinguish readable narration from optional motion. */
export class ShowcaseAbortError extends Error {}

export class ShowcasePlayback {
    constructor({ reducedMotion = false, onChange = () => {} } = {}) {
        this.reducedMotion = reducedMotion;
        this.onChange = onChange;
        this.paused = false;
        this.aborted = false;
        this.pending = null;
    }

    wait(ms, { reading = false, exact = false } = {}) {
        if (this.aborted) return Promise.reject(new ShowcaseAbortError());
        const duration = reading || exact || !this.reducedMotion ? ms : Math.min(ms, 250);
        return new Promise((resolve, reject) => {
            let remaining = Math.max(0, duration);
            let last = Date.now();
            const finish = (error) => {
                clearInterval(timer);
                this.pending = null;
                this.onChange();
                if (error) reject(error); else resolve();
            };
            const timer = setInterval(() => {
                const now = Date.now();
                if (!this.paused) remaining -= now - last;
                last = now;
                if (!this.paused && remaining <= 0) finish();
            }, 20);
            this.pending = { reading, finish };
            this.onChange();
        });
    }

    togglePause() {
        this.paused = !this.paused;
        this.onChange();
    }

    next() {
        // Never skip clicks, data preparation, or asynchronous UI work.
        if (!this.pending?.reading) return;
        this.paused = false;
        this.pending.finish();
    }

    abort() {
        this.aborted = true;
        this.pending?.finish(new ShowcaseAbortError());
    }
}
