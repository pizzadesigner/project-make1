// Start screen. Owns the page shell (title, SDG 11 panel, target filter) and the
// lifecycle of the europeMap component, plus the loading/error/empty states so
// the stage never shows a half-drawn map.

import { t } from '../lib/i18n.js';
import { SDG11_TARGET_CODES, SDG11_TARGETS } from '../lib/sdg11.js';
import * as europeMap from '../components/europeMap.js';

/**
 * @param {HTMLElement} container
 * @param {object} props
 * @returns {{ update(props: object): void, destroy(): void }}
 */
export function render(container, props) {
  const refs = buildShell(container);
  let mapHandle = null;
  let filterButtons = null;

  function update(next) {
    if (next.status === 'error') {
      teardownMap();
      return showState(refs.stage, 'state--error', t('state.error'));
    }
    if (next.status !== 'ready' || !next.geo) {
      return showSkeleton(refs.stage);
    }
    if (next.projects.length === 0) {
      teardownMap();
      return showState(refs.stage, 'state--empty', t('state.empty'));
    }

    if (!filterButtons) filterButtons = buildFilterBar(refs.filterBar, next, props.setFilterTarget);
    syncFilterBar(filterButtons, next.filterTarget);
    mountOrUpdateMap(next);
    return undefined;
  }

  function mountOrUpdateMap(next) {
    if (mapHandle) {
      mapHandle.update({ filterTarget: next.filterTarget });
      return;
    }
    refs.stage.replaceChildren();
    mapHandle = europeMap.render(refs.stage, {
      projects: next.projects,
      geo: next.geo,
      filterTarget: next.filterTarget,
      locale: next.locale,
      onSelect: (slug) => props.navigate(`/city/${slug}`),
    });
  }

  function teardownMap() {
    if (!mapHandle) return;
    mapHandle.destroy();
    mapHandle = null;
  }

  update(props);

  return {
    update,
    destroy() {
      teardownMap();
      refs.root.remove();
    },
  };
}

function buildShell(container) {
  const root = document.createElement('section');
  root.className = 'view view--map';
  root.innerHTML = `
    <header class="view__header">
      <h1 class="view__title">${t('map.heading')}</h1>
      <p class="view__tagline">${t('app.tagline')}</p>
      <nav class="view__nav">
        <a class="button" href="#/list">${t('nav.list')}</a>
      </nav>
    </header>
    <details class="panel" open>
      <summary class="panel__summary">${t('sdg11.panelTitle')}</summary>
      <p class="panel__body">${t('sdg11.panelBody')}</p>
    </details>
    <div class="filter-bar" role="group" aria-label="${t('filter.legend')}" data-filter></div>
    <div class="map-stage" data-stage></div>
  `;
  container.append(root);
  return {
    root,
    stage: root.querySelector('[data-stage]'),
    filterBar: root.querySelector('[data-filter]'),
  };
}

function presentTargets(projects) {
  return SDG11_TARGET_CODES.filter((code) =>
    projects.some((project) => project.sdg11Target === code),
  );
}

function buildFilterBar(container, state, setFilterTarget) {
  const buttons = [{ target: null, node: filterButton(t('filter.all'), null) }];
  for (const code of presentTargets(state.projects)) {
    buttons.push({
      target: code,
      node: filterButton(`${SDG11_TARGETS[code].glyph} ${code}`, code),
    });
  }
  for (const { target, node } of buttons) {
    node.addEventListener('click', () => setFilterTarget(target));
    container.append(node);
  }
  return buttons;
}

function filterButton(label, code) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'filter-bar__chip';
  button.textContent = label;
  if (code) {
    button.style.setProperty('--marker-color', `var(${SDG11_TARGETS[code].colorVar})`);
    button.title = t(`sdg.target.${code}`);
  }
  return button;
}

function syncFilterBar(buttons, filterTarget) {
  for (const { target, node } of buttons) {
    node.setAttribute('aria-pressed', String(target === (filterTarget ?? null)));
  }
}

function showSkeleton(stage) {
  stage.replaceChildren();
  const skeleton = document.createElement('div');
  skeleton.className = 'skeleton skeleton--map';
  stage.append(skeleton);
}

function showState(stage, modifier, message) {
  stage.replaceChildren();
  const box = document.createElement('div');
  box.className = `state ${modifier}`;
  box.textContent = message;
  stage.append(box);
}
