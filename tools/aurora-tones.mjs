/**
 * Aurora-Farbtöne: überträgt fest eingetragene Hell-Farben in den Dunkelstil.
 *
 * Viele Bausteine tragen ihre Farben direkt (`background: #fff`,
 * `color: #334155`, `border-color: #e2e8f0`) statt über die Token aus
 * variables.css. Damit der Aurora-Stil trotzdem überall lesbar bleibt, liest
 * dieses Werkzeug alle Stildateien und schreibt für jede solche Deklaration
 * eine Gegenregel mit demselben Selektor nach `src/styles/aurora-tones.css`:
 *
 *   - helle Flächen      → dunkle Glasfläche bzw. getönte, halbtransparente Fläche
 *   - dunkle Schrift     → helle Schrift (gleicher Farbton)
 *   - helle Rahmen       → Aurora-Rahmen
 *   - Marken-Türkis      → Aurora-Violett
 *
 * Es ändert nur Farben – keine Abstände, keine Sichtbarkeit, keine Logik.
 *
 * Aufruf:  node tools/aurora-tones.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STYLE_DIR = resolve(ROOT, 'src/styles');
const OUTPUT = resolve(STYLE_DIR, 'aurora-tones.css');
const SKIP = new Set(['aurora.css', 'aurora-tones.css', 'variables.css', 'main.css']);
// Diese beiden laden ihre Komponenten selbst nach main.css – ihre Gegenregeln
// brauchen einen Hauch mehr Gewicht (`:root …`), um später geladen zu gewinnen.
const LATE = new Set(['contracts.css', 'serviceVisits.css']);

const NAMED = { white: [255, 255, 255], black: [0, 0, 0] };
const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\bwhite\b|\bblack\b/g;

function parseColor(text) {
    if (NAMED[text]) return [...NAMED[text], 1];
    if (text.startsWith('#')) {
        let hex = text.slice(1);
        if (hex.length === 3 || hex.length === 4) hex = [...hex].map((c) => c + c).join('');
        const n = (i) => parseInt(hex.slice(i, i + 2), 16);
        return [n(0), n(2), n(4), hex.length === 8 ? n(6) / 255 : 1];
    }
    const parts = text.replace(/rgba?\(|\)/g, '').split(/[\s,/]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.some(Number.isNaN)) return null;
    return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
}

function toHsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return [h * 60, s, l];
}

function fromHsl(h, s, l) {
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}

const rgba = ([r, g, b], a) => (a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${+a.toFixed(3)})`);
const isTeal = (h, s) => s > 0.3 && h >= 160 && h <= 192;
const VIOLET_HUE = 258;

/** Fläche: hell → dunkel bzw. getönt; Türkis → Violett. Dunkles bleibt. */
function mapBackground(c) {
    const [h, s, l] = toHsl(c);
    const a = c[3];
    if (isTeal(h, s)) {
        if (l >= 0.8) return rgba(fromHsl(VIOLET_HUE, 0.9, 0.65), 0.2 * a);
        return rgba(fromHsl(VIOLET_HUE, Math.min(s, 0.85), Math.max(l, 0.5)), a);
    }
    if (l < 0.8) return null;
    if (s < 0.2 || l > 0.985) {
        if (a < 1) return `rgba(22, 20, 46, ${+(Math.max(a, 0.5)).toFixed(3)})`;
        return l > 0.975 ? 'var(--color-surface)' : 'var(--color-surface-2)';
    }
    return rgba(fromHsl(h, Math.min(0.85, s), 0.62), 0.16 * a + 0.02);
}

/** Schrift: dunkel → hell (gleicher Farbton); Türkis → helles Violett. Helles bleibt. */
function mapText(c) {
    const [h, s, l] = toHsl(c);
    if (isTeal(h, s)) return 'var(--color-primary-dark)';
    if (l >= 0.55) return null;
    if (s < 0.25) return l < 0.3 ? 'var(--color-text)' : 'var(--color-text-muted)';
    return rgba(fromHsl(h, Math.min(s, 0.9), 0.76), c[3]);
}

/** Rahmen: hell → Aurora-Kante; Türkis → Violett. */
function mapBorder(c) {
    const [h, s, l] = toHsl(c);
    if (isTeal(h, s)) return rgba(fromHsl(VIOLET_HUE, 0.85, 0.7), Math.min(c[3], 0.7));
    if (l < 0.75) return null;
    if (s < 0.25) return 'var(--color-border)';
    return rgba(fromHsl(h, Math.min(s, 0.85), 0.62), 0.4);
}

function replaceColors(value, mapper) {
    let changed = false;
    const out = value.replace(COLOR_RE, (match) => {
        const parsed = parseColor(match.toLowerCase());
        if (!parsed) return match;
        const mapped = mapper(parsed);
        if (!mapped) return match;
        changed = true;
        return mapped;
    });
    return changed ? out : null;
}

const BG = /^background(-color|-image)?$/;
const TEXT = /^(color|-webkit-text-fill-color|caret-color)$/;
const BORDER = /^(border(-(top|right|bottom|left))?(-color)?|outline(-color)?|column-rule(-color)?)$/;

function prefixSelector(selector) {
    return selector.split(',').map((part) => {
        const p = part.trim();
        if (/^(html|:root)\b/.test(p)) return p;
        return `:root ${p}`;
    }).join(',\n');
}

const blocks = [];
const files = readdirSync(STYLE_DIR).filter((f) => f.endsWith('.css') && !SKIP.has(f)).sort();
for (const file of files) {
    const root = postcss.parse(readFileSync(resolve(STYLE_DIR, file), 'utf8'), { from: file });
    const rules = [];
    root.walkRules((rule) => {
        // Keyframes-Schritte (from/to/50%) sind keine Selektoren.
        if (rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
        const decls = [];
        // Bleibt die Fläche einer Regel eine kräftige Farbe (Abzeichen, Warnung),
        // behält ihre Schrift die ursprüngliche, dafür gewählte Farbe.
        let keepsStrongBg = false;
        rule.each((node) => {
            if (node.type !== 'decl' || !BG.test(node.prop)) return;
            const colors = node.value.match(COLOR_RE) || [];
            if (colors.some((c) => { const p = parseColor(c.toLowerCase()); return p && p[3] > 0.5 && !mapBackground(p) && toHsl(p)[2] >= 0.35; })) keepsStrongBg = true;
        });
        rule.each((node) => {
            if (node.type !== 'decl') return;
            let mapped = null;
            if (BG.test(node.prop)) mapped = replaceColors(node.value, mapBackground);
            else if (TEXT.test(node.prop) && !keepsStrongBg) mapped = replaceColors(node.value, mapText);
            else if (BORDER.test(node.prop)) mapped = replaceColors(node.value, mapBorder);
            if (mapped) decls.push(`    ${node.prop}: ${mapped}${node.important ? ' !important' : ''};`);
        });
        if (!decls.length) return;
        const selector = LATE.has(file) ? prefixSelector(rule.selector) : rule.selector.split(',').map((s) => s.trim()).join(',\n');
        let text = `${selector} {\n${decls.join('\n')}\n}`;
        // Medien-/Support-Abfragen beibehalten, damit die Gegenregel genau dort greift.
        for (let p = rule.parent; p && p.type === 'atrule'; p = p.parent) {
            text = `@${p.name} ${p.params} {\n${text.replace(/^/gm, '    ')}\n}`;
        }
        rules.push(text);
    });
    if (rules.length) blocks.push(`/* ── ${file} ── */\n${rules.join('\n')}`);
}

const header = `/*
 * Aurora-Farbtöne – automatisch erzeugt von tools/aurora-tones.mjs.
 * Nicht von Hand bearbeiten: Werkzeug erneut laufen lassen.
 * Nur Farben (Fläche, Schrift, Rahmen) – keine Abstände, keine Sichtbarkeit.
 */
`;
writeFileSync(OUTPUT, `${header}\n${blocks.join('\n\n')}\n`);
console.log(`aurora-tones.css: ${blocks.length} Dateien übertragen → ${OUTPUT}`);
