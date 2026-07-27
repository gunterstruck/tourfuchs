/**
 * Prüfstrecke für Fingergesten.
 *
 * Warum es dieses Werkzeug zusätzlich zu `demo-check` gibt: Ein Playwright-Lauf
 * mit `page.mouse` läuft grün durch, obwohl die App am Telefon nicht bedienbar
 * ist. Für die Maus gilt `touch-action` nicht – und genau daran ist das Lasso
 * beim ersten echten Gerätetest gescheitert: Die Karte fror ein, aber der
 * Finger zeichnete ins Leere, weil der Browser die Wischgeste für sich
 * beanspruchte und `pointercancel` schickte.
 *
 * Hier werden Berührungen deshalb über das Chrome DevTools Protocol
 * eingespeist (`Input.dispatchTouchEvent`), so wie ein Gerät sie erzeugt.
 * Geprüft wird, was nur mit einem echten Finger sichtbar wird:
 *
 *  - Ist der Knopf frei bedienbar oder liegt ein schwebendes Element darüber?
 *  - Folgt die Zeichenspur dem Finger wirklich – oder bricht sie nach dem
 *    ersten Millimeter ab?
 *  - Steht der Auswahlstreifen im Bild und ist er antippbar?
 *  - Lässt sich die Karte danach wieder schieben?
 *  - Trifft ein Daumen die 17 Pixel großen Häkchen der Auswahlkarte, meint der
 *    Knopf danach wirklich die angehakten Kunden, und bleibt die Auswahl nach
 *    dem Übernehmen stehen?
 *
 * Aufruf:
 *   npm run touch-check
 *
 * Voraussetzung wie bei demo-check (bewusst nicht in package.json):
 *   npm i -D playwright && npx playwright install chromium
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const FORMATS = [
    { name: 'smartphone', viewport: { width: 390, height: 844 } },
    { name: 'tablet-hochkant', viewport: { width: 834, height: 1112 } }
];

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
    const child = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
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

/** Liegt etwas über diesem Element – also würde ein Finger daneben treffen? */
const COVER_PROBE = (id) => {
    const el = document.getElementById(id);
    if (!el || el.hidden) return { da: false };
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
        da: true,
        frei: el === top || el.contains(top),
        drueber: top ? (top.id || top.className || top.tagName) : null,
        imBild: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth
    };
};

async function runFormat(browser, format, baseUrl) {
    const context = await browser.newContext({
        viewport: format.viewport,
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 3,
        locale: 'de-DE',
        timezoneId: 'Europe/Berlin'
    });
    const page = await context.newPage();
    const problems = [];
    page.on('pageerror', (e) => problems.push(`Skriptfehler: ${String(e).slice(0, 160)}`));
    page.on('dialog', (d) => d.accept());
    const cdp = await context.newCDPSession(page);
    const touch = (type, point) => cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x: point.x, y: point.y, radiusX: 12, radiusY: 12, force: 1 }]
    });

    /** Eine Fläche mit dem Finger ziehen – wie ein Nutzer, ohne Messungen. */
    const zieheFlaeche = async () => {
        const box = await page.locator('#map').boundingBox();
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height * 0.42;
        const r = Math.min(box.width, box.height) * 0.26;
        const ring = [];
        for (let i = 0; i <= 24; i++) {
            const angle = (i / 24) * Math.PI * 2 - Math.PI / 2;
            ring.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r * 0.9 });
        }
        await touch('touchStart', ring[0]);
        for (const point of ring.slice(1)) { await touch('touchMove', point); await sleep(12); }
        await touch('touchEnd', ring[ring.length - 1]);
        await sleep(1400);
    };

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#map', { timeout: 20000 });
    await sleep(9000);
    await page.evaluate(() => document.getElementById('btn-demo-welcome-close')?.click());
    await sleep(1200);


    const button = await page.evaluate(COVER_PROBE, 'btn-lasso');
    if (!button.da) problems.push('Der Lasso-Knopf fehlt.');
    else if (!button.frei) problems.push(`Der Lasso-Knopf ist verdeckt von: ${button.drueber}`);
    else if (!button.imBild) problems.push('Der Lasso-Knopf liegt außerhalb des Bildes.');

    if (button.da && button.frei) {
        await page.locator('#btn-lasso').tap({ timeout: 8000 }).catch(() => problems.push('Der Lasso-Knopf ließ sich nicht antippen.'));
        await sleep(800);

        const action = await page.evaluate(() => getComputedStyle(document.getElementById('map')).touchAction);
        if (action !== 'none') problems.push(`touch-action der Karte ist „${action}" – der Browser nimmt dem Finger die Geste weg.`);

        // Einen Kreis ziehen und dabei prüfen, ob die Spur mitwächst.
        const box = await page.locator('#map').boundingBox();
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height * 0.42;
        const radius = Math.min(box.width, box.height) * 0.26;
        const ring = [];
        for (let i = 0; i <= 24; i++) {
            const angle = (i / 24) * Math.PI * 2 - Math.PI / 2;
            ring.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius * 0.9 });
        }
        await touch('touchStart', ring[0]);
        let drawn = 0;
        for (const point of ring.slice(1)) {
            await touch('touchMove', point);
            await sleep(16);
            drawn = await page.evaluate(() => (document.querySelector('.lasso-path')?.getAttribute('d') || '').split('L').length - 1);
        }
        // Nicht nur ob die Spur wächst, sondern ob sie auch SICHTBAR ist: Ein
        // SVG ohne ausdrückliche Größe bleibt bei 300x150 und schneidet alles
        // darunter ab – das `d`-Attribut stimmt dann trotzdem.
        const trace = await page.evaluate(() => {
            const svg = document.querySelector('.lasso-overlay');
            const path = document.querySelector('.lasso-path');
            const map = document.getElementById('map');
            if (!svg || !path || !map) return null;
            const s = svg.getBoundingClientRect();
            const m = map.getBoundingClientRect();
            const p = path.getBoundingClientRect();
            return {
                deckt: Math.round(s.width) >= Math.round(m.width) - 2 && Math.round(s.height) >= Math.round(m.height) - 2,
                svg: `${Math.round(s.width)}x${Math.round(s.height)}`,
                karte: `${Math.round(m.width)}x${Math.round(m.height)}`,
                // Die gezeichnete Spur muss so hoch sein wie der gezogene Ring.
                spurHoehe: Math.round(p.height)
            };
        });
        if (!trace) problems.push('Die Zeichenebene fehlt.');
        else {
            if (!trace.deckt) problems.push(`Die Zeichenebene deckt die Karte nicht ab (${trace.svg} statt ${trace.karte}) – die Spur wird abgeschnitten.`);
            if (trace.spurHoehe < radius) problems.push(`Die sichtbare Spur ist zu flach (${trace.spurHoehe} px bei Radius ${Math.round(radius)}) – vermutlich beschnitten.`);
        }
        await touch('touchEnd', ring[ring.length - 1]);
        if (drawn < 5) problems.push(`Die Spur folgte dem Finger nicht (${drawn} Punkte).`);
        await sleep(1300);

        // Abgeschnittene Beschriftungen: „Kunden in me…" ist keine Bedienung.
        const labels = await page.evaluate(() => {
            const out = [];
            for (const el of document.querySelectorAll('.map-fab .mns-label')) {
                if (el.scrollWidth > el.clientWidth + 1) out.push(el.textContent.trim());
            }
            return out;
        });
        for (const label of labels) problems.push(`Beschriftung abgeschnitten: „${label}"`);

        const card = await page.evaluate(() => {
            const el = document.querySelector('.popup-lasso');
            if (!el) return { da: false };
            const r = el.getBoundingClientRect();
            const brief = el.querySelector('[data-lasso="brief"], [data-lasso="clear"]');
            const br = brief?.getBoundingClientRect();
            const top = br ? document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2) : null;
            return {
                da: true,
                imBild: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
                knopfFrei: !!brief && (brief === top || brief.contains(top)),
                drueber: top ? (top.id || top.className || top.tagName) : null
            };
        });
        if (!card.da) problems.push('Nach dem Zug ist keine Auswahlkarte entstanden.');
        else if (!card.imBild) problems.push('Die Auswahlkarte liegt nicht vollständig im Bild.');
        else if (!card.knopfFrei) problems.push(`Der Knopf auf der Auswahlkarte ist verdeckt von: ${card.drueber}`);

        // Nach dem Aufheben muss sich die Karte wieder schieben lassen.
        const markerX = () => page.evaluate(() => {
            const marker = document.querySelector('.leaflet-marker-icon');
            return marker ? Math.round(marker.getBoundingClientRect().left) : null;
        });
        const before = await markerX();
        await page.evaluate(() => document.querySelector('.popup-lasso [data-lasso="clear"]')?.click());
        await sleep(1200);
        // Dort ansetzen, wo nach dem Aufräumen wirklich Karte liegt – sonst
        // schiebt der Testfinger das wieder hochgefahrene Blatt.
        const grip = await page.evaluate(() => {
            const map = document.getElementById('map');
            const b = map.getBoundingClientRect();
            for (let y = b.top + 40; y < b.bottom - 40; y += 10) {
                const el = document.elementFromPoint(b.left + b.width / 2, y);
                if (el && map.contains(el)) return { x: b.left + b.width / 2, y };
            }
            return null;
        });
        if (grip) {
            await touch('touchStart', grip);
            for (let i = 1; i <= 8; i++) { await touch('touchMove', { x: grip.x + i * 14, y: grip.y + i * 6 }); await sleep(20); }
            await touch('touchEnd', { x: grip.x + 112, y: grip.y + 48 });
            await sleep(1200);
            if (await markerX() === before) problems.push('Die Karte lässt sich nach dem Lasso nicht mehr schieben.');
        } else {
            problems.push('Nach dem Aufheben ist keine freie Kartenfläche mehr erreichbar.');
        }

        // --- Der Rückweg: „diese drei zur Tour" ---
        //
        // Ein Häkchen ist 17 Pixel groß. Ob man es mit dem Daumen trifft und ob
        // der Knopf danach wirklich die angehakten meint, zeigt nur ein echter
        // Finger – am Bildschirm, nicht im Zustandsobjekt.
        await page.evaluate(() => document.querySelector('[data-depth="profi"]')?.click());
        await sleep(1500);
        await page.locator('#btn-lasso').tap({ timeout: 8000 }).catch(() => problems.push('Der Lasso-Knopf ließ sich im Profi-Modus nicht antippen.'));
        await sleep(700);
        await zieheFlaeche();

        const vorher = await page.evaluate(() => ({
            haken: document.querySelectorAll('.popup-lasso [data-pick]').length,
            knopf: document.querySelector('.popup-lasso [data-lasso="tour"]')?.textContent?.trim() || null
        }));
        if (vorher.haken === 0) {
            problems.push('Die Auswahlkarte trägt im Profi-Modus keine Häkchen.');
        } else if (vorher.knopf !== '🚩 Alle zur Tour') {
            problems.push(`Ohne Häkchen heißt der Tour-Knopf „${vorher.knopf}" statt „🚩 Alle zur Tour".`);
        } else {
            // Zwei Zeilen antippen – auf das Etikett, nicht auf das Kästchen:
            // So trifft ein Daumen, und genau dafür ist die Trefferfläche da.
            const zuTippen = Math.min(2, vorher.haken);
            for (let i = 0; i < zuTippen; i++) {
                await page.locator('.popup-lasso .popup-pick label').nth(i)
                    .tap({ timeout: 5000 })
                    .catch(() => problems.push(`Zeile ${i + 1} der Auswahlkarte ließ sich nicht antippen.`));
                await sleep(350);
            }
            const nachHaken = await page.evaluate(() => ({
                gesetzt: document.querySelectorAll('.popup-lasso [data-pick]:checked').length,
                knopf: document.querySelector('.popup-lasso [data-lasso="tour"]')?.textContent?.trim() || null
            }));
            if (nachHaken.gesetzt !== zuTippen) {
                problems.push(`Nach ${zuTippen} Tippern sind ${nachHaken.gesetzt} Häkchen gesetzt – die Trefferfläche stimmt nicht.`);
            }
            if (nachHaken.knopf !== `🚩 ${zuTippen} zur Tour`) {
                problems.push(`Mit ${zuTippen} Häkchen heißt der Knopf „${nachHaken.knopf}" statt „🚩 ${zuTippen} zur Tour".`);
            }

            await page.locator('.popup-lasso [data-lasso="tour"]').tap({ timeout: 5000 })
                .catch(() => problems.push('Der Tour-Knopf auf der Auswahlkarte ließ sich nicht antippen.'));
            await sleep(900);
            const danach = await page.evaluate(() => ({
                karteDa: !!document.querySelector('.popup-lasso'),
                inTour: document.querySelectorAll('.popup-lasso .popup-pick-done').length,
                knopf: document.querySelector('.popup-lasso [data-lasso="tour"]')?.textContent?.trim() || null,
                stopps: document.querySelectorAll('#tour-stops li, #tour-stops .stop-card').length
            }));
            if (!danach.karteDa) problems.push('Nach „zur Tour" ist die Auswahl verschwunden – man kann nicht zweimal anhaken.');
            if (danach.inTour < zuTippen) problems.push(`Übernommene Kunden stehen nicht als „in Tour" in der Liste (${danach.inTour} von ${zuTippen}).`);
            if (danach.knopf !== '🚩 Alle zur Tour') problems.push(`Nach der Übernahme heißt der Knopf „${danach.knopf}" – die Häkchen wurden nicht zurückgesetzt.`);
        }
    }

    await context.close();
    return problems;
}

let chromium;
try {
    ({ chromium } = await import('playwright'));
} catch {
    console.error('Playwright fehlt. Einmalig einrichten:\n  npm i -D playwright && npx playwright install chromium');
    process.exit(2);
}

const port = await freePort();
const server = await startPreview(port);
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
let total = 0;

try {
    for (const format of FORMATS) {
        console.log(`\n=== ${format.name} (${format.viewport.width}x${format.viewport.height}, echter Touch) ===`);
        const problems = await runFormat(browser, format, `http://localhost:${port}/`);
        total += problems.length;
        if (problems.length === 0) console.log('  alles sauber');
        else for (const problem of problems) console.log(`  BEFUND: ${problem}`);
    }
} finally {
    await browser.close();
    server.kill();
}

console.log(`\n${total === 0 ? 'Keine Befunde.' : `${total} Befund${total === 1 ? '' : 'e'}.`}`);
process.exit(total ? 1 : 0);
