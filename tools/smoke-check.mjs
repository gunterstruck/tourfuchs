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
        console.log(`  ✗ ${name}: ${String(error.message || error)}`);
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
        if (copied !== '[SMOKE-1] Smoke Test Nord') throw new Error(`Falscher Kopierwert: ${copied}`);
        // Die Kopieraktion schließt das Popup bereits selbst.
        await page.evaluate(() => document.querySelector('.leaflet-popup-close-button')?.click());
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
            await page.mouse.down();
            await page.mouse.move(edge.x + edge.width / 2 + target - box.width, edge.y + 120, { steps: 8 });
            await page.mouse.up();
            await page.waitForFunction((expected) => Math.abs(document.getElementById('sidebar').getBoundingClientRect().width - expected) < 1, Math.max(340, Math.min(600, target)), { timeout: TIMEOUT });
        };
        await dragWidth(600);
        await dragWidth(750);
        if (await page.evaluate(() => localStorage.getItem('gf_sidebar_width')) !== '600') throw new Error('Breite wird nicht gespeichert');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.getElementById('sidebar')?.getBoundingClientRect().width === 600, null, { timeout: TIMEOUT });
        await page.waitForFunction(() => /\b3\b/.test(document.getElementById('data-status')?.textContent || ''), null, { timeout: TIMEOUT });
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

    await step('Datei im Worker lesen, Abbrechen und Fehler erhalten den Bestand', async () => {
        await closeDialogs(page);
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
        await page.waitForFunction(() => /\b0\b|keine/i.test(document.getElementById('data-status')?.textContent || ''), null, { timeout: TIMEOUT }).catch(() => {});
        await sleep(1000);
        page.off('dialog', answer);
        for (const key of ['gespeicherte-touren', 'geocode-cache', 'simulations-szenarien']) {
            const raw = await rawStore(page, key);
            if (raw && JSON.stringify(raw).includes('Rosenweg')) throw new Error(`${key} nach „Alle Daten löschen" noch vorhanden`);
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
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));

    await step('App startet mit Beispieldaten', () => openApp(page, baseUrl));

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
