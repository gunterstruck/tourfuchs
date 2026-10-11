#!/usr/bin/env node
/**
 * Bildvergleich (Release 17.0b) – vorher gegen nachher, Pixel für Pixel.
 *
 * Baut den Vergleichsstand (Standard: origin/main) in einer Arbeitskopie,
 * öffnet ihn und den aktuellen Build (dist/) nebeneinander mit denselben
 * Beispieldaten und vergleicht feste Ansichten – hell und dunkel, Desktop und
 * Handy. Beide Stände laufen auf derselben Maschine im selben Moment: Schrift,
 * Kantenglättung und Datum sind gleich, ein Unterschied kommt aus dem Code.
 *
 * Kartenkacheln aus dem Netz werden durch eine feste graue Kachel ersetzt,
 * jeder andere fremde Abruf wird blockiert – das Bild hängt nicht vom Netz ab.
 *
 *   npm run build && npm run visual-check                 # gegen origin/main
 *   npm run visual-check -- --ref <commit|branch>          # gegen einen anderen Stand
 *   npm run visual-check -- --only desktop-hell            # nur eine Variante
 *
 * Abweichende Ansichten landen als Bild (vorher | nachher | Unterschied) in
 * tmp/visual/. Für Umbau-PRs (Release 17) muss das Ergebnis lauten: keine
 * Abweichung.
 */
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { crc32, deflateSync } from 'node:zlib';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const TIMEOUT = 30_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const arg = (name, fallback) => {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : fallback;
};
const REF = arg('--ref', 'origin/main');
const ONLY = arg('--only', '');
const OUT = resolve(ROOT, 'tmp/visual');
const CONCURRENCY = Number(arg('--parallel', '3'));
if (!Number.isInteger(CONCURRENCY) || CONCURRENCY < 1) {
    console.error('--parallel braucht eine ganze Zahl ab 1.');
    process.exit(2);
}

// Eine graue 256er-Kachel (PNG) statt echter Kartenkacheln – hier erzeugt.
function grayTile(size = 256, value = 221) {
    const chunk = (type, data) => {
        const head = Buffer.alloc(8);
        head.writeUInt32BE(data.length, 0);
        head.write(type, 4, 'ascii');
        const crc = Buffer.alloc(4);
        crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])) >>> 0, 0);
        return Buffer.concat([head, data, crc]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8; ihdr[9] = 0; // 8 Bit, Graustufen
    const raw = Buffer.alloc((size + 1) * size, value);
    for (let y = 0; y < size; y++) raw[y * (size + 1)] = 0; // Filter „keiner" je Zeile
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))
    ]);
}
const GRAY_TILE = grayTile();

function freePort() {
    return new Promise((done, fail) => {
        const server = createServer();
        server.on('error', fail);
        server.listen(0, () => { const { port } = server.address(); server.close(() => done(port)); });
    });
}

async function startPreview(cwd, port) {
    const child = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { cwd, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    child.stopAll = () => { try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill(); } };
    for (let attempt = 0; attempt < 60; attempt++) {
        await sleep(500);
        try { if ((await fetch(`http://localhost:${port}/`)).ok) return child; } catch { /* noch nicht bereit */ }
    }
    child.stopAll();
    throw new Error(`Vorschau-Server in ${cwd} ist nicht gestartet.`);
}

const removeWorktree = (dir) => {
    try { execFileSync('git', ['worktree', 'remove', '--force', dir], { cwd: ROOT, stdio: 'ignore' }); } catch { rmSync(dir, { recursive: true, force: true }); }
};

/**
 * Vergleichsstand in einer Arbeitskopie bauen. Sie bleibt als Zwischenspeicher
 * für den nächsten Lauf liegen; ältere Arbeitskopien werden aufgeräumt.
 * Gleiche Paketliste → die Pakete dieses Stands werden mitbenutzt. Andere
 * Paketliste (z. B. ein PR hebt Leaflet an) → der Vergleichsstand bekommt seine
 * eigenen Pakete, sonst sähen beide Bilder gleich aus und die Wirkung des
 * Updates bliebe unsichtbar.
 */
function buildReference(ref) {
    const sha = execFileSync('git', ['rev-parse', ref], { cwd: ROOT }).toString().trim();
    const dir = join(tmpdir(), `tourfuchs-visual-${sha.slice(0, 12)}`);
    const stale = execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: ROOT }).toString()
        .split('\n').filter((line) => line.startsWith('worktree ')).map((line) => line.slice(9))
        .filter((path) => /[\\/]tourfuchs-visual-[0-9a-f]{12}$/.test(path) && path !== dir);
    stale.forEach(removeWorktree);
    if (!existsSync(join(dir, 'dist/index.html'))) {
        if (existsSync(dir)) removeWorktree(dir);
        execFileSync('git', ['worktree', 'add', '--detach', dir, sha], { cwd: ROOT, stdio: 'ignore' });
        const lock = (base) => { try { return readFileSync(join(base, 'package-lock.json'), 'utf8'); } catch { return ''; } };
        if (lock(dir) === lock(ROOT)) {
            symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'));
        } else {
            console.log(`Paketliste von ${ref} weicht ab – installiere ihre Pakete …`);
            execFileSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: dir, stdio: 'ignore' });
        }
        console.log(`Baue Vergleichsstand ${ref} (${sha.slice(0, 7)}) …`);
        execFileSync('npx', ['vite', 'build'], { cwd: dir, stdio: 'ignore' });
    }
    return { dir, sha };
}

const VARIANTS = [
    { name: 'desktop-hell', viewport: { width: 1440, height: 900 }, mobile: false, theme: 'light' },
    { name: 'desktop-dunkel', viewport: { width: 1440, height: 900 }, mobile: false, theme: 'dark' },
    { name: 'handy-hell', viewport: { width: 390, height: 844 }, mobile: true, theme: 'light' },
    { name: 'handy-dunkel', viewport: { width: 390, height: 844 }, mobile: true, theme: 'dark' }
].filter((v) => !ONLY || v.name === ONLY);
if (!VARIANTS.length) {
    console.error(`--only ${ONLY}: unbekannte Variante.`);
    process.exit(2);
}

const closeDialogs = (page) => page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));

/** Feste Ansichten. Jede beginnt mit frisch geladener App. */
const VIEWS = [
    { name: 'start', go: async () => {} },
    { name: 'daten', go: (page, v) => openTab(page, v, 'gebietsplanung', 'daten') },
    { name: 'filter', go: (page, v) => openTab(page, v, 'gebietsplanung', 'team') },
    { name: 'gebiete', go: (page, v) => openTab(page, v, 'gebietsplanung', 'gebiete') },
    { name: 'tour', go: (page, v) => openTab(page, v, 'aussendienst', 'tour') },
    {
        name: 'kundenkachel',
        go: async (page) => {
            await page.fill('#global-search', 'Bäckerei');
            await page.waitForSelector('#search-results .result-row[data-id]', { timeout: TIMEOUT });
            await page.evaluate(() => document.querySelector('#search-results .result-row[data-id]').click());
            await page.waitForSelector('.leaflet-popup .popup-customer', { timeout: TIMEOUT });
            await page.fill('#global-search', '');
            await sleep(1500);
        }
    },
    {
        name: 'lichterkarte',
        go: async (page) => {
            await page.evaluate(() => {
                const select = document.getElementById('basemap-select');
                const lights = [...select.options].find((o) => /licht/i.test(o.textContent));
                select.value = lights.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
            });
            await sleep(1500);
        }
    },
    {
        name: 'eigene-daten',
        go: async (page) => {
            await page.evaluate(() => document.getElementById('own-data-dialog').showModal());
            await sleep(400);
        }
    }
];

/** Modus wählen (falls nicht aktiv) und Reiter öffnen – am Handy ohne Reiterleiste per Klick im DOM. */
async function openTab(page, variant, mode, tab) {
    await page.evaluate((m) => {
        const button = document.querySelector(`.mode-btn[data-mode="${m}"]`);
        if (button && !button.classList.contains('active')) button.click();
    }, mode);
    await sleep(500);
    await page.evaluate((id) => document.querySelector(`.tab-button[data-tab="${id}"]`)?.click(), tab);
    await sleep(700);
}

async function openApp(browser, baseUrl, variant) {
    const context = await browser.newContext({
        viewport: variant.viewport, isMobile: variant.mobile, hasTouch: variant.mobile, deviceScaleFactor: 1,
        locale: 'de-DE', timezoneId: 'Europe/Berlin', reducedMotion: 'reduce', colorScheme: variant.theme
    });
    await context.addInitScript((theme) => {
        try {
            sessionStorage.setItem('tf_demo_welcome_ack', '1');
            localStorage.setItem('tf_theme', theme);
            // Einmalige, zeitgesteuerte Handy-Vorschau-Vorführung (bzw. ihr Hinweis)
            // gilt als gesehen – sie erschiene sonst zufällig im Bild.
            localStorage.setItem('tf_mobile_preview_teaser_seen', '1');
        } catch { /* egal */ }
        // Entdeck-Hinweis an Kundenstapel und -karten: Er erscheint bei
        // Beispieldaten nach jedem Zoomen für 4,6 s – je nach Takt mal im Bild,
        // mal nicht. Gehört nicht in ein Standbild; die App setzt ihn, das
        // Werkzeug nimmt ihn sofort wieder ab.
        new MutationObserver((changes) => changes.forEach(({ target }) => {
            if (target.classList?.contains('is-discovery')) target.classList.remove('is-discovery');
        })).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }, variant.theme);
    const origin = new URL(baseUrl).origin;
    await context.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith(origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
        if (/tile\.openstreetmap\.org|arcgisonline\.com/.test(url)) return route.fulfill({ status: 200, contentType: 'image/png', body: GRAY_TILE });
        return route.abort();
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl}?nowelcome=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.getElementById('demo-banner')?.hidden === false, null, { timeout: TIMEOUT });
    await closeDialogs(page);
    await page.addStyleTag({ content: `
        *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
        #toasts, .customer-marker-discovery { display: none !important; }
    ` });
    await sleep(1500);
    return { context, page };
}

async function capture(browser, baseUrl, variant, view) {
    const { context, page } = await openApp(browser, baseUrl, variant);
    try {
        await view.go(page, variant);
        await page.evaluate(() => document.fonts?.ready);
        // Ruhe abwarten: erst wenn zwei Aufnahmen hintereinander gleich sind
        // (Karte fertig geschwenkt, Kacheln gezeichnet), zählt das Bild.
        let previous = await page.screenshot({ animations: 'disabled' });
        for (let attempt = 0; attempt < 10; attempt++) {
            await sleep(400);
            const current = await page.screenshot({ animations: 'disabled' });
            if (current.equals(previous)) return current;
            previous = current;
        }
        return previous;
    } finally {
        await context.close();
    }
}

/** Zwei PNGs im Browser vergleichen – ohne zusätzliche Bibliothek. */
async function compare(page, before, after) {
    return page.evaluate(async ([a, b]) => {
        const load = (b64) => new Promise((ok, fail) => {
            const img = new Image();
            img.onload = () => ok(img);
            img.onerror = fail;
            img.src = `data:image/png;base64,${b64}`;
        });
        const [ia, ib] = await Promise.all([load(a), load(b)]);
        if (ia.width !== ib.width || ia.height !== ib.height) return { differing: -1, total: 0 };
        const { width, height } = ia;
        const read = (img) => {
            const c = document.createElement('canvas');
            c.width = width; c.height = height;
            const ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0);
            return ctx.getImageData(0, 0, width, height);
        };
        const da = read(ia);
        const db = read(ib);
        const out = document.createElement('canvas');
        out.width = width * 3; out.height = height;
        const octx = out.getContext('2d');
        octx.drawImage(ia, 0, 0);
        octx.drawImage(ib, width, 0);
        const diff = octx.createImageData(width, height);
        let differing = 0;
        for (let i = 0; i < da.data.length; i += 4) {
            const delta = Math.max(Math.abs(da.data[i] - db.data[i]), Math.abs(da.data[i + 1] - db.data[i + 1]), Math.abs(da.data[i + 2] - db.data[i + 2]));
            const grey = Math.round((da.data[i] + da.data[i + 1] + da.data[i + 2]) / 3 * 0.3 + 170);
            if (delta > 0) {
                differing += 1;
                diff.data.set([255, 0, 64, 255], i);
            } else {
                diff.data.set([grey, grey, grey, 255], i);
            }
        }
        octx.putImageData(diff, width * 2, 0);
        return { differing, total: width * height, image: differing ? out.toDataURL('image/png').split(',')[1] : null };
    }, [before.toString('base64'), after.toString('base64')]);
}

let chromium;
try {
    ({ chromium } = await import('playwright'));
} catch {
    console.error('Playwright fehlt. Einmalig: npm i --no-save playwright && npx playwright install chromium');
    process.exit(2);
}
if (!existsSync(resolve(ROOT, 'dist/index.html'))) {
    console.error('dist/ fehlt – vorher `npm run build` ausführen.');
    process.exit(2);
}

const reference = buildReference(REF);
const servers = [];
const stopAll = () => servers.forEach((s) => s.stopAll());
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { stopAll(); process.exit(130); });
let browser;
let differences = 0;
try {
    const [portBefore, portAfter] = [await freePort(), await freePort()];
    servers.push(await startPreview(reference.dir, portBefore));
    servers.push(await startPreview(ROOT, portAfter));
    // Feste Rasterung: Unter Last kachelt Chromium sonst unterschiedlich, und
    // Weichzeichner (backdrop-filter) liefern an Kanten abweichende Pixel.
    browser = await chromium.launch({
        ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}),
        args: ['--disable-partial-raster', '--disable-gpu-rasterization', '--num-raster-threads=1', '--disable-checker-imaging',
            '--disable-threaded-animation', '--disable-threaded-scrolling', '--force-color-profile=srgb']
    });
    const scratch = await browser.newPage();
    mkdirSync(OUT, { recursive: true });
    console.log(`Vergleich: ${REF} (${reference.sha.slice(0, 7)}) gegen aktuellen Build`);
    // Abweichung? Bis zu fünfmal beide Stände neu aufnehmen. Gleich ist die
    // Ansicht, sobald irgendein Vorher- und ein Nachher-Bild pixelgleich sind:
    // Eine echte Code-Änderung ist bei jeder Aufnahme dieselbe und fällt nie
    // durch – zeitabhängiges Rauschen (Kartenanimation, Kantenglättung) schon.
    const checkView = async (variant, view) => {
        const label = `${variant.name} · ${view.name}`;
        try {
            const befores = [await capture(browser, `http://localhost:${portBefore}/`, variant, view)];
            const afters = [await capture(browser, `http://localhost:${portAfter}/`, variant, view)];
            const same = () => befores.some((b) => afters.some((a) => a.equals(b)));
            for (let retry = 0; retry < 5 && !same(); retry++) {
                befores.push(await capture(browser, `http://localhost:${portBefore}/`, variant, view));
                afters.push(await capture(browser, `http://localhost:${portAfter}/`, variant, view));
            }
            if (same()) return `  ✓ ${label}${befores.length > 1 ? ` (nach ${befores.length - 1} Wiederholung(en) gleich)` : ''}`;
            const result = await compare(scratch, befores[0], afters[0]);
            if (result.differing === 0) return `  ✓ ${label}`;
            differences += 1;
            const file = resolve(OUT, `${variant.name}-${view.name}.png`);
            if (result.image) writeFileSync(file, Buffer.from(result.image, 'base64'));
            return result.differing < 0
                ? `  ✗ ${label}: Bildgröße verschieden`
                : `  ✗ ${label}: ${result.differing} Pixel (${(result.differing / result.total * 100).toFixed(3)} %) – ${file}`;
        } catch (error) {
            differences += 1;
            return `  ✗ ${label}: ${String(error.message || error).split('\n')[0]}`;
        }
    };
    // Mehrere Ansichten gleichzeitig – jede in eigenen, frischen Fenstern.
    const tasks = VARIANTS.flatMap((variant) => VIEWS.map((view) => ({ variant, view })));
    const results = new Array(tasks.length);
    let next = 0;
    const worker = async () => {
        while (next < tasks.length) {
            const i = next++;
            results[i] = await checkView(tasks[i].variant, tasks[i].view);
            console.log(results[i]);
        }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    // Kein Grün ohne Vergleich: Jede Ansicht muss ein Ergebnis haben.
    const missing = results.filter((r) => !r).length + (tasks.length ? 0 : 1);
    if (missing) {
        differences += missing;
        console.log(`  ✗ ${missing} Ansicht(en) nicht verglichen`);
    }
} finally {
    await browser?.close();
    stopAll();
}
console.log(differences ? `\n${differences} Ansicht(en) weichen ab.` : '\nBildvergleich: keine Abweichung.');
process.exit(differences ? 1 : 0);
