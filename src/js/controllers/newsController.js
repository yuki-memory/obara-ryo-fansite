function toDateTimeValue(date) {
  return typeof date === 'string' ? date.replaceAll('.', '-') : '';
}

function createNewsItem(newsItem) {
  const item = document.createElement('li');
  item.className = 'news-section__item';

  const date = document.createElement('time');
  date.className = 'news-section__date';
  date.dateTime = toDateTimeValue(newsItem.date);
  date.textContent = newsItem.date;

  const title = document.createElement('span');
  title.className = 'news-section__link';
  title.textContent = newsItem.title;

  item.append(date, title);

  return item;
}

export function initNewsController(options = {}) {
  const {
    items = [],
    list = document.querySelector('.js-news-list'),
  } = options;

  if (!list) {
    return;
  }

  const newsElements = items.map(createNewsItem);
  list.replaceChildren(...newsElements);
}
