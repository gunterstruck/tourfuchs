/**
 * Die installierte App ans Betriebssystem anschließen.
 *
 * Drei Wege führen von außen in eine konkrete Aufgabe:
 * - **Shortcut** (Long-Press aufs App-Icon) → `?start=tour|nearby|import`
 * - **Kundenliste im Explorer/Finder geöffnet** → File Handling API
 * - **Excel-Anhang geteilt (Android)** → Service Worker legt die Datei ab,
 *   die App holt sie über `?share=1`
 *
 * Dazu das Installations-Angebot: `beforeinstallprompt` wurde bisher gar nicht
 * abgefangen, die Installation also nie aktiv angeboten. Jetzt schon – aber
 * erst, wenn sie einen Sinn ergibt (eigene Daten, geplante Tour), nicht beim
 * ersten Blick auf die Beispieldaten.
 */
import { state, on } from '../core/state.js';
import { isDemoDataset } from '../core/demoSafety.js';
import {
    readLaunchIntent,
    shouldOfferInstall,
    takeSharedFile,
    urlWithoutLaunchParams
} from '../services/pwaLaunch.js';
import { importExternalFile, openOwnDataDialog } from './importWizard.js';
import { showTourView, showDataView } from './sidebar.js';
import { showToast } from './toast.js';

const DISMISS_KEY = 'tf_install_dismissed';
const insideMobilePreview = new URLSearchParams(location.search).has('mobilePreview');

let installEvent = null;
let offerShown = false;

function store() {
    try { return globalThis.localStorage || null; } catch { return null; }
}

function isInstalled() {
    return window.matchMedia?.('(display-mode: standalone)')?.matches
        || window.navigator.standalone === true;
}

/** Shortcut-Ziel ausführen. Bewusst nur Navigation – nichts wird gestartet. */
function applyStartTarget(target) {
    if (target === 'tour') showTourView();
    else if (target === 'import') openOwnDataDialog();
    else if (target === 'nearby') {
        showTourView();
        document.getElementById('btn-nearby')?.click();
    }
}

async function handleLaunchIntent() {
    const { start, share } = readLaunchIntent(location.search);
    if (!start && !share) return;
    history.replaceState(null, '', urlWithoutLaunchParams(location.href));

    if (share) {
        const file = await takeSharedFile();
        if (file) importExternalFile(file);
        else showToast('Die geteilte Datei konnte nicht übernommen werden.', 'info', 5000);
        return;
    }
    applyStartTarget(start);
}

/** Im Betriebssystem geöffnete Kundenliste („Öffnen mit → TourFuchs"). */
function initFileHandling() {
    const queue = window.launchQueue;
    if (!queue?.setConsumer) return;
    queue.setConsumer(async (launchParams) => {
        const handle = launchParams?.files?.[0];
        if (!handle?.getFile) return;
        try {
            importExternalFile(await handle.getFile());
        } catch {
            showToast('Die geöffnete Datei konnte nicht gelesen werden.', 'error', 5000);
        }
    });
}

function dismissInstallOffer(banner, remember) {
    if (remember) {
        try { store()?.setItem(DISMISS_KEY, '1'); } catch { /* optional */ }
    }
    banner.classList.remove('visible');
    setTimeout(() => banner.remove(), 180);
}

function showInstallOffer() {
    if (offerShown || !installEvent) return;
    offerShown = true;

    const banner = document.createElement('div');
    banner.className = 'install-offer';
    banner.setAttribute('role', 'status');
    banner.innerHTML = `
        <div class="install-offer-copy">
            <strong>TourFuchs installieren?</strong>
            <span>Startet ohne Browserleiste, funktioniert offline und liegt als Symbol auf dem Startbildschirm.</span>
        </div>
        <div class="install-offer-actions">
            <button type="button" class="install-offer-later">Später</button>
            <button type="button" class="install-offer-now primary">Installieren</button>
        </div>`;

    banner.querySelector('.install-offer-later').addEventListener('click', () => dismissInstallOffer(banner, true));
    banner.querySelector('.install-offer-now').addEventListener('click', async () => {
        const event = installEvent;
        installEvent = null;
        dismissInstallOffer(banner, false);
        try {
            event.prompt();
            const { outcome } = await event.userChoice;
            if (outcome === 'dismissed') {
                try { store()?.setItem(DISMISS_KEY, '1'); } catch { /* optional */ }
            }
        } catch {
            showToast('Die Installation konnte nicht gestartet werden. Über das Browsermenü klappt es weiterhin.', 'info', 6000);
        }
    });

    document.body.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add('visible'));
}

function maybeOfferInstall() {
    const ok = shouldOfferInstall({
        promptAvailable: Boolean(installEvent),
        installed: isInstalled(),
        dismissed: store()?.getItem(DISMISS_KEY) === '1',
        hasOwnData: state.customers.length > 0 && !isDemoDataset(state.customers),
        tourStopCount: state.tour?.stops?.length || 0,
        insideMobilePreview
    });
    if (ok) showInstallOffer();
}

export function initPwaLaunch() {
    initFileHandling();

    window.addEventListener('beforeinstallprompt', (event) => {
        // Der Browser würde sonst seinen eigenen Zeitpunkt wählen; wir heben uns
        // das Angebot für den Moment auf, in dem es etwas bringt.
        event.preventDefault();
        installEvent = event;
    });
    window.addEventListener('appinstalled', () => { installEvent = null; });

    on('app:ready', () => { handleLaunchIntent(); maybeOfferInstall(); });
    on('tour:changed', maybeOfferInstall);
    on('customers:changed', maybeOfferInstall);
}
