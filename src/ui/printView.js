/**
 * Druckansichten (Tagesplan, Entscheidungsvorlage) mit sicherem Rückweg.
 *
 * Bisher öffnete jede Druckansicht ein neues Fenster. In der installierten App
 * auf dem iPhone hat dieses Fenster keine Browserleiste – wer nicht drucken
 * wollte, kam nicht mehr zurück. Deshalb:
 *
 * 1. Jede Druckansicht trägt oben eine Leiste „← Zurück zu TourFuchs" und
 *    „Drucken" (wird nicht mitgedruckt).
 * 2. In der installierten App (Standalone) öffnet sie gar kein Fenster mehr,
 *    sondern liegt als Vollbild-Ebene in der App; „Zurück" schließt sie.
 */
import { currentLocale, t } from '../core/i18n.js';

const BAR_STYLE = `
    .tf-printbar { position: sticky; top: 0; z-index: 10; display: flex; gap: 8px; align-items: center;
        margin: -24px -24px 16px; padding: calc(10px + env(safe-area-inset-top, 0px)) 16px 10px;
        background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    .tf-printbar button { font: inherit; font-size: 16px; padding: 9px 14px; border-radius: 999px;
        border: 1px solid #cbd5e1; background: #fff; color: #0f172a; cursor: pointer; }
    .tf-printbar .tf-print { margin-left: auto; background: #0d9488; border-color: #0d9488; color: #fff; font-weight: 700; }
    @media print { .tf-printbar { display: none !important; } }`;

function barHtml() { return `<div class="tf-printbar" lang="${currentLocale()}">
    <button type="button" class="tf-back" onclick="tfBack()">${t('print.back')}</button>
    <button type="button" class="tf-print" onclick="window.print()">${t('print.action')}</button>
</div>
<script>
function tfBack() {
    if (window.parent && window.parent !== window) { window.parent.postMessage({ tf: 'print-close' }, '*'); return; }
    try { window.close(); } catch (e) {}
    setTimeout(function () {
        if (window.closed) return;
        if (history.length > 1) { history.back(); return; }
        location.href = '/';
    }, 300);
}
<\/script>`; }

/** Leiste in ein fertiges Druck-HTML einsetzen (direkt nach <body>). */
export function withBackBar(html) {
    const text = String(html || '');
    if (text.includes('class="tf-printbar"')) return text;
    const styled = text.replace('</style>', `${BAR_STYLE}\n</style>`);
    return styled.replace(/<body([^>]*)>/i, (m) => `${m}\n${barHtml()}`);
}

export function isStandaloneApp(win = window) {
    try {
        return Boolean(win.navigator?.standalone)
            || Boolean(win.matchMedia?.('(display-mode: standalone)').matches);
    } catch {
        return false;
    }
}

let overlay = null;

function closeOverlay() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
}

function openOverlay(html, doc = document) {
    closeOverlay();
    overlay = doc.createElement('div');
    overlay.className = 'print-view-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', t('print.view'));
    const frame = doc.createElement('iframe');
    frame.title = t('print.view');
    frame.srcdoc = html;
    overlay.appendChild(frame);
    doc.body.appendChild(overlay);
    return true;
}

window.addEventListener?.('message', (event) => {
    if (event?.data?.tf === 'print-close') closeOverlay();
});
document.addEventListener?.('keydown', (event) => {
    if (event.key === 'Escape' && overlay) closeOverlay();
});

/**
 * Druckansicht öffnen. Gibt false zurück, wenn der Browser das Fenster
 * blockiert hat (nur außerhalb der installierten App möglich).
 */
export function openPrintView(html, { win = window, open = (...args) => win.open(...args) } = {}) {
    const page = withBackBar(html);
    if (isStandaloneApp(win)) return openOverlay(page, win.document);
    const target = open('', '_blank');
    if (!target) return false;
    target.document.write(page);
    target.document.close();
    return true;
}
