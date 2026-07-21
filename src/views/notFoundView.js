import { t } from '../lib/i18n.js';

/**
 * @param {HTMLElement} container
 * @returns {{ update(): void, destroy(): void }}
 */
export function render(container) {
  const section = document.createElement('section');
  section.className = 'view view--not-found';
  section.innerHTML = `
    <h1 class="view__title">${t('notFound.heading')}</h1>
    <p>${t('notFound.body')}</p>
    <nav class="view__nav">
      <a class="button" href="#/">${t('nav.backToMap')}</a>
    </nav>
  `;
  container.append(section);

  return {
    update() {},
    destroy() {
      section.remove();
    },
  };
}
