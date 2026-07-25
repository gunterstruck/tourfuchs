import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    buildCustomerBriefingPrompt,
    customerBriefingContext,
    customerBriefingFlow
} from '../src/features/customerBriefing.js';
import {
    ASSISTANTS,
    assistantForDepth,
    forgetLegacyCopilotSetup,
    loadAssistantChoice,
    resolveAssistant,
    saveAssistantChoice,
    validateAssistantUrl
} from '../src/services/assistant.js';

const customer = {
    id: 'kunde-1',
    name: 'Beispiel Technik GmbH',
    nummer: '4711',
    strasse: 'Geheime Straße 10',
    plz: '45136',
    ort: 'Essen',
    ansprechpartner: 'Frau Beispiel',
    telefon: '0201 123456',
    email: 'intern@example.test',
    umsatz: 900000,
    besuche: ['2026-02-04', '2026-06-21']
};

beforeEach(() => localStorage.clear());

describe('Kundenbriefing', () => {
    it('bleibt in Basis und Profi derselbe manuelle Weg, Profi ergänzt nur die Zielwahl', () => {
        expect(customerBriefingFlow('basis')).toBe('manual');
        expect(customerBriefingFlow('profi')).toBe('choice');
    });

    it('baut einen eindeutigen, datensparsamen Vertriebs-Prompt', () => {
        const prompt = buildCustomerBriefingPrompt(customer, {
            plannedDate: '2026-07-15',
            stopPosition: 2,
            stopCount: 5,
            lastLocalVisit: '2026-06-21'
        });

        expect(prompt).toContain('Beispiel Technik GmbH');
        expect(prompt).toContain('Kundennummer: 4711');
        expect(prompt).toContain('45136 Essen');
        expect(prompt).toContain('Hauptansprechpartner: Frau Beispiel');
        expect(prompt).toContain('Geplanter Besuch: 15.07.2026');
        expect(prompt).toContain('Stopp 2 von 5');
        expect(prompt).toContain('Nutze keine Websuche');
        expect(prompt).toContain('## Jetzt wichtig');
        expect(prompt).toContain('genau 3 kurze, konkrete Fragen');
        expect(prompt).toContain('höchstens 250 Wörter');
        expect(prompt).toContain('keinen Vorspann');
        expect(prompt).toContain('jeden Quellenlink höchstens einmal');
        expect(prompt).not.toContain(customer.strasse);
        expect(prompt).not.toContain(customer.telefon);
        expect(prompt).not.toContain(customer.email);
        expect(prompt).not.toContain(String(customer.umsatz));
    });

    it('nennt die Quellen des gewählten Assistenten', () => {
        const copilot = buildCustomerBriefingPrompt(customer, {}, ASSISTANTS.find((a) => a.id === 'copilot'));
        const gemini = buildCustomerBriefingPrompt(customer, {}, ASSISTANTS.find((a) => a.id === 'gemini'));

        expect(copilot).toContain('Microsoft-365-Inhalte');
        expect(gemini).toContain('Google-Workspace-Inhalte');
        expect(gemini).not.toContain('Microsoft-365-Inhalte');
        // ohne Angabe bleibt es beim Standard (Microsoft 365)
        expect(buildCustomerBriefingPrompt(customer, {})).toContain('Microsoft-365-Inhalte');
    });

    it('erzeugt für Demo-Kunden niemals einen externen Prompt', () => {
        expect(() => buildCustomerBriefingPrompt({ ...customer, id: 'demo-1', demo: true }))
            .toThrow(/Demo-Kunden/);
    });

    it('leitet nur den aktuellen Tourkontext des Kunden ab', () => {
        const context = customerBriefingContext(customer, {
            start: { customerId: 'anderer-kunde' },
            destination: { customerId: customer.id },
            stops: ['kunde-0', customer.id, 'kunde-2']
        }, '2026-07-16');

        expect(context).toEqual({
            plannedDate: '2026-07-16',
            stopPosition: 2,
            stopCount: 3,
            isStart: false,
            isDestination: true,
            lastLocalVisit: '2026-06-21'
        });
    });
});

describe('Zielassistent', () => {
    it('steht in Basis fest auf Copilot und ist nur im Profi wählbar', () => {
        saveAssistantChoice({ id: 'gemini' });
        expect(assistantForDepth('basis').id).toBe('copilot');
        expect(assistantForDepth('profi').id).toBe('gemini');
    });

    it('merkt die Wahl lokal und fällt bei Unbekanntem auf Copilot zurück', () => {
        saveAssistantChoice({ id: 'chatgpt' });
        expect(loadAssistantChoice().id).toBe('chatgpt');
        localStorage.setItem('tourfuchs:briefing-assistant:v1', '{"id":"gibtsnicht"}');
        expect(loadAssistantChoice().id).toBe('copilot');
    });

    it('lässt für eigene Assistenten nur https zu', () => {
        expect(validateAssistantUrl('https://assistent.example.com/chat')).toContain('https://');
        expect(() => validateAssistantUrl('http://assistent.example.com')).toThrow(/https/);
        expect(() => validateAssistantUrl('javascript:alert(1)')).toThrow(/https/);
        expect(() => validateAssistantUrl('')).toThrow();
        expect(() => saveAssistantChoice({ id: 'custom', customUrl: 'kein-url' })).toThrow();
    });

    it('führt eine unvollständige eigene Adresse nie ins Leere', () => {
        expect(resolveAssistant({ id: 'custom', customUrl: '' }).id).toBe('copilot');
        expect(resolveAssistant({ id: 'custom', customUrl: 'https://assistent.example.com' }).url)
            .toContain('assistent.example.com');
    });

    it('räumt Kennungen und Einwilligung der früheren Automatik weg', () => {
        localStorage.setItem('tourfuchs:copilot-config:v1', '{"clientId":"alt"}');
        localStorage.setItem('tourfuchs:copilot-consent:v1', 'yes');
        forgetLegacyCopilotSetup();
        expect(localStorage.getItem('tourfuchs:copilot-config:v1')).toBeNull();
        expect(localStorage.getItem('tourfuchs:copilot-consent:v1')).toBeNull();
    });
});

describe('Keine automatische KI-Anbindung mehr', () => {
    const briefingSource = readFileSync(resolve(process.cwd(), 'src/ui/customerBriefing.js'), 'utf8');

    it('ersetzt den bisherigen Kopieren-Button durch Briefing', () => {
        const mapSource = readFileSync(resolve(process.cwd(), 'src/features/map.js'), 'utf8');
        const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
        expect(mapSource).toContain('data-action="customer-briefing"');
        expect(mapSource).not.toContain('data-action="copy-customer"');
        expect(html).toContain('id="customer-briefing-dialog"');
    });

    it('enthält weder Anmeldung noch API-Aufruf im Briefing-Dialog', () => {
        expect(briefingSource).not.toMatch(/msal|graph\.microsoft|loginPopup|acquireToken|accessToken|clientId|tenantId/i);
        expect(briefingSource).toContain('data-briefing-open');
    });

    it('hat MSAL vollständig aus dem Projekt entfernt', () => {
        const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));
        expect(Object.keys(pkg.dependencies)).not.toContain('@azure/msal-browser');
    });
});
