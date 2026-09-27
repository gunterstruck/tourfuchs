/** Playback waits distinguish readable narration from optional motion. */
export class ShowcaseAbortError extends Error {}

/**
 * Tempo der Vorführung. „1,2×" ist das gewohnte Tempo der Filme; „1,0×"
 * spielt dieselben Filme ruhiger ab (alle Pausen, Lesezeiten und
 * Zeigerwege um den Faktor 1,2 länger). Die Musik läuft davon unberührt.
 */
export const SHOWCASE_TEMPI = Object.freeze({
    normal: Object.freeze({ id: 'normal', rate: 1, label: '1,2×' }),
    slow: Object.freeze({ id: 'slow', rate: 1 / 1.2, label: '1,0×' })
});

export function showcaseTempo(id) {
    return SHOWCASE_TEMPI[id] || SHOWCASE_TEMPI.normal;
}

export class ShowcasePlayback {
    constructor({ reducedMotion = false, onChange = () => {}, rate = 1 } = {}) {
        this.reducedMotion = reducedMotion;
        this.onChange = onChange;
        this.rate = rate > 0 ? rate : 1;
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
                // Langsameres Tempo: Die Zeit vergeht für die Vorführung langsamer.
                if (!this.paused) remaining -= (now - last) * this.rate;
                last = now;
                if (!this.paused && remaining <= 0) finish();
            }, 20);
            this.pending = { reading, finish, restart: () => { remaining = Math.max(0, duration); } };
            this.onChange();
        });
    }

    setRate(rate) {
        if (rate > 0) this.rate = rate;
        this.onChange();
    }

    /** Läuft gerade eine Lesezeit, die „Weiter" überspringen darf? */
    get canSkip() {
        return Boolean(this.pending?.reading);
    }

    /** Die laufende Lesezeit von vorn beginnen (nach „Nochmal lesen"). */
    restartReading() {
        if (this.pending?.reading) this.pending.restart();
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
