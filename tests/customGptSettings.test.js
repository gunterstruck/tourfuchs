import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Name, Beschreibung und Gesprächsaufhänger des TourFuchs-Guides stehen nur im
 * ChatGPT-Editor – und gehen bei der Umstellung GPT → Plugin (Frist 11.12.2026)
 * verloren. Deshalb liegen sie im Repo und reisen mit dem Upload-Paket.
 */
const read = (file) => readFileSync(file, 'utf8');
const settings = read('docs/custom-gpt-einstellungen.md');
const starters = settings.split('## Gesprächsaufhänger')[1].split('## ')[0]
    .match(/```\n([^`]+?)\n```/g).map((block) => block.slice(4, -4));

describe('Einstellungen des TourFuchs-Guides', () => {
    it('hält die Gesprächsaufhänger fest', () => {
        expect(starters).toHaveLength(5);
        expect(starters).toContain('🦊 TourFuchs-PWA öffnen');
    });

    it('der Aufhänger zum App-Link passt zu den Anweisungen', () => {
        expect(read('docs/custom-gpt-systemprompt.txt')).toContain('„🦊 TourFuchs-PWA öffnen“');
    });

    it('nutzt keine veralteten Begriffe', () => {
        for (const outdated of ['Gebiets-Briefing', 'Basis', 'Profi', 'Als Excel exportieren']) {
            expect(starters.join('\n')).not.toContain(outdated);
        }
        expect(read('docs/guide-ki-wissensbasis.md')).toContain('Mehrkunden-Briefing');
    });

    it('reist mit dem Upload-Paket', () => {
        expect(read('tools/prepare-custom-gpt-upload.mjs')).toContain("['docs/custom-gpt-einstellungen.md', 'EINSTELLUNGEN.md']");
        expect(read('custom-gpt-upload/EINSTELLUNGEN.md')).toBe(settings);
    });
});
