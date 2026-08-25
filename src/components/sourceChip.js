// A link to the source. Every number in the app carries one — the whole point of
// the dashboard is that figures are traceable, and the shortest path from a
// figure to the document behind it is one click.
//
// It is one glyph: the outbound arrow, in a circle the size of a line of body
// text. The citation arrives on hover and on keyboard focus (.link-hint) and
// names the source and the date it was read; pressing the chip opens that
// source. It used to be a <details> that opened a panel holding the same
// citation as a second link, which put two clicks between a figure and its
// evidence and left the name invisible until the first of them.
//
// The name is a hint rather than the chip's visible content on purpose: a card
// can end on three of these, and three citations in a row read as content —
// they take the eye before the figure they belong to does. Nothing about it is
// mouse-only: the arrow carries the citation as its accessible name, so the
// chip announces where it goes to a screen reader and answers a keyboard focus
// with the same words the mouse gets.

import { t } from '../lib/i18n.js';
import { formatDate } from '../lib/format.js';

/**
 * @param {HTMLElement} container
 * @param {{ url: string, label: string, accessed?: string|null, locale: 'en'|'de' }} props
 * @returns {{ update(): void, destroy(): void }}
 */
export function render(container, props) {
  const link = document.createElement('a');
  link.className = 'source-chip';
  link.href = encodeURI(props.url);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';

  // Only some rows carry a date — projects.csv has the column, metrics.csv does
  // not — so the second line is there when the provenance is and absent when it
  // is not. Never a placeholder date: an invented one would be worse than none.
  const accessed = props.accessed
    ? `<span class="link-hint__note">${escapeHtml(
        t('city.sourceAccessed').replace('{date}', formatDate(props.accessed, props.locale)),
      )}</span>`
    : '';

  // The accessible name says what the link is and where it goes, in that order.
  // The hint repeats it visually and so is hidden from the accessibility tree —
  // otherwise the citation would be announced twice.
  link.setAttribute('aria-label', `${t('city.source')}: ${props.label}`);
  // Opts this link into the floating hint box (hintLayer.js); the .link-hint
  // inside stays as the text that box draws.
  link.dataset.hint = '';
  link.innerHTML = `
    <span class="link-hint" aria-hidden="true">
      <span class="link-hint__name">${escapeHtml(props.label)}</span>
      ${accessed}
    </span>
  `;
  container.append(link);

  return {
    update() {},
    destroy() {
      link.remove();
    },
  };
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}
