export const SHOWCASE_MUSIC_URL = '/audio/tropical-island-house-2024.mp3';

/** Kurzes Ein-/Ausblenden, etwa beim Musik-Knopf. */
export const MUSIC_FADE_MS = 350;
/** Ende einer Schulungsrunde: sanft ausklingen statt abreißen. */
export const MUSIC_STOP_FADE_MS = 2000;
/** Zwischen zwei Filmen läuft die Musik leiser weiter … */
export const MUSIC_BREAK_VOLUME_FACTOR = 0.6;
/** … und klingt aus, wenn so lange niemand etwas im Auswahlfenster tut. */
export const MUSIC_BREAK_IDLE_MS = 60_000;

/** One player shared by all live tutorials; enabled by default, without storage or third-party requests. */
export class ShowcaseMusic {
    constructor({ createAudio = () => new Audio(), onChange = () => {} } = {}) {
        this.createAudio = createAudio;
        this.onChange = onChange;
        this.audio = null;
        // The click that starts a tutorial also starts playback. This remains a
        // user gesture, while a deliberate switch-off is kept for later demos
        // in the same page session.
        this.enabled = true;
        this.active = false;
        this.paused = false;
        this.hidden = false;
        this.volume = 0.18;
        this.error = '';
        this.loading = false;
        this.wanted = false;
        this.generation = 0;
        this.fadeTimer = null;
        // Pause zwischen zwei Filmen: Das Auswahlfenster ist offen, die Runde
        // läuft noch. Die Musik spielt dann leiser weiter, statt abzureißen.
        this.onBreak = false;
        this.breakTimer = null;
    }

    setEnabled(enabled) {
        this.enabled = Boolean(enabled);
        this.error = '';
        this.sync({ fadeOutMs: MUSIC_FADE_MS });
    }

    setPlayback({ active = this.active, paused = this.paused, hidden = this.hidden, onBreak = this.onBreak } = {}) {
        // Pause soll sofort still sein; nur das Ende einer Runde klingt lang aus.
        const pausing = paused && !this.paused;
        this.active = active;
        this.paused = paused;
        this.hidden = hidden;
        this.onBreak = onBreak;
        this.syncBreakTimer();
        this.sync({ fadeOutMs: pausing ? MUSIC_FADE_MS : MUSIC_STOP_FADE_MS });
    }

    /** Jemand bedient das Auswahlfenster: Der Leerlauf beginnt von vorn. */
    touch() {
        if (!this.onBreak || this.active) return;
        clearTimeout(this.breakTimer);
        this.breakTimer = null;
        this.syncBreakTimer();
    }

    syncBreakTimer() {
        const idle = this.onBreak && !this.active;
        if (!idle) {
            clearTimeout(this.breakTimer);
            this.breakTimer = null;
        } else if (!this.breakTimer) {
            this.breakTimer = setTimeout(() => {
                this.breakTimer = null;
                this.setPlayback({ onBreak: false });
            }, MUSIC_BREAK_IDLE_MS);
        }
    }

    targetVolume() {
        return this.active ? this.volume : this.volume * MUSIC_BREAK_VOLUME_FACTOR;
    }

    setVolume(value) {
        if (!Number.isFinite(Number(value))) return;
        this.volume = Math.max(0, Math.min(0.5, Number(value)));
        if (this.wanted && !this.loading) this.fade(this.targetVolume());
        this.onChange();
    }

    sync({ fadeOutMs = MUSIC_STOP_FADE_MS } = {}) {
        const wanted = this.enabled && (this.active || this.onBreak) && !this.paused && !this.hidden;
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
                    if (!this.active && !this.onBreak && this.audio) this.audio.currentTime = 0;
                }, fadeOutMs);
            }
        } else if (this.hidden && this.audio) this.silence();
        // Wechsel Film <-> Pause: gleiche Aufnahme, nur die Lautstärke gleitet.
        else if (wanted && !this.loading && this.audio && Math.abs(this.audio.volume - this.targetVolume()) > 0.001) {
            this.fade(this.targetVolume(), undefined, MUSIC_STOP_FADE_MS / 2);
        }
        if (!this.active && !this.onBreak && this.audio?.paused) this.audio.currentTime = 0;
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
                this.fade(this.targetVolume());
                this.onChange();
            }).catch((error) => {
                if (generation !== this.generation) return;
                // Ohne vorherigen Tipp verweigert der Browser Ton (Autoplay-Regel),
                // etwa beim Selbststart der Vorführung. Das ist kein Fehler: still
                // auf „Musik ein" stellen – ein Tipp darauf startet sie.
                if (error?.name === 'NotAllowedError') this.block();
                else this.fail();
            });
        } catch {
            this.fail();
        }
    }

    block() {
        ++this.generation;
        this.enabled = false;
        this.wanted = false;
        this.loading = false;
        this.error = '';
        this.silence();
        this.onChange();
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

    fade(target, done, ms = MUSIC_FADE_MS) {
        clearInterval(this.fadeTimer);
        this.fadeTimer = null;
        if (!this.audio) { done?.(); return; }
        const start = this.audio.volume;
        const started = Date.now();
        this.fadeTimer = setInterval(() => {
            const fraction = Math.min(1, (Date.now() - started) / ms);
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
        clearTimeout(this.breakTimer);
        this.breakTimer = null;
        this.onBreak = false;
        this.active = false;
        this.enabled = false;
        this.wanted = false;
        this.loading = false;
        this.silence();
        if (this.audio) this.audio.removeAttribute('src');
        this.audio = null;
    }
}
