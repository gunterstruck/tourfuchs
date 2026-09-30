import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const main = readFileSync(resolve(process.cwd(), 'src/main.js'), 'utf8');

describe('Gescannter Tour-Link verschwindet sofort aus der Adresszeile', () => {
    it('nimmt das Fragment als Erstes beim Start heraus – vor Tresor und Daten', () => {
        const init = main.slice(main.indexOf('async function init() {'));
        expect(init.indexOf('takeSharedTourFromUrl();')).toBeGreaterThan(-1);
        expect(init.indexOf('takeSharedTourFromUrl();')).toBeLessThan(init.indexOf('initVault('));
        expect(main).toContain("history.replaceState(null, '', window.location.pathname + window.location.search);");
    });

    it('öffnet die Tour erst nach dem Entsperren', () => {
        expect(main).toContain('if (!pendingSharedTour || vaultLocked()) return;');
    });
});
