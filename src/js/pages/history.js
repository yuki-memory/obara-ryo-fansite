import { historyCategoryLabels, historyYears } from '../data/history.js';
import { initMenuController } from '../controllers/menuController.js';
import {
  initOutboundLinkTracking,
  trackPageViewEvent,
} from '../utils/analytics.js';
import { setupScrollTopLinks } from '../utils/scroll.js';

function createTextElement(tagName, className, text) {
  if (!text) {
    return null;
  }

  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;

  return element;
}

function createHistoryMedia(item) {
  if (!item?.image?.src) {
    return null;
  }

  const media = document.createElement('figure');
  media.className = 'history-timeline__media';

  const image = document.createElement('img');
  image.src = item.image.src;
  image.alt = item.image.alt || `${item.title} 関連画像`;
  image.loading = 'lazy';

  media.appendChild(image);

  return media;
}

function createHistoryItem(item) {
  const article = document.createElement('article');
  article.className = 'history-timeline__item';

  const meta = document.createElement('div');
  meta.className = 'history-timeline__meta';

  const category = item.category || 'activity';
  const tag = createTextElement(
    'span',
    `history-timeline__tag history-timeline__tag--${category}`,
    historyCategoryLabels[category] || category.toUpperCase(),
  );

  meta.appendChild(tag);

  const title = createTextElement(
    'h3',
    'history-timeline__item-title',
    item.title,
  );
  const description = createTextElement(
    'p',
    'history-timeline__description',
    item.description,
  );
  const media = createHistoryMedia(item);

  article.append(...[meta, title, description, media].filter(Boolean));

  return article;
}

function createYearSection(yearGroup) {
  const section = document.createElement('section');
  section.className = 'history-timeline__year-section';
  section.setAttribute('aria-labelledby', `history-year-${yearGroup.year}`);

  const year = createTextElement('h3', 'history-timeline__year', yearGroup.year);

  if (year) {
    year.id = `history-year-${yearGroup.year}`;
  }

  const items = document.createElement('div');
  items.className = 'history-timeline__items';
  items.append(...yearGroup.items.map(createHistoryItem));

  section.append(...[year, items].filter(Boolean));

  return section;
}

function renderHistoryTimeline() {
  const list = document.getElementById('history-timeline-list');

  if (!list) {
    return;
  }

  list.replaceChildren(...historyYears.map(createYearSection));
}

renderHistoryTimeline();
trackPageViewEvent('history');
initOutboundLinkTracking();
initMenuController();
setupScrollTopLinks();
