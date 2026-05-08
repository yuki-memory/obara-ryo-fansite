function toDateTimeValue(date) {
  return typeof date === 'string' ? date.replaceAll('.', '-') : '';
}

function createNewsTitle(newsItem) {
  if (newsItem.url) {
    const link = document.createElement('a');
    link.className = 'news-section__link news-card__link';
    link.href = newsItem.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = newsItem.title;
    return link;
  }

  const title = document.createElement('span');
  title.className = 'news-section__link';
  title.textContent = newsItem.title;
  return title;
}

function createNewsItem(newsItem) {
  const item = document.createElement('li');
  item.className = 'news-section__item';

  const date = document.createElement('time');
  date.className = 'news-section__date';
  date.dateTime = toDateTimeValue(newsItem.date);
  date.textContent = newsItem.date;

  const title = createNewsTitle(newsItem);

  item.append(date, title);

  return item;
}

function createStatusItem(message) {
  const item = document.createElement('li');
  item.className = 'news-section__item news-section__item--status';
  item.textContent = message;
  return item;
}

export function initNewsController(options = {}) {
  const {
    items = [],
    list = document.querySelector('.js-news-list'),
    state = 'success',
    message = '',
  } = options;

  if (!list) {
    return;
  }

  if (state === 'loading') {
    list.replaceChildren(createStatusItem('Loading news...'));
    return;
  }

  if (items.length === 0) {
    list.replaceChildren(createStatusItem('現在表示できるNEWSはありません。'));
    return;
  }

  const newsElements = items.map(createNewsItem);

  if (message) {
    newsElements.unshift(createStatusItem(message));
  }

  list.replaceChildren(...newsElements);
}
