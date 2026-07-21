// City / project detail view. Loads cold from a shared link (#/city/:slug):
// resolves the project, builds the card grid, and lazily fetches the city
// silhouette. Every number carries a source chip. Owns loading/error/not-found
// states so a card is never half-populated.

import { t } from '../lib/i18n.js';
import { formatCurrency, formatYear, formatNumber } from '../lib/format.js';
import { SDG11_TARGETS } from '../lib/sdg11.js';
import { projectByCitySlug, metricsForProject, peersForProject } from '../data/selectors.js';
import { loadCitySilhouette } from '../data/load.js';
import * as sourceChip from '../components/sourceChip.js';
import * as lineChart from '../components/lineChart.js';
import * as citySilhouette from '../components/citySilhouette.js';

export function render(container, props) {
  const root = document.createElement('section');
  root.className = 'view view--city';
  root.innerHTML = `
    <nav class="view__nav"><a class="button" href="#/">${t('nav.backToMap')}</a></nav>
    <div data-content></div>
  `;
  container.append(root);
  const content = root.querySelector('[data-content]');

  const children = [];
  let renderedSlug = null;
  let silhouetteToken = 0;

  function clearChildren() {
    for (const child of children.splice(0)) child.destroy();
  }

  function update(next) {
    const slug = next.route.params.slug;
    if (next.status === 'error') {
      clearChildren();
      renderedSlug = null;
      showState('state--error', content);
      return undefined;
    }
    if (next.status !== 'ready') {
      if (!renderedSlug) showSkeleton(content);
      return undefined;
    }
    if (slug === renderedSlug) return undefined;

    clearChildren();
    content.replaceChildren();
    renderedSlug = slug;

    const project = projectByCitySlug(next.projects, slug);
    if (!project) return showNotFound(content);

    renderProject(content, project, next, children);
    lazyLoadSilhouette(content, project, ++silhouetteToken);
    return undefined;
  }

  function lazyLoadSilhouette(host, project, token) {
    const slot = host.querySelector('[data-silhouette]');
    if (!slot) return;
    loadCitySilhouette(project.citySlug)
      .then((geojson) => {
        if (token !== silhouetteToken) return;
        slot.replaceChildren();
        children.push(citySilhouette.render(slot, { geojson, cityDisplay: project.cityDisplay }));
      })
      .catch(() => {
        if (token !== silhouetteToken) return;
        slot.replaceChildren();
        slot.className = 'city-header__silhouette state';
        slot.textContent = t('city.silhouetteUnavailable');
      });
  }

  update(props);

  return {
    update,
    destroy() {
      clearChildren();
      root.remove();
    },
  };
}

function renderProject(content, project, state, children) {
  const grid = elWithClass('div', 'city-grid');
  grid.append(
    headerCard(project),
    aboutCard(project),
    factsCard(project, state.locale, children),
    chartCard(project, metricsForProject(state.metrics, project.id), state.locale, children),
    peersCard(project, peersForProject(state.peers, project.id)),
  );
  content.append(grid);
}

function headerCard(project) {
  const target = SDG11_TARGETS[project.sdg11Target];
  const card = elWithClass('section', 'card city-header');
  card.style.setProperty('--marker-color', `var(${target.colorVar})`);
  card.innerHTML = `
    <div class="city-header__text">
      <span class="target-badge">${target.glyph} ${project.sdg11Target} · ${escapeHtml(t(`sdg.target.${project.sdg11Target}`))}</span>
      <h1 class="city-header__title">${escapeHtml(project.projectTitle)}</h1>
      <p class="city-header__place">${escapeHtml(project.cityDisplay)}, ${escapeHtml(project.country)} · ${escapeHtml(statusLabel(project))}</p>
    </div>
    <div class="city-header__silhouette" data-silhouette><div class="skeleton skeleton--silhouette"></div></div>
  `;
  return card;
}

function aboutCard(project) {
  const card = elWithClass('section', 'card');
  card.innerHTML = `
    <h2 class="card__title">${t('city.about')}</h2>
    <p class="card__lead">${escapeHtml(project.summary)}</p>
    <p>${escapeHtml(project.description)}</p>
  `;
  return card;
}

function factsCard(project, locale, children) {
  const card = elWithClass('section', 'card');
  card.innerHTML = `
    <dl class="facts">
      <div class="facts__row">
        <dt>${t('city.budget')}</dt>
        <dd>${escapeHtml(budgetText(project, locale))}<span data-chip="budget"></span></dd>
      </div>
      <div class="facts__row">
        <dt>${t('city.funding')}</dt>
        <dd>${escapeHtml(project.fundingSource ?? t('value.missing'))}</dd>
      </div>
      <div class="facts__row">
        <dt>${t('city.timeframe')}</dt>
        <dd>${escapeHtml(`${formatYear(project.startYear)} – ${formatYear(project.endYear)}`)}</dd>
      </div>
      <div class="facts__row">
        <dt>${t('city.transferability')}</dt>
        <dd>
          <strong class="score">${escapeHtml(formatNumber(project.transferabilityScore, locale))}</strong>
          <span class="facts__hint">${t('city.transferabilityHint')}</span>
          <details class="rubric"><summary>${t('city.rubricLink')}</summary><p>${t('city.rubricExplain')}</p></details>
          <span data-chip="transferability"></span>
        </dd>
      </div>
    </dl>
  `;
  const source = {
    url: project.sourceUrl,
    label: project.sourceLabel,
    accessed: project.sourceAccessed,
    locale,
  };
  mountChip(card.querySelector('[data-chip="budget"]'), source, children);
  mountChip(card.querySelector('[data-chip="transferability"]'), source, children);
  return card;
}

function chartCard(project, metrics, locale, children) {
  const card = elWithClass('section', 'card');
  card.innerHTML = `<h2 class="card__title">${t('city.chartTitle')}</h2><div data-chart></div>`;
  const slot = card.querySelector('[data-chart]');
  const series = metrics
    .filter((metric) => metric.value !== null)
    .map((metric) => ({ year: metric.year, value: metric.value }));

  if (series.length === 0) {
    slot.className = 'state';
    slot.textContent = t('city.noMetrics');
    return card;
  }
  children.push(lineChart.render(slot, { series, unit: metrics[0].unit, locale }));
  const [first] = metrics;
  mountChip(
    card,
    { url: first.sourceUrl, label: first.sourceLabel, accessed: null, locale },
    children,
  );
  return card;
}

function peersCard(project, peers) {
  const card = elWithClass('section', 'card');
  const links = peers
    .slice(0, 4)
    .map(
      (peer) => `
      <a class="peer" href="${encodeURI(peer.peerUrl)}" target="_blank" rel="noopener noreferrer">
        <span class="peer__city">${escapeHtml(peer.peerCity)}</span>
        <span class="peer__country">${escapeHtml(peer.peerCountry)}</span>
        <span class="peer__rel">${escapeHtml(peer.relationship)}</span>
      </a>`,
    )
    .join('');
  card.innerHTML = `<h2 class="card__title">${t('city.similarProjects')}</h2><div class="peer-grid">${links}</div>`;
  return card;
}

function mountChip(slot, source, children) {
  children.push(sourceChip.render(slot, source));
}

function budgetText(project, locale) {
  const amount = formatCurrency(project.budgetEur, locale);
  return project.budgetYear ? `${amount} (${formatYear(project.budgetYear)})` : amount;
}

function statusLabel(project) {
  return t(`status.${project.status}`);
}

function showSkeleton(content) {
  content.replaceChildren();
  const skeleton = elWithClass('div', 'skeleton skeleton--card');
  content.append(skeleton);
}

function showState(modifier, content) {
  content.replaceChildren();
  const box = elWithClass('div', `state ${modifier}`);
  box.textContent = t('state.error');
  content.append(box);
}

function showNotFound(content) {
  content.replaceChildren();
  content.innerHTML = `<h1 class="view__title">${t('city.notFound')}</h1><p>${t('city.notFoundBody')}</p>`;
  return undefined;
}

function elWithClass(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}
