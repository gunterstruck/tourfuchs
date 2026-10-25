import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * Der externe TourFuchs-Guide (GPT bei ChatGPT) ist seit 25.10.2026 aus der
 * App entfernt: OpenAI schaltet Custom GPTs am 11.12.2026 ab, und Plugins
 * lassen sich nicht öffentlich teilen – für die Nutzer bliebe ein toter Link.
 * Die Wissensbasis bleibt als Dokumentation erhalten.
 */
const read = (file) => readFileSync(file, 'utf8');
const shipped = () => ['index.html', ...execFileSync('git', ['ls-files', 'src', 'public'], { encoding: 'utf8' })
    .split('\n').filter((file) => /\.(js|css|html)$/.test(file))];

describe('Externer Guide entfernt', () => {
    it('die App verlinkt nicht mehr auf ChatGPT', () => {
        const hits = shipped().filter((file) => file !== 'public/datenschutz.html' && /chatgpt\.com\/g\//.test(read(file)));
        expect(hits).toEqual([]);
    });

    it('kein Schalter, Dialog oder Knopf mehr', () => {
        const html = read('index.html');
        for (const id of ['chk-guide-enabled', 'guide-dialog', 'guide-optin-dialog', 'js-open-guide']) expect(html).not.toContain(id);
        expect(read('src/main.js')).not.toContain('initGuide');
    });

    it('kein optionales Modul „guide" mehr', async () => {
        const { OPTIONAL_MODULES } = await import('../src/features/optionalModules.js');
        expect(Object.keys(OPTIONAL_MODULES)).toEqual(['territoryPlanning', 'service']);
    });

    it('die Datenschutzerklärung nennt die Entfernung', () => {
        const privacy = read('public/datenschutz.html');
        expect(privacy).toContain('TourFuchs verlinkt nicht mehr auf ChatGPT.');
        expect(privacy).not.toContain('Frag den TourFuchs-Guide');
    });
});
