import { FIRST_STEPS, firstStepsProgress } from '../features/firstSteps.js';
import { t } from '../core/i18n.js';

/**
 * „Wie geht das?" dort, wo der Schritt ansteht (leere Tour, Tresor einrichten):
 * ein Link zur passenden Live-Demo, bis der Schritt einmal getan ist. Den Klick
 * nimmt `ui/firstSteps.js` an; während einer Vorführung blendet CSS ihn aus.
 */
export function helpDemoLink(stepId) {
    const story = FIRST_STEPS.find((step) => step.id === stepId)?.showcase;
    if (!story || firstStepsProgress().done.includes(stepId)) return '';
    return `<p class="help-demo"><button type="button" class="linklike" data-help-demo="${story}">${t('ownData.safeDemo')}</button></p>`;
}
