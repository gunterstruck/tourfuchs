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
import { createServer } from 'node:net';

const TIMEOUT = 30_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FIXTURE = [
    'Kundennummer\tKundenname\tStraße\tPLZ\tOrt\tVertriebsbezirk',
    'SMOKE-1\tSmoke Test Nord\tDomkloster 4\t50667\tKöln\tBezirk Köln',
    'SMOKE-2\tSmoke Test Süd\tSeverinstraße 15\t50678\tKöln\tBezirk Köln',
    'SMOKE-3\tSmoke Test West\tAachener Straße 1\t50674\tKöln\tBezirk Köln'
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
    const child = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
    for (let attempt = 0; attempt < 60; attempt++) {
        await sleep(500);
        try {
            if ((await fetch(`http://localhost:${port}/`)).ok) return child;
        } catch { /* noch nicht bereit */ }
    }
    child.kill();
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
        console.log(`  ✗ ${name}: ${String(error.message || error).split('\n')[0]}`);
    }
}

async function openApp(page, baseUrl) {
    await page.goto(`${baseUrl}?nowelcome=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#map', { timeout: TIMEOUT });
    // Beispieldaten sind geladen, sobald der Demo-Streifen steht.
    await page.waitForFunction(() => document.getElementById('demo-banner')?.hidden === false, null, { timeout: TIMEOUT });
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
            get.onsuccess = () => resolve(get.result ?? null);
            get.onerror = () => resolve(null);
        };
        req.onerror = () => resolve(null);
    }), key);
}

async function desktop(browser, baseUrl) {
    console.log('Desktop (1440×900)');
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));

    await step('App startet mit Beispieldaten', () => openApp(page, baseUrl));

    await step('Eigene Liste importieren (Einfügen → Zuordnen → Karte)', async () => {
        await closeDialogs(page);
        // Solange die Begrüßung steht, trägt sie das Angebot – sonst der Demo-Streifen.
        const welcomeOwn = page.locator('#btn-demo-welcome-own');
        if (await welcomeOwn.isVisible().catch(() => false)) await welcomeOwn.click();
        else await page.locator('#btn-demo-own-data').click({ timeout: TIMEOUT });
        await page.waitForSelector('#own-data-dialog[open]', { timeout: TIMEOUT });
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
        const before = await customerCount(page);
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
        await page.fill('#vault-pin', 'Smoke-Test-2026');
        await page.click('#vault-unlock');
        await page.waitForFunction(() => document.getElementById('vault-lock')?.hidden === true, null, { timeout: TIMEOUT });
        await page.waitForFunction((text) => (document.getElementById('data-status')?.textContent || '') === text, before, { timeout: TIMEOUT });
    });

    await step('Tresor deaktivieren – Kunden bleiben, auch nach dem Neuladen', async () => {
        await closeDialogs(page);
        const before = await customerCount(page);
        const answer = (dialog) => dialog.type() === 'prompt' ? dialog.accept('Smoke-Test-2026') : dialog.accept();
        page.on('dialog', answer);
        await page.evaluate(() => { const b = document.getElementById('btn-vault-disable'); b.hidden = false; b.click(); });
        await page.waitForFunction(() => !localStorage.getItem('tf_vault'), null, { timeout: TIMEOUT });
        page.off('dialog', answer);
        // Speichertimer abwarten: Früher schrieb er hier den geleerten Bestand weg.
        await sleep(2500);
        const raw = await rawStore(page, 'kundendaten');
        if (raw?.__enc) throw new Error('Kundendaten nach dem Deaktivieren noch verschlüsselt');
        if (!JSON.stringify(raw || {}).includes('Smoke Test')) throw new Error('Kundendaten nach dem Deaktivieren verloren');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#map', { timeout: TIMEOUT });
        await page.waitForFunction((text) => (document.getElementById('data-status')?.textContent || '') === text, before, { timeout: TIMEOUT });
        if (await page.evaluate(() => document.getElementById('vault-lock')?.hidden === false)) throw new Error('Sperrbildschirm trotz deaktiviertem Tresor');
    });

    await step('keine Skriptfehler', async () => {
        if (errors.length) throw new Error(errors.join(' | '));
    });
    await context.close();
}

async function phone(browser, baseUrl) {
    console.log('Smartphone (390×844)');
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));

    await step('App startet mit Beispieldaten', () => openApp(page, baseUrl));

    // Suchen → Treffer → Aktion im Kunden-Popup. Geklickt wird über das DOM:
    // Am Handy kann das Tour-Blatt Teile der Karte überdecken – geprüft wird
    // hier der Bedienweg, nicht die Treffsicherheit eines Fingers.
    const pick = async (query, action) => {
        await closeDialogs(page);
        await page.fill('#global-search', query);
        await page.waitForSelector('#search-results .result-row', { timeout: TIMEOUT });
        await page.evaluate(() => document.querySelector('#search-results .result-row').click());
        await page.waitForSelector(`.leaflet-popup [data-action="${action}"]`, { timeout: TIMEOUT });
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

    await step('Besuch eintragen → „Besuche weitergeben" erscheint', async () => {
        await pick('Druckerei', 'mark-visited');
        await page.waitForFunction(() => document.getElementById('btn-visit-report')?.hidden === false, null, { timeout: TIMEOUT });
    });

    await step('keine Skriptfehler', async () => {
        if (errors.length) throw new Error(errors.join(' | '));
    });
    await context.close();
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
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
try {
    const baseUrl = `http://localhost:${port}/`;
    await desktop(browser, baseUrl);
    await phone(browser, baseUrl);
} finally {
    await browser.close();
    server.kill();
}
console.log(failures ? `\n${failures} Schritt(e) fehlgeschlagen.` : '\nAlle Schritte ok.');
process.exit(failures ? 1 : 0);
