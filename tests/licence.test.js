import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

/**
 * Die Lizenz steht an vier Stellen: LICENSE, NOTICE, package.json und der
 * Seite „Lizenz & Rechtliches" in der App. Wenn eine davon zurückbleibt,
 * widerspricht die App sich selbst – und ausgerechnet an der Stelle, an der
 * ein Leser in einem Konzern zuerst nachsieht.
 */
describe('Lizenz', () => {
    const licence = read('LICENSE');
    const notice = read('NOTICE');
    const pkg = JSON.parse(read('package.json'));
    const page = read('public/license.html');
    const readme = read('README.md');

    it('ist MIT – mit Namensnennung und Haftungsausschluss im Text', () => {
        expect(licence).toContain('MIT License');
        expect(licence).toContain('Copyright (c) 2025-2026 Günter Struck');
        expect(licence).toContain('The above copyright notice and this permission notice shall be included');
        expect(licence).toContain('WITHOUT WARRANTY OF ANY KIND');
    });

    it('sagt nirgends mehr „alle Rechte vorbehalten"', () => {
        // Der alte Stand widerspräche der MIT-Lizenz direkt.
        for (const [name, text] of [['LICENSE', licence], ['NOTICE', notice], ['license.html', page], ['README', readme]]) {
            expect(`${name}: ${text.toLowerCase()}`).not.toContain('alle rechte vorbehalten');
        }
    });

    it('meldet MIT auch maschinenlesbar in der package.json', () => {
        expect(pkg.license).toBe('MIT');
    });

    it('hält im NOTICE fest, was die Lizenz nicht regelt', () => {
        // Privat, unentgeltlich, ohne Gewähr – und ausdrücklich ohne Support.
        expect(notice).toMatch(/privates Projekt/i);
        expect(notice).toMatch(/unentgeltlich/i);
        expect(notice).toMatch(/kein(en)? Support/i);
        expect(notice).toMatch(/keine Haftung/i);
    });

    it('lässt die Fremdlizenzen der Geodaten unberührt fortgelten', () => {
        // MIT deckt den Quellcode. ODbL, dl-de/by-2-0 und CC BY 4.0 verlangen
        // Namensnennung und wirken auch auf abgeleitete Datenbestände.
        for (const quelle of ['ODbL', 'dl-de/by-2-0', 'CC BY 4.0']) {
            expect(notice).toContain(quelle);
        }
        expect(licence).toContain('NOTICE');
        expect(readme).toContain('NOTICE');
    });

    it('sagt es in der App genauso wie im Repository', () => {
        expect(page).toContain('MIT-Lizenz');
        expect(page).toMatch(/privates Projekt/i);
        expect(page).toMatch(/kein(en)? Support/i);
    });
});
