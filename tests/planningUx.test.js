import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { state, emit } from '../src/core/state.js';
import { initFirstSteps } from '../src/ui/firstSteps.js';

vi.mock('../src/ui/showcase.js', () => ({ startShowcaseStory: vi.fn(() => true) }));
vi.mock('../src/ui/demoWelcome.js', () => ({ isDemoWelcomeOpen: () => false }));
// „Erste Schritte" gibt es nur noch am Handy – das Gesicht ist hier umschaltbar.
const face = vi.hoisted(() => ({ phone: false }));
vi.mock('../src/core/viewport.js', async (importOriginal) => ({
    ...(await importOriginal()),
    isPhoneUi: () => face.phone
}));
const html = readFileSync('index.html', 'utf8');
const sidebar = readFileSync('src/ui/sidebar.js', 'utf8');

describe('Planungsstart und sichtbare Bedienhilfen', () => {
    it('startet auf dem Desktop im Außendienst (PO, 11.10.2026) mit aktiviertem Profi-Zugang', () => {
        expect(state.ui).toMatchObject({ mode: 'aussendienst', activeTab: 'tour', depth: 'profi' });
    });
    it('platziert globale Listenaktionen vor den Checkbox-Zeilen', () => {
        const section = sidebar.slice(sidebar.indexOf('function renderSection(section)'), sidebar.indexOf('function renderAddFilterControl'));
        expect(section.indexOf('class="filter-bulk"')).toBeLessThan(section.indexOf('class="filter-rows"'));
        expect(section).toContain('Alles auswählen');
        expect(section).toContain('Alle abwählen');
    });
    it('hält Mini-Demos beim ersten Start und nach automatischer Demo eingeklappt, aber bedienbar', () => {
        face.phone = true;
        localStorage.clear();
        document.body.innerHTML = '<div id="first-steps"></div>';
        state.customers = [{ id: 'a' }];state.tour.stops = [];state.fileName = 'Demo-Daten';
        initFirstSteps();emit('app:ready');
        const host = document.getElementById('first-steps');
        expect(host.classList.contains('collapsed')).toBe(true);
        emit('demo:auto-loaded');emit('demo-welcome:changed', false);
        expect(host.classList.contains('collapsed')).toBe(true);
        host.querySelector('.first-steps-chip').click();
        expect(host.classList.contains('collapsed')).toBe(false);
        expect(host.querySelectorAll('.first-steps-action')).toHaveLength(4);
        host.querySelector('.first-steps-later').click();
        expect(host.classList.contains('collapsed')).toBe(true);
        // Am Desktop: keine Checkliste – dort führen die „Live-Demos" oben rechts.
        face.phone = false;
        emit('customers:changed');
        expect(host.hidden).toBe(true);
        expect(host.innerHTML).toBe('');
        face.phone = true;
    });
    it('bietet eine zugängliche, zunächst eingeklappte Datenschutz-FAQ mit Grenzen des Local-First-Modells', () => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const faq = doc.querySelector('#info-dialog .privacy-faq');
        expect(faq.getAttribute('aria-labelledby')).toBe('privacy-faq-title');
        expect(faq.querySelectorAll('details')).toHaveLength(6);
        expect(faq.querySelectorAll('details[open]')).toHaveLength(0);
        expect(faq.textContent).toContain('IndexedDB');
        expect(faq.textContent).toContain('Nominatim');
        expect(faq.textContent).toContain('OSRM');
        expect(faq.textContent).toContain('Cloud-Zwischenablage');
        const scope = faq.querySelector('[data-i18n="info.privacy.encryptionAnswer1"]').textContent;
        expect(scope).toContain('Adress-Cache, separat gespeicherte Touren und Simulations-Szenarien');
        expect(scope).toContain('AES-256-GCM');
        const limits = faq.querySelector('[data-i18n="info.privacy.encryptionAnswer2"]').textContent;
        expect(limits).toContain('App-Einstellungen bleiben unverschlüsselt');
        expect(limits).toContain('keine bereits exportierten Dateien');
        expect(limits).toContain('kopierten Prompts');
        expect(limits).toContain('entschlüsselten Inhalte');
    });
});
