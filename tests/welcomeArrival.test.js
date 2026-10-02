import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('Erster Start: eine Begrüßung statt zwei', () => {
    const welcome = read('src/ui/demoWelcome.js');
    const wizard = read('src/ui/importWizard.js');
    const sidebar = read('src/ui/sidebar.js');

    it('die Begrüßung steht schon, während die Beispieldaten unterwegs sind', () => {
        expect(wizard).toContain("emit('welcome-demo:arriving', true);");
        expect(wizard).toContain("emit('welcome-demo:arriving', false);");
        expect(welcome).toContain('|| (arriving && state.customers.length === 0)');
    });

    it('Selbststart erst mit Beispieldaten', () => {
        expect(welcome).toContain('if (root.hidden || !isDemoDataset(state.customers)) stopAutostart(); else startAutostart();');
    });

    it('Panel und Blatt wiederholen das Willkommen nicht', () => {
        expect(read('src/styles/components.css')).toContain('body.welcome-arriving #onboarding .ob-hero');
        expect(sidebar).toContain('if (open && state.customers.length === 0) showMapView(false);');
        expect(sidebar).toContain('state.customers.length === 0 && !isDemoWelcomeOpen()');
    });

    it('keine doppelten Hinweise beim automatischen Laden', () => {
        expect(wizard).toContain("await applyCustomers(customers, 'Demo-Daten', { announce: false });");
        expect(wizard).toContain('if (!isDemoWelcomeOpen()) {');
    });
});
