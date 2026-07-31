import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    AREA_BRIEFING_LIMIT,
    areaBriefingSelection,
    areaLabelFor,
    buildAreaBriefingPrompt
} from '../src/features/areaBriefing.js';
import { assistantById } from '../src/services/assistant.js';

const NOW = new Date('2026-07-26T09:00:00');

const customers = [
    {
        id: 'k-1',
        name: 'Muster Technik GmbH',
        nummer: '4711',
        strasse: 'Geheime Straße 10',
        plz: '45136',
        ort: 'Essen',
        ansprechpartner: 'Frau Muster',
        telefon: '0201 123456',
        email: 'intern@example.test',
        umsatz: 900000,
        lat: 51.45,
        lng: 7.01,
        rhythmusWochen: 8,
        besuche: ['2026-01-12']
    },
    {
        id: 'k-2',
        name: 'Beispiel Maschinenbau AG',
        nummer: '4712',
        plz: '44135',
        ort: 'Dortmund',
        umsatz: 120000,
        rhythmusWochen: 26,
        besuche: ['2026-07-20']
    }
];

const demoCustomer = { id: 'demo-3', name: 'TourFuchs Demo · Autohaus Nord', plz: '45127', ort: 'Essen' };

const many = (count) => Array.from({ length: count }, (_, i) => ({
    id: `k-${i}`, name: `Kunde ${i}`, nummer: String(1000 + i), plz: '45136', ort: 'Essen'
}));

describe('Gebiets-Briefing: Auswahl', () => {
    it('nimmt die Reihenfolge, wie sie auf dem Schirm steht', () => {
        const { included, total, truncated } = areaBriefingSelection(customers);
        expect(included.map((c) => c.id)).toEqual(['k-1', 'k-2']);
        expect(total).toBe(2);
        expect(truncated).toBe(false);
    });

    it('lässt Beispielkunden gar nicht erst hinein', () => {
        const { included, total, demoCount } = areaBriefingSelection([customers[0], demoCustomer]);
        expect(included.map((c) => c.id)).toEqual(['k-1']);
        expect(total).toBe(1);
        expect(demoCount).toBe(1);
    });

    it('deckelt lange Listen – ein Gebiet ist kein Bestand', () => {
        const { included, total, truncated } = areaBriefingSelection(many(40));
        expect(included).toHaveLength(AREA_BRIEFING_LIMIT);
        expect(total).toBe(40);
        expect(truncated).toBe(true);
    });
});

describe('Gebiets-Briefing: Prompt', () => {
    const prompt = buildAreaBriefingPrompt(
        customers,
        { areaLabel: 'Umkreis von 25 km um Essen Hbf', plannedDate: '2026-07-28', total: 2, now: NOW },
        assistantById('copilot')
    );

    it('benennt Gebiet, Besuchstag und die Kunden eindeutig', () => {
        expect(prompt).toContain('Umkreis von 25 km um Essen Hbf');
        expect(prompt).toContain('Geplanter Besuchstag: 28.07.2026');
        expect(prompt).toContain('1. Muster Technik GmbH · Kundennummer 4711 · 45136 Essen');
        expect(prompt).toContain('2. Beispiel Maschinenbau AG · Kundennummer 4712 · 44135 Dortmund');
        expect(prompt).toContain('Vermische keine ähnlich benannten Kunden');
    });

    it('gibt keine Daten heraus, die für die Reihenfolge nichts beitragen', () => {
        // Dieselbe Zusage wie beim Kundenbriefing – bei einer ganzen Liste
        // wiegt sie schwerer, nicht leichter.
        expect(prompt).not.toContain('Geheime Straße');
        expect(prompt).not.toContain('0201 123456');
        expect(prompt).not.toContain('intern@example.test');
        expect(prompt).not.toContain('Frau Muster');
        expect(prompt).not.toContain('900000');
        expect(prompt).not.toMatch(/51\.45|7\.01/);
    });

    it('gibt die lokal bekannte Fälligkeit mit, damit der Assistent sie nicht rät', () => {
        expect(prompt).toContain('überfällig');
        expect(prompt).toContain('zuletzt besucht 12.01.2026');
    });

    it('verlangt beides: was los ist und in welcher Reihenfolge', () => {
        // Nur eine Rangliste wäre zu wenig – der Nutzer will auch wissen,
        // warum. Nur Fließtext wäre zu viel: Er steht vor der Tür.
        expect(prompt).toContain('## Tourreihenfolge');
        expect(prompt).toContain('## Das solltest du wissen');
        expect(prompt).toContain('## Mitnehmen / vorbereiten');
        expect(prompt).toContain('## Nichts gefunden');
        expect(prompt).toContain('höchstens 300 Wörter');
        expect(prompt).toContain('Erfinde nichts');
        expect(prompt).toContain('Nutze keine Websuche');
    });

    it('lässt die Reihenfolge aus den Funden entstehen, nicht aus der Entfernung', () => {
        // Die Entfernung kennt TourFuchs selbst – dafür braucht es keinen
        // Assistenten. Wertvoll ist, was offen ist.
        expect(prompt).toContain('nicht aus der Entfernung');
        expect(prompt).toContain('Nenne bei jeder Aussage Datum und Anlass');
    });

    it('übernimmt die Quellenzeile des gewählten Assistenten', () => {
        expect(prompt).toContain(assistantById('copilot').promptSources);
        const gemini = buildAreaBriefingPrompt(customers, { areaLabel: 'Umkreis' }, assistantById('gemini'));
        expect(gemini).toContain(assistantById('gemini').promptSources);
    });

    it('sagt, dass die Liste gekürzt wurde – sonst hält man sie für vollständig', () => {
        const cut = buildAreaBriefingPrompt(many(12), { areaLabel: 'Umkreis von 50 km', total: 37 });
        expect(cut).toContain('Es sind 37 Kunden im Gebiet; hier stehen die 12 nächstgelegenen.');
    });

    it('baut für Beispielkunden keinen Prompt', () => {
        expect(() => buildAreaBriefingPrompt([demoCustomer], { areaLabel: 'Umkreis' })).toThrow(/Beispielkunden/);
    });
});

describe('Gebiets-Briefing: Gebietsbeschreibung', () => {
    it('beschreibt Umkreis, Strecke, Standort und Kartenausschnitt', () => {
        expect(areaLabelFor({ mode: 'radius', radiusKm: 25, startLabel: 'Essen Hbf' }))
            .toBe('Umkreis von 25 km um Essen Hbf');
        expect(areaLabelFor({ mode: 'radius', radiusKm: 25 })).toBe('Umkreis von 25 km um den Startpunkt');
        expect(areaLabelFor({ mode: 'route', startLabel: 'Essen Hbf' }))
            .toBe('Kunden entlang der geplanten Strecke ab Essen Hbf');
        expect(areaLabelFor({ mode: 'gps' })).toBe('Umkreis um meinen aktuellen Standort');
        expect(areaLabelFor({ mode: 'map' })).toBe('der aktuell sichtbare Kartenausschnitt');
    });
});

describe('Gebiets-Briefing: Verdrahtung', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const ui = readFileSync(resolve(process.cwd(), 'src/ui/areaBriefing.js'), 'utf8');
    const tourPanel = readFileSync(resolve(process.cwd(), 'src/ui/tourPanel.js'), 'utf8');
    const nearby = readFileSync(resolve(process.cwd(), 'src/ui/nearby.js'), 'utf8');
    const main = readFileSync(resolve(process.cwd(), 'src/main.js'), 'utf8');

    it('hat Dialog und beide Einstiege im Markup', () => {
        expect(html).toContain('id="area-briefing-dialog"');
        expect(html).toContain('id="area-briefing-body"');
        expect(html).toContain('id="area-briefing-footer"');
        expect(html).toContain('id="btn-area-briefing"');
        expect(html).toContain('id="btn-near-briefing"');
    });

    it('ist im Tourplaner und in „In der Nähe" verdrahtet und beim Start angemeldet', () => {
        expect(tourPanel).toContain('openAreaBriefing');
        expect(nearby).toContain('openAreaBriefing');
        expect(main).toContain('initAreaBriefing()');
    });

    it('zeigt den Knopf erst ab zwei echten Kunden', () => {
        expect(tourPanel).toContain('real.length < 2');
        expect(nearby).toContain('isDemoCustomer(c)).length < 2');
    });

    it('meldet sich nirgends an, sondern kopiert und öffnet', () => {
        // Derselbe Grundsatz wie beim Kundenbriefing: TourFuchs sendet nichts.
        expect(ui).toContain('copyText');
        expect(ui).not.toMatch(/fetch\(|msal|access_token|graph\.microsoft/i);
    });

    it('zeigt den Prompt vollständig, bevor er kopiert wird', () => {
        expect(ui).toContain('briefing-prompt-visible');
        expect(ui).toContain('pre.textContent = currentPrompt');
    });
});

describe('Ein Tag, auf den sich alles bezieht', () => {
    // Externer Prüfbericht, P2: Der Prompt sagte „Ich bin heute unterwegs" und
    // nannte zugleich einen anderen geplanten Besuchstag – während „überfällig"
    // gegen die echte Uhr gerechnet wurde. Zwei Zeitbezüge in einem Prompt.
    const KUNDE = { id: 'k1', name: 'Alpha GmbH', nummer: '4711', plz: '45127', ort: 'Essen' };

    it('sagt „heute", wenn kein Tag eingestellt ist', () => {
        const prompt = buildAreaBriefingPrompt([KUNDE], { areaLabel: 'Umkreis' });
        expect(prompt).toContain('Ich bin heute in diesem Gebiet unterwegs');
    });

    it('nennt den geplanten Tag, wenn er nicht heute ist', () => {
        const prompt = buildAreaBriefingPrompt([KUNDE], { areaLabel: 'Umkreis', plannedDate: '2026-09-15' });
        expect(prompt).toContain('Ich bin am 15.09.2026 in diesem Gebiet unterwegs');
        expect(prompt).not.toContain('Ich bin heute');
        // …und sagt ausdrücklich, worauf sich die Fälligkeiten beziehen.
        expect(prompt).toContain('Fälligkeiten unten beziehen sich auf diesen Tag');
    });

    it('rechnet die Fälligkeit gegen den geplanten Tag, nicht gegen die Uhr', () => {
        // Rhythmus 4 Wochen, letzter Besuch 01.07.: am 05.07. noch nicht fällig,
        // am 15.09. längst überfällig. Der Prompt muss den Reisetag meinen.
        const kunde = { ...KUNDE, rhythmusWochen: 4, besuche: ['2026-07-01'] };
        const frueh = buildAreaBriefingPrompt([kunde], { areaLabel: 'U', plannedDate: '2026-07-05' });
        const spaet = buildAreaBriefingPrompt([kunde], { areaLabel: 'U', plannedDate: '2026-09-15' });
        expect(frueh).not.toContain('überfällig');
        expect(spaet).toContain('überfällig');
    });
});
