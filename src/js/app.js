import logoImageUrl from '../../assets/logo.png';
import { albums } from './albums.js';
import { FluidSimulation } from './fluid.js';
import { ParticleSystem, PARTICLE_MOTION_MODES } from './particleSystem.js';
import { Renderer } from './renderer.js';
import { buildDaysTargetPoints, buildLogoTargetPoints, loadImage } from './targets.js';
import { getDaysLeftJST, scheduleMidnightUpdate } from './utils/date.js';

const LIVE_DATE = new Date('2026-05-17T00:00:00+09:00');
const RESIZE_DEBOUNCE_MS = 120;
const PARTICLE_UPDATE_SUBSTEPS = 3;
const POINTER_SMOOTHING = 0.16;
const POINTER_RELEASE_HALF_LIFE_SEC = 0.12;

const APP_STATES = Object.freeze({
  IDLE: 'idle',
  LOGO: 'logo',
  MORPH_TO_DAYS: 'morphToDays',
  COUNTDOWN: 'countdown',
  LOGIN_SEQUENCE: 'loginSequence',
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
  alphaThreshold: 20,
  fontFamily: '"Helvetica Neue", Arial, sans-serif',
  fontWeight: 800,
  maxWidthRatioDesktop: 0.58,
  maxWidthRatioMobile: 0.88,
  maxHeightRatioDesktop: 0.24,
  maxHeightRatioMobile: 0.2,
  wideAspectThreshold: 1.9,
  wideMaxWidthAdjust: 0.06,
  wideMaxHeightAdjust: -0.03,
  offsetY: 18,
};
const DAYS_PARTICLE_SIZE_SCALE = 1.03;

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
};

const albumImageLoadState = new Map();

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

function buildCurrentDaysTarget() {
  const days = getLiveDaysLeft();

  return buildDaysTargetPoints({
    text: `${days}DAYS`,
    width: state.width,
    height: state.height,
    particleCount: state.particleSystem.getParticleCount(),
    ...DAYS_TARGET_LAYOUT,
  });
}

function applyTarget(targetType) {
  const targetPoints =
    targetType === 'days' ? buildCurrentDaysTarget() : buildCurrentLogoTarget();

  state.particleSystem.setSizeScale(
    targetType === 'days' ? DAYS_PARTICLE_SIZE_SCALE : 1,
  );
  state.particleSystem.setTargets(targetPoints);
  state.activeTarget = targetType;
}

function setAppState(nextState) {
  state.appState = nextState;
}

function setParticleMotionMode(nextMode) {
  state.particleMotionMode = nextMode;
}

function showLogoTarget() {
  setAppState(APP_STATES.LOGO);
  setParticleMotionMode(PARTICLE_MOTION_MODES.RETURN);
  applyTarget('logo');
}

function showDaysTarget() {
  setAppState(APP_STATES.COUNTDOWN);
  setParticleMotionMode(PARTICLE_MOTION_MODES.RETURN);
  applyTarget('days');
  setupJstMidnightUpdate();
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
    } else {
      setAppState(APP_STATES.LOGO);
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
  } finally {
    if (sequenceId === state.introSequenceId) {
      state.isIntroSequenceRunning = false;
    }
  }
}

async function playLoginSequence() {
  if (state.isLoginSequenceRunning) {
    return;
  }

  state.isLoginSequenceRunning = true;
  const sequenceId = state.loginSequenceId + 1;
  state.loginSequenceId = sequenceId;

  const isCancelled = () =>
    sequenceId !== state.loginSequenceId || !state.isLoginSequenceRunning;

  try {
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

  return ((index % albums.length) + albums.length) % albums.length;
}

function applyAlbumCover(coverElement, album) {
  if (!coverElement || !album) {
    return;
  }

  coverElement.dataset.albumId = album.id;
  coverElement.setAttribute('aria-label', album.title);
  coverElement.classList.remove('album-section__cover--loaded');
  coverElement.style.backgroundImage = '';

  if (album.image) {
    coverElement.dataset.imageSrc = album.image;
    applyAlbumCoverImage(coverElement, album.image);
    return;
  }

  delete coverElement.dataset.imageSrc;
}

function applyAlbumCoverImage(coverElement, imageUrl) {
  const cachedState = albumImageLoadState.get(imageUrl);

  if (cachedState === 'loaded') {
    coverElement.style.backgroundImage = `url("${imageUrl}")`;
    coverElement.classList.add('album-section__cover--loaded');
    return;
  }

  if (cachedState === 'failed' || cachedState === 'loading') {
    return;
  }

  albumImageLoadState.set(imageUrl, 'loading');

  const image = new Image();

  image.addEventListener('load', () => {
    albumImageLoadState.set(imageUrl, 'loaded');

    if (coverElement.dataset.imageSrc === imageUrl) {
      coverElement.style.backgroundImage = `url("${imageUrl}")`;
      coverElement.classList.add('album-section__cover--loaded');
    }
  });

  image.addEventListener('error', () => {
    albumImageLoadState.set(imageUrl, 'failed');

    if (coverElement.dataset.imageSrc === imageUrl) {
      coverElement.style.backgroundImage = '';
      coverElement.classList.remove('album-section__cover--loaded');
    }
  });

  image.src = imageUrl;
}

function renderAlbumSection(elements) {
  if (!elements || !elements.trackList || albums.length === 0) {
    return;
  }

  albumState.albumIndex = normalizeAlbumIndex(albumState.albumIndex);

  const activeAlbum = albums[albumState.albumIndex];
  const prevAlbum = albums[normalizeAlbumIndex(albumState.albumIndex - 1)];
  const nextAlbum = albums[normalizeAlbumIndex(albumState.albumIndex + 1)];

  if (!activeAlbum) {
    return;
  }

  const activeTracks = Array.isArray(activeAlbum.tracks) ? activeAlbum.tracks : [];

  applyAlbumCover(elements.prevCover, prevAlbum);
  applyAlbumCover(elements.activeCover, activeAlbum);
  applyAlbumCover(elements.nextCover, nextAlbum);

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
    `お気に入り楽曲: 「${trackTitle}」`,
    `Album: ${albumTitle}`,
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

function initAlbumSection() {
  if (albumState.isInitialized) {
    return;
  }

  const section = document.querySelector('.album-section');

  if (!section || albums.length === 0) {
    return;
  }

  const elements = {
    prevButton: section.querySelector('.album-section__nav-button--prev'),
    nextButton: section.querySelector('.album-section__nav-button--next'),
    prevCover: section.querySelector('.album-section__cover--prev'),
    activeCover: section.querySelector('.album-section__cover--active'),
    nextCover: section.querySelector('.album-section__cover--next'),
    trackList: section.querySelector('.album-section__track-list'),
    postButton: section.querySelector('.album-section__post-button'),
  };

  if (!elements.trackList) {
    return;
  }

  albumState.isInitialized = true;

  elements.prevButton?.addEventListener('click', () => {
    albumState.albumIndex = normalizeAlbumIndex(albumState.albumIndex - 1);
    albumState.selectedTrackIndex = 0;
    renderAlbumSection(elements);
  });

  elements.nextButton?.addEventListener('click', () => {
    albumState.albumIndex = normalizeAlbumIndex(albumState.albumIndex + 1);
    albumState.selectedTrackIndex = 0;
    renderAlbumSection(elements);
  });

  elements.postButton?.addEventListener('click', () => {
    openSelectedTrackTweet();
  });

  renderAlbumSection(elements);
}

function setupJstMidnightUpdate() {
  if (state.cancelMidnightUpdate) {
    state.cancelMidnightUpdate();
  }

  state.cancelMidnightUpdate = scheduleMidnightUpdate(() => {
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
  applyTarget(state.activeTarget);

  if (!state.isLoginSequenceRunning) {
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

async function init() {
  const canvas = document.getElementById('webgl-canvas');

  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('`#webgl-canvas` が見つかりません。');
  }

  state.renderer = new Renderer(canvas);
  state.fluid = new FluidSimulation(state.renderer.getContext());
  state.logoImage = await loadImage(logoImageUrl);

  rebuildScene();
  state.pointerDown = false;
  state.fluid.setPointerDown(false);
  setupResizeHandler();
  setupTargetControls();
  initAlbumSection();
  setupPointerInput(canvas);

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
  playIntroSequence().catch((error) => {
    reportAppError('playIntroSequence', error);
  });
}

init().catch((error) => {
  reportAppError('init', error);
});
