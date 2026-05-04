import { getVideoItems } from './video-data.js';

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

function createVideoCard(video) {
  const link = document.createElement('a');
  link.className = 'video-card';
  link.href = video.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.dataset.albumId = video.albumId;
  link.setAttribute('aria-label', `${video.title} をYouTubeで見る`);

  const thumbnail = document.createElement('div');
  thumbnail.className = 'video-card__thumbnail';

  const image = document.createElement('img');
  image.src = video.thumbnail;
  image.alt = `${video.title} サムネイル`;
  image.loading = 'lazy';

  const play = document.createElement('span');
  play.className = 'video-card__play';
  play.setAttribute('aria-hidden', 'true');

  const body = document.createElement('div');
  body.className = 'video-card__body';

  const type = document.createElement('p');
  type.className = 'video-card__type';
  type.textContent = video.type;

  const title = document.createElement('h3');
  title.className = 'video-card__title';
  title.textContent = video.title;

  thumbnail.append(image, play);
  body.append(type, title);
  link.append(thumbnail, body);

  return link;
}

function renderVideoPage() {
  const grid = document.getElementById('video-grid');

  if (!grid) {
    return;
  }

  const cards = getVideoItems().map(createVideoCard);
  grid.replaceChildren(...cards);
}

renderVideoPage();
setupScrollTopLinks();
