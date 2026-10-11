import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { decryptSafeTransfer, keyMatchesContainer, parseKeyQr, readSafeFile } from '../src/features/safeTransfer.js';
import {
    datasetSnapshot, replaceCustomers, setCustomers, setPlaces, setServiceContracts, setServiceVisits, state
} from '../src/core/state.js';
import { mergeOwnPlaces } from '../src/features/places.js';

/**
 * Umzugsdateien aller bisherigen Stände bleiben einlösbar (Release 17.0).
 *
 * Jede Datei in tests/fixtures/umzug wurde am 11.10.2026 mit dem Code eines
 * historischen Stands erzeugt – dessen Excel-Import, State und Verschlüsselung,
 * nichts nachgebaut (Generator: Arbeitskopie je Commit):
 *
 *   2026-07-11-v1-kunden     3b0ea34  erster Tresor-Stand: nur Kunden + Gebiete
 *   2026-07-17-v2-vertraege  3bc0ceb  + Serviceverträge (schemaVersion 2)
 *   2026-07-17-v3-einsaetze  285375f  + Serviceeinsätze (schemaVersion 3)
 *   2026-09-27-v3-orte       8af4a56  + eigene Orte, tolerantes Einlesen
 *   2026-10-11-v3-heute      heute    + Umsatzjahre, Kontakte, Opps, Produkte
 *
 * Neben jeder Datei liegen ihr Schlüssel (QR-Text) und der Inhalt, den der
 * damalige Stand verschlüsselt hat. Die Dateien sind eingefroren: Wer Format,
 * Verschlüsselung, Einlesen oder Übernahme ändert, muss sie weiter öffnen und
 * vollständig übernehmen können – Nutzer haben solche Dateien noch auf dem
 * Handy oder im Postfach. Die zweite Prüfung desselben Wegs läuft im Browser
 * (smoke-check: „Umzugsdateien aller Stände einlösen").
 */
const DIR = resolve(process.cwd(), 'tests/fixtures/umzug');
const STEMS = readdirSync(DIR).filter((f) => f.endsWith('.tfsafe')).map((f) => f.replace(/\.tfsafe$/, '')).sort();

const fixture = (stem) => ({
    bytes: new Uint8Array(readFileSync(resolve(DIR, `${stem}.tfsafe`))),
    keyQr: readFileSync(resolve(DIR, `${stem}.key.txt`), 'utf8').trim(),
    expected: JSON.parse(readFileSync(resolve(DIR, `${stem}.erwartet.json`), 'utf8'))
});

async function open(bytes, keyQr) {
    const { container, problem } = readSafeFile(bytes);
    expect(problem).toBeFalsy();
    const key = parseKeyQr(keyQr);
    expect(keyMatchesContainer(container, key)).toBe(true);
    return decryptSafeTransfer(container, key.keyB64);
}

/** Dieselbe Übernahme wie „Daten empfangen" (ui/safeTransfer.js → applyImported). */
function adopt(dataset) {
    replaceCustomers(dataset.customers || [], {
        fileName: dataset.fileName, importedAt: dataset.importedAt, territories: dataset.territories || {}
    });
    setServiceContracts(dataset.serviceContracts || [], dataset.serviceContractSources || {});
    setServiceVisits(dataset.serviceVisits || [], dataset.serviceVisitSources || {});
    setPlaces(mergeOwnPlaces(state.places, dataset.places));
}

const utf16le = (text) => new Uint8Array(Buffer.from(text, 'utf16le'));
const withBom = (bom, bytes) => new Uint8Array([...bom, ...bytes]);
const swap16 = (bytes) => bytes.map((_, i) => bytes[i % 2 ? i - 1 : i + 1]);

afterEach(() => {
    setCustomers([]);
    setServiceContracts([], {});
    setServiceVisits([], {});
    setPlaces([]);
});

describe('Umzugsdateien aller Stände', () => {
    it('liegen vollständig vor (5 Stände, je Datei + Schlüssel + Inhalt)', () => {
        expect(STEMS).toEqual([
            'TourFuchs-Umzug-2026-07-11-v1-kunden',
            'TourFuchs-Umzug-2026-07-17-v2-vertraege',
            'TourFuchs-Umzug-2026-07-17-v3-einsaetze',
            'TourFuchs-Umzug-2026-09-27-v3-orte',
            'TourFuchs-Umzug-2026-10-11-v3-heute'
        ]);
    });

    for (const stem of STEMS) {
        describe(stem, () => {
            it('entschlüsselt genau den Inhalt, den der damalige Stand verpackt hat', async () => {
                const { bytes, keyQr, expected } = fixture(stem);
                expect(await open(bytes, keyQr)).toEqual(expected);
            });

            it('liest die Datei auch nach typischen Transportschäden', async () => {
                const { bytes, keyQr, expected } = fixture(stem);
                const text = new TextDecoder().decode(bytes);
                const variants = {
                    'UTF-16 mit BOM': withBom([0xff, 0xfe], utf16le(text)),
                    'UTF-16 ohne BOM': utf16le(text),
                    'UTF-16 BE mit BOM': withBom([0xfe, 0xff], swap16(utf16le(text))),
                    'Base64 mit Zeilenumbrüchen': new TextEncoder().encode(Buffer.from(text).toString('base64').replace(/.{76}/g, '$&\r\n')),
                    'Text davor und danach': new TextEncoder().encode(`Anhang: Umzug\r\n\r\n${text}\r\n-- \r\nVon meinem Handy gesendet`),
                    'Zeilenende und Leerzeichen': new TextEncoder().encode(`  ${text}\r\n\r\n`)
                };
                for (const [name, variant] of Object.entries(variants)) {
                    const { container, problem } = readSafeFile(variant);
                    expect(problem, name).toBeFalsy();
                    expect(await decryptSafeTransfer(container, parseKeyQr(keyQr).keyB64), name).toEqual(expected);
                }
            });

            it('wird vollständig übernommen – Kunden, Gebiete, Verträge, Einsätze, Orte', async () => {
                const { bytes, keyQr, expected } = fixture(stem);
                adopt(await open(bytes, keyQr));
                const snap = datasetSnapshot();

                expect(snap.customers).toHaveLength(expected.customers.length);
                for (const before of expected.customers) {
                    const now = snap.customers.find((c) => c.nummer === before.nummer);
                    expect(now, before.nummer).toBeTruthy();
                    const kept = Object.fromEntries(Object.entries(before).filter(([key]) => !key.startsWith('_')));
                    expect(JSON.parse(JSON.stringify(now)), before.nummer).toMatchObject(kept);
                }
                expect(snap.territories).toEqual(expected.territories || {});
                expect(snap.fileName).toBe(expected.fileName);
                expect(snap.importedAt).toBe(expected.importedAt);
                expect(JSON.parse(JSON.stringify(snap.serviceContracts))).toEqual(expected.serviceContracts || []);
                expect(JSON.parse(JSON.stringify(snap.serviceVisits))).toEqual(expected.serviceVisits || []);
                for (const place of expected.places || []) {
                    expect(snap.places.map((p) => p.id)).toContain(place.id);
                }
            });

            it('lehnt einen fremden Schlüssel ab', async () => {
                const { bytes, keyQr } = fixture(stem);
                const { container } = readSafeFile(bytes);
                expect(keyMatchesContainer(container, parseKeyQr(keyQr.replace(/:[^:]+:/, ':000000000000:')))).toBe(false);
                const otherKey = parseKeyQr(fixture(STEMS.find((s) => s !== stem)).keyQr).keyB64;
                await expect(decryptSafeTransfer(container, otherKey)).rejects.toBeTruthy();
            });
        });
    }
});
