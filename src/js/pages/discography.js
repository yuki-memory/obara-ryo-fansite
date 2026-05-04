import { albums } from '../data/albums.js';

function setupScrollTopLinks() {
  const scrollTopLinks = document.querySelectorAll('.js-scroll-top');
  const topButtons = document.querySelectorAll('.top-button');

  const updateTopButtonState = () => {
    topButtons.forEach((button) => {
      button.classList.toggle('is-visible', window.scrollY > 200);
    });
  };

  scrollTopLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();

      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    });
  });

  updateTopButtonState();
  window.addEventListener('scroll', updateTopButtonState, { passive: true });
}

const LINK_LABELS = {
  linkcore: 'LinkCore',
  tunecore: 'TuneCore',
  spotify: 'Listen',
  appleMusic: 'Apple Music',
  amazonMusic: 'Amazon Music',
  youtubeMusic: 'YouTube Music',
  youtube: 'YouTube',
  buy: 'Buy',
};

function isMusicRelease(album) {
  return Boolean(album?.type && /(?:Album|Single)/.test(album.type));
}

function getReleaseTime(album) {
  const releaseTime = Date.parse(album?.releaseDate || '');

  return Number.isNaN(releaseTime) ? 0 : releaseTime;
}

function formatReleaseDate(releaseDate) {
  if (!releaseDate) {
    return '';
  }

  const date = new Date(`${releaseDate}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return releaseDate;
  }

  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
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

function createDiscographyCard(album) {
  const article = document.createElement('article');
  article.className = 'discography-page__card';
  article.dataset.albumId = album.id;

  const detailLink = document.createElement('a');
  detailLink.className = 'discography-page__card-link';
  detailLink.href = `./discography-detail.html?id=${encodeURIComponent(album.id)}`;
  detailLink.setAttribute('aria-label', `${album.title} の詳細を見る`);

  let imageWrapper = null;

  if (album.jacket || album.image) {
    imageWrapper = document.createElement('div');
    imageWrapper.className = 'discography-page__image';

    const image = document.createElement('img');
    image.src = album.jacket || album.image;
    image.alt = `${album.title} ジャケット画像`;
    imageWrapper.appendChild(image);
  }

  const body = document.createElement('div');
  body.className = 'discography-page__body';

  const type = createTextElement('p', 'discography-page__type', album.type);
  const title = createTextElement(
    'h3',
    'discography-page__item-title',
    album.title,
  );
  const releaseDate = createTextElement(
    'time',
    'discography-page__date',
    formatReleaseDate(album.releaseDate),
  );

  if (releaseDate) {
    releaseDate.dateTime = album.releaseDate;
  }

  body.append(...[type, title, releaseDate].filter(Boolean));
  detailLink.append(...[imageWrapper, body].filter(Boolean));
  article.appendChild(detailLink);

  const validLinks = getValidLinks(album.links);

  if (validLinks.length > 0) {
    const linkList = document.createElement('div');
    linkList.className = 'discography-page__links';

    validLinks.forEach(([key, url]) => {
      const link = document.createElement('a');
      link.className = 'discography-page__external-link';
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = LINK_LABELS[key] || key;
      linkList.appendChild(link);
    });

    article.appendChild(linkList);
  }

  return article;
}

function renderDiscographyPage() {
  const list = document.getElementById('discography-page-list');

  if (!list) {
    return;
  }

  const musicAlbums = [...albums]
    .filter(isMusicRelease)
    .sort(
      (albumA, albumB) => getReleaseTime(albumB) - getReleaseTime(albumA),
    );

  const cards = musicAlbums.map(createDiscographyCard);
  list.replaceChildren(...cards);
}

renderDiscographyPage();
setupScrollTopLinks();
