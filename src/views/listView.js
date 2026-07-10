// Accessible, sortable table of every project — the keyboard/screen-reader
// equivalent of the map, and faster for power users. Column headers sort;
// aria-sort announces the state. Owns loading / error / empty states.

import { t } from '../lib/i18n.js';
import { formatCurrency, formatNumber } from '../lib/format.js';
import { SDG11_TARGETS } from '../lib/sdg11.js';

/** Column definitions: how each sorts and renders. */
const COLUMNS = [
  { key: 'city', labelKey: 'list.colCity', value: (p) => p.cityDisplay, numeric: false },
  { key: 'project', labelKey: 'list.colProject', value: (p) => p.projectTitle, numeric: false },
  { key: 'target', labelKey: 'list.colTarget', value: (p) => p.sdg11Target, numeric: false },
  { key: 'budget', labelKey: 'list.colBudget', value: (p) => p.budgetEur, numeric: true },
  {
    key: 'transferability',
    labelKey: 'list.colTransferability',
    value: (p) => p.transferabilityScore,
    numeric: true,
  },
];

export function render(container, props) {
  const root = document.createElement('section');
  root.className = 'view view--list';
  root.innerHTML = `
    <header class="view__header">
      <nav class="view__nav"><a class="button" href="#/">${t('nav.backToMap')}</a></nav>
      <h1 class="view__title">${t('list.heading')}</h1>
    </header>
    <div data-table></div>
  `;
  container.append(root);
  const host = root.querySelector('[data-table]');

  let sort = { key: 'city', dir: 1 };

  function onSort(key) {
    sort = sort.key === key ? { key, dir: -sort.dir } : { key, dir: 1 };
    draw(host, currentProjects, props.locale, sort, onSort);
  }

  let currentProjects = [];

  function update(next) {
    if (next.status === 'error') return showState(host, 'state--error', t('state.error'));
    if (next.status !== 'ready') return showState(host, '', t('state.loading'));
    if (next.projects.length === 0) return showState(host, 'state--empty', t('state.empty'));
    currentProjects = next.projects;
    draw(host, currentProjects, next.locale, sort, onSort);
    return undefined;
  }

  update(props);

  return {
    update,
    destroy() {
      root.remove();
    },
  };
}

function draw(host, projects, locale, sort, onSort) {
  const table = document.createElement('table');
  table.className = 'project-table';
  table.append(buildHead(sort, onSort), buildBody(projects, locale, sort));
  host.replaceChildren(table);
}

function buildHead(sort, onSort) {
  const thead = document.createElement('thead');
  const row = document.createElement('tr');
  for (const column of COLUMNS) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.setAttribute('aria-sort', ariaSort(column.key, sort));
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'project-table__sort';
    button.textContent = t(column.labelKey);
    button.addEventListener('click', () => onSort(column.key));
    th.append(button);
    row.append(th);
  }
  thead.append(row);
  return thead;
}

function buildBody(projects, locale, sort) {
  const tbody = document.createElement('tbody');
  for (const project of sortProjects(projects, sort, locale)) {
    tbody.append(buildRow(project, locale));
  }
  return tbody;
}

function buildRow(project, locale) {
  const tr = document.createElement('tr');
  const target = SDG11_TARGETS[project.sdg11Target];
  tr.innerHTML = `
    <th scope="row"><a href="#/city/${encodeURIComponent(project.citySlug)}">${escapeHtml(project.cityDisplay)}</a></th>
    <td>${escapeHtml(project.projectTitle)}</td>
    <td>${target.glyph} ${escapeHtml(project.sdg11Target)}</td>
    <td>${escapeHtml(formatCurrency(project.budgetEur, locale))}</td>
    <td>${escapeHtml(formatNumber(project.transferabilityScore, locale))}</td>
  `;
  return tr;
}

function sortProjects(projects, sort, locale) {
  const column = COLUMNS.find((c) => c.key === sort.key);
  return [...projects].sort((a, b) => sort.dir * compare(column, a, b, locale));
}

function compare(column, a, b, locale) {
  const va = column.value(a);
  const vb = column.value(b);
  if (column.numeric) return (va ?? -Infinity) - (vb ?? -Infinity); // nulls sort low
  return String(va).localeCompare(String(vb), locale);
}

function ariaSort(key, sort) {
  if (sort.key !== key) return 'none';
  return sort.dir === 1 ? 'ascending' : 'descending';
}

function showState(host, modifier, message) {
  const box = document.createElement('div');
  box.className = `state ${modifier}`.trim();
  box.textContent = message;
  host.replaceChildren(box);
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}
