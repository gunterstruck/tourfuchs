/**
 * Prüfstrecke für die zwei Gesichter.
 *
 * Warum es dieses Werkzeug zusätzlich zu `demo-check` und `touch-check` gibt:
 * Beide fahren Abläufe durch und prüfen, ob Klicks treffen und Gesten wirken.
 * Keines von beiden liest, **welches Gesicht** die App gerade zeigt – und genau
 * das war über Tage falsch, ohne dass es jemandem auffiel.
 *
 * Der Anlass ist ein Galaxy Tab S6 Lite. Hochkant (~800 CSS-px) lieferte die
 * App einen Zwitter: Blatt-Geometrie und Handy-Checkliste, aber Desktop-
 * Kartenpopups, Desktop-Tourpanel und offenes Cockpit. Vier unabhängige
 * Breitenschwellen, von denen einige griffen und andere nicht. Unit-Tests sahen
 * das nicht, weil sie Quelltext prüfen, nicht gerechnetes Layout.
 *
 * Hier wird deshalb die **gebaute App im echten Browser** an echten
 * Gerätemaßen befragt: Welche Reiter sind sichtbar? Liegt das Panel unten oder
 * seitlich? Ist das Cockpit erreichbar? Und vor allem:
 *
 *   **Antwortet ein Tablet hochkant exakt wie ein Handy?**
 *
 * Das ist das Versprechen aus Version 3.2 („kein Unterschied"), und es ist die
 * einzige Frage, die dieses Werkzeug wirklich beantworten muss. Jede Abweichung
 * zwischen der Hochkant-Spalte und der Handy-Spalte ist ein Fehler.
 *
 * Ausgeführt wird gegen `dist/` – also vorher `npm run build`.
 *
 * Aufruf:
 *   npm run face-check
 *   npm run face-check -- --format=tablet-hochkant
 *
 * Voraussetzung wie bei demo-check (bewusst nicht in package.json, damit ein
 * normales `npm install` schlank bleibt):
 *   npm i -D playwright && npx playwright install chromium
 *
 * In Umgebungen mit vorhandenem Browser:
 *   PLAYWRIGHT_CHROMIUM_PATH=/pfad/zu/chrome npm run face-check
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

/**
 * Echte Geräte in CSS-Pixeln. `erwartet` ist das Gesicht, das laut
 * `src/core/viewport.js` gelten muss.
 */
const FORMATS = [
    { name: 'smartphone',        viewport: { width: 390, height: 844 },  erwartet: 'phone',   referenz: true },
    { name: 'tablet-hochkant',   viewport: { width: 800, height: 1333 }, erwartet: 'phone' },  // Tab S6 Lite
    { name: 'tablet-quer',       viewport: { width: 1333, height: 800 }, erwartet: 'desktop' },
    { name: 'ipad11-hochkant',   viewport: { width: 834, height: 1194 }, erwartet: 'phone' },
    { name: 'ipad129-hochkant',  viewport: { width: 1024, height: 1366 }, erwartet: 'phone' },
    { name: 'desktop',           viewport: { width: 1440, height: 900 }, erwartet: 'desktop' }
];

/**
 * Was am Gesicht abgelesen wird. Bewusst Zustand, nicht Aussehen: Pixelmaße
 * und Schriftgrößen gehören ans Auge, diese Fragen gehören an eine Maschine.
 */
const PROBE = `(() => {
    const sichtbar = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return 'fehlt';
        if (el.hidden) return 'aus';
        const cs = getComputedStyle(el);
        return (cs.display === 'none' || cs.visibility === 'hidden') ? 'aus' : 'an';
    };
    const sidebar = document.getElementById('sidebar');
    const rect = sidebar ? sidebar.getBoundingClientRect() : null;
    return {
        // Blatt-Geometrie heißt: Panel über die volle Fensterbreite.
        panelUnten: rect ? Math.round(rect.width) >= window.innerWidth - 4 : null,
        blattOffen: document.body.classList.contains('sheet-open'),
        reiter: [...document.querySelectorAll('.tab-button')].filter((b) => !b.hidden)
            .map((b) => b.dataset.tab).sort().join(','),
        aktiverReiter: (document.querySelector('.tab-button.active') || {}).dataset
            ? document.querySelector('.tab-button.active').dataset.tab : null,
        modusSchalter: [...document.querySelectorAll('.mode-btn')]
            .filter((b) => !b.hidden && getComputedStyle(b).display !== 'none')
            .map((b) => b.dataset.mode).sort().join(','),
        tiefeProfi: document.body.classList.contains('depth-profi'),
        cockpitKnopf: sichtbar('#btn-cockpit'),
        panelZoom: sichtbar('.panel-zoom'),
        seitenleisteZiehen: sichtbar('.sidebar-resize')
    };
})()`;

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

/** Das Gesicht, das die App selbst annimmt – gelesen aus ihrem eigenen Modul. */
async function faceOf(page) {
    return page.evaluate(() => {
        // Dieselbe Zeichenkette wie PHONE_FACE_MEDIA; sie steht im gebauten
        // Bündel und lässt sich von außen nicht importieren.
        const media = '(max-width: 768px), (max-width: 1200px) and (orientation: portrait),'
            + ' (max-width: 900px) and (max-height: 520px)';
        return window.matchMedia(media).matches ? 'phone' : 'desktop';
    });
}

async function inspect(browser, format, baseUrl) {
    const context = await browser.newContext({
        viewport: format.viewport,
        hasTouch: format.erwartet === 'phone',
        deviceScaleFactor: 1
    });
    const page = await context.newPage();
    const fehler = [];
    page.on('pageerror', (error) => fehler.push(String(error)));

    // `networkidle` wird nie erreicht: Die Karte lädt fortlaufend Kacheln.
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#sidebar', { timeout: 30000 });
    await sleep(4000);

    const face = await faceOf(page);
    const zustand = await page.evaluate(PROBE);
    await context.close();
    return { ...format, face, zustand, fehler };
}

function parseArgs(argv) {
    const wanted = [];
    for (const arg of argv) {
        const [key, value] = arg.replace(/^--/, '').split('=');
        if (key === 'format' && value) wanted.push(value);
    }
    return wanted.length ? FORMATS.filter((f) => wanted.includes(f.name)) : FORMATS;
}

const formats = parseArgs(process.argv.slice(2));
const { chromium } = await import('playwright');
const port = await freePort();
const server = await startPreview(port);
const baseUrl = `http://localhost:${port}/`;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
const browser = await chromium.launch(executablePath ? { executablePath } : {});

const ergebnisse = [];
try {
    for (const format of formats) {
        const result = await inspect(browser, format, baseUrl);
        ergebnisse.push(result);
        const { width, height } = format.viewport;
        const ok = result.face === format.erwartet ? '✓' : '✗';
        console.log(`${ok} ${format.name.padEnd(18)} ${String(width).padStart(4)}x${String(height).padEnd(4)} -> ${result.face} (erwartet ${format.erwartet})`);
        for (const [key, value] of Object.entries(result.zustand)) {
            console.log(`      ${key.padEnd(20)} ${JSON.stringify(value)}`);
        }
    }
} finally {
    await browser.close();
    server.kill();
}

// ---- Auswertung ----

let fehlerhaft = 0;

for (const r of ergebnisse) {
    if (r.face !== r.erwartet) {
        console.log(`\n✗ ${r.name}: Gesicht ${r.face}, erwartet ${r.erwartet}`);
        fehlerhaft++;
    }
    if (r.fehler.length) {
        console.log(`\n✗ ${r.name}: ${r.fehler.length} JavaScript-Fehler`);
        r.fehler.slice(0, 3).forEach((e) => console.log(`      ${e}`));
        fehlerhaft++;
    }
}

/**
 * Die eigentliche Prüfung: Jedes Touransicht-Format muss dieselben Antworten
 * geben wie das Smartphone. „Kein Unterschied" ist das Versprechen, und hier
 * wird es nachgezählt statt behauptet.
 */
const referenz = ergebnisse.find((r) => r.referenz);
if (referenz) {
    for (const r of ergebnisse) {
        if (r === referenz || r.erwartet !== 'phone') continue;
        const abweichungen = Object.keys(referenz.zustand).filter(
            (key) => JSON.stringify(r.zustand[key]) !== JSON.stringify(referenz.zustand[key])
        );
        if (abweichungen.length) {
            console.log(`\n✗ ${r.name} weicht vom Smartphone ab:`);
            for (const key of abweichungen) {
                console.log(`      ${key}: ${JSON.stringify(r.zustand[key])} statt ${JSON.stringify(referenz.zustand[key])}`);
            }
            fehlerhaft++;
        } else {
            console.log(`\n✓ ${r.name} antwortet in allen ${Object.keys(referenz.zustand).length} Punkten wie das Smartphone.`);
        }
    }
} else {
    console.log('\n(Ohne das Format „smartphone" entfällt der Vergleich – es ist der Maßstab.)');
}

console.log(fehlerhaft === 0
    ? '\nAlle Formate zeigen das erwartete Gesicht.'
    : `\n${fehlerhaft} Befund(e).`);
process.exit(fehlerhaft === 0 ? 0 : 1);
