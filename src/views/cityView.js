// City / project detail view. Structural shell for now — the cards, silhouette,
// chart and source chips arrive in a later step. It already reads the slug from
// the route so deep links resolve to the right city.

import { t } from '../lib/i18n.js';

/**
 * @param {HTMLElement} container
 * @param {object} props
 * @returns {{ update(props: object): void, destroy(): void }}
 */
export function render(container, props) {
  const section = document.createElement('section');
  section.className = 'view view--city';
  container.append(section);

  function update(next) {
    const slug = next.route.params.slug ?? '';
    section.innerHTML = `
      <header class="view__header">
        <nav class="view__nav">
          <a class="button" href="#/">${t('nav.backToMap')}</a>
        </nav>
        <h1 class="view__title" data-city>${slug}</h1>
      </header>
      <div class="skeleton skeleton--card"></div>
    `;
  }

  update(props);

  return {
    update,
    destroy() {
      section.remove();
    },
  };
}
