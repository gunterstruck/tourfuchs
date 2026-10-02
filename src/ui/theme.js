/**
 * Darstellung: Automatisch (folgt dem Gerät) · Hell · Dunkel.
 *
 * Die Wahl liegt nur auf diesem Gerät (localStorage `tf_theme`). „Automatisch“
 * ist Standard: Steht das Gerät auf dunkel – oft automatisch ab
 * Sonnenuntergang –, zeigt TourFuchs den dunklen Aurora-Stil, sonst den hellen.
 * public/theme-boot.js wendet dieselbe Regel schon vor dem ersten Bild an.
 */
export const THEME_KEY = 'tf_theme';
export const THEME_CHOICES = ['auto', 'light', 'dark'];
const DARK_CLASS = 'aurora-dark';
const THEME_COLOR = { light: '#0d9488', dark: '#0b0a1a' };

export function normalizeThemeChoice(value) {
    return THEME_CHOICES.includes(value) ? value : 'auto';
}

/** Ergibt die Wahl zusammen mit der Geräteeinstellung einen dunklen Stil? */
export function resolveDark(choice, systemPrefersDark) {
    const normalized = normalizeThemeChoice(choice);
    if (normalized === 'dark') return true;
    if (normalized === 'light') return false;
    return Boolean(systemPrefersDark);
}

export function readThemeChoice(storage = globalThis.localStorage) {
    try { return normalizeThemeChoice(storage?.getItem(THEME_KEY)); } catch { return 'auto'; }
}

export function saveThemeChoice(choice, storage = globalThis.localStorage) {
    const normalized = normalizeThemeChoice(choice);
    try {
        if (normalized === 'auto') storage?.removeItem(THEME_KEY);
        else storage?.setItem(THEME_KEY, normalized);
    } catch { /* nur für diese Sitzung */ }
    return normalized;
}

export function applyTheme(dark, doc = document) {
    doc.documentElement.classList.toggle(DARK_CLASS, dark);
    const meta = doc.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? THEME_COLOR.dark : THEME_COLOR.light);
}

/** Schalter im Info-Dialog verdrahten und auf Wechsel am Gerät hören. */
export function initTheme({ doc = document, win = window, storage = globalThis.localStorage } = {}) {
    const media = win.matchMedia ? win.matchMedia('(prefers-color-scheme: dark)') : null;
    let choice = readThemeChoice(storage);
    const buttons = [...doc.querySelectorAll('[data-theme-choice]')];

    const render = () => {
        applyTheme(resolveDark(choice, media?.matches), doc);
        for (const button of buttons) {
            const active = button.dataset.themeChoice === choice;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        }
    };

    for (const button of buttons) {
        button.addEventListener('click', () => {
            choice = saveThemeChoice(button.dataset.themeChoice, storage);
            render();
        });
    }
    media?.addEventListener?.('change', () => { if (choice === 'auto') render(); });
    render();
    return { get choice() { return choice; } };
}
