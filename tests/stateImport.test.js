import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * Wer `state.…` liest, muss `state` auch importieren.
 *
 * 24.10.2026: Die große Gebietskachel öffnete sich nicht mehr – in
 * src/ui/territorySummary.js fehlte `state` im Import, der Klick endete in
 * einem ReferenceError. Gefunden hat es erst `npm run demo-check`
 * („Vom Bezirk zum Kunden"); einen Linter mit no-undef gibt es nicht.
 */
const sources = () => execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8' })
    .split('\n').filter((file) => file.endsWith('.js'));

const withoutComments = (code) => code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1');

// `state.x`, aber nicht `foo.state.x`, `myState.x` oder der Pfad '../core/state.js'.
const USES_STATE = /(?<![\w.$/])state\.[A-Za-z_]/;
const BINDS_STATE = [
    /import\s*\{[^}]*\bstate\b[^}]*\}\s*from/,
    /\b(?:const|let|var)\s+state\b/,
    /[(,]\s*state\s*[,)=]/,
    /\bstate\s*=>/
];

describe('state wird importiert, wo es benutzt wird', () => {
    it('kein Modul liest state.… ohne Import oder eigene Deklaration', () => {
        const unbound = sources().filter((file) => {
            const code = withoutComments(readFileSync(file, 'utf8'));
            return USES_STATE.test(code) && !BINDS_STATE.some((pattern) => pattern.test(code));
        });
        expect(unbound).toEqual([]);
    });
});
