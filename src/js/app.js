import logoImageUrl from '../../assets/logos/logo.png';
import { albums } from './data/albums.js';
import { getVideoItems } from './data/video-data.js';
import { FluidSimulation } from './webgl/fluid.js';
import { ParticleSystem, PARTICLE_MOTION_MODES } from './webgl/particleSystem.js';
import { Renderer } from './webgl/renderer.js';
import { buildDaysTargetPoints, buildLogoTargetPoints, loadImage } from './webgl/targets.js';
import {
  formatTimeLeftJST,
  getDaysLeftJST,
  scheduleMidnightUpdate,
} from './utils/date.js';

const LIVE_DATE = new Date('2026-05-17T00:00:00+09:00');
// 開発確認用。本番前に false に戻すこと
const FORCE_POST_LIVE_MODE = false;
const SITE_URL = window.location.origin;
const RESIZE_DEBOUNCE_MS = 120;
const PARTICLE_UPDATE_SUBSTEPS = 3;
const POINTER_SMOOTHING = 0.16;
const POINTER_RELEASE_HALF_LIFE_SEC = 0.12;
const SWIPE_THRESHOLD = 48;

const APP_STATES = Object.freeze({
  IDLE: 'idle',
  LOGO: 'logo',
  MORPH_TO_DAYS: 'morphToDays',
  COUNTDOWN: 'countdown',
  LOGIN_SEQUENCE: 'loginSequence',
  POST_LIVE: 'postLive',
});

const LOGIN_SEQUENCE_TIMINGS = Object.freeze({
  logoAssembleDuration: 720,
  logoHoldDuration: 780,
  disperseDuration: 780,
  morphToDaysDelay: 180,
  collapsePulseIntervalMs: 56,
  morphSettleMs: 780,
});

const INTRO_SEQUENCE_TIMINGS = Object.freeze({
  logoHoldDuration: 2000,
  morphToDaysDelay: 600,
  scatterPower: 4.5,
});

const TARGET_LAYOUT = {
  fitWidthRatioDesktop: 0.86,
  fitWidthRatioMobile: 0.92,
  fitHeightRatioDesktop: 0.56,
  fitHeightRatioMobile: 0.44,
  sidePaddingDesktop: 50,
  sidePaddingMobile: 16,
  wideAspectThreshold: 1.9,
  wideFitWidthAdjust: -0.03,
  wideFitHeightAdjust: -0.08,
  wideSidePaddingScale: 1.2,
  offsetY: 0,
  alphaThreshold: 16,
  sampleStepDesktop: 1,
  sampleStepMobile: 2,
};

const DAYS_TARGET_LAYOUT = {
  sampleStepDesktop: 2,
  sampleStepMobile: 3,
  alphaThreshold: 18,
  fontFamily: '"Helvetica Neue", Arial, sans-serif',
  fontWeight: 900,
  maxWidthRatioDesktop: 0.64,
  maxWidthRatioMobile: 0.9,
  maxHeightRatioDesktop: 0.44,
  maxHeightRatioMobile: 0.4,
  wideAspectThreshold: 1.9,
  wideMaxWidthAdjust: 0.04,
  wideMaxHeightAdjust: -0.02,
  offsetY: 0,
};
const DAYS_PARTICLE_SIZE_SCALE = 1;
const POST_LIVE_PARTICLE_SIZE_SCALE = 0.58;
const POST_LIVE_BACKGROUND_COLORS = Object.freeze({
  clear: [0.08, 0.055, 0.075, 1],
  particle: [0.95, 0.48, 0.72],
});
const LIVE_COUNTDOWN_BACKGROUND_COLORS = Object.freeze({
  clear: [1.0, 0.91, 0.91, 1],
  particle: [0.91, 0.31, 0.96],
});

const countdownState = {
  previousLines: null,
  intervalId: null,
};

// App-level orchestration state. Rendering/physics internals live in dedicated modules.
const state = {
  renderer: null,
  fluid: null,
  logoImage: null,
  particleSystem: new ParticleSystem(),
  appState: APP_STATES.IDLE,
  particleMotionMode: PARTICLE_MOTION_MODES.IDLE,
  activeTarget: 'logo',
  pointerDown: false,
  introSequenceId: 0,
  isIntroSequenceRunning: false,
  loginSequenceId: 0,
  isLoginSequenceRunning: false,
  cancelMidnightUpdate: null,
  isRebuilding: false,
  rebuildQueued: false,
  width: 0,
  height: 0,
  dpr: 1,
  lastTime: 0,
  pointer: {
    x: 0,
    y: 0,
    smoothDx: 0,
    smoothDy: 0,
    influence: 0,
  },
};

const albumState = {
  albumIndex: 0,
  selectedTrackIndex: 0,
  isInitialized: false,
  thumbnailSwiper: null,
  elements: null,
};

function reportAppError(context, error) {
  console.error(`[app] ${context}`, error);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function readViewport() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: Math.min(window.devicePixelRatio || 1, 2),
  };
}

function animate(timeMs) {
  const time = timeMs * 0.001;
  const dt = Math.min(0.05, time - (state.lastTime || time));
  state.lastTime = time;

  if (state.pointerDown) {
    state.pointer.influence = 1;
  } else {
    const decay = Math.pow(0.5, dt / POINTER_RELEASE_HALF_LIFE_SEC);
    state.pointer.influence *= decay;
    state.pointer.smoothDx = lerp(state.pointer.smoothDx, 0, 0.24);
    state.pointer.smoothDy = lerp(state.pointer.smoothDy, 0, 0.24);
  }

  // Update simulation modules and keep app.js as the orchestrator.
  state.fluid.update(dt, { pointerDown: state.pointerDown });

  const stepDt = dt / PARTICLE_UPDATE_SUBSTEPS;

  for (let i = 0; i < PARTICLE_UPDATE_SUBSTEPS; i += 1) {
    state.particleSystem.update(stepDt, time + i * stepDt, state.fluid, {
      motionMode: state.particleMotionMode,
      pointer: state.pointer,
      viewportWidth: state.width,
      viewportHeight: state.height,
    });
  }

  if (
    state.particleMotionMode === PARTICLE_MOTION_MODES.RETURN &&
    !state.pointerDown &&
    state.particleSystem.isSettled(0.75, 0.14)
  ) {
    setParticleMotionMode(PARTICLE_MOTION_MODES.IDLE);
  }

  state.renderer.render(state.particleSystem.getParticles());

  requestAnimationFrame(animate);
}

function buildCurrentLogoTarget() {
  return buildLogoTargetPoints({
    image: state.logoImage,
    width: state.width,
    height: state.height,
    particleCount: state.particleSystem.getParticleCount(),
    ...TARGET_LAYOUT,
  });
}

function getLiveDaysLeft() {
  return getDaysLeftJST(LIVE_DATE);
}

function isPostLiveMode() {
  return FORCE_POST_LIVE_MODE || Date.now() >= LIVE_DATE.getTime();
}

function syncPostLiveDomState() {
  document.body.classList.toggle('is-post-live', isPostLiveMode());
}

function applyRenderTone() {
  if (!state.renderer) {
    return;
  }

  const colors = isPostLiveMode()
    ? POST_LIVE_BACKGROUND_COLORS
    : LIVE_COUNTDOWN_BACKGROUND_COLORS;

  state.renderer.setClearColor(...colors.clear);
  state.renderer.setParticleColor(...colors.particle);
}

function buildPostLiveAmbientTarget() {
  const particleCount = state.particleSystem.getParticleCount();
  const isMobile = state.width < 768;
  const horizontalPadding = isMobile ? 18 : 40;
  const topPadding = isMobile ? 54 : 48;
  const bottomPadding = isMobile ? 42 : 48;

  return Array.from({ length: particleCount }, (_, index) => {
    const columnRatio = ((index * 0.618033988749895) % 1);
    const rowRatio = ((index * 0.4142135623730951) % 1);
    const waveX = Math.sin(index * 0.73) * (isMobile ? 10 : 22);
    const waveY = Math.cos(index * 0.47) * (isMobile ? 8 : 18);

    return {
      x: horizontalPadding + columnRatio * Math.max(1, state.width - horizontalPadding * 2) + waveX,
      y: topPadding + rowRatio * Math.max(1, state.height - topPadding - bottomPadding) + waveY,
      type: index % 3 === 0 ? 'days' : 'time',
    };
  });
}

function getCountdownLines() {
  const days = getLiveDaysLeft();
  const timeLeft = formatTimeLeftJST(LIVE_DATE);

  return [
    `${days}DAYS`,
    timeLeft,
  ];
}

function buildDaysTargetFromLines(lines) {
  return buildDaysTargetPoints({
    lines: [
      {
        text: lines[0],
        key: 'days',
        fontWeight: 900,
        fontSizeScale: 1,
      },
      {
        text: lines[1],
        key: 'time',
        fontWeight: 700,
        fontSizeScale: 0.32,
        offsetYRatio: 0.66,
      },
    ],
    width: state.width,
    height: state.height,
    particleCount: state.particleSystem.getParticleCount(),
    ...DAYS_TARGET_LAYOUT,
  });
}

function buildCurrentDaysTarget() {
  const lines = getCountdownLines();
  return buildDaysTargetFromLines(lines);
}

function getChangedCharIndexes(previousLines, nextLines) {
  if (!previousLines) {
    return null;
  }

  const changed = [];

  nextLines.forEach((line, lineIndex) => {
    const previousLine = previousLines[lineIndex] || '';
    const maxLength = Math.max(previousLine.length, line.length);

    for (let charIndex = 0; charIndex < maxLength; charIndex += 1) {
      if (previousLine[charIndex] !== line[charIndex]) {
        changed.push({ lineIndex, charIndex });
      }
    }
  });

  return changed;
}

function updateParticleCountdownDiff() {
  if (state.activeTarget !== 'days') {
    return;
  }

  const nextLines = getCountdownLines();
  const previousLines = countdownState.previousLines;

  if (!previousLines) {
    applyTarget('days');
    return;
  }

  const shouldRebuildAll = previousLines.some((line, index) => (
    line.length !== (nextLines[index] || '').length
  ));

  if (shouldRebuildAll) {
    applyTarget('days');
    return;
  }

  const changed = getChangedCharIndexes(previousLines, nextLines);

  if (!changed || changed.length === 0) {
    return;
  }

  const nextTarget = buildDaysTargetFromLines(nextLines);
  const changedGroupKeys = changed.map(
    ({ lineIndex, charIndex }) => `line-${lineIndex}-char-${charIndex}`,
  );

  if (!nextTarget.groupedPoints) {
    applyTarget('days');
    return;
  }

  state.particleSystem.softUpdateTargetsByGroup(
    nextTarget.groupedPoints,
    changedGroupKeys,
  );

  countdownState.previousLines = [...nextLines];
}

function applyTarget(targetType) {
  applyRenderTone();

  if (targetType === 'ambient') {
    state.particleSystem.setSizeScale(POST_LIVE_PARTICLE_SIZE_SCALE);
    state.particleSystem.clearTargetGroups();
    state.particleSystem.setTargets(buildPostLiveAmbientTarget());
    countdownState.previousLines = null;
    state.activeTarget = targetType;
    return;
  }

  const lines = targetType === 'days' ? getCountdownLines() : null;
  const targetPoints =
    targetType === 'days' ? buildDaysTargetFromLines(lines) : buildCurrentLogoTarget();

  state.particleSystem.setSizeScale(
    targetType === 'days' ? DAYS_PARTICLE_SIZE_SCALE : 1,
  );

  if (targetType === 'days' && targetPoints.groupedPoints) {
    state.particleSystem.setTargetsByGroup(targetPoints.groupedPoints);
    countdownState.previousLines = [...lines];
  } else {
    state.particleSystem.clearTargetGroups();
    state.particleSystem.setTargets(targetPoints.points || targetPoints);
    countdownState.previousLines = null;
  }

  state.activeTarget = targetType;
}

function startParticleCountdownTimer() {
  stopParticleCountdownTimer();

  if (isPostLiveMode()) {
    return;
  }

  countdownState.previousLines = getCountdownLines();

  countdownState.intervalId = window.setInterval(updateParticleCountdownDiff, 1000);
}

function stopParticleCountdownTimer() {
  if (countdownState.intervalId !== null) {
    window.clearInterval(countdownState.intervalId);
    countdownState.intervalId = null;
  }
}

function setAppState(nextState) {
  state.appState = nextState;
}

function setParticleMotionMode(nextMode) {
  state.particleMotionMode = nextMode;
}

function showLogoTarget() {
  if (isPostLiveMode()) {
    showPostLiveTarget();
    return;
  }

  stopParticleCountdownTimer();
  setAppState(APP_STATES.LOGO);
  setParticleMotionMode(PARTICLE_MOTION_MODES.RETURN);
  applyTarget('logo');
}

function showDaysTarget() {
  if (isPostLiveMode()) {
    showPostLiveTarget();
    return;
  }

  setAppState(APP_STATES.COUNTDOWN);
  setParticleMotionMode(PARTICLE_MOTION_MODES.RETURN);
  applyTarget('days');
  setupJstMidnightUpdate();
  startParticleCountdownTimer();
}

function showPostLiveTarget() {
  stopParticleCountdownTimer();

  if (state.cancelMidnightUpdate) {
    state.cancelMidnightUpdate();
    state.cancelMidnightUpdate = null;
  }

  syncPostLiveDomState();
  setAppState(APP_STATES.POST_LIVE);
  setParticleMotionMode(PARTICLE_MOTION_MODES.AMBIENT);
  applyTarget('ambient');
}

function scatterAll(power = INTRO_SEQUENCE_TIMINGS.scatterPower) {
  state.particleSystem.scatter(power);
  setParticleMotionMode(PARTICLE_MOTION_MODES.INTERACT);
}

function cancelIntroSequence() {
  if (!state.isIntroSequenceRunning) {
    return;
  }

  state.introSequenceId += 1;
  state.isIntroSequenceRunning = false;
}

function cancelLoginSequence() {
  if (state.isLoginSequenceRunning) {
    state.loginSequenceId += 1;
    state.isLoginSequenceRunning = false;
  }

  if (state.appState === APP_STATES.LOGIN_SEQUENCE) {
    if (state.activeTarget === 'days') {
      setAppState(APP_STATES.COUNTDOWN);
      startParticleCountdownTimer();
    } else {
      setAppState(APP_STATES.LOGO);
      stopParticleCountdownTimer();
    }
  }

  if (state.pointerDown) {
    setParticleMotionMode(PARTICLE_MOTION_MODES.INTERACT);
  } else {
    setParticleMotionMode(PARTICLE_MOTION_MODES.RETURN);
  }
}

function cancelAutoSequences() {
  cancelIntroSequence();
  cancelLoginSequence();
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function playIntroSequence() {
  if (isPostLiveMode()) {
    showPostLiveTarget();
    return;
  }

  if (state.isIntroSequenceRunning) {
    return;
  }

  state.isIntroSequenceRunning = true;
  const sequenceId = state.introSequenceId + 1;
  state.introSequenceId = sequenceId;

  const isCancelled = () =>
    sequenceId !== state.introSequenceId || !state.isIntroSequenceRunning;

  try {
    showLogoTarget();
    await wait(INTRO_SEQUENCE_TIMINGS.logoHoldDuration);
    if (isCancelled()) {
      return;
    }

    scatterAll();
    await wait(INTRO_SEQUENCE_TIMINGS.morphToDaysDelay);
    if (isCancelled()) {
      return;
    }

    setAppState(APP_STATES.MORPH_TO_DAYS);
    setParticleMotionMode(PARTICLE_MOTION_MODES.RETURN);
    applyTarget('days');
    setAppState(APP_STATES.COUNTDOWN);
    setupJstMidnightUpdate();
    startParticleCountdownTimer();
  } finally {
    if (sequenceId === state.introSequenceId) {
      state.isIntroSequenceRunning = false;
    }
  }
}

async function playLoginSequence() {
  if (isPostLiveMode()) {
    showPostLiveTarget();
    return;
  }

  if (state.isLoginSequenceRunning) {
    return;
  }

  state.isLoginSequenceRunning = true;
  const sequenceId = state.loginSequenceId + 1;
  state.loginSequenceId = sequenceId;

  const isCancelled = () =>
    sequenceId !== state.loginSequenceId || !state.isLoginSequenceRunning;

  try {
    stopParticleCountdownTimer();
    setAppState(APP_STATES.LOGIN_SEQUENCE);
    setParticleMotionMode(PARTICLE_MOTION_MODES.RETURN);
    applyTarget('logo');
    await wait(LOGIN_SEQUENCE_TIMINGS.logoAssembleDuration);

    if (isCancelled()) {
      return;
    }

    setParticleMotionMode(PARTICLE_MOTION_MODES.IDLE);
    await wait(LOGIN_SEQUENCE_TIMINGS.logoHoldDuration);
    if (isCancelled()) {
      return;
    }

    const collapseStart = performance.now();
    let enteredInteract = false;
    while (performance.now() - collapseStart < LOGIN_SEQUENCE_TIMINGS.disperseDuration) {
      if (isCancelled()) {
        return;
      }

      state.particleSystem.scatter(4.5);
      if (!enteredInteract) {
        setParticleMotionMode(PARTICLE_MOTION_MODES.INTERACT);
        enteredInteract = true;
      }
      await wait(LOGIN_SEQUENCE_TIMINGS.collapsePulseIntervalMs);
    }

    if (isCancelled()) {
      return;
    }

    setParticleMotionMode(PARTICLE_MOTION_MODES.RETURN);
    await wait(LOGIN_SEQUENCE_TIMINGS.morphToDaysDelay);
    if (isCancelled()) {
      return;
    }

    setAppState(APP_STATES.MORPH_TO_DAYS);
    applyTarget('days');

    await wait(LOGIN_SEQUENCE_TIMINGS.morphSettleMs);
    if (isCancelled()) {
      return;
    }

    setAppState(APP_STATES.COUNTDOWN);
    setParticleMotionMode(PARTICLE_MOTION_MODES.IDLE);
    startParticleCountdownTimer();
  } finally {
    if (sequenceId === state.loginSequenceId) {
      state.isLoginSequenceRunning = false;
    }
  }
}

function setupTargetControls() {
  const logoButton = document.getElementById('btn-logo');
  const daysButton = document.getElementById('btn-days');
  const loginButton = document.getElementById('btn-login');

  if (logoButton) {
    logoButton.addEventListener('click', () => {
      cancelAutoSequences();
      showLogoTarget();
    });
  }

  if (daysButton) {
    daysButton.addEventListener('click', () => {
      cancelAutoSequences();
      showDaysTarget();
    });
  }

  if (loginButton) {
    loginButton.addEventListener('click', () => {
      cancelIntroSequence();
      playLoginSequence().catch((error) => {
        reportAppError('playLoginSequence(button)', error);
      });
    });
  }
}

function normalizeAlbumIndex(index) {
  if (albums.length === 0) {
    return 0;
  }

  const numericIndex = Number(index);
  const safeIndex = Number.isFinite(numericIndex) ? numericIndex : 0;

  return ((safeIndex % albums.length) + albums.length) % albums.length;
}

function getAlbumReleaseTime(album) {
  const releaseTime = Date.parse(album?.releaseDate || '');

  return Number.isNaN(releaseTime) ? 0 : releaseTime;
}

function getLatestMusicItems(limit = 2) {
  return [...albums]
    .filter((album) => album?.releaseDate && /(?:Album|Single)/.test(album.type))
    .sort(
      (albumA, albumB) =>
        getAlbumReleaseTime(albumB) - getAlbumReleaseTime(albumA),
    )
    .slice(0, limit);
}

function formatAlbumReleaseDate(releaseDate) {
  if (!releaseDate) {
    return '';
  }

  return releaseDate.replaceAll('-', '.');
}

function createDiscographyMusicCard(album, index) {
  const link = document.createElement('a');
  link.className = [
    'discography-section__card',
    index % 2 === 1 ? 'is-reverse' : '',
  ]
    .filter(Boolean)
    .join(' ');
  link.href = `./pages/discography-detail.html?id=${encodeURIComponent(album.id)}`;
  link.dataset.albumId = album.id;
  link.setAttribute('aria-label', `${album.title} の詳細を見る`);

  const imageWrapper = document.createElement('div');
  imageWrapper.className = 'discography-section__image';

  const image = document.createElement('img');
  image.src = album.jacket || album.image || '';
  image.alt = `${album.title} ジャケット画像`;

  const body = document.createElement('div');
  body.className = 'discography-section__body';

  const type = document.createElement('p');
  type.className = 'discography-section__type';
  type.textContent = album.type;

  const title = document.createElement('h3');
  title.className = 'discography-section__title';
  title.textContent = album.title;

  const releaseDate = document.createElement('p');
  releaseDate.className = 'discography-section__date';
  releaseDate.textContent = formatAlbumReleaseDate(album.releaseDate);

  imageWrapper.appendChild(image);
  body.append(type, title, releaseDate);
  link.append(imageWrapper, body);

  if (album.characterImage) {
    const character = document.createElement('img');
    character.className = 'discography-section__card-character';
    character.src = album.characterImage;
    character.alt = '';
    character.loading = 'lazy';
    character.setAttribute('aria-hidden', 'true');
    link.appendChild(character);
  }

  return link;
}

function renderDiscographyPreview() {
  const musicList = document.querySelector('[data-latest-discography-list]');

  if (!musicList) {
    return;
  }

  const cards = getLatestMusicItems(2).map((album, index) =>
    createDiscographyMusicCard(album, index),
  );

  musicList.replaceChildren(...cards);
}

function createDiscographyVideoCard(video, index) {
  const item = document.createElement('li');
  item.className = [
    'discography-section__item',
    'video-item',
    index % 2 === 1 ? 'video-item--reverse' : '',
  ]
    .filter(Boolean)
    .join(' ');
  item.dataset.albumId = video.albumId;

  const thumbnail = document.createElement('a');
  thumbnail.className = 'video-item__thumb';
  thumbnail.href = video.url;
  thumbnail.target = '_blank';
  thumbnail.rel = 'noopener noreferrer';
  thumbnail.dataset.albumId = video.albumId;
  thumbnail.setAttribute('aria-label', `${video.title} をYouTubeで見る`);

  const image = document.createElement('img');
  image.src = video.thumbnail;
  image.alt = `${video.title} サムネイル`;
  image.loading = 'lazy';

  const play = document.createElement('span');
  play.className = 'video-item__play';
  play.setAttribute('aria-hidden', 'true');

  const body = document.createElement('div');
  body.className = 'video-item__content';

  const type = document.createElement('p');
  type.className = 'video-item__type';
  type.textContent = video.kind;

  const title = document.createElement('h3');
  title.className = 'video-item__title';
  title.textContent = video.title;

  const description = document.createElement('p');
  description.className = 'video-item__description';
  description.textContent = video.description || '';

  const more = document.createElement('a');
  more.className = 'video-item__link';
  more.href = video.url;
  more.target = '_blank';
  more.rel = 'noopener noreferrer';
  more.dataset.albumId = video.albumId;
  more.setAttribute('aria-label', `${video.title} をYouTubeで見る`);
  more.textContent = 'play video';

  thumbnail.append(image, play);
  body.append(type, title);

  if (description.textContent) {
    body.appendChild(description);
  }

  body.appendChild(more);
  item.append(thumbnail, body);

  return item;
}

function renderVideoPreview() {
  const videoList = document.querySelector('[data-latest-video-list]');

  if (!videoList) {
    return;
  }

  videoList.classList.add('video-list');

  const cards = getVideoItems({ limit: 2 }).map((video, index) =>
    createDiscographyVideoCard(video, index),
  );

  videoList.replaceChildren(...cards);
}

function getVisibleAlbumIndexes() {
  const activeIndex = normalizeAlbumIndex(albumState.albumIndex);

  return {
    prevIndex: normalizeAlbumIndex(activeIndex - 1),
    activeIndex,
    nextIndex: normalizeAlbumIndex(activeIndex + 1),
  };
}

function applyAlbumCover(element, album, index) {
  if (!element || !album) {
    return;
  }

  element.dataset.albumIndex = String(index);
  element.dataset.albumId = album.id;
  element.setAttribute('aria-label', album.title);

  if (album.image) {
    element.style.backgroundImage = `url("${album.image}")`;
    element.classList.add('album-section__cover--loaded');
  } else {
    element.style.backgroundImage = '';
    element.classList.remove('album-section__cover--loaded');
  }
}

function renderAlbumCovers(elements) {
  if (!elements?.prevCover || !elements?.activeCover || !elements?.nextCover) {
    return;
  }

  const { prevIndex, activeIndex, nextIndex } = getVisibleAlbumIndexes();

  applyAlbumCover(elements.prevCover, albums[prevIndex], prevIndex);
  applyAlbumCover(elements.activeCover, albums[activeIndex], activeIndex);
  applyAlbumCover(elements.nextCover, albums[nextIndex], nextIndex);
}

function setActiveAlbum(index) {
  albumState.albumIndex = normalizeAlbumIndex(index);
  albumState.selectedTrackIndex = 0;

  renderAlbumSection(albumState.elements);
  syncAlbumThumbnailState(albumState.albumIndex);
}

function showPrevAlbum() {
  setActiveAlbum(albumState.albumIndex - 1);
}

function showNextAlbum() {
  setActiveAlbum(albumState.albumIndex + 1);
}

function initAlbumCoverSwipe(elements) {
  if (!elements?.covers) {
    return;
  }

  let startX = 0;
  let currentX = 0;
  let isDragging = false;

  elements.covers.addEventListener('pointerdown', (event) => {
    isDragging = true;
    startX = event.clientX;
    currentX = event.clientX;
  });

  elements.covers.addEventListener('pointermove', (event) => {
    if (!isDragging) {
      return;
    }

    currentX = event.clientX;
  });

  elements.covers.addEventListener('pointerup', () => {
    if (!isDragging) {
      return;
    }

    isDragging = false;

    const diffX = currentX - startX;

    if (Math.abs(diffX) < SWIPE_THRESHOLD) {
      return;
    }

    if (diffX < 0) {
      showNextAlbum();
    } else {
      showPrevAlbum();
    }
  });

  elements.covers.addEventListener('pointercancel', () => {
    isDragging = false;
  });
}

function createAlbumThumbnailSlide(album, albumIndex, elements) {
  const slide = document.createElement('div');
  slide.className = 'album-section__thumbnail-slide swiper-slide';
  slide.dataset.albumId = album.id;

  const button = document.createElement('button');
  button.className = 'album-section__thumbnail-button';
  button.type = 'button';
  button.dataset.albumIndex = String(albumIndex);
  button.dataset.albumId = album.id;
  button.setAttribute('aria-label', `${album.title} を表示`);
  button.setAttribute('aria-current', 'false');

  const image = document.createElement('span');
  image.className = 'album-section__thumbnail-image';

  if (album.image) {
    image.style.backgroundImage = `url("${album.image}")`;
  }

  button.addEventListener('click', () => {
    const index = Number(button.dataset.albumIndex);
    setActiveAlbum(index);
  });

  button.appendChild(image);
  slide.appendChild(button);

  return slide;
}

function renderAlbumThumbnailSlides(elements) {
  if (!elements.thumbnailList) {
    return;
  }

  const slides = albums.map((album, albumIndex) =>
    createAlbumThumbnailSlide(album, albumIndex, elements),
  );

  elements.thumbnailList.replaceChildren(...slides);
}

function syncAlbumThumbnailState(index) {
  const normalizedIndex = normalizeAlbumIndex(index);

  document
    .querySelectorAll('.album-section__thumbnail-button')
    .forEach((button) => {
      const isActive = Number(button.dataset.albumIndex) === normalizedIndex;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-current', isActive ? 'true' : 'false');
    });

  const thumbnailSwiper = albumState.thumbnailSwiper;

  if (!thumbnailSwiper) {
    return;
  }

  const visibleOffset = 2;
  const targetSlideIndex = Math.max(0, normalizedIndex - visibleOffset);

  thumbnailSwiper.slideTo(targetSlideIndex);
}

function renderAlbumSection(elements) {
  if (!elements || !elements.trackList || albums.length === 0) {
    return;
  }

  albumState.albumIndex = normalizeAlbumIndex(albumState.albumIndex);
  renderAlbumCovers(elements);

  const activeAlbum = albums[albumState.albumIndex];

  if (!activeAlbum) {
    return;
  }

  const activeTracks = Array.isArray(activeAlbum.tracks) ? activeAlbum.tracks : [];

  elements.trackList.replaceChildren();

  if (activeTracks.length === 0) {
    const item = document.createElement('li');
    item.className = 'album-section__track-item album-section__track-item--empty';
    item.textContent = '楽曲情報を準備中です';
    elements.trackList.appendChild(item);

    if (elements.postButton) {
      elements.postButton.dataset.albumId = activeAlbum.id;
      elements.postButton.dataset.albumTitle = activeAlbum.title;
      delete elements.postButton.dataset.trackTitle;
      delete elements.postButton.dataset.trackIndex;
      elements.postButton.disabled = true;
    }

    return;
  }

  albumState.selectedTrackIndex = normalizeTrackIndex(
    albumState.selectedTrackIndex,
    activeTracks,
  );

  activeTracks.forEach((trackTitle, trackIndex) => {
    const item = document.createElement('li');
    item.className = 'album-section__track-item';

    const button = document.createElement('button');
    button.className = 'album-section__track-button';
    button.type = 'button';
    button.textContent = trackTitle;

    if (trackIndex === albumState.selectedTrackIndex) {
      button.classList.add('is-active');
    }

    button.addEventListener('click', () => {
      albumState.selectedTrackIndex = trackIndex;
      renderAlbumSection(elements);
    });

    item.appendChild(button);
    elements.trackList.appendChild(item);
  });

  if (elements.postButton) {
    const selectedTrackTitle = activeTracks[albumState.selectedTrackIndex];

    elements.postButton.dataset.albumId = activeAlbum.id;
    elements.postButton.dataset.albumTitle = activeAlbum.title;
    elements.postButton.dataset.trackTitle = selectedTrackTitle;
    elements.postButton.dataset.trackIndex = String(albumState.selectedTrackIndex);
    elements.postButton.disabled = false;
  }
}

function normalizeTrackIndex(index, tracks) {
  if (!tracks || tracks.length === 0) {
    return 0;
  }

  return Math.min(Math.max(index, 0), tracks.length - 1);
}

function getCurrentAlbumSelection() {
  if (albums.length === 0) {
    return null;
  }

  const currentAlbum = albums[normalizeAlbumIndex(albumState.albumIndex)];
  if (!currentAlbum) {
    return null;
  }

  const tracks = Array.isArray(currentAlbum.tracks) ? currentAlbum.tracks : [];
  if (tracks.length === 0) {
    return null;
  }

  const selectedTrackIndex = normalizeTrackIndex(
    albumState.selectedTrackIndex,
    tracks,
  );
  const selectedTrack = tracks[selectedTrackIndex];

  if (!selectedTrack) {
    return null;
  }

  return {
    currentAlbum,
    selectedTrack,
    selectedTrackIndex,
  };
}

function buildTweetText({ albumTitle, trackTitle, daysLeft }) {
  return [
    `収録アルバム: ${albumTitle}`,
    `お気に入り楽曲: 「${trackTitle}」`,
    '',
    SITE_URL,
    '',
    `#小原涼 #小原涼生誕ワンマン2026 まであと${daysLeft}日`,
  ].join('\n');
}

function openSelectedTrackTweet() {
  const selection = getCurrentAlbumSelection();

  if (!selection) {
    return;
  }

  const daysLeft = getLiveDaysLeft();
  const tweetText = buildTweetText({
    albumTitle: selection.currentAlbum.title,
    trackTitle: selection.selectedTrack,
    daysLeft,
  });
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

  window.open(tweetUrl, '_blank', 'noopener,noreferrer');
}

function initAlbumThumbnailSwiper(elements) {
  renderAlbumThumbnailSlides(elements);

  const SwiperConstructor = window.Swiper;

  if (!SwiperConstructor || !elements.thumbnailSwiper || !elements.thumbnailList) {
    reportAppError(
      'initAlbumThumbnailSwiper',
      new Error('Thumbnail Swiper is not available'),
    );
    return null;
  }

  const swiper = new SwiperConstructor(elements.thumbnailSwiper, {
    slidesPerView: 3,
    spaceBetween: 14,
    grabCursor: true,
    watchSlidesProgress: true,
    navigation: {
      prevEl: elements.thumbnailPrevButton,
      nextEl: elements.thumbnailNextButton,
    },
    breakpoints: {
      0: {
        slidesPerView: 3,
        spaceBetween: 10,
      },
      769: {
        slidesPerView: 4,
        spaceBetween: 18,
      },
    },
  });

  albumState.thumbnailSwiper = swiper;
  return swiper;
}

function initAlbumSection() {
  if (albumState.isInitialized) {
    return;
  }

  const section = document.querySelector('.album-section');

  if (!section || albums.length === 0) {
    return;
  }

  const elements = {
    carousel: section.querySelector('.album-section__carousel'),
    covers: section.querySelector('.album-section__covers'),
    prevCover: section.querySelector('.album-section__cover--prev'),
    activeCover: section.querySelector('.album-section__cover--active'),
    nextCover: section.querySelector('.album-section__cover--next'),
    thumbnailSwiper: section.querySelector('.album-section__thumbnail-swiper'),
    thumbnailList: section.querySelector('.album-section__thumbnail-list'),
    thumbnailPrevButton: section.querySelector(
      '.album-section__thumbnail-nav--prev',
    ),
    thumbnailNextButton: section.querySelector(
      '.album-section__thumbnail-nav--next',
    ),
    trackList: section.querySelector('.album-section__track-list'),
    postButton: section.querySelector('.album-section__post-button'),
  };

  if (
    !elements.trackList ||
    !elements.prevCover ||
    !elements.activeCover ||
    !elements.nextCover ||
    !elements.thumbnailList
  ) {
    return;
  }

  albumState.isInitialized = true;
  albumState.elements = elements;
  albumState.albumIndex = normalizeAlbumIndex(albumState.albumIndex);

  console.table(
    albums.map((album, index) => ({
      index,
      id: album.id,
      title: album.title,
      image: album.image,
    })),
  );

  elements.postButton?.addEventListener('click', () => {
    openSelectedTrackTweet();
  });

  elements.prevCover?.addEventListener('click', showPrevAlbum);
  elements.nextCover?.addEventListener('click', showNextAlbum);
  initAlbumCoverSwipe(elements);
  initAlbumThumbnailSwiper(elements);
  renderAlbumSection(elements);
  syncAlbumThumbnailState(albumState.albumIndex);
}

function setupJstMidnightUpdate() {
  if (state.cancelMidnightUpdate) {
    state.cancelMidnightUpdate();
  }

  state.cancelMidnightUpdate = scheduleMidnightUpdate(() => {
    syncPostLiveDomState();

    if (isPostLiveMode()) {
      showPostLiveTarget();
      return;
    }

    if (state.activeTarget === 'days') {
      applyTarget('days');
    }
  });
}

function setupResizeHandler() {
  let resizeTimer = 0;

  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      requestSceneRebuild();
    }, RESIZE_DEBOUNCE_MS);
  });
}

function setupPointerInput(canvas) {
  let hasLast = false;
  let lastX = 0;
  let lastY = 0;

  const beginPointer = (x, y) => {
    if (isPostLiveMode()) {
      return;
    }

    state.pointerDown = true;
    state.fluid.setPointerDown(true);
    if (!state.isLoginSequenceRunning) {
      setParticleMotionMode(PARTICLE_MOTION_MODES.INTERACT);
    }
    state.pointer.x = x;
    state.pointer.y = y;
    state.pointer.smoothDx = 0;
    state.pointer.smoothDy = 0;
    state.pointer.influence = 1;
    lastX = x;
    lastY = y;
    hasLast = true;
  };

  const movePointer = (x, y) => {
    if (hasLast && state.pointerDown) {
      const rawDx = x - lastX;
      const rawDy = y - lastY;

      state.pointer.smoothDx = lerp(state.pointer.smoothDx, rawDx, POINTER_SMOOTHING);
      state.pointer.smoothDy = lerp(state.pointer.smoothDy, rawDy, POINTER_SMOOTHING);
      state.pointer.x = x;
      state.pointer.y = y;
      state.pointer.influence = 1;

      state.fluid.addPointerInput({
        x,
        y,
        dx: state.pointer.smoothDx,
        dy: state.pointer.smoothDy,
      });
    }

    lastX = x;
    lastY = y;
    hasLast = true;
  };

  const endPointer = () => {
    state.pointerDown = false;
    state.fluid.setPointerDown(false);
    state.pointer.smoothDx = 0;
    state.pointer.smoothDy = 0;
    state.pointer.influence = 0;
    hasLast = false;
    if (!state.isLoginSequenceRunning) {
      setParticleMotionMode(PARTICLE_MOTION_MODES.RETURN);
    }
  };

  canvas.addEventListener('mousedown', (event) => {
    const rect = canvas.getBoundingClientRect();
    beginPointer(event.clientX - rect.left, event.clientY - rect.top);
  });

  canvas.addEventListener('mousemove', (event) => {
    if (!state.pointerDown) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    movePointer(event.clientX - rect.left, event.clientY - rect.top);
  });

  window.addEventListener('mouseup', () => {
    if (state.pointerDown) {
      endPointer();
    }
  });

  canvas.addEventListener('mouseleave', () => {
    if (!state.pointerDown) {
      hasLast = false;
    }
  });

  canvas.addEventListener('touchstart', (event) => {
    const touch = event.touches[0];
    if (!touch) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    beginPointer(touch.clientX - rect.left, touch.clientY - rect.top);
  }, { passive: true });

  canvas.addEventListener('touchmove', (event) => {
    const touch = event.touches[0];
    if (!touch || !state.pointerDown) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    movePointer(touch.clientX - rect.left, touch.clientY - rect.top);
  }, { passive: true });

  window.addEventListener('touchend', () => {
    if (state.pointerDown) {
      endPointer();
    }
  }, { passive: true });

  window.addEventListener('touchcancel', () => {
    if (state.pointerDown) {
      endPointer();
    }
  }, { passive: true });
}

function rebuildScene() {
  // Safe resize re-initialization path for renderer, fluid buffers, and particle targets.
  const viewport = readViewport();
  const shouldSkip =
    viewport.width === state.width &&
    viewport.height === state.height &&
    viewport.dpr === state.dpr;

  if (shouldSkip) {
    return;
  }

  state.width = viewport.width;
  state.height = viewport.height;
  state.dpr = viewport.dpr;
  state.pointerDown = false;
  state.pointer.x = viewport.width * 0.5;
  state.pointer.y = viewport.height * 0.5;
  state.pointer.smoothDx = 0;
  state.pointer.smoothDy = 0;
  state.pointer.influence = 0;

  state.renderer.resize(state.width, state.height, state.dpr);
  state.fluid.setPointerDown(false);
  state.fluid.resize(state.width, state.height);

  state.particleSystem.rebuild(state.width, state.height);

  syncPostLiveDomState();
  if (isPostLiveMode()) {
    state.activeTarget = 'ambient';
  }

  applyTarget(state.activeTarget);

  if (isPostLiveMode()) {
    setParticleMotionMode(PARTICLE_MOTION_MODES.AMBIENT);
  } else if (!state.isLoginSequenceRunning) {
    setParticleMotionMode(PARTICLE_MOTION_MODES.RETURN);
  }
}

function requestSceneRebuild() {
  if (state.isRebuilding) {
    state.rebuildQueued = true;
    return;
  }

  state.isRebuilding = true;

  try {
    rebuildScene();
  } catch (error) {
    reportAppError('rebuildScene', error);
  } finally {
    state.isRebuilding = false;

    if (state.rebuildQueued) {
      state.rebuildQueued = false;
      requestSceneRebuild();
    }
  }
}

function setupScrollOverlayState() {
  const topButtons = document.querySelectorAll('.top-button');

  const updateScrollState = () => {
    document.body.classList.toggle('is-scrolled', window.scrollY > 80);

    topButtons.forEach((button) => {
      button.classList.toggle('is-visible', window.scrollY > 200);
    });
  };

  updateScrollState();
  window.addEventListener('scroll', updateScrollState, { passive: true });
}

function setupScrollTopLinks() {
  const scrollTopLinks = document.querySelectorAll(
    '.js-scroll-top, .js-scroll-home',
  );

  scrollTopLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();

      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    });
  });
}

function setupSiteMenu() {
  const menuButton = document.querySelector('.site-menu-button');
  const siteMenu = document.getElementById('site-menu');
  const menuCloseButton = document.querySelector('.site-menu__close');
  const menuLinks = document.querySelectorAll('.site-menu__link');

  if (!menuButton || !siteMenu) {
    return;
  }

  const openMenu = () => {
    document.body.classList.add('is-menu-open');
    menuButton.setAttribute('aria-expanded', 'true');
    menuButton.setAttribute('aria-label', 'メニューを閉じる');
    siteMenu.setAttribute('aria-hidden', 'false');
    menuCloseButton?.focus();
  };

  const closeMenu = () => {
    document.body.classList.remove('is-menu-open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'メニューを開く');
    siteMenu.setAttribute('aria-hidden', 'true');
  };

  const toggleMenu = () => {
    if (document.body.classList.contains('is-menu-open')) {
      closeMenu();
      return;
    }

    openMenu();
  };

  menuButton.addEventListener('click', toggleMenu);
  menuCloseButton?.addEventListener('click', () => {
    closeMenu();
    menuButton.focus();
  });

  siteMenu.addEventListener('click', (event) => {
    if (event.target === siteMenu) {
      closeMenu();
    }
  });

  menuLinks.forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  window.addEventListener('keydown', (event) => {
    if (
      event.key === 'Escape' &&
      document.body.classList.contains('is-menu-open')
    ) {
      closeMenu();
      menuButton.focus();
    }
  });
}

async function init() {
  const canvas = document.getElementById('webgl-canvas');

  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('`#webgl-canvas` が見つかりません。');
  }

  state.renderer = new Renderer(canvas);
  state.fluid = new FluidSimulation(state.renderer.getContext());
  state.logoImage = await loadImage(logoImageUrl);

  syncPostLiveDomState();
  rebuildScene();
  state.pointerDown = false;
  state.fluid.setPointerDown(false);
  setupResizeHandler();
  setupTargetControls();
  setupScrollTopLinks();
  setupSiteMenu();
  renderDiscographyPreview();
  renderVideoPreview();
  initAlbumSection();
  setupPointerInput(canvas);
  setupScrollOverlayState();

  window.playLoginSequence = () =>
    playLoginSequence().catch((error) => {
      reportAppError('playLoginSequence(window)', error);
    });

  window.addEventListener('beforeunload', () => {
    if (state.cancelMidnightUpdate) {
      state.cancelMidnightUpdate();
      state.cancelMidnightUpdate = null;
    }

    cancelAutoSequences();
    state.fluid.dispose();
  });

  requestAnimationFrame(animate);
  if (isPostLiveMode()) {
    showPostLiveTarget();
  } else {
    playIntroSequence().catch((error) => {
      reportAppError('playIntroSequence', error);
    });
  }
}

init().catch((error) => {
  reportAppError('init', error);
});
