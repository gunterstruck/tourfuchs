/** Only fixed training sentences, served by the app itself. No speech API. */
export class ShowcaseSpeech {
    constructor({ createAudio = () => new Audio(), onChange = () => {}, loadClips = async () => {
        const response = await fetch('/audio/thorsten/index.json');
        if (!response.ok) throw new Error('Missing narration index');
        return response.json();
    } } = {}) {
        this.createAudio = createAudio;
        this.onChange = onChange;
        this.loadClips = loadClips;
        this.clips = null;
        this.loading = null;
        this.enabled = false;
        this.audio = null;
        this.cancel = null;
        this.speaking = false;
        this.error = '';
    }

    setEnabled(enabled) {
        this.enabled = Boolean(enabled);
        this.error = '';
        if (!this.enabled) this.stop();
        else {
            // Unlock the SAME element synchronously in the user's tap (Safari).
            this.audio ||= this.createAudio();
            this.audio.src = '/audio/thorsten/ready.mp3';
            try { Promise.resolve(this.audio.play()).catch(() => {}); } catch { /* next sentence falls back */ }
            // An optional data file, not part of the application startup bundle.
            // Never wait for it in the demo: while loading, the bubble remains readable.
            if (!this.clips && !this.loading) {
                this.loading = this.loadClips().then(clips => { this.clips = clips; }).catch(() => {
                    if (this.enabled) this.error = 'Thorsten ist gerade nicht verfügbar. Die Erklärung steht in der Sprechblase.';
                }).finally(() => { this.loading = null; this.onChange(); });
            }
        }
        this.onChange();
    }

    async speak(text, playback) {
        const clip = this.clips?.[text];
        if (!this.enabled || !clip) return false;
        this.audio ||= this.createAudio();
        this.audio.pause();
        this.audio.src = `/audio/thorsten/${clip}`;
        this.error = '';
        let result;
        try {
            result = await playback.waitForAudio(this.audio, {
                onCancel: cancel => { this.cancel = cancel; },
                onSpeaking: speaking => {
                    if (this.speaking === speaking) return;
                    this.speaking = speaking;
                    this.onChange();
                }
            });
        } finally { this.cancel = null; }
        if (!result && this.enabled) {
            this.error = 'Thorsten ist gerade nicht verfügbar. Die Erklärung steht in der Sprechblase.';
            this.onChange();
        }
        return result;
    }

    stop() {
        this.cancel?.();
        this.cancel = null;
        this.audio?.pause();
        this.speaking = false;
        this.onChange();
    }
}
