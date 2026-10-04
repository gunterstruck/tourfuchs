export const SHOWCASE_MUSIC_URL = '/audio/tropical-island-house-2024.mp3';

/** Kurzes Ein-/Ausblenden, etwa beim Musik-Knopf. */
export const MUSIC_FADE_MS = 350;
/** Ende einer Schulungsrunde: sanft ausklingen statt abreißen. */
export const MUSIC_STOP_FADE_MS = 2000;
/** Leiser in die Pause zwischen zwei Filmen und wieder lauter in den nächsten: weich, nicht abrupt. */
export const MUSIC_BREAK_FADE_MS = 2500;
/** Zwischen zwei Filmen läuft die Musik leiser weiter … */
export const MUSIC_BREAK_VOLUME_FACTOR = 0.6;
/** … und klingt aus, wenn so lange niemand etwas im Auswahlfenster tut. */
export const MUSIC_BREAK_IDLE_MS = 60_000;

/** One player shared by all live tutorials; enabled by default, without storage or third-party requests. */
/**
 * iPhone/iPad: Safari ignoriert `audio.volume` (bleibt immer 1). Ein- und
 * Ausblenden liefen dort ins Leere – die Musik spielte laut weiter und riss
 * am Ende der Blende ab. Dann regelt ein Web-Audio-Verstärker (GainNode) die
 * Lautstärke. Wo `volume` wirkt (Android, Desktop), bleibt alles wie bisher.
 */
export function volumeIsWritable(audio) {
    try {
        const before = audio.volume;
        audio.volume = 0.5;
        const ok = Math.abs(audio.volume - 0.5) < 0.01;
        audio.volume = before;
        return ok;
    } catch {
        return false;
    }
}

/**
 * iPhone/iPad erkennen (auch iPadOS, das sich als Mac ausgibt). Neuere iOS-
 * Versionen melden einen gesetzten `volume`-Wert zurück, spielen aber trotzdem
 * mit voller Lautstärke – die Rückfrage allein reicht dort nicht.
 */
export function isAppleMobile(nav = globalThis.navigator) {
    if (!nav) return false;
    const ua = String(nav.userAgent || '');
    return /iPad|iPhone|iPod/.test(ua) || (nav.platform === 'MacIntel' && Number(nav.maxTouchPoints) > 1);
}

export function preferPlaybackSession(nav = globalThis.navigator) {
    try {
        if (nav?.audioSession && nav.audioSession.type !== 'playback') nav.audioSession.type = 'playback';
        return Boolean(nav?.audioSession);
    } catch {
        return false;
    }
}

/** Ton-Hinweis (Laufleiste): einmal je Sitzung, auf Handy und Tablet – alle Browser. */
export const SOUND_HINT_KEY = 'tf_sound_hint_shown';
export function shouldShowSoundHint({ win = globalThis.window, storage = globalThis.sessionStorage } = {}) {
    let shown = false;
    try { shown = storage?.getItem(SOUND_HINT_KEY) === '1'; } catch { /* privat */ }
    if (shown) return false;
    return Boolean(win?.matchMedia?.('(pointer: coarse)').matches);
}

function defaultCreateContext() {
    const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
    return Ctor ? new Ctor() : null;
}

export class ShowcaseMusic {
    constructor({ createAudio = () => new Audio(), createContext = defaultCreateContext, onChange = () => {}, appleMobile = isAppleMobile() } = {}) {
        this.createAudio = createAudio;
        this.appleMobile = appleMobile;
        this.createContext = createContext;
        this.context = null;  // nur, wo audio.volume nicht wirkt (iOS)
        this.source = null;
        this.gain = null;
        this.onChange = onChange;
        this.audio = null;
        // The click that starts a tutorial also starts playback. This remains a
        // user gesture, while a deliberate switch-off is kept for later demos
        // in the same page session.
        this.enabled = true;
        // Der Browser hat den Ton verweigert (Selbststart ohne Tipp). Dann holt
        // der erste Tipp irgendwo auf dem Bildschirm die Musik nach.
        this.blocked = false;
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
        this.blocked = false;
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
        else if (wanted && !this.loading && this.audio && Math.abs(this.level() - this.targetVolume()) > 0.001) {
            this.fade(this.targetVolume(), undefined, MUSIC_BREAK_FADE_MS);
        }
        if (!this.active && !this.onBreak && this.audio?.paused) this.audio.currentTime = 0;
        this.onChange();
    }

    /** Aktuelle Lautstärke – über den Verstärker (iOS) oder das Element. */
    level() {
        if (this.gain) return this.gain.gain.value;
        return this.audio ? this.audio.volume : 0;
    }

    setLevel(value) {
        if (this.gain) this.gain.gain.value = value;
        else if (this.audio) this.audio.volume = value;
    }

    /** Nur wo nötig (iOS): Element über einen Verstärker an den Ausgang hängen. */
    attachGain(audio) {
        if (!this.appleMobile && volumeIsWritable(audio)) return;
        try {
            this.context = this.context || this.createContext();
            if (!this.context) return;
            this.source = this.context.createMediaElementSource(audio);
            this.gain = this.context.createGain();
            this.gain.gain.value = 0;
            this.source.connect(this.gain);
            this.gain.connect(this.context.destination);
        } catch {
            this.source = null;
            this.gain = null;
        }
    }

    /**
     * Neue Demo-Runde: frisches Element, im selben Tipp erzeugt. Safari spielt
     * ein einmal hart gestopptes Element teils nicht mehr ab – die Musik blieb
     * dann bis zum Neustart der App stumm.
     */
    renew() {
        ++this.generation;
        clearInterval(this.fadeTimer);
        this.fadeTimer = null;
        this.wanted = false;
        this.loading = false;
        this.releaseElement();
    }

    releaseElement() {
        if (this.audio) {
            try { this.audio.pause(); } catch { /* egal */ }
            this.audio.removeAttribute?.('src');
        }
        try { this.source?.disconnect(); this.gain?.disconnect(); } catch { /* egal */ }
        this.source = null;
        this.gain = null;
        this.audio = null;
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
                this.attachGain(audio);
            }
            // Safari (iOS 17+): Demo-Musik wie ein Video behandeln – sie spielt dann
            // auch bei eingeschaltetem Lautlos-Schalter. Andere Browser kennen
            // navigator.audioSession nicht und überspringen das.
            preferPlaybackSession();
            // iOS hält den Ton-Kontext nach Pausen oder Anrufen an – im Tipp wecken.
            if (this.context?.state && this.context.state !== 'running') this.context.resume?.().catch?.(() => {});
            clearInterval(this.fadeTimer);
            this.fadeTimer = null;
            this.setLevel(0);
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
        this.blocked = true;
        this.wanted = false;
        this.loading = false;
        this.error = '';
        this.silence();
        this.onChange();
    }

    /** Erste Nutzergeste nach einer Autoplay-Sperre: Musik nachholen. */
    unblock() {
        if (!this.blocked) return false;
        this.setEnabled(true);
        return true;
    }

    fail() {
        ++this.generation;
        this.enabled = false;
        this.wanted = false;
        this.loading = false;
        this.error = 'Musik konnte nicht starten. Prüfe Verbindung und Browserfreigabe; die Schulung läuft ohne Musik weiter.';
        this.silence();
        // A new click retries with a fresh media element, including after a network failure.
        this.releaseElement();
        this.onChange();
    }

    fade(target, done, ms = MUSIC_FADE_MS) {
        clearInterval(this.fadeTimer);
        this.fadeTimer = null;
        if (!this.audio) { done?.(); return; }
        const start = this.level();
        let elapsed = 0;
        let last = Date.now();
        this.fadeTimer = setInterval(() => {
            // Höchstens 50 ms je Takt: Ist die Seite kurz beschäftigt (etwa
            // beim Aufräumen nach einem Film), pausiert die Blende, statt danach
            // auf den Stand zu springen, den sie inzwischen haben „sollte“ –
            // genau so ein Sprung klang wie abruptes Leiserwerden.
            const now = Date.now();
            elapsed += Math.min(now - last, 50);
            last = now;
            const fraction = Math.min(1, elapsed / ms);
            // Weich beginnen und weich enden (smoothstep) statt linear: Das Ohr
            // hört den Anfang und das Ende einer Blende, nicht die Mitte.
            const eased = fraction * fraction * (3 - 2 * fraction);
            this.setLevel(start + (target - start) * eased);
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
        if (this.audio) { this.setLevel(0); this.audio.pause(); }
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
        this.releaseElement();
        try { this.context?.close?.(); } catch { /* egal */ }
        this.context = null;
    }
}
