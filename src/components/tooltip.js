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
      // Keep the box within its anchor so an edge point — e.g. the first dot of a
      // sparkline sitting at the chart's left edge — isn't half-clipped by a
      // scrolling ancestor (the L2 panel). Measure the rendered box so this holds
      // whatever transform the tooltip's own styles apply, then nudge x back in by
      // however far it currently overflows.
      const box = el.getBoundingClientRect();
      const bounds = container.getBoundingClientRect();
      const overflowRight = box.right - bounds.right;
      const overflowLeft = bounds.left - box.left;
      if (overflowRight > 0) el.style.left = `${x - overflowRight}px`;
      else if (overflowLeft > 0) el.style.left = `${x + overflowLeft}px`;
    },
    hide() {
      el.hidden = true;
    },
    destroy() {
      el.remove();
    },
  };
}
