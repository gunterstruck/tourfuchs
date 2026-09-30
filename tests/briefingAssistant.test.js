import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assistantChooserHtml, wireAssistantChooser } from '../src/ui/briefingAssistant.js';
import { assistantForDepth, loadAssistantChoice } from '../src/services/assistant.js';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

beforeEach(() => { localStorage.clear(); });

describe('Zielwahl im Kunden- und Mehrkunden-Briefing', () => {
    it('beide Dialoge benutzen dasselbe Bauteil, mit eigenem Präfix', () => {
        const kunde = read('src/ui/customerBriefing.js');
        const gebiet = read('src/ui/areaBriefing.js');
        expect(kunde).toContain("assistantChooserHtml(currentAssistant, 'customer-briefing')");
        expect(gebiet).toContain("assistantChooserHtml(currentAssistant, 'area-briefing')");
        expect(kunde).not.toContain('function launchAssistant');
        expect(gebiet).not.toContain('function launchAssistant');
    });

    it('die Wahl im Lasso gilt auch fürs Kundenbriefing (eine gespeicherte Wahl)', () => {
        const root = document.createElement('div');
        root.innerHTML = assistantChooserHtml(assistantForDepth('profi'), 'area-briefing');
        let chosen = null;
        wireAssistantChooser(root, 'area-briefing', (assistant) => { chosen = assistant; });
        const other = [...root.querySelectorAll('input[name="area-briefing-assistant"]')].find((i) => !i.checked && i.value !== 'custom');
        other.checked = true;
        other.dispatchEvent(new Event('change'));
        expect(chosen.id).toBe(other.value);
        expect(loadAssistantChoice().id).toBe(other.value);
        expect(assistantForDepth('profi').id).toBe(other.value);
        expect(root.querySelector('.briefing-assistant summary b').textContent).toBe(`Ziel: ${chosen.label}`);
    });

    it('zwei Dialoge im Dokument koppeln ihre Radiogruppen nicht', () => {
        const a = assistantChooserHtml(assistantForDepth('profi'), 'customer-briefing');
        const b = assistantChooserHtml(assistantForDepth('profi'), 'area-briefing');
        expect(a).toContain('name="customer-briefing-assistant"');
        expect(b).toContain('name="area-briefing-assistant"');
        expect(a).toContain('id="customer-briefing-assistant-url"');
        expect(b).toContain('id="area-briefing-assistant-url"');
    });

    it('duzt durchgängig', () => {
        for (const file of ['src/ui/customerBriefing.js', 'src/ui/areaBriefing.js', 'src/ui/briefingAssistant.js']) {
            const text = read(file).split('\n').filter((line) => !/^\s*(\/\/|\*)/.test(line)).join('\n');
            expect(text, file).not.toMatch(/\b(Sie|Ihr|Ihre|Ihren|Ihnen)\b/);
        }
    });
});
