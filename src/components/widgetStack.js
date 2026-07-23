// The three map-overlay widgets (Data Quality, Transparency, Inequality) shown
// while a city is focused. Each is independently clickable — like the criteria
// chips in mapView.js, clicking one expands it and recedes the other two (the
// "parallax stack" from the Ripples template). Hidden entirely when no city is
// focused.
//
// render(container, { project, activeCriterion, metrics, onSelectCriterion })
// and the component never reads the store — data comes down, the clicked
// criterion goes up via onSelectCriterion('dq'|'tr'|'ineq').

import { t } from '../lib/i18n.js';

const BASE_LAYOUT = {
  dq: { top: '16px', left: '16px', width: '220px', padding: '14px 16px', opacity: '1', z: '10' },
  tr: { top: '146px', left: '16px', width: '220px', padding: '14px 16px', opacity: '1', z: '10' },
  ineq: { top: '256px', left: '16px', width: '220px', padding: '14px 16px', opacity: '1', z: '10' },
};

/** Ripples' parallax stack: the active widget grows and rises; the rest recede. */
function widgetLayout(activeCriterion) {
  const layout = {
    dq: { ...BASE_LAYOUT.dq },
    tr: { ...BASE_LAYOUT.tr },
    ineq: { ...BASE_LAYOUT.ineq },
  };
  if (activeCriterion === 'dq') {
    Object.assign(layout.dq, { width: '280px', z: '15' });
    Object.assign(layout.tr, {
      top: '20px',
      left: '24px',
      width: '180px',
      padding: '8px 12px',
      opacity: '0.3',
    });
    Object.assign(layout.ineq, {
      top: '26px',
      left: '30px',
      width: '180px',
      padding: '8px 12px',
      opacity: '0.2',
    });
  } else if (activeCriterion === 'tr') {
    Object.assign(layout.tr, { top: '16px', width: '280px', z: '15' });
    Object.assign(layout.dq, {
      top: '12px',
      left: '24px',
      width: '180px',
      padding: '8px 12px',
      opacity: '0.3',
    });
    Object.assign(layout.ineq, {
      top: '20px',
      left: '30px',
      width: '180px',
      padding: '8px 12px',
      opacity: '0.2',
    });
  } else if (activeCriterion === 'ineq') {
    Object.assign(layout.ineq, { top: '16px', width: '320px', z: '15' });
    Object.assign(layout.dq, {
      top: '12px',
      left: '24px',
      width: '180px',
      padding: '8px 12px',
      opacity: '0.3',
    });
    Object.assign(layout.tr, {
      top: '16px',
      left: '30px',
      width: '180px',
      padding: '8px 12px',
      opacity: '0.2',
    });
  }
  return layout;
}

export function render(container, props) {
  const root = document.createElement('div');
  root.className = 'widget-stack';
  root.hidden = true;

  const dq = buildWidget('dq', props.onSelectCriterion);
  const tr = buildWidget('tr', props.onSelectCriterion);
  const ineq = buildWidget('ineq', props.onSelectCriterion);
  root.append(dq.node, tr.node, ineq.node);
  container.append(root);

  function update(next) {
    if (!next.project) {
      root.hidden = true;
      return;
    }
    root.hidden = false;
    const layout = widgetLayout(next.activeCriterion);
    applyWidget(dq, layout.dq, dataQualityContent(next.metrics));
    applyWidget(tr, layout.tr, transparencyContent(next.metrics));
    applyWidget(ineq, layout.ineq, inequalityContent(next.metrics));
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

function noData() {
  return `
    <div class="widget__bar widget__bar--empty"></div>
    <div class="widget__no-data">${t('widget.noData')}</div>`;
}

function dataQualityContent(metrics) {
  const value = metrics.dataQuality;
  if (value == null) {
    return widgetHeader(t('criteria.dataQuality'), null) + noData();
  }
  return (
    widgetHeader(t('criteria.dataQuality'), `DQ ${value}`) +
    `<div class="widget__value-row">
      <span class="widget__value">${value}</span>
      <span class="widget__value-unit">${t('widget.outOf100')}</span>
    </div>
    <div class="widget__bar"><div class="widget__bar-fill" style="width: ${value}%"></div></div>
    <div class="widget__note">${value}% ${t('widget.complete')}</div>`
  );
}

function transparencyContent(metrics) {
  const status = metrics.transparency;
  if (status == null) {
    return widgetHeader(t('criteria.transparency'), null) + noData();
  }
  return (
    widgetHeader(t('criteria.transparency'), null) +
    `<div class="widget__status widget__status--${status}">${t(`widget.status.${status}`)}</div>`
  );
}

function inequalityContent(metrics) {
  const value = metrics.inequality;
  if (value == null) {
    return widgetHeader(t('criteria.inequality'), null) + noData();
  }
  return (
    widgetHeader(t('criteria.inequality'), null) +
    `<div class="widget__value-row">
      <span class="widget__value">${value.toFixed(2)}</span>
      <span class="widget__value-unit">${t('widget.gini')}</span>
    </div>`
  );
}
