import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('Datentresor & sicherer Umzug: eingeklappt mit Status (Konzept „aufzoomen")', () => {
    const html = read('index.html');
    const vault = read('src/ui/lockVault.js');
    const sidebar = read('src/ui/sidebar.js');

    it('bündelt Tresor + Umzug in einem einklappbaren <details> mit Statuszeile', () => {
        expect(html).toContain('<details id="vault-details"');
        expect(html).toContain('id="vault-details-body"');
        expect(html).toContain('id="vault-summary-status"');
        // Der Tresor-Zustand bleibt in der eingeklappten Zeile sichtbar.
        expect(vault).toContain("getElementById('vault-summary-status')");
        expect(vault).toContain('Tresor aus');
    });

    it('hängt den Umzug-Block auf dem Desktop IN den einklappbaren Block (nicht daneben)', () => {
        // Sonst würde nur der Tresor-Teil einklappen, der Umzug bliebe stehen.
        expect(sidebar).toContain("(document.getElementById('vault-details-body') || vault).append(nodes.safeTitle, nodes.safeNote, nodes.safeActions)");
    });
});
