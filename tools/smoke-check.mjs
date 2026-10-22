/**
 * Schnelltest der wichtigsten echten Bedienwege – für jeden PR in der CI.
 *
 * Warum neben `attention-check` genau dieser und nicht `demo-check`:
 * `demo-check` fährt zeitbasierte Vorführungen (25 min, auf geteilten Runnern
 * anfällig) und läuft deshalb nachts (`.github/workflows/nightly.yml`). Dieser
 * Test wartet dagegen nur auf **Zustände** („Dialog offen", „Marker da",
 * „Sperrbildschirm sichtbar") – er ist unabhängig davon, wie schnell die
 * Maschine ist, und dauert rund zwei Minuten.
 *
 * Wege:
 *   1. Desktop: eigene Liste importieren (Einfügen → Zuordnen → Karte)
 *   1b. Desktop: Besuch eintragen, dieselbe Liste neu einlesen – Besuch bleibt
 *   2. Desktop: Tresor einrichten, sperren, entsperren – Kunden wieder da,
 *      gespeicherte Tour im Rohspeicher verschlüsselt; Tresor deaktivieren –
 *      Kunden bleiben im Klartext erhalten, auch nach dem Neuladen
 *   3. Handy: Kunde suchen → als Start und Ziel in die Tour → Besuch eintragen
 *      → „Besuche weitergeben" erscheint
 *
 * Aufruf:  npm run build && npm run smoke-check
 * Chromium: PLAYWRIGHT_CHROMIUM_PATH=/pfad/zu/chrome npm run smoke-check
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';

const TIMEOUT = 30_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FIXTURE = [
    'Kundennummer\tKundenname\tStraße\tPLZ\tOrt\tVertriebsbezirk\tUmsatz\tAccount Manager\tAccount Manager Telefon\tAccount Manager UPN\tVertriebsgruppe\tKundentyp\tSieSales Link',
    'SMOKE-1\tSmoke Test Nord\tDomkloster 4\t50667\tKöln\tBezirk Köln\t100\tEva Test\t030 23125 123\teva@example.org\tIndustrie\tEndkunde\thttps://crm.example/SMOKE-1',
    'SMOKE-2\tSmoke Test Süd\tSeverinstraße 15\t50678\tKöln\tBezirk Köln\t200\tEva Test\t030 23125 123\teva@example.org\tIndustrie\tEndkunde\t',
    'SMOKE-3\tSmoke Test West\tAachener Straße 1\t50674\tKöln\tBezirk Köln\t\tJan Test\t\t\tIndustrie\tPartner\t'
].join('\n');

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
    // Eigene Prozessgruppe: Beim Beenden fällt auch der Vite-Server unter npx
    // (sonst blieb je Lauf ein Vorschau-Server zurück und bremste die nächsten).
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

let failures = 0;
async function step(name, fn) {
    const started = Date.now();
    try {
        await fn();
        console.log(`  ✓ ${name} (${Math.round((Date.now() - started) / 100) / 10} s)`);
    } catch (error) {
        failures += 1;
        console.log(`  ✗ ${name}: ${String(error.message || error)}`);
    }
}

async function openApp(page, baseUrl) {
    await page.goto(`${baseUrl}?nowelcome=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#map', { timeout: TIMEOUT });
    // Beispieldaten sind geladen, sobald der Demo-Streifen steht.
    await page.waitForFunction(() => document.getElementById('demo-banner')?.hidden === false, null, { timeout: TIMEOUT });
}

/**
 * Die einmalige Handy-Vorschau-Vorführung am Desktop („TourFuchs passt in die
 * Tasche") startet zeitgesteuert und legt sich dann über die Seite – mitten in
 * einen Prüfschritt (machte z. B. das Ziehen der Sidebar wackelig). Für die
 * Prüfstrecke gilt sie als gesehen; ihr Verhalten sichert tests/mobilePreview.
 */
function skipMobilePreviewTeaser() {
    try { localStorage.setItem('tf_mobile_preview_teaser_seen', '1'); } catch { /* egal */ }
}

/**
 * Langsames Gerät auf Abruf: Ist `smoke_slow_decrypt` gesetzt, dauert das
 * Entschlüsseln großer Daten (Kundenbestand) so viele Millisekunden – kleine
 * (PIN-Prüfung) bleiben schnell. So entsteht das Zeitfenster nach dem
 * Entsperren, in dem der Bestand noch nachgeladen wird.
 */
function slowDecryptOnDemand() {
    const decrypt = crypto.subtle.decrypt.bind(crypto.subtle);
    crypto.subtle.decrypt = (algorithm, key, data) => {
        let ms = 0;
        try { ms = Number(localStorage.getItem('smoke_slow_decrypt') || 0); } catch { /* egal */ }
        const wait = ms && data.byteLength > 500 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
        return wait.then(() => decrypt(algorithm, key, data));
    };
}

async function closeDialogs(page) {
    await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
}

async function customerCount(page) {
    return page.evaluate(() => document.getElementById('data-status')?.textContent || '');
}

async function rawStore(page, key) {
    return page.evaluate((wanted) => new Promise((resolve) => {
        const req = indexedDB.open('geofuchs-db');
        req.onsuccess = () => {
            const db = req.result;
            const name = db.objectStoreNames[0];
            const get = db.transaction([name], 'readonly').objectStore(name).get(wanted);
            // Verbindung schließen – offen gelassen, stünde sie späteren Datenbank-Vorgängen im Weg.
            get.onsuccess = () => { db.close(); resolve(get.result ?? null); };
            get.onerror = () => { db.close(); resolve(null); };
        };
        req.onerror = () => resolve(null);
    }), key);
}

/** Was liegt gespeichert? – für Fehlermeldungen, die den Zustand nennen statt nur „falsch". */
function describeStored(raw) {
    if (raw == null) return 'nichts gespeichert';
    if (raw.__enc) return 'verschlüsselt';
    const customers = Array.isArray(raw.customers) ? raw.customers : [];
    return `${customers.length} Kunde(n) im Klartext${customers.length ? ` (${customers.slice(0, 2).map((c) => c.name).join(', ')} …)` : ''}`;
}

/** Bis zu TIMEOUT auf einen gespeicherten Zustand warten; gibt den letzten Stand zurück. */
async function waitForStored(page, key, ok) {
    const deadline = Date.now() + TIMEOUT;
    let raw = await rawStore(page, key);
    while (!ok(raw) && Date.now() < deadline) {
        await sleep(250);
        raw = await rawStore(page, key);
    }
    return raw;
}

async function desktop(browser, baseUrl) {
    console.log('Desktop (1440×900)');
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
    await context.addInitScript(skipMobilePreviewTeaser);
    await context.addInitScript(slowDecryptOnDemand);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));

    await step('App startet mit Beispieldaten', () => openApp(page, baseUrl));

    await step('PLZ-Zuständigkeit: ab drei Ziffern, Eingrenzung und Firmenlink', async () => {
        if (await page.locator('.sc-cancel').isVisible().catch(() => false)) await page.locator('.sc-cancel').click();
        if (await page.locator('#btn-demo-welcome-ack').isVisible().catch(() => false)) await page.locator('#btn-demo-welcome-ack').click();
        await closeDialogs(page);
        await page.locator('#btn-postal-responsibility').click();
        await page.locator('#postal-query').fill('50');
        await page.waitForFunction(() => document.getElementById('postal-results')?.textContent.includes('Bitte 3 bis 5'));
        await page.locator('#postal-query').fill('506');
        await page.waitForFunction(() => document.getElementById('postal-results')?.textContent.includes('PLZ 506xx'));
        await page.locator('#postal-query').fill('5066');
        await page.waitForFunction(() => document.getElementById('postal-results')?.textContent.includes('PLZ 5066x'));
        await page.locator('#postal-query').fill('50667');
        await page.waitForFunction(() => document.getElementById('postal-results')?.textContent.includes('PLZ 50667'));
        const overflow = await page.locator('#postal-dialog').evaluate(el => el.scrollWidth > el.clientWidth + 2);
        if (overflow) throw new Error('PLZ-Auskunft läuft seitlich über');
        if (!await page.locator('.postal-settings').evaluate(el => el.open)) await page.locator('.postal-settings summary').click();
        await page.locator('#company-duve').click();
        await page.locator('#company-link-form button[type="submit"]').click();
        if (!(await page.locator('#company-status').textContent()).includes('gespeichert')) throw new Error('Firmenlink nicht gespeichert');
        await page.locator('#company-remove').click();
        await page.keyboard.press('Escape');
        await page.locator('#global-search').fill('506');
        await page.locator('[data-postal]').click();
        await page.waitForSelector('#postal-dialog[open]');
        await page.keyboard.press('Escape');
        await page.locator('#global-search').fill('');
    });

    await step('GeoFuchs: Bezirkskacheln abschalten – nur bunte Flächen, gemerkt', async () => {
        const kacheln = () => page.locator('.territory-stack-card').count();
        const click = (selector) => page.evaluate((sel) => document.querySelector(sel)?.click(), selector);
        const colorMode = (value) => page.evaluate((v) => {
            const select = document.getElementById('colormode-select');
            const previous = select.value;
            select.value = v;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            return previous;
        }, value);
        await closeDialogs(page);
        await click('.mode-btn[data-mode="gebietsplanung"]');
        await click('.tab-button[data-tab="gebiete"]');
        const previousMode = await colorMode('bezirk');
        await page.waitForFunction(() => document.querySelectorAll('.territory-stack-card').length > 0, null, { timeout: TIMEOUT });
        const flaechen = await page.locator('.leaflet-overlay-pane path').count();
        await click('#territory-labels-toggle');
        await page.waitForFunction(() => document.querySelectorAll('.territory-stack-card').length === 0, null, { timeout: TIMEOUT });
        if (await page.locator('.leaflet-overlay-pane path').count() !== flaechen) throw new Error('Flächen verschwinden mit den Kacheln');
        // Reload erst nach abgeschlossenem IndexedDB-Schreiben; das Zeichnen
        // verschwindet schon vor der asynchronen Persistenz.
        for (let attempt = 0; attempt < 60; attempt++) {
            if ((await rawStore(page, 'einstellungen'))?.territoryLabels === false) break;
            if (attempt === 59) throw new Error('Kachelwahl nicht gespeichert');
            await page.waitForTimeout(100);
        }
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.getElementById('demo-banner')?.hidden === false, null, { timeout: TIMEOUT });
        if (await page.isChecked('#territory-labels-toggle')) throw new Error('Wahl nicht gemerkt');
        await page.waitForTimeout(800);
        if (await kacheln() !== 0) throw new Error('Kacheln nach dem Neuladen wieder da');
        await click('#territory-labels-toggle');
        await page.waitForFunction(() => document.querySelectorAll('.territory-stack-card').length > 0, null, { timeout: TIMEOUT });
        await colorMode(previousMode);
        await click('.mode-btn[data-mode="aussendienst"]');
    });

    await step('Live-Demos rechts in der Desktop-Kopfzeile öffnen', async () => {
        const launcher = page.locator('.topbar #btn-demos-pill');
        if (!await launcher.isVisible()) throw new Error('Demo-Zugang fehlt im Desktop-Kopf');
        await launcher.click();
        await page.waitForSelector('#showcase-dialog[open] .sc-tile[data-story="empfang"]', { timeout: TIMEOUT });
        if (await page.locator('#demo-welcome').isVisible()) throw new Error('Startauswahl bleibt hinter Demo-Übersicht offen');
        await page.keyboard.press('Escape');
        await page.evaluate(() => sessionStorage.removeItem('tf_demo_welcome_ack'));
        await page.reload({ waitUntil: 'domcontentloaded' });
    });

    await step('Startauswahl allein, Panel beim Umschauen und nach der Demo', async () => {
        const welcome = page.locator('#demo-welcome');
        const panelOpen = () => page.waitForFunction(() => document.getElementById('sidebar')?.classList.contains('open'), null, { timeout: TIMEOUT });
        const startSelection = async () => {
            await welcome.waitFor({ state: 'visible', timeout: TIMEOUT });
            await page.waitForFunction(() => !document.getElementById('sidebar').classList.contains('open') && getComputedStyle(document.getElementById('sidebar')).visibility === 'hidden', null, { timeout: TIMEOUT });
            const box = await welcome.boundingBox();
            if (Math.abs(box.x + box.width / 2 - 720) > 1) throw new Error('Startauswahl ist nicht über der ganzen Karte zentriert');
        };
        const restartWelcome = async () => {
            await page.evaluate(() => sessionStorage.removeItem('tf_demo_welcome_ack'));
            await page.reload({ waitUntil: 'domcontentloaded' });
            await startSelection();
        };
        await startSelection();
        await page.locator('#btn-demo-welcome-ack').click();
        await panelOpen();
        await restartWelcome();
        await page.locator('#btn-demo-welcome-demos').click();
        await page.waitForSelector('.sc-running');
        await panelOpen();
        await page.locator('.sc-cancel').click();
        await page.waitForFunction(() => !document.body.classList.contains('sc-running'), null, { timeout: TIMEOUT });
        await panelOpen();
        await restartWelcome();
    });

    // PO, 11.10.2026: Neue bekommen meist eine Datei von Kollegen – der Weg
    // dorthin steht in der Begrüßung und oben in „Daten".
    await step('Datei von Kollegen: aus der Begrüßung und aus „Deine Daten holen"', async () => {
        const card = page.locator('#demo-welcome .demo-welcome-card');
        await card.waitFor({ state: 'visible', timeout: TIMEOUT });
        // Maus auf der Karte: der Selbststart wartet, solange jemand liest.
        const box = await card.boundingBox();
        await page.mouse.move(box.x + 12, box.y + 12);
        await page.waitForSelector('#btn-demo-welcome-demos.is-waiting', { timeout: TIMEOUT });
        await page.mouse.move(5, box.y + box.height / 2);
        await page.waitForFunction(() => !document.getElementById('btn-demo-welcome-demos').classList.contains('is-waiting'), null, { timeout: TIMEOUT });
        await page.locator('#btn-demo-welcome-safe').click();
        await page.waitForSelector('#safe-receive-dialog[open]', { timeout: TIMEOUT });
        if (await page.locator('#demo-welcome').isVisible()) throw new Error('Begrüßung bleibt hinter dem Empfang stehen');
        await closeDialogs(page);
        // Abgebrochen oder eingelöst: danach steht das Panel im Bild, nicht die leere Karte.
        await page.waitForFunction(() => document.getElementById('sidebar')?.classList.contains('open'), null, { timeout: TIMEOUT })
            .catch(() => { throw new Error('Panel bleibt nach dem Empfang zu'); });
        await page.evaluate(() => document.querySelector('.tab-button[data-tab="daten"]')?.click());
        await page.locator('#data-start').waitFor({ state: 'visible', timeout: TIMEOUT });
        if (await page.locator('#btn-vault-setup').isVisible()) throw new Error('Verwaltung steht schon bei Beispieldaten im Bild');
        await page.locator('#btn-get-safe').click();
        await page.waitForSelector('#safe-receive-dialog[open]', { timeout: TIMEOUT });
        await closeDialogs(page);
        if (await page.locator('.sc-running').count()) throw new Error('Vorführung startete trotz Empfang');
        // Zurück zum Ausgangspunkt der nächsten Schritte: Begrüßung steht.
        await page.evaluate(() => sessionStorage.removeItem('tf_demo_welcome_ack'));
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.locator('#demo-welcome').waitFor({ state: 'visible', timeout: TIMEOUT });
    });

    await step('Eigene Liste importieren (Einfügen → Zuordnen → Karte)', async () => {
        await closeDialogs(page);
        // Solange die Begrüßung steht, trägt sie das Angebot – sonst der Demo-Streifen.
        const welcomeOwn = page.locator('#btn-demo-welcome-own');
        if (await welcomeOwn.isVisible().catch(() => false)) await welcomeOwn.click();
        else await page.locator('#btn-demo-own-data').click({ timeout: TIMEOUT });
        await page.waitForSelector('#own-data-dialog[open]', { timeout: TIMEOUT });
        if (await page.locator('#sidebar').evaluate((el) => el.classList.contains('open'))) throw new Error('Panel öffnet hinter der Importauswahl');
        await page.locator('#btn-paste').click();
        await page.waitForSelector('#consent-dialog[open]', { timeout: TIMEOUT });
        await page.locator('#consent-confirm').click();
        await page.waitForSelector('#paste-dialog[open]', { timeout: TIMEOUT });
        await page.locator('#paste-input').fill(FIXTURE);
        await page.waitForFunction(() => !document.getElementById('paste-confirm')?.disabled, null, { timeout: TIMEOUT });
        await page.locator('#paste-confirm').click();
        await page.waitForSelector('#import-dialog[open]', { timeout: TIMEOUT });
        await page.locator('#mapping-confirm').click();
        // Ersetzt die Beispieldaten evtl. mit Rückfrage.
        const confirmReplace = page.locator('#import-diff-dialog[open] [data-diff-confirm]');
        if (await confirmReplace.isVisible({ timeout: 3000 }).catch(() => false)) await confirmReplace.click();
        await page.waitForFunction(() => document.getElementById('demo-banner')?.hidden === true, null, { timeout: TIMEOUT });
        await page.waitForFunction(() => /\b3\b/.test(document.getElementById('data-status')?.textContent || ''), null, { timeout: TIMEOUT });
        // Nach dem ersten eigenen Import fragt TourFuchs, ob es Adressen genau
        // verorten soll – das Fenster öffnet sich verzögert. Beantworten wie ein
        // Nutzer („Nein, PLZ reicht"); sonst läge es irgendwann über dem
        // nächsten Schritt (machte z. B. das Ziehen der Sidebar wackelig).
        await page.waitForSelector('#geocode-offer-dialog[open]', { timeout: TIMEOUT })
            .catch(() => { throw new Error('Angebot zur genauen Verortung erscheint nach dem ersten Import nicht'); });
        await page.locator('#geocode-offer-no').click();
        await page.waitForFunction(() => !document.getElementById('geocode-offer-dialog').open, null, { timeout: TIMEOUT });
    });

    await step('Mit eigenen Daten: „Daten" nach Aufgaben, Empfang oben bei „Daten laden"', async () => {
        await closeDialogs(page);
        await page.evaluate(() => document.querySelector('.tab-button[data-tab="daten"]')?.click());
        await page.locator('#btn-safe-receive').waitFor({ state: 'visible', timeout: TIMEOUT });
        if (await page.locator('#data-start').isVisible()) throw new Error('„Deine Daten holen" steht trotz eigener Daten');
        const order = await page.evaluate(() => ['btn-safe-receive', 'btn-safe-export', 'vault-controls', 'data-more', 'btn-clear']
            .map((id) => document.getElementById(id)?.getBoundingClientRect().top ?? NaN));
        if (order.some(Number.isNaN) || order.some((top, i) => i && top <= order[i - 1])) throw new Error(`Reihenfolge stimmt nicht: ${order}`);
    });

    await step('Eigene PLZ-Daten: Kontakte, Summen, DUVE-Link und mobile Darstellung', async () => {
        await closeDialogs(page);
        await page.locator('#btn-postal-responsibility').click();
        await page.locator('#postal-query').fill('506');
        await page.waitForFunction(() => document.querySelector('#postal-results .postal-total')?.textContent.includes('3 Kunden'));
        if (await page.locator('.postal-card').count() !== 2) throw new Error('Account Manager nicht getrennt');
        const results = await page.locator('#postal-results').textContent();
        if (!results.includes('300') || !results.includes('1 ohne Umsatzangabe')) throw new Error('Umsatzsumme oder fehlende Werte falsch');
        if (await page.locator('.postal-card a[href^="tel:"]').getAttribute('href') !== 'tel:03023125123') throw new Error('Mitarbeitertelefon fehlt');
        if (!(await page.locator('.postal-card a[href*="teams.microsoft.com"]').getAttribute('href')).includes('eva%40example.org')) throw new Error('Teams-UPN fehlt');
        await page.screenshot({ path: 'tmp/postal-desktop.png' });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: 'tmp/postal-mobile.png' });
        if (await page.locator('#postal-dialog').evaluate(el => el.scrollWidth > el.clientWidth + 2)) throw new Error('Mobiler Dialog läuft über');
        await page.setViewportSize({ width: 1440, height: 900 });
        if (!results.includes('Vertriebsgruppe: Industrie') || !results.includes('Endkunde (2/3 Kunden · 67 %)')) throw new Error('Vertriebsgruppe oder Kundenschwerpunkt fehlt');
        // Previous settings smoke deliberately disabled the link. Reset to the fresh-browser default.
        await page.evaluate(() => localStorage.removeItem('tourfuchs.company-link.v1'));
        await page.locator('#postal-dialog .dialog-close').click();
        await page.locator('#global-search').fill('Smoke Test Süd');
        await page.locator('#search-results .result-row[data-id]').first().click();
        await page.waitForSelector('.leaflet-popup [data-popup-close]');
        if (await page.locator('.popup-company').count()) throw new Error('DUVE ohne SieSales-Link sichtbar');
        await page.locator('.leaflet-popup [data-popup-close]').click();
        await page.waitForFunction(() => !document.querySelector('.leaflet-popup'));
        await page.locator('#global-search').fill('Smoke Test Nord');
        await page.locator('#search-results .result-row[data-id]').first().click();
        await page.waitForSelector('.popup-company');
        if (await page.locator('.popup-company').getAttribute('href') !== 'https://duve.siemens.com/duve-ui/search?clusterType=case&searchTerm=SMOKE-1') throw new Error('DUVE-Suchadresse falsch');
        if (await page.locator('.popup-company').getAttribute('target') !== '_blank') throw new Error('DUVE öffnet nicht separat');
        await page.locator('.popup-company').click({ trial: true });
        await page.screenshot({ path: 'tmp/duve-customer-desktop.png', animations: 'disabled' });
        await page.locator('.leaflet-popup [data-popup-close]').click();
        await page.waitForFunction(() => !document.querySelector('.leaflet-popup'));
        await page.setViewportSize({ width: 390, height: 844 });
        if (await page.locator('#sidebar').evaluate(el => el.classList.contains('open'))) await page.locator('#sidebar-toggle').click();
        await page.locator('#global-search').fill('Smoke Test Nord');
        await page.locator('#search-results .result-row[data-id]').first().click();
        await page.locator('.popup-company').click({ trial: true });
        await page.screenshot({ path: 'tmp/duve-customer-mobile.png', animations: 'disabled' });
        if (await page.locator('.popup-customer').evaluate(el => el.scrollWidth > el.clientWidth + 2)) throw new Error('Kopier-/Firmenknöpfe laufen mobil über');
        await page.locator('.leaflet-popup [data-popup-close]').click();
        await page.waitForFunction(() => !document.querySelector('.leaflet-popup'));
        await page.setViewportSize({ width: 1440, height: 900 });
        if (!await page.locator('#sidebar').evaluate(el => el.classList.contains('open'))) await page.locator('#sidebar-toggle').click();
        await page.locator('#btn-postal-responsibility').click();
        if (!await page.locator('.postal-settings').evaluate(el => el.open)) await page.locator('.postal-settings summary').click();
        await page.locator('#company-remove').click();
        await page.keyboard.press('Escape');
        await page.locator('#global-search').fill('Smoke Test Nord');
        await page.locator('#search-results .result-row[data-id]').first().click();
        await page.waitForSelector('.leaflet-popup [data-action="copy-customer-number"]');
        if (await page.locator('.popup-company').count()) throw new Error('Entfernter Firmenlink erscheint weiter');
        await page.locator('.leaflet-popup [data-popup-close]').click();
        await page.waitForFunction(() => !document.querySelector('.leaflet-popup'));
        await page.locator('#global-search').fill('');
    });

    await step('Kundennummer mit Namen in die Zwischenablage kopieren', async () => {
        await closeDialogs(page);
        await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseUrl });
        await page.locator('#global-search').fill('Smoke Test Nord');
        const hit = page.locator('#search-results .result-row[data-id]').first();
        await hit.waitFor({ state: 'visible', timeout: TIMEOUT });
        if (await hit.locator('b').textContent() !== '[SMOKE-1] Smoke Test Nord') throw new Error('Kundennummer fehlt im Suchtreffer');
        await hit.click();
        await page.locator('.leaflet-popup [data-action="copy-customer-number"]').click();
        const copied = await page.evaluate(() => navigator.clipboard.readText());
        if (copied !== 'Smoke Test Nord [SMOKE-1]') throw new Error(`Falscher Kopierwert: ${copied}`);
        // Beide Kopieraktionen lassen die Kachel offen.
        await page.waitForSelector('.leaflet-popup [data-action="copy-customer-number-only"]');
        await page.screenshot({ path: 'tmp/customer-number-buttons.png' });
        await page.locator('.leaflet-popup [data-action="copy-customer-number-only"]').click();
        const onlyNumber = await page.evaluate(() => navigator.clipboard.readText());
        if (onlyNumber !== 'SMOKE-1') throw new Error(`Nummer ohne Namen/Klammern falsch: ${onlyNumber}`);
        const numberLabel = await page.locator('[data-action="copy-customer-number-only"]').textContent();
        const nameLabel = await page.locator('[data-action="copy-customer-number"]').textContent();
        if (!numberLabel.includes('Nr. SMOKE-1') || !nameLabel.includes('Name + Nr.')) throw new Error('Kopierknöpfe falsch beschriftet');
        await page.locator('.leaflet-popup [data-popup-close]').click();
        await page.waitForFunction(() => !document.querySelector('.leaflet-popup'));
        await page.locator('#global-search').fill('');
    });

    await step('Sidebar bis 150 % ziehen, speichern und frei verschoben skalieren', async () => {
        await closeDialogs(page);
        const panel = page.locator('#sidebar');
        const handle = page.locator('#sidebar-resize');
        const dragWidth = async (target) => {
            const box = await panel.boundingBox();
            const edge = await handle.boundingBox();
            await page.mouse.move(edge.x + edge.width / 2, edge.y + 120);
            const before = await page.evaluate(([x, y]) => {
                const el = document.elementFromPoint(x, y);
                return { hit: el ? `${el.tagName.toLowerCase()}#${el.id}.${[...el.classList].join('.')}` : '–', toasts: document.getElementById('toasts')?.textContent.slice(0, 80) || '' };
            }, [edge.x + edge.width / 2, edge.y + 120]);
            await page.mouse.down();
            await page.mouse.move(edge.x + edge.width / 2 + target - box.width, edge.y + 120, { steps: 8 });
            await page.mouse.up();
            const justAfter = await page.evaluate(() => ({
                width: Math.round(document.getElementById('sidebar').getBoundingClientRect().width),
                stored: localStorage.getItem('gf_sidebar_width'),
                resizing: document.body.classList.contains('sidebar-resizing')
            }));
            const expected = Math.max(340, Math.min(600, target));
            await page.waitForFunction((want) => Math.abs(document.getElementById('sidebar').getBoundingClientRect().width - want) < 1, expected, { timeout: TIMEOUT })
                .catch(async () => {
                    const [x, y] = [edge.x + edge.width / 2, edge.y + 120];
                    const seen = await page.evaluate(([x, y]) => ({
                        width: Math.round(document.getElementById('sidebar').getBoundingClientRect().width),
                        dialogs: [...document.querySelectorAll('dialog[open]')].map((d) => d.id),
                        hit: (() => { const el = document.elementFromPoint(x, y); return el ? `${el.tagName.toLowerCase()}#${el.id}.${[...el.classList].join('.')}` : '–'; })()
                    }), [x, y]);
                    throw new Error(`Ziehen auf ${target}: erwartet ${expected} px, ist ${seen.width} px; offene Dialoge: ${seen.dialogs.join(', ') || 'keine'}; Griff ${JSON.stringify(edge)}; unter der Maus: ${seen.hit}; direkt nach dem Loslassen ${JSON.stringify(justAfter)}; vor dem Drücken ${JSON.stringify(before)}`);
                });
        };
        await dragWidth(600);
        await dragWidth(750);
        if (await page.evaluate(() => localStorage.getItem('gf_sidebar_width')) !== '600') throw new Error('Breite wird nicht gespeichert');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.getElementById('sidebar')?.getBoundingClientRect().width === 600, null, { timeout: TIMEOUT })
            .catch(async () => { throw new Error(`nach Neuladen Breite ${await page.evaluate(() => document.getElementById('sidebar')?.getBoundingClientRect().width)} statt 600`); });
        await page.waitForFunction(() => /\b3\b/.test(document.getElementById('data-status')?.textContent || ''), null, { timeout: TIMEOUT })
            .catch(async () => { throw new Error(`nach Neuladen Datenstand „${await page.locator('#data-status').textContent().catch(() => '')}"`.slice(0, 200)); });
        await closeDialogs(page);
        if (!await panel.evaluate((el) => el.classList.contains('open'))) await page.locator('#sidebar-toggle').click();
        // Vor Koordinatenaktionen auch den Einblend-Übergang abwarten.
        await page.locator('#sheet-grip').click({ trial: true });
        const grip = await page.locator('#sheet-grip').boundingBox();
        await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
        await page.mouse.down();
        await page.mouse.move(grip.x + grip.width / 2 + 120, grip.y + grip.height / 2, { steps: 8 });
        await page.mouse.up();
        await page.waitForSelector('#sidebar.floating-sidebar');
        await dragWidth(550);
        await page.locator('#sheet-grip').dblclick();
        await dragWidth(200);
        await dragWidth(400);
    });

    // Gemerkte Importvorlagen (15.1) würden dieselbe Liste ohne Zuordnung
    // übernehmen – die folgenden Schritte prüfen den Weg von Hand.
    const forgetImportTemplates = () => page.evaluate(() => localStorage.removeItem('tf_import_templates'));

    await step('Datei im Worker lesen, Abbrechen und Fehler erhalten den Bestand', async () => {
        await closeDialogs(page);
        await forgetImportTemplates();
        const before = await customerCount(page);
        await page.locator('#file-input').setInputFiles({ name: 'worker.csv', mimeType: 'text/csv', buffer: Buffer.from(FIXTURE) });
        await page.waitForSelector('#import-dialog[open]', { timeout: TIMEOUT });
        await page.waitForFunction(() => document.getElementById('mapping-file-info')?.textContent.includes('worker.csv'), null, { timeout: TIMEOUT });
        if (await page.locator('#import-wait-dialog').evaluate(el => el.open)) throw new Error('Wartedialog bleibt offen');
        const mapping = await page.locator('#mapping-file-info').textContent();
        await page.locator('#file-input').setInputFiles({ name: 'large.csv', mimeType: 'text/csv', buffer: Buffer.from(FIXTURE + '\n' + Array(20000).fill(FIXTURE.split('\n')[1]).join('\n')) });
        await page.waitForSelector('#import-wait-dialog[open]', { timeout: TIMEOUT });
        await page.keyboard.press('Escape');
        await page.waitForSelector('#import-dialog[open]', { timeout: TIMEOUT });
        if (await page.locator('#mapping-file-info').textContent() !== mapping) throw new Error('Abbruch verändert Zuordnung');
        await page.locator('#file-input').setInputFiles({ name: 'broken.csv', mimeType: 'text/csv', buffer: Buffer.from('nur eine Zeile') });
        await page.waitForSelector('#toasts .toast-error', { timeout: TIMEOUT });
        await page.waitForSelector('#import-dialog[open]', { timeout: TIMEOUT });
        if (await customerCount(page) !== before) throw new Error('Einlesen verändert vorhandene Kunden');
    });

    await step('Reimport behält lokal erfasste Besuche', async () => {
        await closeDialogs(page);
        await forgetImportTemplates();
        // Besuch bei „Smoke Test Nord" eintragen (Suche → Popup → besucht).
        await page.fill('#global-search', 'Smoke Test Nord');
        await page.waitForSelector('#search-results .result-row', { timeout: TIMEOUT });
        await page.evaluate(() => document.querySelector('#search-results .result-row').click());
        await page.waitForSelector('.leaflet-popup [data-action="mark-visited"]', { timeout: TIMEOUT });
        await page.evaluate(() => document.querySelector('.leaflet-popup [data-action="mark-visited"]').click());
        await page.evaluate(() => document.querySelector('.leaflet-popup-close-button')?.click());
        await page.fill('#global-search', '');
        const today = await page.evaluate(() => new Date().toLocaleDateString('sv-SE'));
        // Dieselbe Liste noch einmal einlesen – wie der monatliche CRM-Export.
        await page.evaluate(() => document.getElementById('own-data-dialog').showModal());
        await page.locator('#btn-paste').click();
        const consent = page.locator('#consent-dialog[open] #consent-confirm');
        if (await consent.isVisible({ timeout: 2000 }).catch(() => false)) await consent.click();
        await page.waitForSelector('#paste-dialog[open]', { timeout: TIMEOUT });
        await page.locator('#paste-input').fill(FIXTURE);
        await page.waitForFunction(() => !document.getElementById('paste-confirm')?.disabled, null, { timeout: TIMEOUT });
        await page.locator('#paste-confirm').click();
        await page.waitForSelector('#import-dialog[open]', { timeout: TIMEOUT });
        await page.locator('#mapping-confirm').click();
        await page.waitForSelector('#import-diff-dialog[open]', { timeout: TIMEOUT });
        const headline = await page.textContent('#import-diff-body .diff-headline');
        if (/verloren/.test(headline)) throw new Error(`Änderungsbericht meldet Verlust: ${headline}`);
        await page.locator('#import-diff-dialog[open] [data-diff-confirm]').click();
        await page.waitForFunction(() => !document.getElementById('import-diff-dialog')?.open, null, { timeout: TIMEOUT });
        await sleep(1500);
        const raw = await rawStore(page, 'kundendaten');
        const nord = (raw?.customers || []).find((c) => c.nummer === 'SMOKE-1');
        if (!nord?.besuche?.includes(today)) throw new Error(`Besuch vom ${today} nach dem Reimport verloren`);
    });

    await step('Wiedererkannte Liste: ohne Zuordnung, nur Ergebnis (Importvorlage)', async () => {
        await closeDialogs(page);
        // Der vorige Schritt hat die Zuordnung bestätigt – dieselbe Liste kommt jetzt ohne Dialog.
        await page.evaluate(() => document.getElementById('own-data-dialog').showModal());
        await page.locator('#btn-paste').click();
        const consent = page.locator('#consent-dialog[open] #consent-confirm');
        if (await consent.isVisible({ timeout: 2000 }).catch(() => false)) await consent.click();
        await page.waitForSelector('#paste-dialog[open]', { timeout: TIMEOUT });
        await page.locator('#paste-input').fill(FIXTURE);
        await page.waitForFunction(() => !document.getElementById('paste-confirm')?.disabled, null, { timeout: TIMEOUT });
        await page.locator('#paste-confirm').click();
        await page.waitForSelector('#import-result-dialog[open]', { timeout: TIMEOUT });
        if (await page.locator('#import-dialog').evaluate((el) => el.open)) throw new Error('Zuordnung trotz Vorlage');
        if (await page.locator('#import-diff-dialog').evaluate((el) => el.open)) throw new Error('Änderungsbericht ohne fehlende Kunden');
        const title = await page.textContent('#import-result-dialog h2');
        if (!/Liste aktualisiert/.test(title)) throw new Error(`Ergebnisfenster: ${title}`);
        if (!await page.locator('#import-template-review').isVisible()) throw new Error('„Zuordnung prüfen" fehlt');
        await closeDialogs(page);
        // Erst das Schließen des Ergebnisfensters löst die Folgeangebote aus (Verortung …).
        await sleep(1200);
        await closeDialogs(page);
    });

    await step('Tresor einrichten, sperren und entsperren – Daten verschlüsselt', async () => {
        await closeDialogs(page);
        await page.evaluate(() => { const t = document.getElementById('btn-vault-toggle'); t.hidden = false; t.click(); });
        await page.waitForSelector('#setup-pin', { timeout: TIMEOUT });
        await page.fill('#setup-pin', 'Smoke-Test-2026');
        await page.fill('#setup-pin2', 'Smoke-Test-2026');
        await page.click('#vault-setup-form button[type=submit]');
        await page.waitForSelector('.vault-done', { timeout: TIMEOUT });
        await page.click('.vault-done');
        // Offener Dialog mit Kundendaten: Die Sperre muss ihn schließen und leeren
        // (modale Dialoge lägen sonst über dem Sperrbildschirm).
        await page.evaluate(() => {
            document.getElementById('territory-summary-body').textContent = 'Smoke Test Nord';
            document.getElementById('territory-summary-dialog').showModal();
        });
        await page.evaluate(() => document.getElementById('btn-vault-toggle').click());
        await page.waitForFunction(() => document.getElementById('vault-lock')?.hidden === false, null, { timeout: TIMEOUT });
        const leftOpen = await page.evaluate(() => [...document.querySelectorAll('dialog[open]')]
            .filter((d) => d.id !== 'vault-dialog').map((d) => d.id));
        if (leftOpen.length) throw new Error(`Dialog bleibt über der Sperre offen: ${leftOpen.join(', ')}`);
        if (await page.evaluate(() => document.getElementById('territory-summary-body').textContent)) throw new Error('Dialoginhalt nach dem Sperren nicht geleert');
        const raw = await rawStore(page, 'kundendaten');
        if (!raw?.__enc) throw new Error('Kundendaten liegen nicht verschlüsselt im Speicher');
        if (JSON.stringify(raw).includes('Smoke Test')) throw new Error('Klartext im verschlüsselten Speicher');
        // Langsames Gerät: Der Bestand braucht nach dem Entsperren 3 s. Der
        // nächste Schritt deaktiviert bewusst sofort, ohne darauf zu warten.
        await page.evaluate(() => localStorage.setItem('smoke_slow_decrypt', '3000'));
        await page.fill('#vault-pin', 'Smoke-Test-2026');
        await page.click('#vault-unlock');
        await page.waitForFunction(() => document.getElementById('vault-lock')?.hidden === true, null, { timeout: TIMEOUT });
    });

    // Direkt nach dem Entsperren, während der Bestand noch nachlädt: Bis 17.1a
    // speicherte das Deaktivieren hier den leeren Arbeitsspeicher im Klartext
    // über die verschlüsselten Daten (CI: „0 Kunde(n) im Klartext").
    await step('Tresor deaktivieren – direkt nach dem Entsperren, Kunden bleiben, auch nach dem Neuladen', async () => {
        await closeDialogs(page);
        const before = await customerCount(page);
        if (!await page.evaluate(() => Boolean(localStorage.getItem('tf_vault')))) throw new Error('Tresor war vor dem Deaktivieren nicht aktiv');
        const answer = (dialog) => dialog.type() === 'prompt' ? dialog.accept('Smoke-Test-2026') : dialog.accept();
        page.on('dialog', answer);
        await page.evaluate(() => { const b = document.getElementById('btn-vault-disable'); b.hidden = false; b.click(); });
        await page.waitForFunction(() => !localStorage.getItem('tf_vault'), null, { timeout: TIMEOUT });
        page.off('dialog', answer);
        // Auf den Zustand warten, nicht auf eine feste Zeit: Klartext mit den Kunden
        // gespeichert (auf langsamen Rechnern dauert schon die PIN-Prüfung).
        const plain = (raw) => Boolean(raw) && !raw.__enc && JSON.stringify(raw).includes('Smoke Test');
        let raw = await waitForStored(page, 'kundendaten', plain);
        if (!plain(raw)) throw new Error(`Kundendaten nach dem Deaktivieren nicht im Klartext gespeichert – ${describeStored(raw)}`);
        // Danach darf kein Speichervorgang mehr dazwischenfunken: Früher schrieb der
        // Speichertimer hier den geleerten Bestand weg.
        await sleep(2500);
        raw = await rawStore(page, 'kundendaten');
        if (!plain(raw)) throw new Error(`Kundendaten nach dem Deaktivieren überschrieben – ${describeStored(raw)}`);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#map', { timeout: TIMEOUT });
        await page.waitForFunction((text) => (document.getElementById('data-status')?.textContent || '') === text, before, { timeout: TIMEOUT });
        if (await page.evaluate(() => document.getElementById('vault-lock')?.hidden === false)) throw new Error('Sperrbildschirm trotz deaktiviertem Tresor');
    });
    await page.evaluate(() => localStorage.removeItem('smoke_slow_decrypt'));

    await step('Alle Daten löschen – auch Touren, Adress-Cache und Szenarien', async () => {
        await closeDialogs(page);
        // Nebenspeicher füllen, wie es Tourspeichern und Verortung täten.
        await page.evaluate(() => new Promise((resolve) => {
            const req = indexedDB.open('geofuchs-db');
            req.onsuccess = () => {
                const db = req.result;
                const tx = db.transaction([db.objectStoreNames[0]], 'readwrite');
                const store = tx.objectStore(db.objectStoreNames[0]);
                store.put([{ id: 't1', name: 'Smoke Tour', start: { label: 'Zuhause Rosenweg 7' }, stopIds: [] }], 'gespeicherte-touren');
                store.put({ 'Rosenweg 7, 45127 Essen': { lat: 51.45, lng: 7.01 } }, 'geocode-cache');
                tx.oncomplete = () => { db.close(); resolve(); };
            };
        }));
        const answer = (dialog) => dialog.accept();
        page.on('dialog', answer);
        await page.evaluate(() => document.getElementById('btn-clear').click());
        await page.waitForFunction(() => /\b0\b|keine/i.test(document.getElementById('data-status')?.textContent || ''), null, { timeout: TIMEOUT })
            .catch(async () => { throw new Error(`Bestand nach „Alle Daten löschen" nicht leer – ${await page.locator('#data-status').textContent().catch(() => '')}`.slice(0, 300)); });
        page.off('dialog', answer);
        for (const key of ['gespeicherte-touren', 'geocode-cache', 'simulations-szenarien']) {
            const gone = (raw) => !raw || !JSON.stringify(raw).includes('Rosenweg');
            if (!gone(await waitForStored(page, key, gone))) throw new Error(`${key} nach „Alle Daten löschen" noch vorhanden`);
        }
        // Gegenprobe: Schreibt ein verspäteter Speichervorgang die Daten zurück?
        await sleep(1000);
        for (const key of ['gespeicherte-touren', 'geocode-cache', 'simulations-szenarien']) {
            const raw = await rawStore(page, key);
            if (raw && JSON.stringify(raw).includes('Rosenweg')) throw new Error(`${key} nach „Alle Daten löschen" wieder aufgetaucht`);
        }
    });

    // Zweite, unabhängige Prüfung zu tests/vaultHistory.test.js: Jeder
    // eingefrorene Tresor (je ein historischer Stand) liegt im Speicher, wie ihn
    // die damalige App hinterlassen hätte – und wird am echten Sperrbildschirm
    // mit seiner PIN geöffnet, auch eine alte 4-stellige.
    await step('Tresore aller Stände am Sperrbildschirm öffnen', async () => {
        const dir = new URL('../tests/fixtures/tresor/', import.meta.url);
        const fixtures = readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
            .map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));
        if (fixtures.length < 5) throw new Error(`nur ${fixtures.length} Tresore gefunden`);
        const plant = (fixture) => page.evaluate((f) => new Promise((resolve, reject) => {
            localStorage.setItem('tf_vault', JSON.stringify(f.meta));
            const req = indexedDB.open('geofuchs-db');
            req.onerror = () => reject(req.error);
            req.onsuccess = () => {
                const db = req.result;
                const tx = db.transaction([db.objectStoreNames[0]], 'readwrite');
                tx.objectStore(db.objectStoreNames[0]).put(f.payload, 'kundendaten');
                tx.oncomplete = () => { db.close(); resolve(); };
                tx.onerror = () => reject(tx.error);
            };
        }), fixture);
        try {
            for (const fixture of fixtures) {
                await closeDialogs(page);
                // Die App speichert 400 ms nach einer Änderung – erst danach den
                // nächsten Tresor hinlegen, sonst überschreibt sie ihn.
                await sleep(800);
                await plant(fixture);
                await page.reload({ waitUntil: 'domcontentloaded' });
                await page.waitForFunction(() => document.getElementById('vault-lock')?.hidden === false, null, { timeout: TIMEOUT })
                    .catch(() => { throw new Error(`${fixture.stand}: kein Sperrbildschirm`); });
                await page.fill('#vault-pin', fixture.pin);
                await page.click('#vault-unlock');
                await page.waitForFunction(() => document.getElementById('vault-lock')?.hidden === true, null, { timeout: TIMEOUT })
                    .catch(async () => { throw new Error(`${fixture.stand}: PIN nicht angenommen – ${await page.locator('#vault-lock').textContent().catch(() => '')}`.slice(0, 300)); });
                await page.waitForFunction((name) => (document.getElementById('data-status')?.textContent || '').includes(name), fixture.inhalt.fileName, { timeout: TIMEOUT })
                    .catch(() => { throw new Error(`${fixture.stand}: Bestand nach dem Entsperren nicht da`); });
            }
        } finally {
            await page.evaluate(() => new Promise((resolve) => {
                localStorage.removeItem('tf_vault');
                const req = indexedDB.open('geofuchs-db');
                req.onsuccess = () => {
                    const db = req.result;
                    const tx = db.transaction([db.objectStoreNames[0]], 'readwrite');
                    tx.objectStore(db.objectStoreNames[0]).delete('kundendaten');
                    tx.oncomplete = () => { db.close(); resolve(); };
                    tx.onerror = () => { db.close(); resolve(); };
                };
                req.onerror = () => resolve();
            }));
        }
    });

    await step('keine Skriptfehler', async () => {
        if (errors.length) throw new Error(errors.join(' | '));
    });
    await context.close();
}

async function phone(browser, baseUrl) {
    console.log('Smartphone (390×844)');
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
    await context.addInitScript(skipMobilePreviewTeaser);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));

    await step('App startet mit Beispieldaten', () => openApp(page, baseUrl));

    await step('PLZ-Zuständigkeit: ab drei Ziffern, Eingrenzung und Firmenlink', async () => {
        await closeDialogs(page);
        await page.locator('#btn-postal-responsibility').click();
        await page.locator('#postal-query').fill('50');
        await page.waitForFunction(() => document.getElementById('postal-results')?.textContent.includes('Bitte 3 bis 5'));
        await page.locator('#postal-query').fill('506');
        await page.waitForFunction(() => document.getElementById('postal-results')?.textContent.includes('PLZ 506xx'));
        await page.locator('#postal-query').fill('5066');
        await page.waitForFunction(() => document.getElementById('postal-results')?.textContent.includes('PLZ 5066x'));
        await page.locator('#postal-query').fill('50667');
        await page.waitForFunction(() => document.getElementById('postal-results')?.textContent.includes('PLZ 50667'));
        const overflow = await page.locator('#postal-dialog').evaluate(el => el.scrollWidth > el.clientWidth + 2);
        if (overflow) throw new Error('PLZ-Auskunft läuft seitlich über');
        if (!await page.locator('.postal-settings').evaluate(el => el.open)) await page.locator('.postal-settings summary').click();
        await page.locator('#company-duve').click();
        await page.locator('#company-link-form button[type="submit"]').click();
        if (!(await page.locator('#company-status').textContent()).includes('gespeichert')) throw new Error('Firmenlink nicht gespeichert');
        await page.locator('#company-remove').click();
        await page.keyboard.press('Escape');
        await page.locator('#global-search').fill('506');
        await page.locator('[data-postal]').click();
        await page.waitForSelector('#postal-dialog[open]');
        await page.keyboard.press('Escape');
        await page.locator('#global-search').fill('');
    });

    await step('Handy bleibt bei gespeicherter 600-Pixel-Desktopbreite im Fenster', async () => {
        if (await page.locator('#btn-demos-pill').isVisible()) throw new Error('Desktop-Demo-Knopf steht im Handy-Kopf');
        await page.evaluate(() => { document.documentElement.style.setProperty('--sidebar-width', '600px'); });
        const panel = await page.locator('#sidebar').boundingBox();
        if (panel.width > 390 || await page.locator('#sidebar-resize').isVisible()) throw new Error('Desktopbreite beeinflusst Handy-Blatt');
    });

    // Suchen → Treffer → Aktion im Kunden-Popup. Geklickt wird über das DOM:
    // Am Handy kann das Tour-Blatt Teile der Karte überdecken – geprüft wird
    // hier der Bedienweg, nicht die Treffsicherheit eines Fingers.
    // Die Trefferliste wird asynchron neu aufgebaut; eine eben gefundene Zeile
    // kann im nächsten Moment ersetzt sein. Deshalb gezielt einen *Kunden*-
    // Treffer (data-id, nicht Ort) anklicken und bei Bedarf neu ansetzen.
    const pick = async (query, action) => {
        await closeDialogs(page);
        for (let attempt = 1; ; attempt++) {
            await page.fill('#global-search', '');
            await page.fill('#global-search', query);
            await page.waitForSelector('#search-results .result-row[data-id]', { timeout: TIMEOUT });
            const clicked = await page.evaluate(() => {
                const row = document.querySelector('#search-results .result-row[data-id]');
                const number = document.querySelector('#search-results .result-row[data-id] b')?.textContent;
                if (row && !/^\[.+\] /.test(number || '')) throw new Error('Kundennummer fehlt im mobilen Suchtreffer');
                row?.click();
                return Boolean(row);
            });
            const opened = clicked && await page.waitForSelector(`.leaflet-popup [data-action="${action}"]`, { timeout: 10000 })
                .then(() => true).catch(() => false);
            if (opened) break;
            if (attempt >= 3) throw new Error(`Kunden-Popup für „${query}" nicht erschienen`);
        }
        await page.evaluate((a) => document.querySelector(`.leaflet-popup [data-action="${a}"]`).click(), action);
        await page.evaluate(() => document.querySelector('.leaflet-popup-close-button')?.click());
        // Leaflet blendet ein geschlossenes Popup noch ~200 ms aus, bevor es das
        // Element entfernt. Ohne dieses Warten fände der nächste Aufruf dort noch
        // seinen Knopf – und griffe ins Leere, sobald das Element verschwindet.
        await page.waitForFunction(() => !document.querySelector('.leaflet-popup'), null, { timeout: TIMEOUT });
    };

    await step('Tour: Start und Ziel über die Suche', async () => {
        await pick('Bäckerei', 'tour-start');
        await pick('Autohaus', 'tour-dest');
        // Start + Ziel stehen: Die Tour lässt sich an Google Maps übergeben.
        await page.waitForFunction(() => document.getElementById('btn-gmaps')?.disabled === false, null, { timeout: TIMEOUT });
    });

    const syncLabel = () => page.evaluate(() => document.getElementById('btn-sync')?.textContent || '');
    await step('Besuch eintragen → „🔄 Abgleichen · 1 neu" im Tour-Blatt', async () => {
        await pick('Druckerei', 'mark-visited');
        // Sichtbar steht er im Tour-Blatt; hier zählt, dass er den Besuch kennt.
        await page.waitForFunction(() => {
            const button = document.getElementById('btn-sync');
            return button && !button.hidden && / · 1 neu$/.test(button.textContent);
        }, null, { timeout: TIMEOUT });
    });

    // Weg B: Abgleich-Datei senden (ohne Teilen-Menü im Testbrowser: Download)
    // und dieselbe Datei wieder öffnen – nichts doppelt, kein Klartext darin.
    await step('Abgleichen: Datei senden und wieder öffnen', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'tourfuchs-abgleich-'));
        try {
            // Headless Chromium on Windows can expose native sharing. This
            // scenario explicitly exercises the documented download fallback.
            await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }));
            await closeDialogs(page);
            await page.evaluate(() => document.getElementById('btn-sync').click());
            await page.waitForSelector('#sync-dialog[open]', { timeout: TIMEOUT });
            const [download] = await Promise.all([
                page.waitForEvent('download', { timeout: TIMEOUT }),
                page.locator('#sync-send').click()
            ]);
            const name = download.suggestedFilename();
            if (!/^TourFuchs-Abgleich-\d{4}-\d{2}-\d{2}\.txt$/.test(name)) throw new Error(`Dateiname: ${name}`);
            const file = join(dir, name);
            await download.saveAs(file);
            const text = readFileSync(file, 'utf8');
            if (!text.includes('"__tfsync":1') || /Druckerei/i.test(text)) throw new Error(`Inhalt: ${text.slice(0, 120)}`);
            await page.waitForFunction(() => !/neu$/.test(document.getElementById('btn-sync')?.textContent || ''), null, { timeout: TIMEOUT });
            await page.evaluate(() => document.getElementById('btn-sync').click());
            await page.waitForSelector('#sync-dialog[open]', { timeout: TIMEOUT });
            await page.locator('#sync-file-input').setInputFiles(file);
            await page.waitForFunction(() => /Abgleich: 0 Besuche übernommen · 1 war schon eingetragen/.test(document.getElementById('toasts')?.textContent || ''), null, { timeout: TIMEOUT })
                .catch(async () => { throw new Error(`Meldung: ${await page.locator('#toasts').textContent()}`); });
            if (await page.evaluate(() => document.getElementById('sync-dialog').open)) throw new Error('Fenster bleibt offen');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    // Zweite, unabhängige Prüfung zu tests/safeTransferHistory.test.js: Jede
    // eingefrorene Umzugsdatei (je ein historischer Stand) wird über die echte
    // Oberfläche eingelöst – Datei wählen, Schlüssel eingeben, Ersetzen
    // bestätigen – und muss nach dem Neuladen noch da sein (gespeichert).
    await step('Umzugsdateien aller Stände einlösen und nach Neuladen behalten', async () => {
        const dir = new URL('../tests/fixtures/umzug/', import.meta.url);
        const files = readdirSync(dir).filter((f) => f.endsWith('.tfsafe')).sort().map((f) => {
            const stem = f.replace(/\.tfsafe$/, '');
            return {
                stem,
                path: fileURLToPath(new URL(f, dir)),
                key: readFileSync(new URL(`${stem}.key.txt`, dir), 'utf8').trim(),
                expected: JSON.parse(readFileSync(new URL(`${stem}.erwartet.json`, dir), 'utf8'))
            };
        });
        // Datei vom 09.10.2026 (Schlüssel im Test safeTransferCompat) zusätzlich.
        files.unshift({
            stem: 'TourFuchs-Umzug-2026-10-09',
            path: fileURLToPath(new URL('../tests/fixtures/TourFuchs-Umzug-2026-10-09.tfsafe', import.meta.url)),
            key: 'TFK1:3663c2a95183:vP8iAmR1yzSDkjCqS3fybiPfQPFFd8STNpySs5l4chc=',
            expected: { customers: [{}], fileName: null }
        });
        if (files.length < 7) throw new Error(`nur ${files.length} Umzugsdateien gefunden`);
        const accept = (dialog) => dialog.accept();
        page.on('dialog', accept);
        try {
            for (const file of files) {
                await closeDialogs(page);
                await page.evaluate(() => document.getElementById('btn-safe-receive').click());
                await page.waitForSelector('#safe-receive-dialog[open]', { timeout: TIMEOUT });
                await page.locator('#safe-file-input').setInputFiles(file.path);
                await page.waitForFunction(() => document.getElementById('safe-step-key')?.disabled === false, null, { timeout: TIMEOUT })
                    .catch(async () => { throw new Error(`${file.stem}: Datei nicht angenommen – ${await page.locator('#safe-file-status').textContent().catch(() => '')}`); });
                // Wie ein Nutzer ohne Kamera: „Schlüssel eintippen/einfügen" aufklappen.
                const fallback = page.locator('#safe-step-key details.safe-fallback');
                if (!(await fallback.evaluate((d) => d.open))) await fallback.locator('summary').click();
                await page.locator('#safe-key-input').fill(file.key);
                await page.locator('#safe-key-submit').click();
                const count = file.expected.customers.length;
                await page.waitForFunction((n) => !document.getElementById('safe-receive-dialog').open
                    && document.querySelector('#data-status .stat b')?.textContent === String(n), count, { timeout: TIMEOUT })
                    .catch(async () => { throw new Error(`${file.stem}: nicht übernommen – ${await page.locator('#toasts').textContent().catch(() => '')}`); });
                // „… und lokal gespeichert" – erst dann ist der Umzug wirklich angekommen.
                await page.waitForFunction(() => /Daten empfangen \(.*\) und (lokal gespeichert|im Tresor gesichert)/.test(document.getElementById('toasts')?.textContent || ''), null, { timeout: TIMEOUT })
                    .catch(async () => { throw new Error(`${file.stem}: nicht gespeichert – ${await page.locator('#toasts').textContent().catch(() => '')}`); });
                // Auch ein Kunde ohne Position (Variante „ohne-position") steht danach auf der Karte.
                await page.waitForFunction((n) => (document.getElementById('data-status')?.textContent || '').includes(`📍 ${n} verortet`), count, { timeout: TIMEOUT })
                    .catch(async () => { throw new Error(`${file.stem}: nicht alle Kunden verortet – ${await page.locator('#data-status').textContent()}`); });
                if (file.expected.fileName && !(await page.locator('#data-status').textContent()).includes(file.expected.fileName)) {
                    throw new Error(`${file.stem}: Dateiname „${file.expected.fileName}" fehlt nach der Übernahme`);
                }
                await page.evaluate(() => document.getElementById('toasts')?.replaceChildren());
            }
            const last = files.at(-1);
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.waitForFunction((n) => document.querySelector('#data-status .stat b')?.textContent === String(n), last.expected.customers.length, { timeout: TIMEOUT })
                .catch(() => { throw new Error('nach dem Neuladen ist der empfangene Bestand weg'); });
            if (!(await page.locator('#data-status').textContent()).includes(last.expected.fileName)) {
                throw new Error('nach dem Neuladen stammt der Bestand nicht aus der letzten Umzugsdatei');
            }
        } finally {
            page.off('dialog', accept);
        }
    });

    // Besuche, die mit einer Datei vom Desktop kommen (z. B. „Letzter Besuch" aus
    // dem CRM), hat das andere Gerät schon. „📤 Besuche weitergeben" darf sie am
    // Handy nicht als unterwegs erfasst anbieten.
    // Weg A: Eine Datei vom Desktop ersetzt den Bestand – aber nicht die Besuche
    // dieses Geräts. Und was in der Datei steht (z. B. „Letzter Besuch" aus dem
    // CRM), zählt nicht als „neu" fürs Abgleichen.
    await step('Empfang vom Desktop: eigene Besuche bleiben, fremde zählen nicht als neu', async () => {
        const { createSafeTransfer } = await import('../src/features/safeTransfer.js');
        const d = new Date(Date.now() - 86_400_000);
        const yesterday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const baecker = { id: 'k-nr:000101', nummer: '000101', name: 'Bäckerei Krümel GmbH', plz: '45127', ort: 'Essen',
            lat: 51.4556, lng: 7.0116, besuche: [], extra: {}, contacts: [] };
        const desktop = { id: 'k-nr:9001', nummer: '9001', name: 'Desktop Kunde GmbH', plz: '44135', ort: 'Dortmund',
            lat: 51.5136, lng: 7.4653, besuche: [yesterday], extra: {}, contacts: [] };
        const dir = mkdtempSync(join(tmpdir(), 'tourfuchs-besuch-'));
        const accept = (dialog) => dialog.accept();
        page.on('dialog', accept);
        const receive = async (customers, stem) => {
            const { container, keyQr } = await createSafeTransfer({ customers, fileName: `${stem}.xlsx` });
            const file = join(dir, `${stem}.tfsafe`);
            writeFileSync(file, JSON.stringify(container));
            await closeDialogs(page);
            await page.evaluate(() => document.getElementById('btn-safe-receive').click());
            await page.waitForSelector('#safe-receive-dialog[open]', { timeout: TIMEOUT });
            await page.locator('#safe-file-input').setInputFiles(file);
            await page.waitForFunction(() => document.getElementById('safe-step-key')?.disabled === false, null, { timeout: TIMEOUT });
            const fallback = page.locator('#safe-step-key details.safe-fallback');
            if (!(await fallback.evaluate((el) => el.open))) await fallback.locator('summary').click();
            await page.locator('#safe-key-input').fill(keyQr);
            await page.locator('#safe-key-submit').click();
            await page.waitForFunction((n) => !document.getElementById('safe-receive-dialog').open
                && document.querySelector('#data-status .stat b')?.textContent === String(n), customers.length, { timeout: TIMEOUT });
        };
        try {
            await receive([baecker], 'desktop-1');
            await pick('Bäckerei', 'mark-visited');
            await page.waitForFunction(() => / · 1 neu$/.test(document.getElementById('btn-sync')?.textContent || ''), null, { timeout: TIMEOUT });
            await receive([{ ...baecker }, desktop], 'desktop-2');
            await page.waitForTimeout(300);
            const label = await syncLabel();
            // 1 = der eigene Bäckerei-Besuch von heute (blieb erhalten); der
            // Desktop-Besuch von gestern zählt nicht. Ohne Weg A stünde hier nichts
            // (verloren), ohne die Kennzeichnung „· 2 neu".
            if (!/ · 1 neu$/.test(label)) throw new Error(`nach dem Empfang: „${label}"`);
        } finally {
            page.off('dialog', accept);
            rmSync(dir, { recursive: true, force: true });
        }
    });

    await step('keine Skriptfehler', async () => {
        if (errors.length) throw new Error(errors.join(' | '));
    });
    await context.close();
}

/**
 * Gesperrte Website-Daten (Safari, Chrome mit blockierten Cookies): Schon der
 * Zugriff auf localStorage/sessionStorage wirft, IndexedDB ebenso. Bis 17.1a
 * brach daran der ganze Start ab – keine Karte, keine Beispieldaten. Zweite
 * Prüfung zu tests/blockedStorage.test.js.
 */
async function blockedStorage(browser, baseUrl) {
    console.log('Gesperrter Browser-Speicher (1440×900)');
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
    await context.addInitScript(() => {
        for (const name of ['localStorage', 'sessionStorage', 'indexedDB']) {
            Object.defineProperty(window, name, {
                configurable: true,
                get() { throw new DOMException('The operation is insecure.', 'SecurityError'); }
            });
        }
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
    await step('App startet trotzdem mit Beispieldaten und Seitenleiste', async () => {
        await openApp(page, baseUrl);
        const zoom = await page.locator('#panel-zoom-label').textContent();
        if (zoom !== '100%') throw new Error(`Seitenleiste nicht eingerichtet (Zoom „${zoom}")`);
    });
    await step('keine Skriptfehler', async () => {
        if (errors.length) throw new Error(errors.join(' | '));
    });
    await context.close();
}

/**
 * QR-Rundweg (Release 17.1b – QR-Bibliotheken laden erst bei Bedarf): Der
 * Desktop erzeugt Umzugsdatei und Schlüssel-QR, das Handy liest genau dieses
 * Bild per „Foto des QR-Codes" und löst die Datei damit ein. So sind Erzeugen
 * und Lesen gemeinsam im echten Browser geprüft.
 */
async function qrRoundTrip(browser, baseUrl) {
    console.log('QR-Rundweg (Desktop → Handy)');
    const dir = mkdtempSync(join(tmpdir(), 'tourfuchs-qr-'));
    const fixture = fileURLToPath(new URL('../tests/fixtures/umzug/TourFuchs-Umzug-2026-10-11-v3-heute', import.meta.url));
    const errors = [];
    const contexts = [];
    const openPage = async (options) => {
        const context = await browser.newContext({ ...options, acceptDownloads: true, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
        contexts.push(context);
        await context.addInitScript(skipMobilePreviewTeaser);
        const page = await context.newPage();
        page.on('dialog', (dialog) => dialog.accept());
        page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
        await openApp(page, baseUrl);
        return page;
    };
    const receive = async (page, file, { key, keyFile, photo }) => {
        await closeDialogs(page);
        await page.evaluate(() => document.getElementById('btn-safe-receive').click());
        await page.waitForSelector('#safe-receive-dialog[open]', { timeout: TIMEOUT });
        await page.locator('#safe-file-input').setInputFiles(file);
        await page.waitForFunction(() => document.getElementById('safe-step-key')?.disabled === false, null, { timeout: TIMEOUT });
        if (keyFile) {
            await page.locator('#safe-key-file-input').setInputFiles(keyFile);
            await page.waitForSelector('#safe-key-file-status[data-kind="success"]:not([hidden])');
            await page.locator('#safe-key-submit').click();
        } else if (photo) {
            await page.locator('#safe-qr-options summary').click();
            await page.locator('#safe-scan-photo').setInputFiles(photo);
        } else {
            const fallback = page.locator('#safe-step-key details.safe-fallback');
            if (!(await fallback.evaluate((d) => d.open))) await fallback.locator('summary').click();
            await page.locator('#safe-key-input').fill(key);
            await page.locator('#safe-key-submit').click();
        }
        await page.waitForFunction(() => !document.getElementById('safe-receive-dialog').open
            && document.querySelector('#data-status .stat b')?.textContent === '3', null, { timeout: TIMEOUT });
    };
    try {
        let desk;
        await step('Desktop: Umzugsdatei und Schlüssel-QR erzeugen', async () => {
            desk = await openPage({ viewport: { width: 1440, height: 900 } });
            await receive(desk, `${fixture}.tfsafe`, { key: readFileSync(`${fixture}.key.txt`, 'utf8').trim() });
            await closeDialogs(desk);
            const [download] = await Promise.all([
                desk.waitForEvent('download', { timeout: TIMEOUT }),
                desk.evaluate(() => document.getElementById('btn-safe-export').click())
            ]);
            await download.saveAs(join(dir, 'rundweg.tfsafe'));
            await desk.waitForFunction(() => document.getElementById('safe-export-keytext')?.value.startsWith('TFK1:'), null, { timeout: TIMEOUT });
            writeFileSync(join(dir, 'schluessel.png'), await desk.locator('#safe-export-canvas').screenshot());
            const [keyDownload] = await Promise.all([
                desk.waitForEvent('download', { timeout: TIMEOUT }),
                desk.locator('#safe-export-key-download').click()
            ]);
            await keyDownload.saveAs(join(dir, 'schluessel.txt'));
            if (readFileSync(join(dir, 'schluessel.txt'), 'utf8').trim() !== await desk.locator('#safe-export-keytext').inputValue()) {
                throw new Error('Heruntergeladene Schlüsseldatei passt nicht zum Export.');
            }
        });
        await step('Handy: heruntergeladene Schlüssel-TXT laden und Daten einlösen', async () => {
            const phone = await openPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
            await receive(phone, join(dir, 'rundweg.tfsafe'), { keyFile: join(dir, 'schluessel.txt') });
        });
        await step('Handy: Schlüssel per Foto des QR-Codes lesen und Daten einlösen', async () => {
            const phone = await openPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
            await receive(phone, join(dir, 'rundweg.tfsafe'), { photo: join(dir, 'schluessel.png') })
                .catch(async () => { throw new Error(`nicht eingelöst – ${await phone.locator('#toasts').textContent().catch(() => '')}`.slice(0, 300)); });
        });
        await step('keine Skriptfehler', async () => {
            if (errors.length) throw new Error(errors.join(' | '));
        });
    } finally {
        await Promise.all(contexts.map((context) => context.close().catch(() => {})));
        rmSync(dir, { recursive: true, force: true });
    }
}

let chromium;
try {
    ({ chromium } = await import('playwright'));
} catch {
    console.error('Playwright fehlt. Einmalig: npm i --no-save playwright && npx playwright install chromium');
    process.exit(2);
}
const port = await freePort();
const server = await startPreview(port);
// Eigene Prozessgruppe: Strg+C erreicht den Server nicht mehr von selbst.
for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => { server.stopAll(); process.exit(130); });
}
let browser;
try {
    browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
    const baseUrl = `http://localhost:${port}/`;
    await desktop(browser, baseUrl);
    await phone(browser, baseUrl);
    await blockedStorage(browser, baseUrl);
    await qrRoundTrip(browser, baseUrl);
} finally {
    await browser?.close();
    server.stopAll();
}
console.log(failures ? `\n${failures} Schritt(e) fehlgeschlagen.` : '\nAlle Schritte ok.');
process.exit(failures ? 1 : 0);
