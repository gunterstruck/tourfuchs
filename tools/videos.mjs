/**
 * Alle Live-Demos als Videos – für Präsentationen (Teams, PowerPoint) und
 * Social Media.
 *
 * Wer TourFuchs in einer Besprechung zeigt, kann nicht erwarten, dass die
 * Zuschauer die App öffnen. Dieses Werkzeug nimmt jede Live-Demo so auf, wie
 * sie in der App läuft – mit den Beispieldaten, ohne Steuerleiste, mit Vor-
 * und Abspann und der Film-Musik darunter – und legt sie einzeln als MP4
 * (H.264/AAC) ab. Das spielt jedes Teams, PowerPoint, LinkedIn und Handy ab.
 *
 * Ergebnis in `videos/` (nicht im Git – Videos blähen das Projekt auf):
 *   tourfuchs-<demo>-desktop.mp4   1920×1080
 *   tourfuchs-<demo>-handy.mp4     Hochformat, 1080 breit
 *
 * Aufruf:
 *   npm run build && npm run videos
 *   npm run videos -- --format=desktop            (nur Desktop)
 *   npm run videos -- --format=handy --demo=tour  (ein Film, Handy)
 *
 * Voraussetzungen (bewusst nicht in package.json):
 *   npm i -D playwright ffmpeg-static && npx playwright install chromium
 * Ist bereits ein Chromium da, genügt PLAYWRIGHT_CHROMIUM_PATH=/pfad/zu/chrome;
 * ein systemweites ffmpeg mit libx264 über FFMPEG_PATH.
 *
 * Musik: „Tropical Island House 2024" von Sascha Ende (ende.app), CC BY 4.0 –
 * die Namensnennung steht im Abspann jedes Videos.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const FORMATE = {
    desktop: { name: 'desktop', viewport: { width: 1920, height: 1080 }, scale: 1, hasTouch: false, isMobile: false },
    // Handy: 390 × 844 CSS-Pixel wie ein übliches Smartphone, doppelt so
    // scharf aufgenommen und auf 1080 Pixel Breite gebracht.
    handy: { name: 'handy', viewport: { width: 390, height: 844 }, scale: 2, hasTouch: true, isMobile: true }
};
const MUSIK = resolve('public', 'audio', 'tropical-island-house-2024.mp3');
const MUSIK_LAUTSTAERKE = 0.32;

const KARTEN_CSS = `
#film-card {
    position: fixed; inset: 0; z-index: 2147483647;
    display: grid; place-content: center; justify-items: center;
    gap: 2.2vh; padding: 8vw; text-align: center;
    background: #0d1513; color: #f2f7f5;
    font-family: "Segoe UI", system-ui, sans-serif;
    opacity: 0; transition: opacity .5s ease;
}
#film-card[data-on="1"] { opacity: 1; }
#film-card .kicker { font-size: 1.8vh; letter-spacing: .22em; text-transform: uppercase; color: #3bc7b4; font-weight: 600; }
#film-card h1 { font-size: 5vh; line-height: 1.15; margin: 0; font-weight: 650; letter-spacing: -.02em; max-width: 22ch; text-wrap: balance; }
#film-card p { font-size: 2.4vh; margin: 0; color: #a2b5b0; max-width: 36ch; text-wrap: balance; }
#film-card .fox { font-size: 8vh; line-height: 1; }
#film-card .url { font-size: 2.8vh; color: #3bc7b4; font-weight: 600; }
#film-card .fine { font-size: 1.6vh; color: #6b807b; }
body.film-karte dialog { opacity: 0 !important; }
/* Die Steuerleiste gehört ins Live-Erlebnis, nicht ins Video. */
.sc-toolbar { display: none !important; }
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

function freePort() {
    return new Promise((resolve_, reject) => {
        const server = createServer();
        server.on('error', reject);
        server.listen(0, () => {
            const { port } = server.address();
            server.close(() => resolve_(port));
        });
    });
}

async function startPreview(port) {
    const viteCli = resolve('node_modules', 'vite', 'bin', 'vite.js');
    const child = spawn(process.execPath, [viteCli, 'preview', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
    for (let i = 0; i < 40; i++) {
        await sleep(500);
        try { if ((await fetch(`http://localhost:${port}/`)).ok) return child; } catch { /* noch nicht bereit */ }
    }
    child.kill();
    throw new Error('Vorschau-Server ist nicht gestartet. Vorher `npm run build` ausführen?');
}

function run(bin, args) {
    return new Promise((resolve_, reject) => {
        const child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        child.stderr.on('data', (chunk) => { stderr += chunk; });
        child.on('close', (code) => (code === 0 ? resolve_() : reject(new Error(stderr.slice(-800)))));
    });
}

async function zeigeKarte(page, html) {
    await page.evaluate((inner) => {
        let card = document.getElementById('film-card');
        if (!card) {
            card = document.createElement('div');
            card.id = 'film-card';
            document.body.appendChild(card);
        }
        card.innerHTML = inner;
        void card.offsetWidth;
        card.dataset.on = '1';
        document.body.classList.add('film-karte');
    }, html);
    await sleep(600);
}

async function blendeKarteAus(page) {
    await page.evaluate(() => {
        const card = document.getElementById('film-card');
        if (card) card.dataset.on = '0';
    });
    await sleep(700);
    await page.evaluate(() => document.body.classList.remove('film-karte'));
}

const titelKarte = (story) => `<span class="kicker">TourFuchs · Live-Demo</span>
    <span class="fox">${escapeHtml(story.icon)}</span>
    <h1>${escapeHtml(story.title)}</h1>
    <p>${escapeHtml(story.blurb)}</p>`;

const ABSPANN = `<span class="fox">🦊</span>
    <h1>TourFuchs – Kunden, Touren, Gebiete. Auf einer Karte.</h1>
    <p class="url">tourfuchs.vercel.app</p>
    <p class="fine">Alle Kunden in diesem Film sind Beispieldaten und erfunden.<br>
    Musik: „Tropical Island House 2024" von Sascha Ende (ende.app), CC BY 4.0</p>`;

/** Einen Film aufnehmen und als MP4 ablegen. */
async function nimmAuf({ browser, port, format, storyId, ffmpeg, zielOrdner }) {
    const rohOrdner = resolve('tmp', 'videos-roh', `${storyId}-${format.name}`);
    rmSync(rohOrdner, { recursive: true, force: true });
    mkdirSync(rohOrdner, { recursive: true });
    const size = { width: format.viewport.width * format.scale, height: format.viewport.height * format.scale };
    const context = await browser.newContext({
        viewport: format.viewport,
        deviceScaleFactor: format.scale,
        hasTouch: format.hasTouch,
        isMobile: format.isMobile,
        locale: 'de-DE',
        timezoneId: 'Europe/Berlin',
        reducedMotion: 'no-preference',
        recordVideo: { dir: rohOrdner, size }
    });
    // Normales Tempo, egal was auf diesem Rechner zuletzt eingestellt war.
    await context.addInitScript(() => { try { localStorage.removeItem('tf_showcase_tempo'); } catch { /* egal */ } });
    const page = await context.newPage();
    const aufnahmeStart = Date.now();
    const fehler = [];
    page.on('pageerror', (e) => fehler.push(String(e).slice(0, 300)));
    let filmStart = 0;
    let filmEnde = 0;
    let ergebnis = 'FEHLER';
    try {
        await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#map', { timeout: 20000 });
        await page.addStyleTag({ content: KARTEN_CSS });
        // Erst eine leere Karte, dahinter Begrüßung quittieren und die
        // Demo-Auswahl öffnen; Titel und Kurztext kommen aus deren Kachel.
        await zeigeKarte(page, '<span class="kicker">TourFuchs · Live-Demo</span>');
        await page.waitForSelector('#demo-welcome:not([hidden])', { timeout: 30000 }).catch(() => {});
        await page.locator('#btn-demo-welcome-ack').click({ timeout: 3000 }).catch(() => {});
        await sleep(800);
        await page.evaluate(() => {
            (document.getElementById('btn-demo-overview') || document.getElementById('btn-showcase') || document.getElementById('btn-demos-pill'))?.click();
        });
        await page.waitForSelector(`#showcase-dialog .sc-tile[data-story="${storyId}"]`, { timeout: 10000 });
        await zeigeKarte(page, titelKarte(await storyVonKachel(page, storyId)));

        filmStart = Date.now();
        await sleep(3200);                     // Titelkarte stehen lassen
        await page.locator(`#showcase-dialog .sc-tile[data-story="${storyId}"]`).click();
        await blendeKarteAus(page);
        try {
            await page.waitForSelector('#showcase-dialog .sc-outcome-head', { timeout: 300000 });
            ergebnis = await page.locator('#showcase-dialog .sc-outcome-failed').count() ? 'FEHLER' : 'ok';
        } catch { /* Abspann kommt trotzdem */ }
        await page.evaluate(() => document.getElementById('showcase-dialog')?.close());
        await sleep(300);
        await zeigeKarte(page, ABSPANN);
        await sleep(5200);
        filmEnde = Date.now() - filmStart;
    } finally {
        await context.close().catch(() => {});
    }
    const roh = readdirSync(rohOrdner).find((f) => f.endsWith('.webm'));
    if (!roh) throw new Error('Playwright hat keine Aufnahme abgelegt.');

    const ziel = resolve(zielOrdner, `tourfuchs-${storyId}-${format.name}.mp4`);
    const dauer = (filmEnde + 300) / 1000;
    const vorlauf = (filmStart - aufnahmeStart) / 1000;
    // Handy auf 1080 Pixel Breite, Desktop bleibt 1920 × 1080; gerade Maße für H.264.
    const skalieren = format.name === 'handy' ? 'scale=1080:-2:flags=lanczos' : 'scale=1920:1080:flags=lanczos';
    const fadeOut = Math.max(0, dauer - 2.5).toFixed(2);
    await run(ffmpeg, [
        '-y',
        '-ss', vorlauf.toFixed(2), '-i', resolve(rohOrdner, roh),
        '-stream_loop', '-1', '-i', MUSIK,
        '-t', dauer.toFixed(2),
        '-map', '0:v:0', '-map', '1:a:0',
        '-vf', `${skalieren},fps=30,fade=t=in:st=0:d=0.6,fade=t=out:st=${Math.max(0, dauer - 0.8).toFixed(2)}:d=0.8`,
        '-af', `volume=${MUSIK_LAUTSTAERKE},afade=t=in:st=0:d=1.5,afade=t=out:st=${fadeOut}:d=2.5`,
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '160k',
        '-movflags', '+faststart',
        ziel
    ]);
    rmSync(rohOrdner, { recursive: true, force: true });
    return { ziel, ergebnis, sekunden: Math.round(dauer), fehler };
}

/** Titel und Kurztext aus der Kachel der Demo-Auswahl. */
async function storyVonKachel(page, storyId) {
    return page.evaluate((id) => {
        const tile = document.querySelector(`#showcase-dialog .sc-tile[data-story="${id}"]`);
        return {
            icon: tile?.querySelector('.sc-tile-icon')?.textContent?.trim() || '🦊',
            title: tile?.querySelector('.sc-tile-body > b')?.textContent?.trim() || id,
            blurb: tile?.querySelector('.sc-tile-body > span')?.textContent?.trim() || ''
        };
    }, storyId);
}

/** Welche Filme gibt es in diesem Format? Genau die Kacheln der Demo-Auswahl. */
async function filmeImFormat(browser, port, format) {
    const context = await browser.newContext({ viewport: format.viewport, hasTouch: format.hasTouch, isMobile: format.isMobile, locale: 'de-DE' });
    const page = await context.newPage();
    try {
        await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#demo-welcome:not([hidden])', { timeout: 30000 }).catch(() => {});
        await page.locator('#btn-demo-welcome-ack').click({ timeout: 3000 }).catch(() => {});
        await sleep(800);
        await page.evaluate(() => {
            (document.getElementById('btn-demo-overview') || document.getElementById('btn-showcase') || document.getElementById('btn-demos-pill'))?.click();
        });
        await page.waitForSelector('#showcase-dialog .sc-tile', { timeout: 10000 });
        return await page.evaluate(() => [...document.querySelectorAll('#showcase-dialog .sc-tile')].map((t) => t.dataset.story));
    } finally {
        await context.close();
    }
}

// ---- Hauptlauf ------------------------------------------------------------
const args = process.argv.slice(2);
const werte = (name) => args.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.split('=')[1]);
const formate = (werte('format').length ? werte('format') : Object.keys(FORMATE)).map((f) => FORMATE[f]).filter(Boolean);
const gewuenscht = werte('demo');

let chromium;
let ffmpeg;
try {
    ({ chromium } = await import('playwright'));
} catch {
    console.error('Playwright fehlt. Einmalig einrichten:\n  npm i -D playwright && npx playwright install chromium');
    process.exit(2);
}
try {
    ffmpeg = process.env.FFMPEG_PATH || (await import('ffmpeg-static')).default;
} catch {
    ffmpeg = '/opt/homebrew/bin/ffmpeg';
}

const zielOrdner = resolve('videos');
mkdirSync(zielOrdner, { recursive: true });
const port = await freePort();
const server = await startPreview(port);
// `--lang`: Datums- und Zeitfelder deutsch (28.09.2026, 08:00 statt 09/28/2026, 08:00 AM).
const browser = await chromium.launch({
    args: ['--lang=de-DE'],
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {})
});
let code = 0;
try {
    for (const format of formate) {
        const alle = await filmeImFormat(browser, port, format);
        const filme = gewuenscht.length ? alle.filter((id) => gewuenscht.includes(id)) : alle;
        console.log(`\n=== ${format.name}: ${filme.join(', ')} ===`);
        for (const storyId of filme) {
            const { ziel, ergebnis, sekunden, fehler } = await nimmAuf({ browser, port, format, storyId, ffmpeg, zielOrdner });
            console.log(`  ${storyId}: ${ergebnis} · ${sekunden} s → ${ziel}${fehler.length ? ` · Skriptfehler: ${fehler[0]}` : ''}`);
            if (ergebnis !== 'ok') code = 1;
        }
    }
} finally {
    await browser.close().catch(() => {});
    server.kill();
}
process.exit(code);
