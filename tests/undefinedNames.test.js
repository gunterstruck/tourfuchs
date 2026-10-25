// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';

/**
 * Kein Modul benutzt einen Namen, den es weder importiert noch deklariert.
 *
 * Ohne Linter fiel so etwas erst im Browser auf – als ReferenceError genau in
 * dem Moment, in dem der Nutzer klickt:
 *  - 23.10.2026: `state` fehlte in src/ui/territorySummary.js – die große
 *    Gebietskachel öffnete sich nicht mehr (gefunden von demo-check).
 *  - 04.10.2026 bis 25.10.2026: `hasValidCoords` fehlte in src/ui/tourQr.js –
 *    „Tour übernehmen" brach ab, sobald ein QR-Stopp einem vorhandenen Kunden
 *    zugeordnet wurde.
 *
 * Bewusst einfach: Ein Name gilt als bekannt, wenn er irgendwo im Modul
 * importiert oder deklariert wird (Variable, Funktion, Klasse, Parameter,
 * catch) oder ein Browser-Global ist. Das fängt fehlende Importe und
 * Tippfehler; Gültigkeitsbereiche prüft es nicht.
 */
const BROWSER_GLOBALS = new Set([
    // Sprache
    'undefined', 'NaN', 'Infinity', 'arguments', 'globalThis', 'Object', 'Array', 'String', 'Number', 'Boolean',
    'Symbol', 'BigInt', 'Math', 'Date', 'JSON', 'RegExp', 'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Reflect',
    'Proxy', 'Intl', 'Error', 'TypeError', 'RangeError', 'AggregateError', 'isNaN', 'isFinite', 'parseInt',
    'parseFloat', 'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'escape', 'structuredClone',
    'queueMicrotask', 'ArrayBuffer', 'DataView', 'Uint8Array', 'Uint8ClampedArray', 'Int32Array', 'Float32Array',
    'Float64Array', 'TextEncoder', 'TextDecoder', 'WebAssembly', 'atob', 'btoa', 'console',
    // Browser
    'window', 'self', 'document', 'navigator', 'location', 'history', 'screen', 'performance', 'localStorage',
    'sessionStorage', 'indexedDB', 'caches', 'crypto', 'fetch', 'Request', 'Response', 'Headers', 'FormData',
    'URL', 'URLSearchParams', 'Blob', 'File', 'FileReader', 'AbortController', 'DOMException', 'DOMParser',
    'XMLSerializer', 'CSS', 'Node', 'NodeFilter', 'Element', 'HTMLElement', 'HTMLDialogElement',
    'HTMLAnchorElement', 'HTMLInputElement', 'Event', 'EventTarget', 'CustomEvent', 'KeyboardEvent',
    'PointerEvent', 'DataTransfer', 'MutationObserver', 'ResizeObserver', 'IntersectionObserver', 'Image',
    'ImageData', 'Audio', 'OffscreenCanvas', 'createImageBitmap', 'Worker', 'PublicKeyCredential', 'ClipboardItem',
    'BarcodeDetector', 'CompressionStream', 'DecompressionStream', 'matchMedia', 'getComputedStyle',
    'visualViewport', 'innerWidth', 'innerHeight', 'devicePixelRatio', 'scrollX', 'scrollY', 'open', 'print',
    'confirm', 'alert', 'prompt', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
    'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback',
    // Bibliotheken als Global
    'L'
]);

function bindNames(pattern, into) {
    if (!pattern) return;
    if (pattern.type === 'Identifier') into.add(pattern.name);
    else if (pattern.type === 'ObjectPattern') pattern.properties.forEach((p) => bindNames(p.type === 'RestElement' ? p.argument : p.value, into));
    else if (pattern.type === 'ArrayPattern') pattern.elements.forEach((p) => bindNames(p, into));
    else if (pattern.type === 'RestElement') bindNames(pattern.argument, into);
    else if (pattern.type === 'AssignmentPattern') bindNames(pattern.left, into);
}

/** Alle deklarierten Namen und alle als Wert benutzten Bezeichner eines Moduls. */
function namesOf(source) {
    const declared = new Set();
    const used = [];
    const visit = (node, parent, key) => {
        if (!node || typeof node.type !== 'string') return;
        switch (node.type) {
            case 'ImportSpecifier': case 'ImportDefaultSpecifier': case 'ImportNamespaceSpecifier':
                declared.add(node.local.name); return;
            case 'MetaProperty': return;   // import.meta
            case 'VariableDeclarator': bindNames(node.id, declared); break;
            case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression':
                if (node.id) declared.add(node.id.name);
                node.params.forEach((p) => bindNames(p, declared));
                break;
            case 'ClassDeclaration': case 'ClassExpression': if (node.id) declared.add(node.id.name); break;
            case 'CatchClause': bindNames(node.param, declared); break;
            case 'Identifier': {
                const propertyName = (parent?.type === 'MemberExpression' && key === 'property' && !parent.computed)
                    || (['Property', 'MethodDefinition', 'PropertyDefinition'].includes(parent?.type) && key === 'key' && !parent.computed);
                const label = ['LabeledStatement', 'BreakStatement', 'ContinueStatement', 'ExportSpecifier'].includes(parent?.type);
                if (!propertyName && !label) used.push(node);
                return;
            }
            default: break;
        }
        for (const [childKey, child] of Object.entries(node)) {
            if (Array.isArray(child)) child.forEach((c) => visit(c, node, childKey));
            else if (child && typeof child.type === 'string') visit(child, node, childKey);
        }
    };
    visit(parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true }));
    return { declared, used };
}

function undefinedNames(source) {
    const { declared, used } = namesOf(source);
    return used.filter((id) => !declared.has(id.name) && !BROWSER_GLOBALS.has(id.name))
        .map((id) => `${id.name} (Zeile ${id.loc.start.line})`);
}

describe('Jeder benutzte Name ist importiert oder deklariert', () => {
    it('findet die beiden echten Fälle von früher', () => {
        expect(undefinedNames("import { on } from './state.js';\non('x', () => state.revenueKind);")).toEqual(['state (Zeile 2)']);
        expect(undefinedNames('export function f(stop) { return hasValidCoords(stop); }')).toEqual(['hasValidCoords (Zeile 1)']);
        expect(undefinedNames("import { hasValidCoords } from './x.js';\nhasValidCoords({});")).toEqual([]);
    });

    it('gilt für alle Module unter src/', () => {
        const files = execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8' }).split('\n').filter((f) => f.endsWith('.js'));
        const problems = files.flatMap((file) => undefinedNames(readFileSync(file, 'utf8')).map((name) => `${file}: ${name}`));
        expect(problems).toEqual([]);
    });
});
