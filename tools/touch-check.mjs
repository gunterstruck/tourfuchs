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
        await touch('touchEnd', ring[ring.length - 1]);
        if (drawn < 5) problems.push(`Die Spur folgte dem Finger nicht (${drawn} Punkte).`);
        await sleep(1300);

        const bar = await page.evaluate(COVER_PROBE, 'lasso-bar');
        if (!bar.da) problems.push('Nach dem Zug ist keine Auswahl entstanden.');
        else if (!bar.frei) problems.push(`Der Auswahlstreifen ist verdeckt von: ${bar.drueber}`);
        else if (!bar.imBild) problems.push('Der Auswahlstreifen liegt außerhalb des Bildes.');

        // Nach dem Aufheben muss sich die Karte wieder schieben lassen.
        const markerX = () => page.evaluate(() => {
            const marker = document.querySelector('.leaflet-marker-icon');
            return marker ? Math.round(marker.getBoundingClientRect().left) : null;
        });
        const before = await markerX();
        await page.evaluate(() => document.querySelector('#lasso-bar .lasso-clear')?.click());
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
