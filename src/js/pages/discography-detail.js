import { albums } from '../data/albums.js';
import { setupScrollTopLinks } from '../utils/scroll.js';

const LINK_LABELS = {
  linkcore: 'LinkCore',
  tunecore: 'TuneCore',
  spotify: 'Spotify',
  appleMusic: 'Apple Music',
  amazonMusic: 'Amazon Music',
  youtubeMusic: 'YouTube Music',
  youtube: 'YouTube',
  buy: 'Buy',
};

function getAlbumId() {
  const params = new URLSearchParams(window.location.search);

  return params.get('id') || '';
}

function formatReleaseDate(releaseDate) {
  if (!releaseDate) {
    return '';
  }

  return releaseDate.replaceAll('-', '.');
}

function getValidLinks(links) {
  if (!links || typeof links !== 'object') {
    return [];
  }

  return Object.entries(links).filter(([, url]) => url && url !== '#');
}

function createTextElement(tagName, className, text) {
  if (!text) {
    return null;
  }

  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;

  return element;
}

function createLinkList(items, className, itemClassName, getLabel) {
  if (!items || items.length === 0) {
    return null;
  }

  const list = document.createElement('div');
  list.className = className;

  items.forEach((item) => {
    const link = document.createElement('a');
    link.className = itemClassName;
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = getLabel(item);
    list.appendChild(link);
  });

  return list;
}

function createTracksSection(tracks) {
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return null;
  }

  const section = document.createElement('section');
  section.className = 'discography-detail-page__section';

  const title = document.createElement('h2');
  title.className = 'discography-detail-page__section-title';
  title.textContent = 'Track List';

  const list = document.createElement('ol');
  list.className = 'discography-detail-page__track-list';

  tracks.forEach((track) => {
    const item = document.createElement('li');
    item.className = 'discography-detail-page__track-item';
    item.textContent = track;
    list.appendChild(item);
  });

  section.append(title, list);

  return section;
}

function createLinksSection(album) {
  const validLinks = getValidLinks(album.links).map(([key, url]) => ({
    key,
    url,
  }));
  const links = createLinkList(
    validLinks,
    'discography-detail-page__links',
    'discography-detail-page__link',
    (item) => LINK_LABELS[item.key] || item.key,
  );

  if (!links) {
    return null;
  }

  const section = document.createElement('section');
  section.className = 'discography-detail-page__section';

  const title = document.createElement('h2');
  title.className = 'discography-detail-page__section-title';
  title.textContent = 'Listen / Buy';

  section.append(title, links);

  return section;
}

function createVideosSection(videos) {
  if (!Array.isArray(videos) || videos.length === 0) {
    return null;
  }

  const links = createLinkList(
    videos,
    'discography-detail-page__links',
    'discography-detail-page__link discography-detail-page__link--video',
    (video) => `${video.title}${video.kind ? ` / ${video.kind}` : ''}`,
  );

  const section = document.createElement('section');
  section.className = 'discography-detail-page__section';

  const title = document.createElement('h2');
  title.className = 'discography-detail-page__section-title';
  title.textContent = 'Movie';

  section.append(title, links);

  return section;
}

function renderDetailNotFound(root) {
  const message = document.createElement('p');
  message.className = 'discography-detail-page__not-found';
  message.textContent = '作品情報が見つかりませんでした。';
  root.replaceChildren(message);
}

function renderDiscographyDetail() {
  const root = document.getElementById('discography-detail-root');

  if (!root) {
    return;
  }

  const album = albums.find((item) => item.id === getAlbumId());

  if (!album) {
    renderDetailNotFound(root);
    return;
  }

  document.title = `${album.title} | Discography | 小原涼`;

  const article = document.createElement('article');
  article.className = 'discography-detail-page__article';
  article.dataset.albumId = album.id;

  const visual = document.createElement('div');
  visual.className = 'discography-detail-page__visual';

  if (album.jacket || album.image) {
    const image = document.createElement('img');
    image.src = album.jacket || album.image;
    image.alt = `${album.title} ジャケット画像`;
    visual.appendChild(image);
  }

  const content = document.createElement('div');
  content.className = 'discography-detail-page__content';

  const type = createTextElement('p', 'discography-detail-page__type', album.type);
  const title = createTextElement(
    'h1',
    'discography-detail-page__title',
    album.title,
  );
  const releaseDate = createTextElement(
    'time',
    'discography-detail-page__date',
    formatReleaseDate(album.releaseDate),
  );

  if (releaseDate) {
    releaseDate.dateTime = album.releaseDate;
  }

  content.append(...[type, title, releaseDate].filter(Boolean));
  content.append(
    ...[
      createLinksSection(album),
      createTracksSection(album.tracks),
      createVideosSection(album.videos),
    ].filter(Boolean),
  );

  article.append(visual, content);
  root.replaceChildren(article);
}

renderDiscographyDetail();
setupScrollTopLinks();
