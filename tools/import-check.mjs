#!/usr/bin/env node
/**
 * Import-Referenz (Release 17.0a) – „Golden Master" für den Import.
 *
 * Feste Dateien aus tests/fixtures/import werden über die echte Oberfläche
 * eingelesen (Datei wählen → Zuordnung → Bestätigen), danach wird der
 * gespeicherte Bestand aus dem Browser-Speicher gelesen und mit dem
 * eingefrorenen Ergebnis (<szenario>.erwartet.json) verglichen. Das Ergebnis
 * muss bytegleich bleiben – egal, wie der Import innen umgebaut wird.
 *
 *   npm run build && npm run import-check
 *   npm run import-check -- --update     # Ergebnis neu einfrieren (nur bewusst, mit Begründung im PR)
 *
 * Normalisiert werden nur Zeitpunkte des Laufs (Importzeit) – alles andere
 * zählt.
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const TIMEOUT = 30_000;
const UPDATE = process.argv.includes('--update');
const DIR = new URL('../tests/fixtures/import/', import.meta.url);
const fixture = (name) => fileURLToPath(new URL(name, DIR));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function freePort() {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.on('error', reject);
        server.listen(0, () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
    });
}

async function startPreview(port) {
    // Eigene Prozessgruppe, damit beim Beenden auch der Vite-Server unter npx fällt.
    const child = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    child.stopAll = () => { try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill(); } };
    for (let attempt = 0; attempt < 60; attempt++) {
        await sleep(500);
        try {
            if ((await fetch(`http://localhost:${port}/`)).ok) return child;
        } catch { /* noch nicht bereit */ }
    }
    child.stopAll();
    throw new Error('Vorschau-Server ist nicht gestartet. Vorher `npm run build` ausführen?');
}

/** Gespeicherter Bestand („kundendaten") aus IndexedDB. */
function storedDataset(page) {
    return page.evaluate(() => new Promise((resolve) => {
        const req = indexedDB.open('geofuchs-db');
        req.onsuccess = () => {
            const db = req.result;
            const name = db.objectStoreNames[0];
            const get = db.transaction([name], 'readonly').objectStore(name).get('kundendaten');
            get.onsuccess = () => { db.close(); resolve(get.result ?? null); };
            get.onerror = () => { db.close(); resolve(null); };
        };
        req.onerror = () => resolve(null);
    }));
}

/** Nur Zeitpunkte des Laufs ersetzen; alles andere bleibt, wie es ist. */
function normalize(value, today) {
    if (Array.isArray(value)) return value.map((v) => normalize(v, today));
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, normalize(v, today)]));
    }
    if (typeof value === 'string' && value.startsWith(today) && /^\d{4}-\d{2}-\d{2}T/.test(value)) return '<Importzeit>';
    if (value === today) return '<heute>';
    return value;
}

/** Erste Unterschiede als lesbare Pfade. */
function differences(expected, actual, path = '', out = []) {
    if (out.length >= 15) return out;
    if (JSON.stringify(expected) === JSON.stringify(actual)) return out;
    if (expected && actual && typeof expected === 'object' && typeof actual === 'object') {
        for (const key of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
            differences(expected[key], actual[key], `${path}${Array.isArray(expected) ? `[${key}]` : `.${key}`}`, out);
        }
        return out;
    }
    out.push(`${path || '(Wurzel)'}: erwartet ${JSON.stringify(expected)?.slice(0, 120)} – jetzt ${JSON.stringify(actual)?.slice(0, 120)}`);
    return out;
}

async function openApp(browser, baseUrl, { service = false } = {}) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
    await context.addInitScript((withService) => {
        try {
            sessionStorage.setItem('tf_demo_welcome_ack', '1');
            // Einmalige Handy-Vorschau-Vorführung (zeitgesteuert) gilt als gesehen –
            // sie legte sich sonst zufällig über einen Klick.
            localStorage.setItem('tf_mobile_preview_teaser_seen', '1');
            // Wie „Erweiterungen → ServiceFuchs" einschalten (ab Werk aus).
            if (withService) localStorage.setItem('gf_service_enabled', '1');
        } catch { /* egal */ }
    }, service);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
    page.on('dialog', (dialog) => dialog.accept());
    await page.goto(`${baseUrl}?nowelcome=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.getElementById('demo-banner')?.hidden === false, null, { timeout: TIMEOUT });
    await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
    return { context, page, errors };
}

/** Wie ein Nutzer: Das Angebot zur adressgenauen Verortung (öffnet sich verzögert
 * nach einem Import) schließen, bevor es den nächsten Klick abfängt. */
const dismissGeocodeOffer = (page) => page.evaluate(() => {
    const offer = document.getElementById('geocode-offer-dialog');
    if (offer?.open) offer.close();
});
/** Klick im DOM – ein später aufgehendes Fenster kann ihn nicht abfangen. */
const domClick = (page, selector) => page.evaluate((sel) => document.querySelector(sel)?.click(), selector);

const statusCount = (page) => page.evaluate(() => document.querySelector('#data-status .stat b')?.textContent || '');

/** Kundenliste über „Datei wählen" einlesen – mit Zuordnungs-, Bericht- und Ergebnisfenster. */
async function importCustomerFile(page, name, expectedCount) {
    await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
    await page.locator('#file-input').setInputFiles(fixture(name));
    const consent = page.locator('#consent-dialog[open] #consent-confirm');
    const done = async () => await statusCount(page) === String(expectedCount)
        && (await page.locator('#data-status').textContent()).includes(name);
    // Je nach Datei: Zuordnung, Änderungsbericht und/oder gleich das Ergebnis.
    const deadline = Date.now() + TIMEOUT;
    while (Date.now() < deadline) {
        await dismissGeocodeOffer(page);
        if (await consent.isVisible().catch(() => false)) await domClick(page, '#consent-dialog[open] #consent-confirm');
        if (await page.locator('#import-dialog[open] #mapping-confirm').isVisible().catch(() => false)) {
            await domClick(page, '#import-dialog[open] #mapping-confirm');
        }
        const diff = page.locator('#import-diff-dialog[open] [data-diff-confirm]');
        if (await diff.isVisible().catch(() => false)) await domClick(page, '#import-diff-dialog[open] [data-diff-confirm]');
        // Fertig erst, wenn genau DIESE Datei übernommen ist (Name im Datenstatus) –
        // ein Reimport mit gleicher Kundenzahl sähe sonst sofort „fertig" aus.
        if (await done()) break;
        await sleep(200);
    }
    if (!(await done())) {
        throw new Error(`${name}: erwartet ${expectedCount} Kunden, angezeigt ${await statusCount(page)} – ${await page.locator('#toasts').textContent().catch(() => '')}`);
    }
    await sleep(1500); // Speichern abwarten (App speichert verzögert)
    await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
}

/** Service-Datei über Vertragsradar bzw. Einsatzplanung einlesen. */
async function importServiceFile(page, { input, confirm, name, feedback }) {
    await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
    await page.locator(input).setInputFiles(fixture(name));
    await page.waitForFunction((sel) => {
        const button = document.querySelector(sel);
        return button && !button.disabled && button.closest('dialog')?.open;
    }, confirm, { timeout: TIMEOUT }).catch(() => { throw new Error(`${name}: Zuordnung erscheint nicht`); });
    await dismissGeocodeOffer(page);
    await domClick(page, confirm);
    await sleep(1500);
    // Abgelehnt? Dann sagt die Rückmeldung, warum – und das Szenario scheitert.
    const message = await page.locator(feedback).textContent().catch(() => '');
    if (/nicht übernommen|abgebrochen/i.test(message || '')) throw new Error(`${name}: ${message.slice(0, 300)}`);
    await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
}

async function enterServiceMode(page) {
    await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
    await page.evaluate(() => document.querySelector('.mode-btn[data-mode="service"]').click());
    // Die Einsatzplanung wird beim Wechsel nachgeladen – erst dann ist ihre Dateiauswahl verdrahtet.
    await page.waitForFunction(() => performance.getEntriesByType('resource')
        .some((entry) => /serviceVisitPlanner-[^/]+\.js$/.test(entry.name)), null, { timeout: TIMEOUT })
        .catch(() => { throw new Error('Einsatzplanung wurde nicht geladen'); });
    await sleep(1000);
}

const SCENARIOS = [
    {
        name: 'kundenliste',
        title: 'Kundenliste (Excel, alle Spaltenarten, Fehlerzeilen, unbekannte PLZ)',
        run: (page) => importCustomerFile(page, 'kundenliste.xlsx', 7)
    },
    {
        name: 'reimport',
        title: 'Reimport derselben Liste einen Monat später (geändert, entfallen, neu)',
        run: async (page) => {
            await importCustomerFile(page, 'kundenliste.xlsx', 7);
            await importCustomerFile(page, 'kundenliste-reimport.xlsx', 7);
        }
    },
    {
        name: 'arbeitsmappe',
        title: 'Vertriebs-Arbeitsmappe (alle Blätter in einem Zug)',
        // 4 Zeilen, aber ein Debitor doppelt: Die spätere Zeile gilt → 3 Kunden.
        run: (page) => importCustomerFile(page, 'vertriebs-arbeitsmappe.xlsx', 3)
    },
    {
        name: 'service',
        title: 'Kundenliste + Serviceverträge + Serviceeinsätze',
        service: true,
        expectAtLeast: { serviceContracts: 3, serviceVisits: 2 },
        run: async (page) => {
            await importCustomerFile(page, 'kundenliste.xlsx', 7);
            await enterServiceMode(page);
            await importServiceFile(page, { input: '#contract-file-input', confirm: '#contract-mapping-confirm', name: 'servicevertraege.xlsx', feedback: '#contract-import-feedback' });
            await importServiceFile(page, { input: '#service-visit-file-input', confirm: '#service-visit-mapping-confirm', name: 'serviceeinsaetze.xlsx', feedback: '#service-visit-import-feedback' });
        }
    }
];

let chromium;
try {
    ({ chromium } = await import('playwright'));
} catch {
    console.error('Playwright fehlt. Einmalig: npm i --no-save playwright && npx playwright install chromium');
    process.exit(2);
}
const port = await freePort();
const server = await startPreview(port);
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.stopAll(); process.exit(130); });
let browser;
let failures = 0;
try {
    browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
    const baseUrl = `http://localhost:${port}/`;
    for (const scenario of SCENARIOS) {
        const started = Date.now();
        const expectedFile = new URL(`${scenario.name}.erwartet.json`, DIR);
        const { context, page, errors } = await openApp(browser, baseUrl, { service: Boolean(scenario.service) });
        try {
            await scenario.run(page);
            const today = await page.evaluate(() => new Date().toISOString().slice(0, 10));
            const actual = normalize(await storedDataset(page), today);
            if (!actual?.customers?.length) throw new Error('kein gespeicherter Bestand');
            for (const [key, min] of Object.entries(scenario.expectAtLeast || {})) {
                if ((actual[key]?.length || 0) < min) throw new Error(`${key}: nur ${actual[key]?.length || 0} gespeichert, erwartet mind. ${min}`);
            }
            if (errors.length) throw new Error(`Skriptfehler: ${errors.join(' | ')}`);
            if (UPDATE || !existsSync(expectedFile)) {
                writeFileSync(expectedFile, `${JSON.stringify(actual, null, 2)}\n`);
                console.log(`  ✎ ${scenario.title}: eingefroren (${actual.customers.length} Kunden)`);
            } else {
                const expected = JSON.parse(readFileSync(expectedFile, 'utf8'));
                const diff = differences(expected, actual);
                if (diff.length) throw new Error(`weicht von der Referenz ab:\n      ${diff.join('\n      ')}`);
                console.log(`  ✓ ${scenario.title} (${Math.round((Date.now() - started) / 100) / 10} s)`);
            }
        } catch (error) {
            failures += 1;
            console.log(`  ✗ ${scenario.title}: ${String(error.message || error)}`);
        } finally {
            await context.close();
        }
    }
} finally {
    await browser?.close();
    server.stopAll();
}
console.log(failures ? `\n${failures} Szenario(s) weichen ab.` : '\nImport-Referenz: alle Szenarien gleich.');
process.exit(failures ? 1 : 0);
