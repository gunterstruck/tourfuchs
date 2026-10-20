import { beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Daten-Tab am Desktop (PO, 11.10.2026): Wer neu ist, bekommt eine Datei von
 * Kollegen und sucht in „Daten" – der Empfang lag ganz unten im Tresor. Jetzt
 * nach Aufgaben: laden · weitergeben · schützen · mehr · löschen. Das Handy
 * behält seine Gruppen, auch nach einem Wechsel hin und zurück.
 */
let phone = false;
vi.mock('../src/core/viewport.js', async (importOriginal) => ({
    ...(await importOriginal()),
    isPhoneUi: () => phone
}));

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
let applyDataPanelLayout;

beforeAll(async () => {
    window.matchMedia ??= (query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} });
    const body = html.slice(html.indexOf('<body'), html.lastIndexOf('</body>'));
    document.body.innerHTML = body.slice(body.indexOf('>') + 1);
    ({ applyDataPanelLayout } = await import('../src/ui/sidebar.js'));
});

const $ = (id) => document.getElementById(id);
const groupOf = (id) => $(id).closest('.data-group')?.querySelector('.data-section-label')?.textContent ?? null;
const ids = (root) => [...root.querySelectorAll('[id]')].map((n) => n.id);

describe('Daten-Tab nach Aufgaben', () => {
    let mobileOrder;

    it('Handy: unveränderte Gruppen (laden · sichern · Werkzeuge)', () => {
        phone = true;
        applyDataPanelLayout();
        expect(groupOf('btn-upload-more')).toBe('Daten laden');
        expect(groupOf('btn-safe-receive')).toBe('Daten laden');
        expect(groupOf('btn-safe-export')).toBe('Sichern & übertragen');
        // Der Besuchsbericht entsteht am Handy und darf nicht im ausgeblendeten Block stecken.
        expect(groupOf('btn-visit-report-data')).toBe('Sichern & übertragen');
        expect(groupOf('btn-geocode')).toBe('Werkzeuge');
        expect($('data-primary-actions').hidden).toBe(true);
        mobileOrder = ids($('tab-daten'));
    });

    it('Desktop: „Daten von Kollegen empfangen" steht oben bei „Daten laden", nicht im Tresor', () => {
        phone = false;
        applyDataPanelLayout();
        expect(groupOf('btn-upload-more')).toBe('Daten laden');
        expect(groupOf('btn-safe-receive')).toBe('Daten laden');
        expect(groupOf('data-sources')).toBe('Daten laden');
        expect($('vault-details').contains($('btn-safe-receive'))).toBe(false);
        for (const id of ['btn-safe-export', 'btn-visit-report-data', 'btn-export', 'btn-export-handover', 'safe-transfer-note']) {
            expect(groupOf(id)).toBe('Weitergeben');
        }
        const more = $('data-more');
        for (const id of ['import-templates', 'btn-template-2', 'btn-geocode', 'btn-import-notes', 'data-explainer']) {
            expect(more.contains($(id))).toBe(true);
        }
        // Reihenfolge: laden · weitergeben · Schützen (Tresor) · Mehr · Löschen
        const order = ids($('data-loaded'));
        const at = (id) => order.indexOf(id);
        expect(at('btn-upload-more')).toBeLessThan(at('btn-safe-export'));
        expect(at('btn-safe-export')).toBeLessThan(at('vault-controls'));
        expect(at('vault-controls')).toBeLessThan(at('data-more'));
        expect(at('data-more')).toBeLessThan(at('btn-clear'));
        expect($('vault-controls').previousElementSibling.textContent).toBe('Schützen');
    });

    it('zurück aufs Handy: alles wieder an seinem Platz', () => {
        phone = true;
        applyDataPanelLayout();
        expect($('data-more')).toBeNull();
        expect(ids($('tab-daten'))).toEqual(mobileOrder);
    });
});

describe('Verortung unter „Mehr"', () => {
    it('klappt „Mehr" beim Start eines Laufs auf, damit der Fortschritt sichtbar ist', () => {
        const sidebar = readFileSync(resolve(process.cwd(), 'src/ui/sidebar.js'), 'utf8');
        expect(sidebar).toContain("if (running && progress.style.display === 'none') progress.closest('details:not([open])')?.setAttribute('open', '');");
    });
});
