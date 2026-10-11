#!/usr/bin/env node
/**
 * Größenbudget der ausgelieferten App (Release 17.0c).
 *
 * Misst nach `npm run build` die Pakete in dist/assets – roh (was der Browser
 * auswerten muss) und gzip (was übers Netz geht) – und vergleicht sie mit
 * tools/bundle-budget.json. Wird ein Paket größer als sein Budget, schlägt
 * der Lauf fehl: Größe wächst sonst schleichend, PR für PR, ohne dass es
 * jemand entschieden hat.
 *
 * Ein Budget wird nur bewusst geändert: gesenkt, wenn ein Umbau Platz
 * gespart hat (damit er nicht wieder verloren geht), erhöht nur mit
 * Begründung im PR.
 *
 *   npm run build && npm run bundle-check
 *   npm run bundle-check -- --json      # Messwerte als JSON (für ein neues Budget)
 */
import { readFileSync, readdirSync, statSync, existsSync, appendFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const ASSETS = resolve(ROOT, 'dist/assets');
const BUDGET = JSON.parse(readFileSync(resolve(ROOT, 'tools/bundle-budget.json'), 'utf8'));

if (!existsSync(ASSETS)) {
    console.error('dist/assets fehlt – vorher `npm run build` ausführen.');
    process.exit(2);
}

// Dateiname ohne Hash: „index-BpBwe22a.js" → „index.js".
const stem = (name) => name.replace(/-[A-Za-z0-9_-]{8}(?=\.(js|css)$)/, '');
const files = readdirSync(ASSETS).filter((name) => /\.(js|css)$/.test(name)).map((name) => {
    const bytes = readFileSync(resolve(ASSETS, name));
    return { name, key: stem(name), raw: statSync(resolve(ASSETS, name)).size, gzip: gzipSync(bytes, { level: 9 }).length };
});

const sum = (list, field) => list.reduce((total, file) => total + file[field], 0);
const measured = Object.fromEntries(files.map((file) => [file.key, { raw: file.raw, gzip: file.gzip }]));
measured['alle JS'] = { raw: sum(files.filter((f) => f.name.endsWith('.js')), 'raw'), gzip: sum(files.filter((f) => f.name.endsWith('.js')), 'gzip') };
measured['alle CSS'] = { raw: sum(files.filter((f) => f.name.endsWith('.css')), 'raw'), gzip: sum(files.filter((f) => f.name.endsWith('.css')), 'gzip') };

if (process.argv.includes('--json')) {
    console.log(JSON.stringify(measured, null, 2));
    process.exit(0);
}

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const rows = [];
const problems = [];
for (const [key, limit] of Object.entries(BUDGET.pakete)) {
    const now = measured[key];
    if (!now) {
        problems.push(`${key}: kein solches Paket mehr im Build – Budget anpassen (Paket umbenannt oder entfernt?)`);
        continue;
    }
    for (const field of ['raw', 'gzip']) {
        if (now[field] > limit[field]) problems.push(`${key} (${field}): ${kb(now[field])} > Budget ${kb(limit[field])}`);
    }
    rows.push(`| ${key} | ${kb(now.raw)} / ${kb(limit.raw)} | ${kb(now.gzip)} / ${kb(limit.gzip)} |`);
}
for (const key of Object.keys(measured)) {
    if (!(key in BUDGET.pakete)) problems.push(`${key}: neues Paket ohne Budget – in tools/bundle-budget.json eintragen`);
}

const table = ['| Paket | roh (jetzt / Budget) | gzip (jetzt / Budget) |', '|---|---|---|', ...rows].join('\n');
console.log(table);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Größenbudget\n\n${table}\n`);
if (problems.length) {
    console.error(`\nÜber Budget:\n- ${problems.join('\n- ')}`);
    process.exit(1);
}
console.log('\nAlle Pakete im Budget.');
