import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { recedingPaysOff, nextRecededState, RECEDE_AT, RESTORE_AT } from '../src/features/offerAutoHide.js';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('Vorübergehende Angebote treten beim Scrollen zurück (kontextbasiert, ohne Timer)', () => {
    const mod = read('src/ui/offerAutoHide.js');
    const main = read('src/main.js');
    const css = read('src/styles/components.css');

    it('ist als eigenes Modul verdrahtet und wird initialisiert', () => {
        expect(mod).toContain('export function initOfferAutoHide');
        expect(main).toContain("import { initOfferAutoHide } from './ui/offerAutoHide.js'");
        expect(main).toContain('initOfferAutoHide()');
    });

    it('nutzt Scroll (nicht Zeit) als Auslöser und reagiert auf die Inhaltsfläche', () => {
        // Kein Timer als Auslöser: keine setInterval/Zeit-getriebene Ausblendung.
        expect(mod).not.toMatch(/setInterval/);
        // Scroll in der Capture-Phase, gebunden an die aktive Tab-Karte.
        expect(mod).toContain("addEventListener('scroll'");
        expect(mod).toContain("classList.contains('tab-panel')");
        // Hysterese: runter ausblenden, hoch wieder einblenden. Die Schwellen
        // liegen prüfbar in features/offerAutoHide.js.
        expect(mod).toContain('nextRecededState(');
        expect(mod).toContain('setReceded(next)');
        expect(mod).toContain("classList.toggle('offers-receded'");
    });

    it('bietet Angebote beim (Wieder-)Betreten erneut an – nie dauerhaft weg', () => {
        expect(mod).toContain("on('tab:changed', () => setReceded(false))");
        expect(mod).toContain("on('mode:changed', () => setReceded(false))");
        // Auf-/Zuklappen des Blatts setzt zurück (Peek zeigt den Streifen).
        expect(mod).toContain('MutationObserver');
    });

    it('lässt in der CSS die angepinnten Angebote sanft einklappen', () => {
        expect(css).toContain('body.offers-receded .basemap-control');
        expect(css).toContain('body.offers-receded #demo-banner');
        expect(css).toMatch(/body\.offers-receded[\s\S]*max-height: 0;/);
        // Reduzierte Bewegung respektiert.
        expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    });

    it('misst, wie viel Platz das Zurücktreten überhaupt freigäbe', () => {
        expect(mod).toContain('function recedableSpace');
        // Ränder zählen mit: sie klappen in der CSS ebenfalls auf 0.
        expect(mod).toContain('marginTop');
        expect(mod).toContain('marginBottom');
        // Die Checkliste ist das größte Angebot – sie muss mitgerechnet werden,
        // sonst greift die Lohnt-sich-Regel zu kurz und die Einbahnstraße kehrt
        // bei mittleren Überhängen zurück (gemessen: Filter-Reiter, 114 px).
        expect(mod).toMatch(/const OFFERS = \[[^\]]*#first-steps/);
    });
});

describe('Zurücktreten nur, wenn es sich lohnt', () => {
    // Gemessen am gebauten Stand, Desktop 1440×900, mit Beispieldaten:
    // Die Angebote geben zusammen ~312 px frei (Kartenstil 26, Beispieldaten-
    // Streifen 50, Erste-Schritte-Karte 218 zzgl. Ränder).
    const FREED = 312;

    it('tritt zurück, wenn der Überhang größer ist als der gewonnene Platz', () => {
        // Daten-Reiter: 384 px Überhang. Danach bleiben 103 px – weiter scrollbar,
        // also auch weiter umkehrbar.
        expect(recedingPaysOff({ overflow: 384, freed: FREED })).toBe(true);
    });

    it('tritt nicht zurück, wenn der Inhalt danach ganz ins Fenster passte', () => {
        // Tour-Reiter: nur 81 px Überhang. Träten die Angebote zurück, gäbe es
        // nichts mehr zu scrollen – und damit kein Ereignis, das sie zurückholt.
        // Genau diese Einbahnstraße verhindert die Regel.
        expect(recedingPaysOff({ overflow: 81, freed: FREED })).toBe(false);
        // Filter-Reiter: 114 px. Knapp über dem, was die beiden kleinen Angebote
        // allein hergäben – aber weit unter dem, was mit der Checkliste frei wird.
        expect(recedingPaysOff({ overflow: 114, freed: FREED })).toBe(false);
    });

    it('tritt nicht zurück, wenn es gar keinen Überhang gibt', () => {
        expect(recedingPaysOff({ overflow: 0, freed: FREED })).toBe(false);
        expect(recedingPaysOff({ overflow: -20, freed: FREED })).toBe(false);
    });

    it('tritt nicht zurück, wenn die Angebote nichts freigäben', () => {
        expect(recedingPaysOff({ overflow: 300, freed: 0 })).toBe(false);
    });

    it('verträgt unbrauchbare Messwerte, ohne etwas auszublenden', () => {
        expect(recedingPaysOff({ overflow: NaN, freed: FREED })).toBe(false);
        expect(recedingPaysOff({ overflow: 300, freed: undefined })).toBe(false);
    });
});

describe('Hysterese beim Hoch- und Runterscrollen', () => {
    const lohnend = { overflow: 400, freed: 312 };

    it('tritt beim Scrollen in den Inhalt zurück', () => {
        expect(nextRecededState({ receded: false, scrollTop: RECEDE_AT + 1, ...lohnend })).toBe(true);
    });

    it('lässt den Zustand knapp unter der Schwelle in Ruhe', () => {
        expect(nextRecededState({ receded: false, scrollTop: RECEDE_AT, ...lohnend })).toBe(null);
    });

    it('holt die Angebote ganz oben zurück', () => {
        expect(nextRecededState({ receded: true, scrollTop: 0, ...lohnend })).toBe(false);
        expect(nextRecededState({ receded: true, scrollTop: RESTORE_AT - 1, ...lohnend })).toBe(false);
    });

    it('lässt sie im Zwischenbereich stehen, statt zu zittern', () => {
        expect(nextRecededState({ receded: true, scrollTop: 30, ...lohnend })).toBe(null);
        expect(nextRecededState({ receded: false, scrollTop: 30, ...lohnend })).toBe(null);
    });

    it('tritt auch weit unten nicht zurück, wenn es sich nicht lohnt', () => {
        expect(nextRecededState({ receded: false, scrollTop: 200, overflow: 81, freed: 312 })).toBe(null);
    });
});

describe('Die Erste-Schritte-Karte tritt mit zurück', () => {
    const firstSteps = read('src/ui/firstSteps.js');
    const mod = read('src/ui/offerAutoHide.js');

    it('meldet das Zurücktreten als Ereignis', () => {
        expect(mod).toContain("emit('offers:receded'");
    });

    it('klappt die Checkliste beim Zurücktreten zur Zeile ein', () => {
        expect(firstSteps).toContain("on('offers:receded'");
    });

    it('klappt sie beim Zurückholen nicht von selbst wieder auf', () => {
        // Hochscrollen holt die kleinen Angebote zurück, nicht die Checkliste:
        // wer sie weggeklappt hat, hat sie weggeklappt.
        const handler = firstSteps.slice(firstSteps.indexOf("on('offers:receded'"), firstSteps.indexOf("on('offers:receded'") + 120);
        expect(handler).toContain('if (receded)');
    });
});
