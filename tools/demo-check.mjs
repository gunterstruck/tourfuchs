/**
 * Prüfstrecke für die Live-Demos.
 *
 * Fährt jede sichtbare Demo in der ECHTEN App durch – mehrere Formate
 * nacheinander – und misst, was Unit-Tests grundsätzlich nicht sehen können:
 *
 *  - Läuft die Demo durch, oder bricht die Engine ab (bei welchem Schritt)?
 *  - Landet die Zeigerspitze des Geister-Cursors auf dem geklickten Element?
 *  - Ist das geklickte Element überhaupt im Bild, oder liegt es hinter dem
 *    Rand (z. B. in einem eingeklappten Blatt)? Der Klick wirkt dann zwar,
 *    aber die Vorführung zeigt ins Leere.
 *  - Wie lange dauert die Demo wirklich? Die Demo-Auswahl verspricht eine Zeit.
 *
 * BEWUSST NICHT IN DER CI: 26 Durchläufe brauchen rund 20 Minuten, und
 * zeitbasierte Vorführungen werden dort früher oder später unzuverlässig. Ein
 * flackerndes Tor ist schlimmer als keines – man gewöhnt sich an rote Haken.
 * Dieses Werkzeug wird gezielt aufgerufen: nach Layout-Änderungen, nach
 * Eingriffen an den Demo-Skripten und vor einem Release.
 *
 * Aufruf:
 *   npm run demo-check
 *   npm run demo-check -- --format=tablet-hochkant
 *   npm run demo-check -- --format=desktop --story=handy-qr --story=tour
 *   npm run demo-check -- --format=desktop --file=tmp/eigene-liste.xlsx
 *   npm run demo-check -- --format=desktop --drag
 *
 * Mit `--file` importiert die Strecke vorher eine eigene Liste (wie ein Nutzer
 * über die Dateiauswahl) und fährt die Demos auf diesen Daten – dort brechen
 * sie am ehesten ab (andere Bezirke, viele Kunden, Lücken). Mit `--drag`
 * verschiebt sie vor jeder Demo die Karte mit der Maus, wie es Nutzer tun.
 *
 * Einmalige Voraussetzung (bewusst nicht in package.json, damit ein normales
 * `npm install` keinen Browser-Download auslöst):
 *   npm i -D playwright && npx playwright install chromium
 *
 * Ist bereits ein Chromium vorhanden, genügt statt des Downloads:
 *   PLAYWRIGHT_CHROMIUM_PATH=/pfad/zu/chrome npm run demo-check
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';

const FORMATS = [
    { name: 'desktop', viewport: { width: 1440, height: 900 }, hasTouch: false },
    { name: 'tablet-hochkant', viewport: { width: 834, height: 1112 }, hasTouch: true },
    { name: 'tablet-quer', viewport: { width: 1112, height: 834 }, hasTouch: true },
    { name: 'smartphone', viewport: { width: 390, height: 844 }, hasTouch: true }
];

// Die Zeigerspitze sitzt bei (left+4, top+2) des Cursor-Elements – so setzt sie
// snapCursor() in src/ui/showcase.js. Gemessen wird gegen diesen Punkt.
//
// Entscheidend ist die Unterscheidung `guided`: clickEl() setzt unmittelbar vor
// dem echten Klick die Klasse `sc-click`. Runner, die zur stillen
// Zustandsvorbereitung direkt element.click() aufrufen, tun das nicht – die
// sollen gar nicht unter dem Cursor liegen und dürfen nicht als Fehler zählen.
const PROBE = `
window.__scClicks = [];
document.addEventListener('click', (ev) => {
    const cursor = document.querySelector('.sc-cursor');
    if (!cursor || !document.querySelector('.sc-shield') || cursor.hidden) return;
    const guided = cursor.classList.contains('sc-click');
    const c = cursor.getBoundingClientRect();
    const tip = { x: c.left + 4, y: c.top + 2 };
    const el = ev.target;
    const r = el.getBoundingClientRect();
    const dx = Math.max(r.left - tip.x, 0, tip.x - r.right);
    const dy = Math.max(r.top - tip.y, 0, tip.y - r.bottom);
    window.__scClicks.push({
        guided,
        target: el.id ? '#' + el.id : el.tagName.toLowerCase(),
        miss: Math.round(Math.hypot(dx, dy)),
        onScreen: r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth,
        fullyVisible: r.top >= -1 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1,
        size: Math.round(r.width) + 'x' + Math.round(r.height)
    });
}, true);
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv) {
    const formats = [];
    const stories = [];
    let file = '';
    let drag = false;
    for (const arg of argv) {
        if (arg === '--drag') drag = true;
        const [key, value] = arg.replace(/^--/, '').split('=');
        if (key === 'format' && value) formats.push(value);
        if (key === 'story' && value) stories.push(value);
        if (key === 'file' && value) file = value;
    }
    return { formats, stories, file, drag };
}

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
    const child = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
        stdio: ['ignore', 'pipe', 'pipe']
    });
    for (let attempt = 0; attempt < 40; attempt++) {
        await sleep(500);
        try {
            const res = await fetch(`http://localhost:${port}/`);
            if (res.ok) return child;
        } catch { /* noch nicht bereit */ }
    }
    child.kill();
    throw new Error('Vorschau-Server ist nicht gestartet. Vorher `npm run build` ausführen?');
}

/**
 * Demo-Auswahl öffnen – über „🎬 Alle Demos" im Beispieldaten-Streifen, das
 * Onboarding oder die Info. Nicht über „In Aktion sehen" der Begrüßung: Der
 * startet seit der Schleife direkt die erste Demo statt der Auswahl.
 */
async function openPanel(page) {
    // Die Begrüßung zählt sonst ab und startet nach zehn Sekunden von selbst.
    await page.locator('#btn-demo-welcome-ack').click({ timeout: 2000 }).catch(() => {});
    // Die mobile Vorschau kann sich am Desktop beim Start öffnen und liegt
    // dann über allem – vorher schließen.
    await page.evaluate(() => document.querySelector('#mobile-preview:not([hidden]) [data-mp-close]')?.click()).catch(() => {});
    // Seit 09.10.2026 steht „Live-Demos" dauerhaft im Desktop-Kopf; das
    // Desktop-Panel (mit Demo-Streifen) ist beim Start geschlossen.
    for (const sel of ['#btn-demos-pill', '#btn-demo-overview', '#btn-showcase-ob', '#btn-showcase']) {
        const el = page.locator(sel).first();
        if (await el.count() && await el.isVisible().catch(() => false)) {
            await el.click({ timeout: 5000 }).catch(() => {});
            if (await page.locator('#showcase-dialog .sc-tile').first().isVisible().catch(() => false)) return true;
        }
    }
    // Mit eigenen Daten gibt es keinen Demo-Streifen; am Handy auch keine
    // Kopfzeilen-Pille – dort führt der Weg über Info → „Funktionen entdecken".
    if (await page.locator('#btn-info').isVisible().catch(() => false)) {
        await page.locator('#btn-info').click({ timeout: 5000 }).catch(() => {});
        await page.locator('#btn-showcase').click({ timeout: 5000 }).catch(() => {});
    }
    return page.locator('#showcase-dialog .sc-tile').first().isVisible().catch(() => false);
}

/** Karte einmal mit der Maus ziehen (Demo-Auswahl dafür kurz schließen). */
async function dragMapOnce(page) {
    await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close())).catch(() => {});
    const box = await page.locator('#map').boundingBox().catch(() => null);
    if (!box) return;
    const x = box.x + box.width * 0.6;
    const y = box.y + box.height * 0.5;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 40, y + 25, { steps: 6 });
    await page.mouse.move(x + 80, y + 50, { steps: 6 });
    await page.mouse.up();
    await sleep(600);
    await openPanel(page);
}

/** Eigene Liste wie ein Nutzer importieren und alle Folge-Dialoge schließen. */
async function importOwnFile(page, file) {
    await page.locator('#btn-demo-welcome-ack').click({ timeout: 2000 }).catch(() => {});
    await page.setInputFiles('#file-input', file);
    for (let attempt = 0; attempt < 60; attempt++) {
        await sleep(1000);
        // Ergebnisfenster, Befund, Tresor- und Verortungsangebot: wegklicken.
        await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close())).catch(() => {});
        const own = await page.evaluate(() => document.getElementById('demo-banner')?.hidden === true
            && /\d/.test(document.getElementById('data-status')?.textContent || '')).catch(() => false);
        if (own && attempt >= 5) return true;
    }
    return false;
}

async function runFormat(browser, format, baseUrl, onlyStories, ownFile = '', dragMap = false) {
    const context = await browser.newContext({
        viewport: format.viewport,
        hasTouch: format.hasTouch,
        locale: 'de-DE',
        timezoneId: 'Europe/Berlin'
    });
    await context.addInitScript(PROBE);
    // Optionale Module einschalten, damit auch ihre Filme geprüft werden – der
    // Service-Film erscheint sonst gar nicht in der Auswahl (ab Werk aus).
    await context.addInitScript(() => {
        try { localStorage.setItem('gf_service_enabled', '1'); } catch { /* ohne Speicher: Standard */ }
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#map', { timeout: 20000 });
    // Die Willkommens-Choreografie blendet die Beispielkunden selbst ein.
    await sleep(9000);

    const results = [];
    if (ownFile && !await importOwnFile(page, ownFile)) {
        console.log(`  ${format.name}: eigene Liste nicht importiert`);
        await context.close();
        return [{ format: format.name, id: '-', outcome: 'FEHLER', reason: 'eigene Liste nicht importiert' }];
    }
    if (!await openPanel(page)) {
        console.log(`  ${format.name}: Demo-Auswahl nicht erreichbar`);
        await context.close();
        return [{ format: format.name, id: '-', outcome: 'FEHLER', reason: 'Demo-Auswahl nicht erreichbar' }];
    }

    let ids = await page.$$eval('#showcase-dialog .sc-tile', (els) => els.map((e) => e.dataset.story));
    if (onlyStories.length) ids = ids.filter((id) => onlyStories.includes(id));

    for (const id of ids) {
        await page.evaluate(() => { window.__scClicks = []; });
        if (!await page.locator(`#showcase-dialog .sc-tile[data-story="${id}"]`).count()) await openPanel(page);
        // Wie ein Nutzer vorher die Karte verschieben: Leaflet merkt sich das
        // Ziehen bis zum nächsten Mausdruck und schluckt bis dahin Klicks auf
        // Kartenelemente – die Demos müssen trotzdem durchlaufen.
        if (dragMap) await dragMapOnce(page);
        const started = Date.now();
        await page.locator(`#showcase-dialog .sc-tile[data-story="${id}"]`).click({ timeout: 10000 }).catch(() => {});

        let outcome = 'FEHLER';
        let reason = '';
        try {
            await page.waitForSelector('#showcase-dialog .sc-outcome-head', { timeout: 240000 });
            const failed = await page.locator('#showcase-dialog .sc-outcome-failed').count();
            outcome = failed ? 'FEHLER' : 'ok';
            if (failed) {
                reason = (await page.locator('#showcase-dialog .sc-failure-reason').innerText().catch(() => ''))
                    .replace(/\s+/g, ' ').trim();
            }
        } catch {
            reason = 'kein Ergebnis-Dialog nach 240 s';
        }

        const clicks = await page.evaluate(() => window.__scClicks);
        const guided = clicks.filter((c) => c.guided);
        const misses = guided.filter((c) => c.miss > 4);
        const offScreen = guided.filter((c) => !c.onScreen);
        const partly = guided.filter((c) => c.onScreen && !c.fullyVisible);
        const seconds = Math.round((Date.now() - started) / 1000);

        results.push({
            format: format.name, id, outcome, seconds, reason,
            guided: guided.length,
            setup: clicks.length - guided.length,
            misses, offScreen, partly
        });

        const flags = [];
        if (misses.length) flags.push(`${misses.length} daneben (max ${Math.max(...misses.map((m) => m.miss))} px)`);
        if (offScreen.length) flags.push(`${offScreen.length} AUSSERHALB DES BILDES`);
        if (partly.length) flags.push(`${partly.length} nur teilweise sichtbar`);
        const setupNote = clicks.length - guided.length ? ` + ${clicks.length - guided.length} Vorbereitung` : '';
        console.log(`  ${format.name} · ${id}: ${outcome} (${seconds}s, ${guided.length} vorgeführte Klicks${setupNote}${flags.length ? ', ' + flags.join(', ') : ', alle sauber'})${reason ? ' – ' + reason : ''}`);
        for (const bad of [...misses, ...offScreen, ...partly].slice(0, 5)) console.log('      ', JSON.stringify(bad));

        const back = page.locator('#showcase-dialog .sc-overview');
        if (await back.count()) await back.click().catch(() => {});
        else await openPanel(page);
        await sleep(800);
    }

    if (pageErrors.length) {
        console.log(`  ${format.name}: ${pageErrors.length} Skriptfehler – ${pageErrors[0]}`);
        results.push({ format: format.name, id: '-', outcome: 'FEHLER', reason: `Skriptfehler: ${pageErrors[0]}` });
    }
    await context.close();
    return results;
}

let chromium;
try {
    ({ chromium } = await import('playwright'));
} catch {
    console.error('Playwright fehlt. Einmalig einrichten:\n  npm i -D playwright && npx playwright install chromium');
    process.exit(2);
}

const { formats: wantedFormats, stories: wantedStories, file: ownFile, drag: dragMap } = parseArgs(process.argv.slice(2));
const formats = wantedFormats.length ? FORMATS.filter((f) => wantedFormats.includes(f.name)) : FORMATS;
if (!formats.length) {
    console.error(`Unbekanntes Format. Verfügbar: ${FORMATS.map((f) => f.name).join(', ')}`);
    process.exit(2);
}

const port = await freePort();
const server = await startPreview(port);
const baseUrl = `http://localhost:${port}/`;
// In Umgebungen mit bereits vorhandenem Browser (CI-Images, Sandkästen) kann
// der Pfad gesetzt werden, statt einen zweiten herunterzuladen.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const all = [];

try {
    for (const format of formats) {
        console.log(`\n=== ${format.name} (${format.viewport.width}x${format.viewport.height}) ===`);
        all.push(...await runFormat(browser, format, baseUrl, wantedStories, ownFile, dragMap));
    }
} finally {
    await browser.close();
    server.kill();
}

mkdirSync('tmp', { recursive: true });
writeFileSync('tmp/demo-check.json', JSON.stringify(all, null, 2));

const failed = all.filter((r) => r.outcome === 'FEHLER');
const flawed = all.filter((r) => r.outcome === 'ok' && (r.misses?.length || r.offScreen?.length || r.partly?.length));
console.log(`\n${all.length} Durchläufe · ${all.length - failed.length} ok · ${failed.length} Abbrüche · ${flawed.length} mit Klickmängeln`);
console.log('Einzelheiten: tmp/demo-check.json');
process.exit(failed.length || flawed.length ? 1 : 0);
