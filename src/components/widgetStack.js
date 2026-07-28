// The three Exploration-layer widgets (Problem Fit, Impact, Adoption
// Requirements) shown around the map while a city is focused (L1). Each is
// independently clickable — clicking one expands it and recedes the other two
// (the "parallax stack" from the Ripples template). Hidden entirely when no
// city is focused or once the L2 detail overlay is open.
//
// render(container, { project, activeCriterion, metrics, onSelectCriterion })
// and the component never reads the store — data comes down, the clicked
// widget goes up via onSelectCriterion('problemFit'|'impact'|'adoption').
// TODO(data): every widget currently renders a placeholder shell — its headline
// figure is not researched yet (widgetMetricsForProject returns nulls), so no
// fabricated number is shown (Neutrality/Honesty — see docs/DESIGN_RATIONALE.md).

import { t } from '../lib/i18n.js';

/** The three widgets, in stacked order. */
const WIDGETS = ['problemFit', 'impact', 'adoption'];

const BASE_LAYOUT = {
  problemFit: {
    top: '16px',
    left: '16px',
    width: '220px',
    padding: '14px 16px',
    opacity: '1',
    z: '10',
  },
  impact: {
    top: '146px',
    left: '16px',
    width: '220px',
    padding: '14px 16px',
    opacity: '1',
    z: '10',
  },
  adoption: {
    top: '256px',
    left: '16px',
    width: '220px',
    padding: '14px 16px',
    opacity: '1',
    z: '10',
  },
};

/** Ripples' parallax stack: the active widget grows and rises; the rest recede. */
function widgetLayout(activeCriterion) {
  const layout = Object.fromEntries(WIDGETS.map((key) => [key, { ...BASE_LAYOUT[key] }]));
  if (!activeCriterion) return layout;

  Object.assign(layout[activeCriterion], { top: '16px', width: '280px', z: '15' });
  const receded = WIDGETS.filter((key) => key !== activeCriterion);
  receded.forEach((key, i) => {
    Object.assign(layout[key], {
      top: `${12 + i * 8}px`,
      left: `${24 + i * 6}px`,
      width: '180px',
      padding: '8px 12px',
      opacity: i === 0 ? '0.3' : '0.2',
    });
  });
  return layout;
}

export function render(container, props) {
  const root = document.createElement('div');
  root.className = 'widget-stack';
  root.hidden = true;

  const widgets = WIDGETS.map((key) => buildWidget(key, props.onSelectCriterion));
  root.append(...widgets.map((w) => w.node));
  container.append(root);

  function update(next) {
    if (!next.project) {
      root.hidden = true;
      return;
    }
    root.hidden = false;
    const layout = widgetLayout(next.activeCriterion);
    for (const widget of widgets) {
      applyWidget(widget, layout[widget.kind], widgetContent(widget.kind, next.metrics));
    }
  }

  update(props);

  return {
    update,
    destroy() {
      root.remove();
    },
  };
}

function buildWidget(kind, onSelectCriterion) {
  const node = document.createElement('div');
  node.className = `widget widget--${kind}`;
  node.setAttribute('role', 'button');
  node.setAttribute('tabindex', '0');
  node.addEventListener('click', () => onSelectCriterion(kind));
  node.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelectCriterion(kind);
    }
  });
  return { node, kind };
}

function applyWidget(widget, layout, contentHtml) {
  Object.assign(widget.node.style, {
    top: layout.top,
    left: layout.left,
    width: layout.width,
    padding: layout.padding,
    opacity: layout.opacity,
    zIndex: layout.z,
  });
  widget.node.innerHTML = contentHtml;
}

function widgetHeader(label, chip) {
  return `
    <div class="widget__header">
      <span class="widget__label">${label}</span>
      ${chip ? `<span class="widget__chip">${chip}</span>` : ''}
    </div>`;
}

/** A widget's body. Until a real headline figure exists the widget is an
 * intentional placeholder shell (marked as such), never a fabricated number. */
function widgetContent(criterion, metrics) {
  const label = t(`criteria.${criterion}`);
  const value = metrics[criterion];
  if (value == null) {
    return (
      widgetHeader(label, t('widget.placeholder')) +
      `<div class="widget__bar widget__bar--empty"></div>
       <div class="widget__note">${t('widget.placeholderNote')}</div>`
    );
  }
  return (
    widgetHeader(label, null) +
    `<div class="widget__value-row"><span class="widget__value">${value}</span></div>`
  );
}
