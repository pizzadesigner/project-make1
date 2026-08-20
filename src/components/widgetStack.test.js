// The L1→L2 seam: entering a criterion opens the region and stands its modules
// in it, and leaving takes the whole thing away again.
//
// The teardown half is the one worth a test. The region is rebuilt from
// innerHTML on every sync, so anything not cleared first is left in the DOM.
// Under reduced motion there is no exit animation to wait for either, which
// makes "clears in the same tick" a behaviour and not just a duration.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from './widgetStack.js';

/** jsdom ships no matchMedia, and a11y.js asks it whether to animate. */
function stubReducedMotion(reduce) {
  window.matchMedia = () => ({ matches: reduce });
}

const props = {
  project: { id: 'koeln-test', citySlug: 'koeln' },
  activeCriterion: null,
  metrics: { problemFit: null, impact: null, adoption: null },
  impactSubMetrics: [],
  modalSplitTarget: null,
  problemFit: null,
  comingSoon: false,
  onSelectCriterion: () => {},
};

let container;
let stack;

beforeEach(() => {
  stubReducedMotion(false);
  container = document.createElement('div');
  document.body.append(container);
  stack = render(container, props);
});

afterEach(() => {
  stack.destroy();
  container.remove();
});

const region = () => container.querySelector('.widget-detail');
const modules = () => container.querySelectorAll('.widget-detail__module');

describe('entering L2', () => {
  it('opens the region with its full set of modules', () => {
    stack.update({ ...props, activeCriterion: 'adoption' });
    expect(region().hidden).toBe(false);
    expect(modules()).toHaveLength(6);
  });

  // Each module's position in the three staggered columns, the order it flies
  // out in, and the path it takes all hang off this class (see widgets.css), so
  // a module without one would land on top of module 1.
  it('gives every module its own place in the arrangement', () => {
    stack.update({ ...props, activeCriterion: 'adoption' });
    const places = [...modules()].map((module) =>
      [...module.classList].find((name) => name.startsWith('widget-detail__module--')),
    );
    expect(places).toEqual([1, 2, 3, 4, 5, 6].map((n) => `widget-detail__module--${n}`));
  });

  it('opens on the side its widget sits on', () => {
    stack.update({ ...props, activeCriterion: 'problemFit' });
    expect(region().classList.contains('widget-detail--left')).toBe(true);
    stack.update({ ...props, activeCriterion: null });
    stack.update({ ...props, activeCriterion: 'impact' });
    expect(region().classList.contains('widget-detail--right')).toBe(true);
  });

  // The modules are empty shells until content is moved into them
  // (detailContent.js), and an empty shell must not be announced as if it held
  // a figure.
  it('draws the arrows between the modules they join', () => {
    stack.update({ ...props, activeCriterion: 'adoption' });
    expect(region().querySelectorAll('.connector__line')).toHaveLength(2);
  });

  // The widgets left standing on the map's side are context at L2. They are
  // already inert and dimmed; stepping them down in size is what stops them
  // competing with the modules for the same glance.
  it('steps the widgets on the map side down in size', () => {
    stack.update({ ...props, activeCriterion: 'impact' });
    const bystander = container.querySelector('.widget--problemFit');
    const covered = container.querySelector('.widget--adoption');
    expect(bystander.style.transform).toBe('scale(0.78)');
    expect(bystander.style.transformOrigin).toBe('top left');
    // The ones the modules cover are out of sight, so they keep their size.
    expect(covered.style.transform).toBe('scale(1)');
    expect(covered.style.opacity).toBe('0');
  });

  it('keeps the empty scaffold out of the accessibility tree', () => {
    stack.update({ ...props, activeCriterion: 'adoption' });
    expect(region().querySelector('.widget-detail__modules').getAttribute('aria-hidden')).toBe(
      'true',
    );
  });
});

describe('leaving L2', () => {
  it('clears the region completely', () => {
    stack.update({ ...props, activeCriterion: 'adoption' });
    stack.update({ ...props, activeCriterion: null });
    // Reduced motion is off but jsdom resolves no token, so the hold is 0 and
    // the region has already cleared — what this pins is that it cleared
    // completely rather than being merely hidden.
    expect(region().hidden).toBe(true);
    expect(region().children).toHaveLength(0);
    expect(modules()).toHaveLength(0);
    expect(container.querySelector('.connector')).toBeNull();
  });

  it('clears in the same tick when the user asked for no motion', () => {
    stubReducedMotion(true);
    stack.update({ ...props, activeCriterion: 'adoption' });
    stack.update({ ...props, activeCriterion: null });
    expect(region().hidden).toBe(true);
    expect(region().classList.contains('is-leaving')).toBe(false);
    expect(modules()).toHaveLength(0);
  });
});

describe('re-syncing a region that is already open', () => {
  it('leaves the modules where they are instead of replaying the entrance', () => {
    stack.update({ ...props, activeCriterion: 'adoption' });
    expect(region().classList.contains('is-settled')).toBe(false);
    stack.update({ ...props, activeCriterion: 'adoption' });
    expect(region().classList.contains('is-settled')).toBe(true);
  });
});

describe('destroying the stack', () => {
  it('leaves nothing behind', () => {
    stack.update({ ...props, activeCriterion: 'adoption' });
    stack.destroy();
    expect(container.querySelector('.widget-stack')).toBeNull();
    expect(container.querySelector('.widget-detail')).toBeNull();
    // afterEach destroys again — a second teardown must be harmless.
  });
});
