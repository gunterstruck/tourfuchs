import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONFIG } from '../src/core/config.js';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('TourFuchs-Guide (externer GPT)', () => {
    const html = read('index.html');
    const guide = read('src/ui/guide.js');
    const showcase = read('src/ui/showcase.js');
    const privacy = read('public/datenschutz.html');

    it('verlinkt den Guide bei ChatGPT und öffnet ihn in einem neuen Tab', () => {
        expect(CONFIG.guideUrl).toMatch(/^https:\/\/chatgpt\.com\/g\/g-[\w-]+-tourfuchs-guide$/);
        expect(html).toContain(`href="${CONFIG.guideUrl}" target="_blank" rel="noopener noreferrer"`);
    });

    it('warnt vor jedem Öffnen ausdrücklich: außerhalb der Organisation', () => {
        // Kein Einstieg führt direkt zu ChatGPT – jeder öffnet zuerst den Hinweis.
        expect(html).toContain('Der Chat läuft außerhalb deiner Organisation');
        expect(html).toContain('Keine Kundendaten, keine internen Informationen, keine Firmendokumente eingeben');
        expect(html).toContain('Verstanden – Guide öffnen');
        expect(html.match(/chatgpt\.com\/g\//g)).toHaveLength(1);
        // Die Live-Demos bleiben unberührt.
        expect(showcase).not.toContain('js-open-guide');
        expect(showcase).not.toContain('chatgpt.com');
        expect(guide).toContain("event.target.closest?.('.js-open-guide')");
    });

    it('ist ab Werk aus und nur über „Optionale Module" (oder ?guide=1) einschaltbar', async () => {
        const { OPTIONAL_MODULES, optionalModuleEnabled } = await import('../src/features/optionalModules.js');
        expect(OPTIONAL_MODULES.guide.defaultEnabled).toBe(false);
        const leer = { getItem: () => null };
        expect(optionalModuleEnabled('guide', leer)).toBe(false);
        expect(optionalModuleEnabled('guide', { getItem: () => '1' })).toBe(true);
        expect(html).toContain('id="chk-guide-enabled"');
        expect(read('src/styles/components.css')).toContain('body:not(.guide-on) .guide-open { display: none !important; }');
        expect(guide).toContain("if (!dialog || !optionalModuleActive('guide')) return;");
        expect(read('src/ui/sidebar.js')).toContain("new URLSearchParams(location.search).get('guide')");
        expect(privacy).toContain('ab Werk ausgeschaltet');
    });

    it('übergibt keine Daten und ist im Datenschutz genannt', () => {
        expect(guide).not.toMatch(/[?&]q=|encodeURIComponent|state\.customers/);
        expect(privacy).toContain('außerhalb Ihrer\nOrganisation');
        expect(privacy).toContain('keine Kundendaten, internen Informationen oder Firmendokumente');
    });
});
