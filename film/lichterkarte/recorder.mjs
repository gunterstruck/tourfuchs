// Gemeinsame Bausteine für die Querformat-Werbefilme (Tour, Firmen-KI-Liste):
// App im Schreibtisch-Format öffnen, Bildschirm mitschneiden, sichtbarer
// Mauszeiger mit Klick-Ring (Playwright zeigt keinen echten Zeiger).
//
// Hinter einem TLS-prüfenden Proxy (Kartenkacheln): FILM_PROXY=<http://host:port>
// und FILM_PROXY_CA=<ca-bundle.pem> setzen.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { X509Certificate, createHash } from 'node:crypto';

export const VIEW = { viewport: { width: 1120, height: 700 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false };
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now() / 1000;

function proxyArgs() {
    const ca = process.env.FILM_PROXY_CA;
    if (!ca) return [];
    const pins = readFileSync(ca, 'utf8').match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g)
        .map((pem) => createHash('sha256').update(new X509Certificate(pem).publicKey.export({ type: 'spki', format: 'der' })).digest('base64'));
    return [`--ignore-certificate-errors-spki-list=${pins.join(',')}`];
}

/** App öffnen: dunkler Stil, Beispieldaten, Modus (Außendienst oder GeoFuchs), Hinweise aus dem Bild. */
export async function openApp(appUrl, { beforeLoad, mode = 'aussendienst' } = {}) {
    const launch = { args: ['--lang=de-DE', ...proxyArgs()] };
    if (process.env.PLAYWRIGHT_CHROMIUM_PATH) launch.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
    if (process.env.FILM_PROXY) launch.proxy = { server: process.env.FILM_PROXY, bypass: new URL(appUrl).hostname };
    const b = await chromium.launch(launch);
    const ctx = await b.newContext({ ...VIEW, locale: 'de-DE', timezoneId: 'Europe/Berlin', colorScheme: 'dark' });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
    if (beforeLoad) await ctx.addInitScript(beforeLoad);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => console.error('Browserfehler:', e.message));
    // Neue Tabs (Assistent öffnen) sofort wieder schließen – der Film bleibt in der App.
    ctx.on('page', (tab) => { if (tab !== p) tab.close().catch(() => {}); });
    await p.goto(appUrl);
    await p.waitForSelector('#map');
    await sleep(9000);
    await p.locator('#btn-demo-welcome-ack').click().catch(() => {});
    await p.locator('#mobile-preview [data-mp-close]').last().click().catch(() => {});
    await p.locator(`.mode-btn[data-mode="${mode}"]`).click().catch(() => {});
    await sleep(800);
    await p.addStyleTag({ content: `
        .toasts, #toasts, .mobile-preview, .mobile-preview-hint, .context-help, .first-steps-float,
        .map-coach, .coach-bubble, .demo-hint-bubble, .customer-stack-discovery-label,
        .leaflet-tooltip { visibility: hidden !important; }
        .sidebar { transition: opacity .45s ease; }
        html.film-hide-side .sidebar { opacity: 0 !important; pointer-events: none !important; }
        #film-cursor { position: fixed; z-index: 2147483647; left: 0; top: 0; width: 26px; height: 26px; pointer-events: none;
            transform: translate(-3px, -2px); filter: drop-shadow(0 2px 4px rgba(0,0,0,.55)); }
        .film-ring { position: fixed; z-index: 2147483646; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%;
            border: 3px solid rgba(255,255,255,.95); box-shadow: 0 0 16px rgba(139,92,246,.9); pointer-events: none;
            animation: film-ring .7s ease-out forwards; }
        @keyframes film-ring { 0% { transform: scale(.4); opacity: 0; } 25% { opacity: 1; } 100% { transform: scale(1.5); opacity: 0; } }
    ` });
    await p.evaluate(() => {
        const c = document.createElement('div');
        c.id = 'film-cursor';
        c.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M3 2l7 19 2.6-7.4L20 11z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
        c.style.left = '1300px';
        document.body.appendChild(c);
        document.addEventListener('mousemove', (e) => { c.style.left = `${e.clientX}px`; c.style.top = `${e.clientY}px`; }, true);
    });
    return { b, ctx, p };
}

/** Zeiger sichtbar an eine Stelle gleiten lassen. */
export async function glide(p, x, y, steps = 18) {
    await p.mouse.move(x, y, { steps });
}

export async function ring(p, x, y) {
    await p.evaluate(({ x, y }) => {
        const r = document.createElement('div');
        r.className = 'film-ring';
        r.style.left = `${x}px`;
        r.style.top = `${y}px`;
        document.body.appendChild(r);
        setTimeout(() => r.remove(), 800);
    }, { x, y });
}

/** Zum Element gleiten, Ring zeigen, klicken. */
export async function clickOn(p, selector, { steps = 18, pause = 250 } = {}) {
    const loc = p.locator(selector).first();
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    const box = await loc.boundingBox();
    if (!box) throw new Error(`Nicht sichtbar: ${selector}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await glide(p, x, y, steps);
    await sleep(pause);
    await ring(p, x, y);
    await p.mouse.click(x, y);
}

/** Bildschirm mitschneiden; stop() schreibt list.txt und marks.json. */
export async function startRecording(ctx, p, dir) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const cdp = await ctx.newCDPSession(p);
    const frames = [];
    cdp.on('Page.screencastFrame', async (f) => {
        const file = `${dir}/f${String(frames.length).padStart(5, '0')}.jpg`;
        writeFileSync(file, Buffer.from(f.data, 'base64'));
        frames.push({ file, t: f.metadata.timestamp });
        try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch { /* Ende */ }
    });
    const { width, height } = VIEW.viewport;
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: width, maxHeight: height, everyNthFrame: 1 });
    const marks = {};
    const order = [];
    return {
        mark(name) { marks[name] = now(); if (name !== 'done') order.push(name); },
        async stop(extra = {}) {
            marks.done = now();
            await sleep(300);
            await cdp.send('Page.stopScreencast');
            const end = frames[frames.length - 1].t + 0.04;
            let list = '';
            frames.forEach((f, i) => {
                const next = i + 1 < frames.length ? frames[i + 1].t : end;
                list += `file '${f.file}'\nduration ${Math.max(0.001, next - f.t).toFixed(4)}\n`;
            });
            list += `file '${frames[frames.length - 1].file}'\n`;
            writeFileSync(`${dir}/list.txt`, list);
            const t0 = frames[0].t;
            const rel = Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, +(v - t0).toFixed(3)]));
            Object.assign(rel, { order, speed: 1 }, extra);
            writeFileSync(`${dir}/marks.json`, JSON.stringify(rel, null, 2));
            const span = frames.length / (frames[frames.length - 1].t - t0);
            console.log('Bilder', frames.length, `(${span.toFixed(1)} fps)`, 'Marken', JSON.stringify(rel));
        },
    };
}
