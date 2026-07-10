// A single positioned tooltip element, shown on marker hover/focus. The host
// container must be positioned; the tooltip places itself relative to it.

/**
 * @param {HTMLElement} container  A positioned element to anchor within.
 * @returns {{ show(html: string, x: number, y: number): void, hide(): void, destroy(): void }}
 */
export function renderTooltip(container) {
  const el = document.createElement('div');
  el.className = 'tooltip';
  el.setAttribute('role', 'status');
  el.hidden = true;
  container.append(el);

  return {
    show(html, x, y) {
      el.innerHTML = html;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.hidden = false;
    },
    hide() {
      el.hidden = true;
    },
    destroy() {
      el.remove();
    },
  };
}
