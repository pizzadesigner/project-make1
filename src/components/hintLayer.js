// One floating box for every hover hint on the page: a source chip's citation,
// a link's hostname, a card's info point.
//
// The hints used to open where they stood, absolutely positioned inside the card
// they belonged to. That cannot be made to work here, because two of their
// ancestors scroll — the L2 region always, and an opened L3 card — and a scroll
// container clips its descendants no matter where inside it they are put.
// Measured at 1440x900 it cost a modal-split citation 204px of itself, and a
// funding link 61px, while at 1920 nothing clipped at all, which is what made it
// look occasional rather than structural.
//
// So the box lives outside all of that instead: one element, fixed to the
// viewport, positioned against whichever anchor was just hovered or focused.
// Nothing can clip it, and there is one of it rather than one per hint.
//
// An anchor opts in with `data-hint` and keeps its own `.link-hint` child, which
// stays in the DOM as the accessible description (aria-describedby) and is
// visually hidden — that element is the content; this is only where it is drawn.
//
// render(container, { }) → { destroy() }. The container is a view root; hints
// are found by delegation from there, so a view mounts one of these and every
// hint inside it works.

import { motionMs } from '../lib/a11y.js';

/** How far the box sits from the anchor, and from the edge of the screen. */
const GAP = 8;
const MARGIN = 8;

export function render(container) {
  const node = document.createElement('div');
  node.className = 'hint-layer';
  node.setAttribute('role', 'presentation');
  node.hidden = true;
  container.append(node);

  let anchor = null;
  let hideTimer = null;

  function show(next) {
    const hint = next.querySelector(':scope > .link-hint');
    if (!hint) return;
    clearTimeout(hideTimer);
    hideTimer = null;
    anchor = next;
    node.innerHTML = hint.innerHTML;
    node.hidden = false;
    node.classList.remove('is-leaving');
    place(node, next);
  }

  /** Held for the fade rather than pulled out from under it — the box is one
   * element, so a hint opening elsewhere reuses it and cancels this. */
  function hide() {
    if (node.hidden || hideTimer) return;
    anchor = null;
    const fade = motionMs('--motion-fast');
    node.classList.add('is-leaving');
    if (fade === 0) return clear();
    hideTimer = setTimeout(clear, fade);
    return undefined;
  }

  function clear() {
    clearTimeout(hideTimer);
    hideTimer = null;
    node.hidden = true;
    node.classList.remove('is-leaving');
    node.replaceChildren();
  }

  function onOver(event) {
    const next = event.target.closest('[data-hint]');
    if (!next) return hide();
    if (next !== anchor) show(next);
    return undefined;
  }

  function onOut(event) {
    // Moving within the same anchor is not leaving it.
    if (event.relatedTarget?.closest?.('[data-hint]') === anchor) return;
    hide();
  }

  function onFocusIn(event) {
    const next = event.target.closest('[data-hint]');
    if (next) show(next);
    else if (anchor) hide();
  }

  // Scrolling moves the anchor out from under the box, and the box is fixed to
  // the viewport rather than to the thing it describes. Closing is the honest
  // answer to that — a box that stayed put would be pointing at whatever had
  // scrolled into its place. Captured, because the scroll happens on the region
  // inside, which does not bubble.
  const onScroll = () => hide();

  // WCAG 1.4.13: content shown on hover or focus has to be dismissable without
  // moving the pointer. The event is only swallowed when a hint was actually
  // open, so Escape still steps back a layer the rest of the time.
  function onKeydown(event) {
    if (event.key !== 'Escape' || node.hidden) return;
    event.stopPropagation();
    clear();
  }

  container.addEventListener('pointerover', onOver);
  container.addEventListener('pointerout', onOut);
  container.addEventListener('focusin', onFocusIn);
  container.addEventListener('focusout', hide);
  document.addEventListener('scroll', onScroll, true);
  document.addEventListener('keydown', onKeydown, true);
  window.addEventListener('resize', onScroll);

  return {
    destroy() {
      clearTimeout(hideTimer);
      container.removeEventListener('pointerover', onOver);
      container.removeEventListener('pointerout', onOut);
      container.removeEventListener('focusin', onFocusIn);
      container.removeEventListener('focusout', hide);
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('keydown', onKeydown, true);
      window.removeEventListener('resize', onScroll);
      node.remove();
    },
  };
}

/** Put the box where it fits.
 *
 * Below the anchor and aligned to its left edge by preference, because that is
 * where the eye already is. Flipped above when the room below runs out, and slid
 * back along the other axis when the box would leave the screen — the anchors
 * near the right edge are exactly the ones whose hints used to be cut.
 *
 * The box is measured after its content is in and before it is placed, so the
 * decision is made against the size it actually came out at rather than a
 * maximum it may not have reached.
 */
function place(node, anchor) {
  const target = anchor.getBoundingClientRect();
  const box = node.getBoundingClientRect();
  const below = target.bottom + GAP;
  const above = target.top - GAP - box.height;
  const fitsBelow = below + box.height <= window.innerHeight - MARGIN;
  const top = fitsBelow || above < MARGIN ? below : above;
  const rightmost = window.innerWidth - MARGIN - box.width;
  const left = Math.max(MARGIN, Math.min(target.left, rightmost));
  node.style.top = `${Math.round(top)}px`;
  node.style.left = `${Math.round(left)}px`;
}
