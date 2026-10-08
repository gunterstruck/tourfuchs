import { state, emit, filterDimensionDefs, on } from '../core/state.js';
import { currentLocale, t } from '../core/i18n.js';
import { isPhoneUi, onFaceChange } from '../core/viewport.js';
import {
    applyPlanningSelections,
    planningScopeCustomers,
    planningSelectionsFromDimensions,
    planningValueCounts,
    planningValueSearchText
} from '../features/planningScope.js';
import { showToast } from './toast.js';

const LIST_LIMIT = 60;
const MAP_MODES = ['auto', 'channel', 'gruppe', 'bezirk', 'none'];
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
));

let dialog;
let defs = [];
let selections = new Map();
let activeDimension = '';
let mapMode = 'auto';
let activeTab = 'filter';

const dimensionLabel = (def) => {
    const key = `tour.scope.mobile.dimension.${def.id}`;
    const translated = t(key);
    return translated === key ? def.label : translated;
};

function activeDefs() {
    return filterDimensionDefs().filter((def) => state.dims[def.id]?.active);
}

function resultCustomers() {
    return planningScopeCustomers(state.customers, defs, selections, state.filters.revenue);
}

function renderResult() {
    const count = resultCustomers().length;
    const el = document.getElementById('mobile-planning-scope-result');
    if (el) el.textContent = t(count === 1 ? 'tour.scope.mobile.resultOne' : 'tour.scope.mobile.resultMany', { count });
}

function renderTabs() {
    dialog.querySelectorAll('[data-planning-tab]').forEach((button) => {
        const selected = button.dataset.planningTab === activeTab;
        button.setAttribute('aria-selected', String(selected));
    });
    document.getElementById('planning-scope-filter-panel').hidden = activeTab !== 'filter';
    document.getElementById('planning-scope-map-panel').hidden = activeTab !== 'map';
}

function renderCategories() {
    const root = document.getElementById('planning-scope-categories');
    if (!defs.length) {
        root.innerHTML = `<p class="muted small">${escapeHtml(t('tour.scope.mobile.noDimensions'))}</p>`;
        document.getElementById('planning-scope-values').replaceChildren();
        return;
    }
    if (!defs.some((def) => def.id === activeDimension)) activeDimension = defs[0].id;
    root.innerHTML = defs.map((def) => {
        const count = selections.get(def.id)?.size || 0;
        const summary = count
            ? t('tour.scope.mobile.categorySelected', { count })
            : t('tour.scope.mobile.categoryAll');
        return `<button type="button" class="planning-scope-category${def.id === activeDimension ? ' active' : ''}" data-planning-dimension="${escapeHtml(def.id)}" aria-pressed="${def.id === activeDimension}">
            <span>${escapeHtml(dimensionLabel(def))}</span><small>${escapeHtml(summary)}</small>
        </button>`;
    }).join('');
}

function representativeNames(value, def) {
    if (def?.id !== 'bezirk') return '';
    const names = new Set(state.customers
        .filter((customer) => String(customer.bezirk ?? '').trim() === value)
        .map((customer) => String(customer.vb ?? '').trim()).filter(Boolean));
    return [...names].sort((a, b) => a.localeCompare(b, currentLocale())).join(', ');
}

function renderValues() {
    const root = document.getElementById('planning-scope-values');
    const more = document.getElementById('planning-scope-more');
    const def = defs.find((entry) => entry.id === activeDimension);
    if (!def) { root.replaceChildren(); more.hidden = true; return; }
    const query = document.getElementById('planning-scope-search').value.trim().toLocaleLowerCase();
    const values = [...state.dims[def.id].values.keys()];
    const filtered = values
        .filter((value) => !query || planningValueSearchText(value, def, state.customers).includes(query))
        .sort((a, b) => a.localeCompare(b, currentLocale()));
    const counts = planningValueCounts(state.customers, defs, selections, def.id, state.filters.revenue);
    const selected = selections.get(def.id) || new Set();
    root.innerHTML = filtered.slice(0, LIST_LIMIT).map((value, index) => {
        const reps = representativeNames(value, def);
        return `<label class="planning-scope-value">
            <input type="checkbox" data-planning-value-index="${index}" ${selected.has(value) ? 'checked' : ''}>
            <span class="planning-scope-value-label"><b>${escapeHtml(value)}</b>${reps ? `<small>VB: ${escapeHtml(reps)}</small>` : ''}</span>
            <span class="planning-scope-value-count">${counts.get(value) ?? 0}</span>
        </label>`;
    }).join('') || `<p class="muted small">${escapeHtml(t('tour.scope.mobile.noResults'))}</p>`;
    root.dataset.visibleValues = JSON.stringify(filtered.slice(0, LIST_LIMIT));
    const hiddenCount = Math.max(0, filtered.length - LIST_LIMIT);
    more.hidden = hiddenCount === 0;
    more.textContent = hiddenCount ? t('tour.scope.mobile.more', { count: hiddenCount }) : '';
}

function renderMapOptions() {
    const root = document.getElementById('planning-scope-map-options');
    root.innerHTML = MAP_MODES.map((mode) => {
        const unavailable = ['channel', 'gruppe', 'bezirk'].includes(mode) && !state.dims[mode]?.active;
        return `<label class="planning-scope-map-option${unavailable ? ' unavailable' : ''}">
            <input type="radio" name="planning-map-mode" value="${mode}" ${mapMode === mode ? 'checked' : ''} ${unavailable ? 'disabled' : ''}>
            <span><b>${escapeHtml(t(`tour.scope.mobile.map.${mode}`))}</b><small>${escapeHtml(t(`tour.scope.mobile.map.${mode}Hint`))}</small></span>
        </label>`;
    }).join('');
}

function renderAll() {
    renderResult();
    renderTabs();
    renderCategories();
    renderValues();
    renderMapOptions();
}

export function openMobilePlanningScope() {
    if (!dialog || !isPhoneUi() || state.ui.mode !== 'aussendienst') return;
    defs = activeDefs();
    selections = planningSelectionsFromDimensions(defs, state.dims, state.tour.bezirk);
    activeDimension = defs[0]?.id || '';
    mapMode = MAP_MODES.includes(state.ui.mobileAreaColorMode) ? state.ui.mobileAreaColorMode : 'auto';
    activeTab = 'filter';
    document.getElementById('planning-scope-search').value = '';
    renderAll();
    dialog.showModal();
}

function apply() {
    applyPlanningSelections(defs, state.dims, selections);
    state.tour.bezirk = '__all__';
    state.ui.mobileAreaColorMode = mapMode;
    const count = resultCustomers().length;
    emit('filters:changed');
    emit('tour:scope-changed');
    emit('mobile-area-color:changed');
    emit('settings:persist');
    dialog.close();
    showToast(t(count === 1 ? 'tour.scope.mobile.appliedOne' : 'tour.scope.mobile.appliedMany', { count }), 'success', 5000);
}

export function initMobilePlanningScope() {
    dialog = document.getElementById('mobile-planning-scope-dialog');
    if (!dialog) return;
    dialog.querySelectorAll('[data-mobile-planning-close]').forEach((button) => button.addEventListener('click', () => dialog.close()));
    dialog.addEventListener('cancel', () => dialog.close());
    dialog.addEventListener('click', (event) => {
        const tab = event.target.closest('[data-planning-tab]');
        if (tab) { activeTab = tab.dataset.planningTab; renderTabs(); return; }
        const category = event.target.closest('[data-planning-dimension]');
        if (category) {
            activeDimension = category.dataset.planningDimension;
            document.getElementById('planning-scope-search').value = '';
            renderCategories(); renderValues();
        }
    });
    document.getElementById('planning-scope-search').addEventListener('input', renderValues);
    document.getElementById('planning-scope-values').addEventListener('change', (event) => {
        const input = event.target.closest('[data-planning-value-index]');
        if (!input) return;
        const values = JSON.parse(event.currentTarget.dataset.visibleValues || '[]');
        const value = values[Number(input.dataset.planningValueIndex)];
        const selected = selections.get(activeDimension) || new Set();
        input.checked ? selected.add(value) : selected.delete(value);
        selections.set(activeDimension, selected);
        renderResult(); renderCategories(); renderValues();
    });
    document.getElementById('planning-scope-map-options').addEventListener('change', (event) => {
        if (event.target.name === 'planning-map-mode') mapMode = event.target.value;
    });
    document.getElementById('planning-scope-reset').addEventListener('click', () => {
        selections = new Map(defs.map((def) => [def.id, new Set()]));
        mapMode = 'auto';
        document.getElementById('planning-scope-search').value = '';
        renderAll();
    });
    document.getElementById('planning-scope-apply').addEventListener('click', apply);
    on('mobile-planning-scope:open', openMobilePlanningScope);
    on('locale:changed', () => { if (dialog.open) renderAll(); });
    onFaceChange((face) => { if (face === 'desktop' && dialog.open) dialog.close(); });
}
