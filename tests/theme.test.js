import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    initTheme, normalizeThemeChoice, readThemeChoice, resolveDark, saveThemeChoice, THEME_KEY
} from '../src/ui/theme.js';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

function memoryStorage(initial = {}) {
    const data = new Map(Object.entries(initial));
    return {
        getItem: (key) => (data.has(key) ? data.get(key) : null),
        setItem: (key, value) => data.set(key, String(value)),
        removeItem: (key) => data.delete(key),
        data
    };
}

function fakeWindow(prefersDark) {
    const listeners = [];
    const media = {
        matches: prefersDark,
        addEventListener: (type, fn) => listeners.push(fn)
    };
    return {
        matchMedia: () => media,
        flip(next) { media.matches = next; listeners.forEach((fn) => fn()); }
    };
}

function mountSwitch() {
    document.head.innerHTML = '<meta name="theme-color" content="#0d9488">';
    document.body.innerHTML = `
        <div class="segmented theme-switch">
            <button data-theme-choice="auto">Automatisch</button>
            <button data-theme-choice="light">Hell</button>
            <button data-theme-choice="dark">Dunkel</button>
        </div>`;
    document.documentElement.classList.remove('aurora-dark');
}

const isDark = () => document.documentElement.classList.contains('aurora-dark');
const pressed = () => [...document.querySelectorAll('[data-theme-choice]')]
    .filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.themeChoice);

describe('Darstellung: Automatisch · Hell · Dunkel', () => {
    beforeEach(mountSwitch);

    it('entscheidet nach Wahl, bei „Automatisch“ nach dem Gerät', () => {
        expect(resolveDark('auto', true)).toBe(true);
        expect(resolveDark('auto', false)).toBe(false);
        expect(resolveDark('light', true)).toBe(false);
        expect(resolveDark('dark', false)).toBe(true);
        expect(resolveDark('unsinn', true)).toBe(true);
        expect(normalizeThemeChoice(null)).toBe('auto');
    });

    it('merkt sich nur Hell/Dunkel; „Automatisch“ hinterlässt nichts', () => {
        const storage = memoryStorage();
        saveThemeChoice('dark', storage);
        expect(storage.data.get(THEME_KEY)).toBe('dark');
        expect(readThemeChoice(storage)).toBe('dark');
        saveThemeChoice('auto', storage);
        expect(storage.data.has(THEME_KEY)).toBe(false);
        expect(readThemeChoice({ getItem() { throw new Error('gesperrt'); } })).toBe('auto');
    });

    it('folgt standardmäßig dem Gerät – auch beim Wechsel während der Nutzung', () => {
        const win = fakeWindow(false);
        initTheme({ win, storage: memoryStorage() });
        expect(isDark()).toBe(false);
        expect(pressed()).toEqual(['auto']);
        win.flip(true);
        expect(isDark()).toBe(true);
        expect(document.querySelector('meta[name="theme-color"]').content).toBe('#0b0a1a');
    });

    it('eine bewusste Wahl gilt und überstimmt das Gerät', () => {
        const storage = memoryStorage();
        const win = fakeWindow(true);
        initTheme({ win, storage });
        expect(isDark()).toBe(true);
        document.querySelector('[data-theme-choice="light"]').click();
        expect(isDark()).toBe(false);
        expect(pressed()).toEqual(['light']);
        expect(storage.data.get(THEME_KEY)).toBe('light');
        win.flip(true);
        expect(isDark()).toBe(false);
    });

    it('der Start-Baustein wendet dieselbe Regel vor dem ersten Bild an', () => {
        const html = read('index.html');
        const head = html.slice(0, html.indexOf('</head>'));
        expect(head).toContain('<script src="/theme-boot.js"></script>');
        const boot = read('public/theme-boot.js');
        expect(boot).toContain(`'${THEME_KEY}'`);
        expect(boot).toContain('aurora-dark');
        expect(html.match(/data-theme-choice="(auto|light|dark)"/g)).toHaveLength(3);
    });

    it('der Dunkelstil greift nur mit html.aurora-dark – der helle Tag bleibt Standard', () => {
        for (const file of ['src/styles/aurora-dark.css', 'src/styles/aurora-tones.css']) {
            const css = read(file).replace(/\/\*[\s\S]*?\*\//g, '');
            const selectors = [...css.matchAll(/(^|\})\s*([^{}@]+)\{/g)]
                .map((m) => m[2].trim())
                .filter((s) => s && !/^(from|to|\d+%)/.test(s));
            for (const selector of selectors) {
                for (const part of selector.split(',')) {
                    expect(part.trim(), `${file}: ${part.trim()}`).toMatch(/aurora-dark/);
                }
            }
        }
    });

    it('Kartenstil „Nacht": dieselben OSM-Kacheln, gedämpft statt invertiert, nur auf Wahl', async () => {
        const { CONFIG } = await import('../src/core/config.js');
        const night = CONFIG.tileLayers.night;
        expect(night.label).toBe('Nacht');
        expect(night.url).toBe(CONFIG.tileLayers.standard.url);
        expect(night.className).toBe('basemap-night');
        const rule = read('src/styles/map.css').match(/\.leaflet-layer\.basemap-night\s*\{([^}]*)\}/);
        expect(rule?.[1]).toMatch(/brightness\(0\.\d+\)/);
        expect(rule?.[1]).not.toMatch(/invert|hue-rotate/);
        // Standard bleibt die normale Karte; die Darstellung schaltet die Karte nie mit.
        expect(read('src/core/state.js')).toContain("basemap: 'standard'");
        expect(read('src/ui/theme.js')).not.toMatch(/basemap/);
    });
});
