const LIVE_DATE = new Date('2026-05-17T00:00:00+09:00');
const LOGO_IMAGE_PATH = '../assets/logo.png';

const canvas = document.getElementById('webgl-canvas');
const gl = canvas.getContext('webgl', { alpha: true, antialias: true });

if (!gl) {
  throw new Error('WebGL が使えない環境です。');
}

const btnLogo = document.getElementById('btn-logo');
const btnDays = document.getElementById('btn-days');
const btnLogin = document.getElementById('btn-login');
const btnScatter = document.getElementById('btn-scatter');

const state = {
  width: 0,
  height: 0,
  dpr: Math.min(window.devicePixelRatio || 1, 2),
  pointerX: 0,
  pointerY: 0,
  pointerMoved: false,
  particles: [],
  maxParticles: window.innerWidth < 768 ? 3500 : 6000,
  currentTargetPoints: [],
  pointSize: window.innerWidth < 768 ? 2.6 : 2.2,
  lastTime: 0,
};

const vertexShaderSource = `
attribute vec2 a_position;
attribute float a_size;
attribute float a_alpha;

uniform vec2 u_resolution;
varying float v_alpha;

void main() {
  vec2 zeroToOne = a_position / u_resolution;
  vec2 zeroToTwo = zeroToOne * 2.0;
  vec2 clipSpace = zeroToTwo - 1.0;

  gl_Position = vec4(clipSpace * vec2(1.0, -1.0), 0.0, 1.0);
  gl_PointSize = a_size;
  v_alpha = a_alpha;
}
`;

const fragmentShaderSource = `
precision mediump float;
varying float v_alpha;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float d = length(uv);

  if (d > 0.5) {
    discard;
  }

  float alpha = smoothstep(0.48, 0.0, d) * v_alpha * 0.82;
  gl_FragColor = vec4(0.922, 0.431, 0.976, alpha);
}
`;

function createShader(glContext, type, source) {
  const shader = glContext.createShader(type);
  glContext.shaderSource(shader, source);
  glContext.compileShader(shader);

  if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
    const error = glContext.getShaderInfoLog(shader);
    glContext.deleteShader(shader);
    throw new Error('Shader compile error: ' + error);
  }

  return shader;
}

function createProgram(glContext, vsSource, fsSource) {
  const vs = createShader(glContext, glContext.VERTEX_SHADER, vsSource);
  const fs = createShader(glContext, glContext.FRAGMENT_SHADER, fsSource);

  const program = glContext.createProgram();
  glContext.attachShader(program, vs);
  glContext.attachShader(program, fs);
  glContext.linkProgram(program);

  if (!glContext.getProgramParameter(program, glContext.LINK_STATUS)) {
    const error = glContext.getProgramInfoLog(program);
    glContext.deleteProgram(program);
    throw new Error('Program link error: ' + error);
  }

  return program;
}

const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
gl.useProgram(program);

const aPosition = gl.getAttribLocation(program, 'a_position');
const aSize = gl.getAttribLocation(program, 'a_size');
const aAlpha = gl.getAttribLocation(program, 'a_alpha');
const uResolution = gl.getUniformLocation(program, 'u_resolution');

const positionBuffer = gl.createBuffer();
const sizeBuffer = gl.createBuffer();
const alphaBuffer = gl.createBuffer();

class Particle {
  constructor(x, y, index = 0) {
    this.x = Math.random() * state.width;
    this.y = Math.random() * state.height;

    this.tx = x;
    this.ty = y;

    this.vx = 0;
    this.vy = 0;
    this.ax = 0;
    this.ay = 0;

    this.alpha = 1;
    this.size = state.pointSize * (0.75 + Math.random() * 0.6);

    this.index = index;
    this.seed = Math.random() * 1000;
  }

  setTarget(x, y) {
    this.tx = x;
    this.ty = y;
  }

  scatter(power = 12) {
    this.vx += (Math.random() - 0.5) * power;
    this.vy += (Math.random() - 0.5) * power;
  }

  update(dt, time) {
    const spring = 10.5;
    const damping = 0.82;
    const maxSpeed = 22;

    const dx = this.tx - this.x;
    const dy = this.ty - this.y;

    this.ax = dx * spring;
    this.ay = dy * spring;

    const nx =
      Math.sin(time * 1.2 + this.seed * 0.37) * 0.18 +
      Math.cos(time * 0.7 + this.seed * 0.91) * 0.12;

    const ny =
      Math.cos(time * 1.0 + this.seed * 0.41) * 0.18 +
      Math.sin(time * 0.8 + this.seed * 0.73) * 0.12;

    this.ax += nx;
    this.ay += ny;

    if (state.pointerMoved) {
      const rx = this.x - state.pointerX;
      const ry = this.y - state.pointerY;
      const dist = Math.sqrt(rx * rx + ry * ry);
      const radius = 120;

      if (dist < radius && dist > 0.001) {
        const falloff = 1 - dist / radius;
        const flow = falloff * falloff * 38;

        this.ax += (rx / dist) * flow;
        this.ay += (ry / dist) * flow;
      }
    }

    this.vx += this.ax * dt;
    this.vy += this.ay * dt;

    this.vx *= damping;
    this.vy *= damping;

    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > maxSpeed) {
      this.vx = (this.vx / speed) * maxSpeed;
      this.vy = (this.vy / speed) * maxSpeed;
    }

    this.x += this.vx;
    this.y += this.vy;
  }
}

function resizeCanvas() {
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.width = window.innerWidth;
  state.height = window.innerHeight;

  canvas.width = state.width * state.dpr;
  canvas.height = state.height * state.dpr;
  canvas.style.width = state.width + 'px';
  canvas.style.height = state.height + 'px';

  gl.viewport(0, 0, canvas.width, canvas.height);
}

function createParticles(count) {
  state.particles = [];
  for (let i = 0; i < count; i++) {
    state.particles.push(new Particle(state.width / 2, state.height / 2, i));
  }
}

function getDaysLeft() {
  const now = new Date();

  const jstNow = new Date(
    now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
  );

  const target = new Date('2026-05-17T00:00:00+09:00');

  const start = new Date(
    jstNow.getFullYear(),
    jstNow.getMonth(),
    jstNow.getDate(),
  );

  const end = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );

  const diff = end - start;

  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function scheduleMidnightUpdate() {
  const now = new Date();
  const jstNow = new Date(
    now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
  );

  const nextMidnight = new Date(jstNow);
  nextMidnight.setHours(24, 0, 0, 0);

  const ms = nextMidnight - jstNow;

  setTimeout(() => {
    morphToDays();
    scheduleMidnightUpdate();
  }, ms);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function createOffscreen(width, height) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

function samplePointsFromImage(img, options = {}) {
  const {
    sampleGap = window.innerWidth < 768 ? 3 : 2,
    offsetY = 0,
    fitWidthRatio = 0.86,
    fitHeightRatio = 0.5,
    sidePadding = 48,
  } = options;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = state.width;
  tempCanvas.height = state.height;
  const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

  tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

  const initialScale = Math.min(
    state.width / img.width,
    state.height / img.height,
  );

  const initialW = img.width * initialScale;
  const initialH = img.height * initialScale;
  const initialX = (state.width - initialW) / 2;
  const initialY = (state.height - initialH) / 2;

  tempCtx.drawImage(img, initialX, initialY, initialW, initialH);

  const tempData = tempCtx.getImageData(
    0,
    0,
    tempCanvas.width,
    tempCanvas.height,
  ).data;

  let minX = tempCanvas.width;
  let minY = tempCanvas.height;
  let maxX = 0;
  let maxY = 0;
  let found = false;

  for (let y = 0; y < tempCanvas.height; y++) {
    for (let x = 0; x < tempCanvas.width; x++) {
      const i = (y * tempCanvas.width + x) * 4;
      const r = tempData[i];
      const g = tempData[i + 1];
      const b = tempData[i + 2];
      const alpha = tempData[i + 3];

      const isPinkLike = r > 140 && b > 140 && g < 120;

      if (alpha > 100 && isPinkLike) {
        found = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!found) {
    return [];
  }

  const trimW = maxX - minX + 1;
  const trimH = maxY - minY + 1;

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = trimW;
  croppedCanvas.height = trimH;
  const croppedCtx = croppedCanvas.getContext('2d', {
    willReadFrequently: true,
  });

  croppedCtx.drawImage(
    tempCanvas,
    minX,
    minY,
    trimW,
    trimH,
    0,
    0,
    trimW,
    trimH,
  );

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = state.width;
  finalCanvas.height = state.height;
  const finalCtx = finalCanvas.getContext('2d', { willReadFrequently: true });

  finalCtx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);

  const aspect = state.width / state.height;

  const responsiveFitWidthRatio =
    aspect > 1.4 ? fitWidthRatio * 0.82 : fitWidthRatio;

  const responsiveFitHeightRatio =
    aspect > 1.4 ? fitHeightRatio * 0.82 : fitHeightRatio;

  const availableWidth =
    state.width * responsiveFitWidthRatio - sidePadding * 2;

  const availableHeight = state.height * responsiveFitHeightRatio;

  const finalScale = Math.min(availableWidth / trimW, availableHeight / trimH);

  const drawW = trimW * finalScale;
  const drawH = trimH * finalScale;
  const drawX = (state.width - drawW) / 2;
  const drawY = (state.height - drawH) / 2 - state.height * 0.04 + offsetY;

  finalCtx.drawImage(
    croppedCanvas,
    0,
    0,
    trimW,
    trimH,
    drawX,
    drawY,
    drawW,
    drawH,
  );

  const finalData = finalCtx.getImageData(
    0,
    0,
    finalCanvas.width,
    finalCanvas.height,
  ).data;
  const points = [];

  for (let y = 0; y < finalCanvas.height; y += sampleGap) {
    for (let x = 0; x < finalCanvas.width; x += sampleGap) {
      const i = (y * finalCanvas.width + x) * 4;

      const r = finalData[i];
      const g = finalData[i + 1];
      const b = finalData[i + 2];
      const alpha = finalData[i + 3];

      const isPinkLike = r > 140 && b > 140 && g < 120;

      if (alpha > 100 && isPinkLike) {
        points.push({ x, y });
      }
    }
  }

  return points;
}

function samplePointsFromText(lines, options = {}) {
  const {
    sampleGap = window.innerWidth < 768 ? 6 : 5,
    fontFamily = '"Helvetica Neue", Arial, sans-serif',
    fontWeight = 700,
    maxWidthRatio = 0.5,
    lineHeight = 0.82,
    offsetY = 0,
  } = options;

  const off = createOffscreen(state.width, state.height);
  const ctx = off.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, off.width, off.height);

  const longestLine = lines.reduce((a, b) => (a.length > b.length ? a : b), '');
  let fontSize = Math.min(state.width * 0.18, 220);

  while (fontSize > 20) {
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    if (ctx.measureText(longestLine).width <= state.width * maxWidthRatio) {
      break;
    }
    fontSize -= 4;
  }

  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

  const totalHeight = fontSize * lineHeight * (lines.length - 1);
  const startY = state.height / 2 - totalHeight / 2 + offsetY;

  lines.forEach((line, i) => {
    ctx.fillText(line, state.width / 2, startY + i * fontSize * lineHeight);
  });

  const imageData = ctx.getImageData(0, 0, off.width, off.height).data;
  const points = [];

  for (let py = 0; py < off.height; py += sampleGap) {
    for (let px = 0; px < off.width; px += sampleGap) {
      const idx = (py * off.width + px) * 4;
      const alpha = imageData[idx + 3];

      if (alpha > 100) {
        points.push({ x: px, y: py });
      }
    }
  }

  return points;
}

function normalizePointCount(points, targetCount) {
  if (points.length === 0) return [];

  const normalized = [];
  for (let i = 0; i < targetCount; i++) {
    normalized.push(points[i % points.length]);
  }
  return normalized;
}

function applyTargets(points) {
  const targetPoints = normalizePointCount(points, state.particles.length);
  state.currentTargetPoints = targetPoints;

  for (let i = 0; i < state.particles.length; i++) {
    const p = state.particles[i];
    const t = targetPoints[i];
    p.setTarget(t.x, t.y);
  }
}

function morphToDays() {
  const days = getDaysLeft();
  const text = `${days}DAYS`;

  const points = samplePointsFromText([text], {
    maxWidthRatio: 0.6,
    lineHeight: 1,
    offsetY: 20,
  });

  applyTargets(points);
}

function morphToLogo(logoImage) {
  const points = samplePointsFromImage(logoImage, {
    sampleGap: window.innerWidth < 768 ? 3 : 2,
    fitWidthRatio: 0.88,
    fitHeightRatio: 0.52,
    sidePadding: 40,
    offsetY: 0,
  });
  applyTargets(points);
}

function scatterAll() {
  for (const p of state.particles) {
    p.scatter();
  }
}

function drawParticles() {
  const positions = new Float32Array(state.particles.length * 2);
  const sizes = new Float32Array(state.particles.length);
  const alphas = new Float32Array(state.particles.length);

  for (let i = 0; i < state.particles.length; i++) {
    const p = state.particles[i];
    positions[i * 2] = p.x * state.dpr;
    positions[i * 2 + 1] = p.y * state.dpr;
    sizes[i] = p.size * state.dpr;
    alphas[i] = p.alpha;
  }

  gl.clearColor(1.0, 0.91, 0.91, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(program);
  gl.uniform2f(uResolution, canvas.width, canvas.height);

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(aSize);
  gl.vertexAttribPointer(aSize, 1, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, alphaBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, alphas, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(aAlpha);
  gl.vertexAttribPointer(aAlpha, 1, gl.FLOAT, false, 0, 0);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  gl.drawArrays(gl.POINTS, 0, state.particles.length);
}

function animate(time) {
  const now = time * 0.001;
  const dt = Math.min(0.033, now - (state.lastTime || now));
  state.lastTime = now;

  const subSteps = 3;
  const stepDt = dt / subSteps;

  for (let s = 0; s < subSteps; s++) {
    for (const p of state.particles) {
      p.update(stepDt * 60, now + s * stepDt);
    }
  }

  drawParticles();
  state.pointerMoved = false;
  requestAnimationFrame(animate);
}

function setupPointerEvents() {
  const updatePointer = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    state.pointerX = clientX - rect.left;
    state.pointerY = clientY - rect.top;
    state.pointerMoved = true;
  };

  canvas.addEventListener('mousemove', (e) => {
    updatePointer(e.clientX, e.clientY);
  });

  canvas.addEventListener(
    'touchmove',
    (e) => {
      const t = e.touches[0];
      if (!t) return;
      updatePointer(t.clientX, t.clientY);
    },
    { passive: true },
  );
}

async function init() {
  resizeCanvas();
  createParticles(state.maxParticles);
  setupPointerEvents();

  const logoImage = await loadImage(LOGO_IMAGE_PATH);

  morphToDays();
  scheduleMidnightUpdate();

  btnLogo.addEventListener('click', () => {
    morphToLogo(logoImage);
  });

  btnDays.addEventListener('click', () => {
    morphToDays();
  });

  btnScatter.addEventListener('click', () => {
    scatterAll();
  });

  btnLogin.addEventListener('click', async () => {
    morphToLogo(logoImage);

    await wait(800);
    scatterAll();

    await wait(3200);
    morphToDays();
  });

  window.addEventListener('resize', () => {
    resizeCanvas();
    state.maxParticles = window.innerWidth < 768 ? 3500 : 6000;
    state.pointSize = window.innerWidth < 768 ? 2.6 : 2.2;
    createParticles(state.maxParticles);
    morphToDays();
  });

  requestAnimationFrame(animate);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

init().catch((error) => {
  console.error(error);
});
