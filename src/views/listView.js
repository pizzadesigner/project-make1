// Accessible, sortable list of every project — the keyboard/screen-reader
// equivalent of the map, and genuinely faster for power users. Structural shell
// for now; rows populate once the data layer lands.

import { t } from '../lib/i18n.js';

/**
 * @param {HTMLElement} container
 * @param {object} props
 * @returns {{ update(props: object): void, destroy(): void }}
 */
export function render(container, props) {
  const section = document.createElement('section');
  section.className = 'view view--list';
  section.innerHTML = `
    <header class="view__header">
      <nav class="view__nav">
        <a class="button" href="#/">${t('nav.backToMap')}</a>
      </nav>
      <h1 class="view__title">${t('list.heading')}</h1>
    </header>
    <table class="project-table">
      <thead>
        <tr>
          <th scope="col">${t('list.colCity')}</th>
          <th scope="col">${t('list.colProject')}</th>
          <th scope="col">${t('list.colTarget')}</th>
          <th scope="col">${t('list.colBudget')}</th>
          <th scope="col">${t('list.colTransferability')}</th>
        </tr>
      </thead>
      <tbody data-rows></tbody>
    </table>
  `;
  container.append(section);

  const body = section.querySelector('[data-rows]');

  function update(next) {
    if (next.status !== 'ready' || next.projects.length === 0) {
      const message = next.status === 'error' ? t('state.error') : t('state.loading');
      body.innerHTML = `<tr><td colspan="5" class="state">${message}</td></tr>`;
    }
  }

  update(props);

  return {
    update,
    destroy() {
      section.remove();
    },
  };
}
