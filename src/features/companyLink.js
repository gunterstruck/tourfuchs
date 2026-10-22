/** Optional browser-local bookmark template, no requests or prefetch. */
export const COMPANY_LINK_KEY = 'tourfuchs.company-link.v1';
export const DUVE_TEMPLATE = 'https://duve.siemens.com/duve-ui/search?clusterType=all&searchTerm={kundennummer}';
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
        return validCompanyLink(config) ? config : null;
    } catch { return null; }
}
export function companyLink(customer, config = readCompanyLink()) {
    const number = String(customer?.nummer ?? '').trim();
    if (!number || !validCompanyLink(config)) return null;
    return { label: config.label.trim(), url: config.template.replaceAll('{kundennummer}', encodeURIComponent(number)) };
}
