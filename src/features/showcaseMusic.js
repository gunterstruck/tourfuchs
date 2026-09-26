export const SHOWCASE_MUSIC_URL = '/audio/tropical-island-house-2024.mp3';

/** One opt-in player shared by all live tutorials; no storage or third-party requests. */
export class ShowcaseMusic {
    constructor({ createAudio = () => new Audio(), onChange = () => {} } = {}) {
        this.createAudio = createAudio;
        this.onChange = onChange;
        this.audio = null;
        this.enabled = false;
        this.active = false;
        this.paused = false;
        this.hidden = false;
        this.volume = 0.18;
        this.error = '';
        this.loading = false;
        this.wanted = false;
        this.generation = 0;
        this.fadeTimer = null;
    }

    setEnabled(enabled) {
        this.enabled = Boolean(enabled);
        this.error = '';
        this.sync();
    }

    setPlayback({ active = this.active, paused = this.paused, hidden = this.hidden } = {}) {
        this.active = active;
        this.paused = paused;
        this.hidden = hidden;
        this.sync();
    }

    setVolume(value) {
        if (!Number.isFinite(Number(value))) return;
        this.volume = Math.max(0, Math.min(0.5, Number(value)));
        if (this.wanted && !this.loading) this.fade(this.volume);
        this.onChange();
    }

    sync() {
        const wanted = this.enabled && this.active && !this.paused && !this.hidden;
        if (wanted !== this.wanted) {
            this.wanted = wanted;
            const generation = ++this.generation;
            if (wanted) this.start(generation);
            else {
                this.loading = false;
                // Background tabs throttle timers: silence immediately there.
                if (this.hidden) this.silence();
                else this.fade(0, () => {
                    this.audio?.pause();
                    if (!this.active && this.audio) this.audio.currentTime = 0;
                });
            }
        } else if (this.hidden && this.audio) this.silence();
        if (!this.active && this.audio?.paused) this.audio.currentTime = 0;
        this.onChange();
    }

    start(generation) {
        try {
            if (!this.audio) {
                this.audio = this.createAudio();
                this.audio.preload = 'none';
                this.audio.loop = true;
                this.audio.src = SHOWCASE_MUSIC_URL;
                const audio = this.audio;
                audio.addEventListener('error', () => {
                    if (this.audio === audio && this.wanted) this.fail();
                });
            }
            clearInterval(this.fadeTimer);
            this.fadeTimer = null;
            this.audio.volume = 0;
            this.loading = true;
            // Called synchronously by the Music button: preserve browser user activation.
            const result = this.audio.play();
            Promise.resolve(result).then(() => {
                if (generation !== this.generation) {
                    if (!this.wanted) this.silence();
                    return;
                }
                this.loading = false;
                this.fade(this.volume);
                this.onChange();
            }).catch(() => {
                if (generation === this.generation) this.fail();
            });
        } catch {
            this.fail();
        }
    }

    fail() {
        ++this.generation;
        this.enabled = false;
        this.wanted = false;
        this.loading = false;
        this.error = 'Musik konnte nicht starten. Prüfe Verbindung und Browserfreigabe; die Schulung läuft ohne Musik weiter.';
        this.silence();
        // A new click retries with a fresh media element, including after a network failure.
        if (this.audio) this.audio.removeAttribute('src');
        this.audio = null;
        this.onChange();
    }

    fade(target, done) {
        clearInterval(this.fadeTimer);
        this.fadeTimer = null;
        if (!this.audio) { done?.(); return; }
        const start = this.audio.volume;
        const started = Date.now();
        this.fadeTimer = setInterval(() => {
            const fraction = Math.min(1, (Date.now() - started) / 350);
            this.audio.volume = start + (target - start) * fraction;
            if (fraction === 1) {
                clearInterval(this.fadeTimer);
                this.fadeTimer = null;
                done?.();
            }
        }, 25);
    }

    silence() {
        clearInterval(this.fadeTimer);
        this.fadeTimer = null;
        if (this.audio) { this.audio.volume = 0; this.audio.pause(); }
    }

    dispose() {
        ++this.generation;
        this.active = false;
        this.enabled = false;
        this.wanted = false;
        this.loading = false;
        this.silence();
        if (this.audio) this.audio.removeAttribute('src');
        this.audio = null;
    }
}
