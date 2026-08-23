// A clickable source affordance. Every number in the app carries one — the whole
// point of the dashboard is that figures are traceable. Collapsed it is the
// outbound arrow and nothing else; expanded it reveals the citation, an outbound
// link, and the date the source was accessed (provenance, not decoration).
//
// The word "Source" is on hover and focus rather than in the chip. A card can
// end on three of these, and three word-chips in a row read as content — they
// take the eye before the figure they belong to does. The arrow alone is the
// same affordance at a tenth of the weight, and the word is one hover away for
// anyone who does not recognise it. It is never *only* on hover: the arrow
// carries it as its accessible name, so the chip announces itself as "Source"
// to a screen reader and answers a keyboard focus with the same label the mouse
// gets.

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

  const label = escapeHtml(t('city.source'));
  details.innerHTML = `
    <summary class="source-chip__summary" aria-label="${label}">
      <span class="source-chip__hint" aria-hidden="true">${label}</span>
    </summary>
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
