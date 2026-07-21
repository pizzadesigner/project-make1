// A clickable source affordance. Every number in the app carries one — the whole
// point of the dashboard is that figures are traceable. Collapsed it reads
// "Source"; expanded it reveals the citation, an outbound link, and the date the
// source was accessed (provenance, not decoration).

import { t } from '../lib/i18n.js';
import { formatDate } from '../lib/format.js';

/**
 * @param {HTMLElement} container
 * @param {{ url: string, label: string, accessed?: string|null, locale: 'en'|'de' }} props
 * @returns {{ update(): void, destroy(): void }}
 */
export function render(container, props) {
  const details = document.createElement('details');
  details.className = 'source-chip';

  const accessed = props.accessed
    ? `<span class="source-chip__date">${escapeHtml(
        t('city.sourceAccessed').replace('{date}', formatDate(props.accessed, props.locale)),
      )}</span>`
    : '';

  details.innerHTML = `
    <summary class="source-chip__summary">${t('city.source')}</summary>
    <div class="source-chip__body">
      <a class="source-chip__link" href="${encodeURI(props.url)}" target="_blank" rel="noopener noreferrer">
        ${escapeHtml(props.label)}
      </a>
      ${accessed}
    </div>
  `;
  container.append(details);

  return {
    update() {},
    destroy() {
      details.remove();
    },
  };
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}
