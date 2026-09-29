/**
 * „🦊 Frag den TourFuchs-Guide" – der eigene GPT bei ChatGPT.
 *
 * Der Guide beantwortet Bedienfragen mit der offiziellen Wissensbasis
 * (docs/guide-ki-wissensbasis.md). Er läuft bei OpenAI, also **außerhalb der
 * Organisation** – anders als die Firmen-KI, an die das Briefing übergibt.
 * Deshalb öffnet jeder Einstieg zuerst einen Hinweis; erst „Verstanden – Guide
 * öffnen" folgt dem Link.
 *
 * Einbetten lässt sich ein GPT nicht (ChatGPT verbietet das Anzeigen in fremden
 * Seiten), und eine eigene KI-Schnittstelle widerspräche dem Grundsatz „keine
 * KI-API, nichts im Hintergrund". TourFuchs übergibt deshalb nichts – weder
 * Kundendaten noch eine vorbereitete Frage.
 */
import { CONFIG } from '../core/config.js';

let dialog = null;

/** Hinweis zeigen; von dort geht es mit einem Tipp zum Guide. */
export function openGuide() {
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
}

export function initGuide() {
    dialog = document.getElementById('guide-dialog');
    if (!dialog) return;
    const link = document.getElementById('guide-open');
    if (link && CONFIG.guideUrl) link.href = CONFIG.guideUrl;
    link?.addEventListener('click', () => dialog.close());
    document.getElementById('guide-cancel')?.addEventListener('click', () => dialog.close());
    // Jeder Einstieg trägt die Klasse (heute: der Knopf im Info-Dialog) –
    // auch solche, die erst später ins DOM kommen.
    document.addEventListener('click', (event) => {
        if (event.target.closest?.('.js-open-guide')) openGuide();
    });
}
