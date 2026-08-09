/**
 * Reproduzierbare Dokumentations-Screenshots aus der laufenden TourFuchs-App.
 *
 * Die Aufnahmen verwenden ausschließlich die eindeutig synthetische Tabelle
 * `tools/fixtures/docs-screenshot-customers.tsv`. Die Namen, Nummern und
 * Kennzahlen sind keine Produktivdaten. Die Tabelle ist absichtlich kein
 * technisch markierter Demo-Datensatz: Nur so lässt sich der echte, sichere
 * Prompt-Prüfweg dokumentieren. Es wird kein externer Assistent geöffnet.
 *
 * Aufruf:
 *   npm run docs:screenshots
 *
 * Playwright bleibt wie bei demo-check und touch-check eine optionale lokale
 * Voraussetzung:
 *   npm i -D playwright && npx playwright install chromium
 *
 * Alternativ kann ein vorhandener Chromium/Chrome gesetzt werden:
 *   PLAYWRIGHT_CHROMIUM_PATH=/pfad/zu/chrome npm run docs:screenshots
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(ROOT, 'public/docs/screenshots');
const FIXTURE = readFileSync(resolve(ROOT, 'tools/fixtures/docs-screenshot-customers.tsv'), 'utf8');
const APP_VERSION = '3.3.0';
const CAPTURE_DATE = '2026-08-09';
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const DESKTOP = { name: 'desktop', width: 1440, height: 900, hasTouch: false };
const SMARTPHONE = { name: 'smartphone', width: 390, height: 844, hasTouch: true };

function freePort() {
    return new Promise((resolvePort, reject) => {
        const server = createServer();
        server.on('error', reject);
        server.listen(0, () => {
            const { port } = server.address();
            server.close(() => resolvePort(port));
        });
    });
}

async function startPreview(port) {
    const serverScript = resolve(ROOT, 'tools/docs-vite-server.mjs');
    const child = spawn(process.execPath, [serverScript, String(port)], {
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'pipe']
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    for (let attempt = 0; attempt < 100; attempt++) {
        await sleep(300);
        try {
            const response = await fetch(`http://127.0.0.1:${port}/`);
            if (response.ok) return child;
        } catch { /* Server startet noch. */ }
    }
    child.kill();
    throw new Error(`Vite-Dokumentationsserver ist nicht gestartet. ${stderr.trim()}`);
}

async function loadPlaywright() {
    try {
        return await import('playwright');
    } catch (originalError) {
        const explicit = process.env.PLAYWRIGHT_MODULE_PATH;
        if (explicit) return import(pathToFileURL(explicit).href);
        throw new Error(`Playwright fehlt. Einmalig \`npm i -D playwright\` ausführen. (${originalError.message})`);
    }
}

function shotPath(fileName) {
    return resolve(OUTPUT, fileName);
}

async function settle(page, { tiles = true } = {}) {
    await page.evaluate(() => document.fonts?.ready);
    if (tiles) {
        await page.waitForFunction(() => document.querySelectorAll('.leaflet-tile-loaded').length > 0, null, { timeout: 12000 })
            .catch(() => {});
    }
    await sleep(500);
}

async function screenshot(page, fileName) {
    await settle(page);
    await page.screenshot({ path: shotPath(fileName), animations: 'disabled' });
    console.log(`  ${fileName}`);
}

async function openFreshApp(page, baseUrl) {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#map', { timeout: 20000 });
    await page.addStyleTag({ content: `
        *, *::before, *::after {
            animation-duration: 0.001ms !important;
            animation-delay: 0ms !important;
            transition-duration: 0.001ms !important;
            caret-color: transparent !important;
        }
    ` });
    // Die vorhandene Start-Choreografie lädt den sicheren Demo-Bestand nach.
    // Wie in den Browser-Prüfstrecken warten wir auf ihren definierten Abschluss.
    await sleep(9000);
    await settle(page);
}

async function dismissPostImportUi(page) {
    const insight = page.locator('#import-insight-dialog[open]');
    if (await insight.count()) await page.locator('#insight-done').click();
    const preview = page.locator('#mobile-preview:not([hidden])');
    if (await preview.count()) await page.locator('#mobile-preview [data-mp-close]').last().click().catch(() => {});
    const later = page.locator('#first-steps button').filter({ hasText: 'Später' }).first();
    if (await later.count() && await later.isVisible().catch(() => false)) await later.click().catch(() => {});
    await sleep(3600); // einmaligen Mobile-Vorschau-Teaser sicher auslaufen lassen
    if (await preview.count() && await preview.isVisible().catch(() => false)) {
        await page.locator('#mobile-preview [data-mp-close]').last().click().catch(() => {});
    }
    await page.waitForFunction(() => document.querySelectorAll('#toasts .toast').length === 0, null, { timeout: 12000 })
        .catch(() => {});
}

async function importFixture(page, { captureImport = false } = {}) {
    const welcomeOwn = page.locator('#btn-demo-welcome-own');
    if (await welcomeOwn.isVisible().catch(() => false)) await welcomeOwn.click();
    else {
        await page.locator('#btn-demo-welcome-close').click().catch(() => {});
        await page.locator('#btn-demo-own-data, #btn-own-data').first().click();
    }
    await page.waitForSelector('#own-data-dialog[open]');
    if (captureImport) await screenshot(page, 'BILD-IMPORT-01-eigene-daten-laden.png');

    await page.locator('#btn-paste').click();
    await page.waitForSelector('#consent-dialog[open]');
    if (captureImport) await screenshot(page, 'BILD-IMPORT-02-berechtigung-bestaetigen.png');
    await page.locator('#consent-confirm').click();

    await page.waitForSelector('#paste-dialog[open]');
    await page.locator('#paste-input').fill(FIXTURE);
    await page.waitForFunction(() => !document.getElementById('paste-confirm')?.disabled);
    await page.locator('#paste-confirm').click();

    await page.waitForSelector('#import-dialog[open]');
    if (captureImport) await screenshot(page, 'BILD-IMPORT-03-spalten-zuordnen.png');
    await page.locator('#mapping-confirm').click();
    await page.waitForFunction(() => document.querySelectorAll('.customer-marker-wrapper').length >= 2, null, { timeout: 20000 });
    // Der Befund öffnet bewusst erst nach der fertig aufgebauten Karte.
    await sleep(1600);
    await dismissPostImportUi(page);
    await settle(page);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

async function lassoRing(page) {
    const geometry = await page.evaluate(() => {
        const map = document.getElementById('map').getBoundingClientRect();
        const sidebar = document.getElementById('sidebar')?.getBoundingClientRect();
        // Mobil ist das Bottom Sheet so breit wie die Karte. Es darf nicht wie
        // eine linke Desktop-Sidebar von der Zeichenfläche abgezogen werden.
        const leftSidebar = sidebar
            && sidebar.width < innerWidth * 0.6
            && sidebar.right > map.left
            && sidebar.right < map.right - 120;
        const minX = leftSidebar ? sidebar.right + 28 : map.left + 28;
        const markers = [...document.querySelectorAll('.customer-marker-wrapper')]
            .map((node) => node.getBoundingClientRect())
            .map((rect) => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }))
            .filter((point) => point.x > minX && point.x < map.right - 24 && point.y > map.top + 90 && point.y < map.bottom - 90);
        return { map: { left: map.left, top: map.top, right: map.right, bottom: map.bottom }, minX, markers, mobile: innerWidth < 600 };
    });
    const { map, minX } = geometry;
    const markers = geometry.markers;
    const padding = geometry.mobile ? 34 : 70;
    const fallback = {
        left: minX + (map.right - minX) * 0.18,
        right: minX + (map.right - minX) * 0.82,
        top: map.top + (map.bottom - map.top) * 0.24,
        bottom: map.top + (map.bottom - map.top) * 0.72
    };
    const raw = markers.length >= 2 ? {
        left: Math.min(...markers.map((point) => point.x)) - padding,
        right: Math.max(...markers.map((point) => point.x)) + padding,
        top: Math.min(...markers.map((point) => point.y)) - padding,
        bottom: Math.max(...markers.map((point) => point.y)) + padding
    } : fallback;
    const box = {
        left: clamp(raw.left, minX + 16, map.right - 160),
        right: clamp(raw.right, minX + 160, map.right - 16),
        top: clamp(raw.top, map.top + 110, map.bottom - 180),
        bottom: clamp(raw.bottom, map.top + 220, map.bottom - 48)
    };
    if (box.right - box.left < 150 || box.bottom - box.top < 120) return [
        { x: fallback.left, y: fallback.top }, { x: fallback.right, y: fallback.top },
        { x: fallback.right, y: fallback.bottom }, { x: fallback.left, y: fallback.bottom },
        { x: fallback.left, y: fallback.top }
    ];
    return [
        { x: box.left, y: box.top }, { x: box.right, y: box.top },
        { x: box.right, y: box.bottom }, { x: box.left, y: box.bottom },
        { x: box.left, y: box.top }
    ];
}

async function mouseLasso(page, activeShot) {
    const ring = await lassoRing(page);
    await page.mouse.move(ring[0].x, ring[0].y);
    await page.mouse.down();
    await page.mouse.move(ring[1].x, ring[1].y, { steps: 16 });
    await page.mouse.move(ring[2].x, ring[2].y, { steps: 10 });
    await screenshot(page, activeShot);
    await page.mouse.move(ring[3].x, ring[3].y, { steps: 10 });
    await page.mouse.move(ring[4].x, ring[4].y, { steps: 10 });
    await page.mouse.up();
    await page.waitForSelector('.popup-lasso', { timeout: 10000 });
    await sleep(600);
}

async function touchLasso(page, activeShot) {
    const ring = await lassoRing(page);
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, point) => cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x: point.x, y: point.y, radiusX: 12, radiusY: 12, force: 1 }]
    });
    const move = async (from, to, steps = 12) => {
        for (let i = 1; i <= steps; i++) {
            const point = { x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps };
            await touch('touchMove', point);
            await sleep(14);
        }
    };
    await touch('touchStart', ring[0]);
    await move(ring[0], ring[1]);
    await move(ring[1], ring[2], 8);
    await screenshot(page, activeShot);
    await move(ring[2], ring[3], 8);
    await move(ring[3], ring[4], 8);
    await touch('touchEnd', ring[4]);
    await page.waitForSelector('.popup-lasso', { timeout: 10000 });
    await sleep(700);
}

async function openCustomer(page) {
    await page.locator('#global-search').fill('TF-SCREEN-0001');
    await page.locator('#search-results .result-row').first().click();
    await page.waitForSelector('.popup-customer', { timeout: 10000 });
    await sleep(700);
}

async function desktopShots(browser, baseUrl) {
    const context = await browser.newContext({
        viewport: { width: DESKTOP.width, height: DESKTOP.height },
        locale: 'de-DE', timezoneId: 'Europe/Berlin', deviceScaleFactor: 1
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => console.error(`  Browserfehler: ${error.message}`));
    await openFreshApp(page, baseUrl);
    await importFixture(page, { captureImport: true });

    await screenshot(page, 'BILD-LASSO-01-kartenansicht-mit-lasso.png');
    await page.locator('#btn-lasso').click();
    await mouseLasso(page, 'BILD-LASSO-02-aktiver-zeichenmodus.png');
    await screenshot(page, 'BILD-LASSO-03-geschlossene-flaeche.png');
    await screenshot(page, 'BILD-LASSO-04-auswahlkarte.png');

    await page.locator('#btn-lasso-brief').click();
    await page.waitForSelector('#area-briefing-dialog[open]');
    await page.locator('#area-briefing-dialog .briefing-prompt-visible summary').click();
    await screenshot(page, 'BILD-LASSO-05-gebietsbriefing-prompt.png');
    await page.locator('#area-briefing-dialog .briefing-prompt-visible summary').click();
    await screenshot(page, 'BILD-LASSO-06-basis-copilot.png');
    await page.locator('#area-briefing-dialog [data-area-header-close]').click();

    await page.locator('[data-depth="profi"]').click();
    await openCustomer(page);
    await screenshot(page, 'BILD-KUNDE-01-marker-mit-briefing.png');
    await page.locator('.popup-customer [data-action="customer-briefing"]').click();
    await page.waitForSelector('#customer-briefing-dialog[open]');
    await screenshot(page, 'BILD-LASSO-07-profi-zielassistent.png');
    await page.locator('#customer-briefing-dialog .briefing-assistant summary').click();
    await screenshot(page, 'BILD-LASSO-08-assistentenauswahl.png');
    await page.locator('#customer-briefing-dialog [data-briefing-header-close]').click();

    await page.locator('.tab-button[data-tab="tour"]').click();
    await screenshot(page, 'BILD-TOUR-01-tourplanung.png');
    await page.locator('.tab-button[data-tab="daten"]').click();
    await page.locator('#btn-export').scrollIntoViewIfNeeded();
    await screenshot(page, 'BILD-DATEN-01-export-vor-ersatz.png');

    await context.close();
}

async function mobileShots(browser, baseUrl) {
    const context = await browser.newContext({
        viewport: { width: SMARTPHONE.width, height: SMARTPHONE.height },
        locale: 'de-DE', timezoneId: 'Europe/Berlin', deviceScaleFactor: 1,
        hasTouch: true, isMobile: true
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => console.error(`  Browserfehler: ${error.message}`));
    await openFreshApp(page, baseUrl);
    await importFixture(page);
    const mapTab = page.locator('.tab-button[data-tab="karte"]').first();
    if (await mapTab.isVisible().catch(() => false)) await mapTab.tap();
    // Nach dem ersten Kartenwechsel erklärt TourFuchs einmalig einen Marker.
    // Für die Lasso-Dokumentation lassen wir diesen echten Hinweis auslaufen.
    await sleep(7000);
    await screenshot(page, 'BILD-LASSO-MOBIL-01-kartenansicht.png');
    await page.locator('#btn-lasso').tap();
    await touchLasso(page, 'BILD-LASSO-MOBIL-02-aktiver-zeichenmodus.png');
    await screenshot(page, 'BILD-LASSO-MOBIL-03-auswahlkarte.png');
    await context.close();
}

mkdirSync(OUTPUT, { recursive: true });
const { chromium } = await loadPlaywright();
const port = await freePort();
const server = await startPreview(port);
const launchOptions = { headless: true };
if (process.env.PLAYWRIGHT_CHROMIUM_PATH) launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const browser = await chromium.launch(launchOptions);
try {
    console.log(`TourFuchs ${APP_VERSION} · ${CAPTURE_DATE} · echte App-Oberfläche`);
    if (!process.argv.includes('--mobile-only')) await desktopShots(browser, `http://127.0.0.1:${port}/`);
    await mobileShots(browser, `http://127.0.0.1:${port}/`);
    console.log(`Fertig: ${OUTPUT}`);
} finally {
    await browser.close();
    server.kill();
}
