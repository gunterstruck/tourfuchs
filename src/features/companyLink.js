/** DUVE alongside an existing CRM link; browser-local override, no requests or prefetch. */
import { crmLink } from './salesWorkbook.js';
import { isDemoCustomer } from '../core/demoSafety.js';
export const COMPANY_LINK_KEY = 'tourfuchs.company-link.v1';
export const DUVE_TEMPLATE = 'https://duve.siemens.com/duve-ui/search?clusterType=case&searchTerm={kundennummer}';
const DEFAULT_LINK = { label: 'DUVE', template: DUVE_TEMPLATE };
// Upgrade only our previously supplied preset; retain custom targets and opt-out.
const currentTemplate = (template) => template === DUVE_TEMPLATE.replace('clusterType=case', 'clusterType=all') ? DUVE_TEMPLATE : template;
export function validCompanyLink(config) {
    if (!config || typeof config.label !== 'string' || !config.label.trim() || config.label.length > 40 || typeof config.template !== 'string') return false;
    const template = config.template;
    if (!/^https:\/\//i.test(template) || !template.includes('{kundennummer}') || /[\s<>"']/.test(template)) return false;
    try {
        const url = new URL(template.replaceAll('{kundennummer}', '123'));
        return url.protocol === 'https:' && !url.username && !url.password && !new URL(template).hostname.includes('{');
    } catch { return false; }
}
export function readCompanyLink() {
    try {
        const config = JSON.parse(localStorage.getItem(COMPANY_LINK_KEY));
        if (config?.disabled === true) return null;
        return validCompanyLink(config) ? { ...config, template: currentTemplate(config.template) } : DEFAULT_LINK;
    } catch { return DEFAULT_LINK; }
}
export function companyLink(customer, config = readCompanyLink()) {
    const number = String(customer?.nummer ?? '').trim();
    if (!number || !crmLink(customer) || isDemoCustomer(customer) || !validCompanyLink(config)) return null;
    return { label: config.label.trim(), url: currentTemplate(config.template).replaceAll('{kundennummer}', encodeURIComponent(number)) };
}
