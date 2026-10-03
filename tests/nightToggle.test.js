import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initTheme, THEME_KEY } from '../src/ui/theme.js';
import { initNightToggle, NIGHT_PREV_BASEMAP_KEY } from '../src/ui/nightToggle.js';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

function memoryStorage() {
    const data = new Map();
    return {
        getItem: (k) => (data.has(k) ? data.get(k) : null),
        setItem: (k, v) => data.set(k, String(v)),
        removeItem: (k) => data.delete(k),
        data
    };
}

const win = { matchMedia: () => ({ matches: false, addEventListener() {} }) };
const isDark = () => document.documentElement.classList.contains('aurora-dark');

function mount(basemap = 'light') {
    document.head.innerHTML = '<meta name="theme-color" content="#0d9488">';
    document.body.innerHTML = `
        <button id="btn-night">🌙</button>
        <button data-theme-choice="auto"></button>
        <button data-theme-choice="light"></button>
        <button data-theme-choice="dark"></button>
        <select id="basemap-select">
            <option value="standard">Standard</option>
            <option value="light">Hell</option>
            <option value="lights">Lichterkarte</option>
        </select>`;
    document.documentElement.classList.remove('aurora-dark');
    const select = document.getElementById('basemap-select');
    select.value = basemap;
    const changes = [];
    select.addEventListener('change', () => changes.push(select.value));
    const storage = memoryStorage();
    const theme = initTheme({ win, storage });
    const night = initNightToggle({ theme, storage });
    return { select, changes, storage, night, button: document.getElementById('btn-night') };
}

describe('Mond/Sonne: komplett umschalten', () => {
    beforeEach(() => { document.body.innerHTML = ''; });

    it('Mond schaltet dunklen Stil und Lichterkarte zusammen ein', () => {
        const { select, changes, storage, button } = mount('light');
        expect(button.textContent).toBe('🌙');
        button.click();
        expect(isDark()).toBe(true);
        expect(select.value).toBe('lights');
        expect(changes).toEqual(['lights']); // über change → Zustand + Speicherung
        expect(storage.data.get(THEME_KEY)).toBe('dark');
        expect(storage.data.get(NIGHT_PREV_BASEMAP_KEY)).toBe('light');
        expect(button.textContent).toBe('☀️');
        expect(button.getAttribute('aria-pressed')).toBe('true');
        expect(document.querySelector('[data-theme-choice="dark"]').getAttribute('aria-pressed')).toBe('true');
    });

    it('Sonne kehrt zu hell und zur vorherigen Karte zurück', () => {
        const { select, button } = mount('light');
        button.click();
        button.click();
        expect(isDark()).toBe(false);
        expect(select.value).toBe('light');
        expect(button.textContent).toBe('🌙');
        expect(button.getAttribute('aria-pressed')).toBe('false');
    });

    it('war schon die Lichterkarte gewählt, führt die Sonne zur Standardkarte', () => {
        const { select, button } = mount('lights');
        button.click();
        expect(isDark()).toBe(true);
        button.click();
        expect(select.value).toBe('standard');
    });

    it('zeigt wieder den Mond, sobald Stil oder Karte anderswo geändert werden', () => {
        const { select, button } = mount('standard');
        button.click();
        select.value = 'standard';
        select.dispatchEvent(new Event('change'));
        expect(button.textContent).toBe('🌙');
        button.click();
        document.querySelector('[data-theme-choice="light"]').click();
        expect(button.textContent).toBe('🌙');
    });

    it('steht oben rechts in der Kopfzeile, vor ⓘ', () => {
        const html = read('index.html');
        const header = html.slice(html.indexOf('<header class="topbar">'), html.indexOf('</header>'));
        expect(header).toContain('id="btn-night"');
        expect(header.indexOf('id="btn-night"')).toBeLessThan(header.indexOf('id="btn-info"'));
        expect(header).not.toMatch(/btn-night[^>]*data-theme-choice/);
    });
});
