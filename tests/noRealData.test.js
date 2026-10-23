import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * Keine echten Personen- oder Kundendaten im Repo (PO 23.10.2026).
 *
 * Das Repo ist öffentlich – mit Absicht: Jeder soll nachlesen können, was
 * TourFuchs tut. Beim Beheben von Nutzer-Feedback landeten trotzdem echte
 * Bruchstücke aus CRM-Exporten in Tests und Doku (Firmen, Kundennummern,
 * Namen mit Handynummer). Sie wurden verfremdet und die Git-Historie bereinigt.
 *
 * Dieser Test hält die auffälligste Sorte draußen: Handynummern. Erlaubt sind
 * nur die erfundenen unten. Wer eine neue braucht, erfindet sie (Vorwahl 0170
 * oder 0171, Ziffern wie 1112233) und trägt sie hier ein – niemals eine Nummer aus
 * einem Screenshot oder einer Kundenliste. Gleiches gilt ohne Prüfung für
 * Firmen, Personen und Kundennummern: vor dem Einchecken verfremden.
 */
const FICTIONAL_MOBILE = new Set([
    '01701112233', '01704445566', '01711234567', '01712223344', '01715550001', '01721234567'
]);

const BINARY = /\.(pdf|png|jpe?g|webp|gif|ico|mp3|mp4|webm|xlsx|tfsafe|woff2?|zip)$/i;
const MOBILE = /(?:\+49|0049|\b0)[\s(]*1[5-7]\d\)?[\s/-]*\d[\d ]{2,10}\d/g;

function trackedTextFiles() {
    return execFileSync('git', ['ls-files'], { encoding: 'utf8' })
        .split('\n')
        .filter((file) => file && !BINARY.test(file) && !file.startsWith('public/geodata/') && file !== 'package-lock.json');
}

const national = (raw) => raw.replace(/[^\d+]/g, '').replace(/^(\+49|0049)/, '0');

describe('Keine echten Daten im öffentlichen Repo', () => {
    it('enthält nur erfundene Handynummern', () => {
        const found = [];
        for (const file of trackedTextFiles()) {
            let text;
            try { text = readFileSync(file, 'utf8'); } catch { continue; }
            for (const match of text.matchAll(MOBILE)) {
                const number = national(match[0]);
                if (!FICTIONAL_MOBILE.has(number)) found.push(`${file}: ${match[0].trim()}`);
            }
        }
        expect(found, 'Echte Nummer? Durch eine erfundene ersetzen (siehe Kopf dieser Datei).').toEqual([]);
    });
});
