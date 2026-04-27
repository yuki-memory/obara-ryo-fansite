import logoImageUrl from '../../assets/logo.png';
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
  sampleStepDesktop: 5,
  sampleStepMobile: 6,
  alphaThreshold: 20,
  fontFamily: '"Helvetica Neue", Arial, sans-serif',
  fontWeight: 700,
  maxWidthRatioDesktop: 0.58,
  maxWidthRatioMobile: 0.88,
  maxHeightRatioDesktop: 0.24,
  maxHeightRatioMobile: 0.2,
  wideAspectThreshold: 1.9,
  wideMaxWidthAdjust: 0.06,
  wideMaxHeightAdjust: -0.03,
  offsetY: 18,
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

function buildCurrentDaysTarget() {
  const days = getDaysLeftJST(LIVE_DATE);

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

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
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
      cancelLoginSequence();
      showLogoTarget();
    });
  }

  if (daysButton) {
    daysButton.addEventListener('click', () => {
      cancelLoginSequence();
      showDaysTarget();
    });
  }

  if (loginButton) {
    loginButton.addEventListener('click', () => {
      playLoginSequence().catch((error) => {
        reportAppError('playLoginSequence(button)', error);
      });
    });
  }
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
  setAppState(APP_STATES.LOGO);
  setParticleMotionMode(PARTICLE_MOTION_MODES.RETURN);
  state.pointerDown = false;
  state.fluid.setPointerDown(false);
  setupResizeHandler();
  setupTargetControls();
  setupPointerInput(canvas);
  setupJstMidnightUpdate();

  window.playLoginSequence = () =>
    playLoginSequence().catch((error) => {
      reportAppError('playLoginSequence(window)', error);
    });

  window.addEventListener('beforeunload', () => {
    if (state.cancelMidnightUpdate) {
      state.cancelMidnightUpdate();
      state.cancelMidnightUpdate = null;
    }

    cancelLoginSequence();
    state.fluid.dispose();
  });

  requestAnimationFrame(animate);
}

init().catch((error) => {
  reportAppError('init', error);
});
