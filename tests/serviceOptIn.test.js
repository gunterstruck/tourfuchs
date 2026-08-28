import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    OPTIONAL_MODULES,
    optionalModuleActive,
    optionalModuleEnabled,
    persistOptionalModule
} from '../src/features/optionalModules.js';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('Optionale Profi-Module', () => {
    const html = read('index.html');
    const layout = read('src/styles/layout.css');
    const responsive = read('src/styles/responsive.css');
    const sidebar = read('src/ui/sidebar.js');
    const map = read('src/features/map.js');
    const cockpit = read('src/ui/cockpit.js');
    const editor = read('src/ui/regionEditor.js');
    const tourPanel = read('src/ui/tourPanel.js');

    beforeEach(() => localStorage.clear());

    it('startet mit Gebietsplanung und Service ausdrücklich aus', () => {
        expect(optionalModuleEnabled('territoryPlanning')).toBe(false);
        expect(optionalModuleEnabled('service')).toBe(false);
        expect(OPTIONAL_MODULES.territoryPlanning.storageKey).toBe('gf_territory_planning_enabled');
        expect(OPTIONAL_MODULES.service.storageKey).toBe('gf_service_enabled');
    });

    it('merkt beide Entscheidungen über einen Reload hinweg', () => {
        persistOptionalModule('territoryPlanning', true);
        persistOptionalModule('service', true);
        expect(optionalModuleEnabled('territoryPlanning')).toBe(true);
        expect(optionalModuleEnabled('service')).toBe(true);

        persistOptionalModule('territoryPlanning', false);
        expect(optionalModuleEnabled('territoryPlanning')).toBe(false);
        expect(optionalModuleEnabled('service')).toBe(true);
    });

    it('bildet Aktivierung und Deaktivierung eindeutig über die UI-Klasse ab', () => {
        document.body.className = '';
        expect(optionalModuleActive('territoryPlanning')).toBe(false);
        document.body.classList.add(OPTIONAL_MODULES.territoryPlanning.bodyClass);
        expect(optionalModuleActive('territoryPlanning')).toBe(true);
        document.body.classList.remove(OPTIONAL_MODULES.territoryPlanning.bodyClass);
        expect(optionalModuleActive('territoryPlanning')).toBe(false);
    });

    it('führt beide Schalter in einem gemeinsamen, eingeklappten Profi-Block', () => {
        const modules = html.slice(html.indexOf('id="optional-modules"'), html.indexOf('class="mode-switch'));
        expect(modules).toContain('optional-modules expert-only');
        expect(modules).toContain('Optionale Profi-Module');
        expect(modules).toContain('id="chk-territory-planning-enabled"');
        expect(modules).toContain('Gebietsplanung &amp; Gebietsmanagement');
        expect(modules).toContain('id="chk-service-enabled"');
        expect(modules).toContain('Service-Vertragsradar');
    });

    it('blendet die Spezialmodi nur mit ihrer jeweiligen Body-Klasse ein', () => {
        expect(html).toContain('mode-btn expert-only territory-module-only');
        expect(html).toContain('mode-btn expert-only service-module-only');
        expect(layout).toContain('body:not(.territory-planning-on) .territory-module-only');
        expect(layout).toContain('body:not(.service-on) .service-module-only');
    });

    it('fällt beim Deaktivieren aus dem Spezialmodus auf Außendienst zurück', () => {
        expect(sidebar).toContain('function applyOptionalModule');
        expect(sidebar).toContain("if (!enabled && state.ui.mode === mode) applyMode('aussendienst'");
        expect(sidebar).toContain("mode === 'gebietsplanung' && !optionalModuleActive('territoryPlanning')");
        expect(sidebar).toContain("mode === 'service' && !optionalModuleActive('service')");
        expect(sidebar).toContain('initOptionalModuleOptIns();');
    });

    it('schützt auch direkte administrative Einstiege, nicht nur ihre Knöpfe', () => {
        expect(map).toContain("!optionalModuleActive('territoryPlanning')");
        expect(cockpit).toContain("optionalModuleActive('territoryPlanning')");
        expect(editor).toContain("optionalModuleActive('territoryPlanning')");
        expect(cockpit).toContain("on('optional-modules:changed'");
        expect(editor).toContain("on('optional-modules:changed'");
    });

    it('lässt operative Tour- und Briefing-Funktionen in Basis verfügbar', () => {
        const document = new DOMParser().parseFromString(html, 'text/html');
        for (const id of ['tour-dest', 'suggest-mode', 'round-trip', 'btn-tour-ics', 'btn-area-briefing', 'btn-near-briefing']) {
            const element = document.getElementById(id);
            expect(element, id).not.toBeNull();
            expect(element?.classList.contains('expert-only'), id).toBe(false);
            expect(element?.closest('.expert-only'), id).toBeNull();
        }
        expect(document.getElementById('customer-briefing-dialog')).not.toBeNull();
        expect(document.getElementById('area-briefing-dialog')).not.toBeNull();
        const depthSwitch = tourPanel.slice(
            tourPanel.indexOf('function applyTourMode'),
            tourPanel.indexOf('function initExpertSwipeControls')
        );
        expect(depthSwitch).not.toContain("state.tour.destination = null;");
        expect(depthSwitch).not.toContain("state.tour.suggestMode = 'radius';");
    });

    it('lässt Bezirksorientierung und Filter in Basis, hält Modulschalter aber mobil fern', () => {
        const document = new DOMParser().parseFromString(html, 'text/html');
        expect(document.querySelector('[data-tab="team"]')?.classList.contains('territory-module-only')).toBe(false);
        expect(document.getElementById('team-filters')?.closest('.territory-module-only')).toBeNull();
        expect(document.getElementById('tour-scope')?.closest('.territory-module-only')).toBeNull();
        expect(responsive).toContain('.optional-modules { display: none !important; }');
    });
});
