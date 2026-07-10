// Start screen. For now this is a structural shell: header, the "What is
// SDG 11?" panel, a route into the accessible list view, and a skeleton where
// the Europe map will mount. The map component lands in a later step.

import { t } from '../lib/i18n.js';

/**
 * @param {HTMLElement} container
 * @param {object} props
 * @returns {{ update(props: object): void, destroy(): void }}
 */
export function render(container, props) {
  const section = document.createElement('section');
  section.className = 'view view--map';
  section.innerHTML = `
    <header class="view__header">
      <h1 class="view__title">${t('map.heading')}</h1>
      <p class="view__tagline">${t('app.tagline')}</p>
      <nav class="view__nav">
        <a class="button" href="#/list">${t('nav.list')}</a>
      </nav>
    </header>

    <details class="panel" open>
      <summary class="panel__summary">${t('sdg11.panelTitle')}</summary>
      <p class="panel__body">${t('sdg11.panelBody')}</p>
    </details>

    <div class="map-stage" role="img" aria-label="${t('map.heading')}">
      <div class="skeleton skeleton--map" data-state></div>
    </div>
  `;
  container.append(section);

  const stateSlot = section.querySelector('[data-state]');

  function update(next) {
    if (next.status === 'error') {
      stateSlot.className = 'state state--error';
      stateSlot.textContent = t('state.error');
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
