import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('Datentresor: eingeklappt mit Status (Konzept „aufzoomen")', () => {
    const html = read('index.html');
    const vault = read('src/ui/lockVault.js');
    const sidebar = read('src/ui/sidebar.js');

    it('bündelt den Tresor in einem einklappbaren <details> mit Statuszeile', () => {
        expect(html).toContain('<details id="vault-details"');
        expect(html).toContain('id="vault-details-body"');
        expect(html).toContain('id="vault-summary-status"');
        // Der Tresor-Zustand bleibt in der eingeklappten Zeile sichtbar.
        expect(vault).toContain("getElementById('vault-summary-status')");
        expect(vault).toContain('Tresor aus');
    });

    it('der Empfang von Kollegen steht nicht mehr im eingeklappten Tresor (PO, 11.10.2026)', () => {
        // Neue Nutzer bekommen meist eine Datei von Kollegen – der Empfang
        // gehört zu „Daten laden"; die Anordnung prüft tests/dataPanelLayout.test.js.
        expect(html).toContain('🔐 Datentresor <span id="vault-summary-status"');
        expect(html).not.toContain('Datentresor &amp; sicherer Umzug');
        expect(sidebar).toContain('d.load.col.append(nodes.upload, nodes.compliance, nodes.safeReceive');
    });
});
