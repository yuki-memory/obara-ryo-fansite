import particleFragSource from '../shaders/particle.frag.glsl?raw';
import particleVertSource from '../shaders/particle.vert.glsl?raw';

function shaderTypeName(gl, type) {
  if (type === gl.VERTEX_SHADER) {
    return 'VERTEX';
  }
  if (type === gl.FRAGMENT_SHADER) {
    return 'FRAGMENT';
  }
  return `UNKNOWN(${type})`;
}

function withLineNumbers(source) {
  return source
    .split('\n')
    .map((line, i) => `${String(i + 1).padStart(3, ' ')}| ${line}`)
    .join('\n');
}

function compileShader(gl, type, source, label) {
  const shader = gl.createShader(type);

  if (!shader) {
    throw new Error(`[Renderer] ${label} shader を作成できません。`);
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || '';
    gl.deleteShader(shader);
    throw new Error(
      `[Renderer] ${label} (${shaderTypeName(gl, type)}) compile failed\n${info}\n--- source ---\n${withLineNumbers(source)}`,
    );
  }

  return shader;
}

function createProgram(gl, vertSource, fragSource) {
  const vertShader = compileShader(gl, gl.VERTEX_SHADER, vertSource, 'particle.vert');
  const fragShader = compileShader(gl, gl.FRAGMENT_SHADER, fragSource, 'particle.frag');

  const program = gl.createProgram();
  if (!program) {
    throw new Error('[Renderer] Program を作成できません。');
  }

  gl.attachShader(program, vertShader);
  gl.attachShader(program, fragShader);
  gl.linkProgram(program);

  gl.deleteShader(vertShader);
  gl.deleteShader(fragShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || '';
    gl.deleteProgram(program);
    throw new Error(`[Renderer] Program link failed: ${info}`);
  }

  return program;
}

export class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });

    if (!gl) {
      throw new Error('WebGL が使えない環境です。');
    }

    this.canvas = canvas;
    this.gl = gl;
    this.dpr = 1;

    this.program = createProgram(gl, particleVertSource, particleFragSource);
    this.aPosition = gl.getAttribLocation(this.program, 'a_position');
    this.aSize = gl.getAttribLocation(this.program, 'a_size');
    this.aDepth = gl.getAttribLocation(this.program, 'a_depth');
    this.aColorBias = gl.getAttribLocation(this.program, 'a_colorBias');
    this.aEnergy = gl.getAttribLocation(this.program, 'a_energy');
    this.uResolution = gl.getUniformLocation(this.program, 'u_resolution');
    this.uColor = gl.getUniformLocation(this.program, 'u_color');

    this.positionBuffer = gl.createBuffer();
    this.sizeBuffer = gl.createBuffer();
    this.depthBuffer = gl.createBuffer();
    this.colorBiasBuffer = gl.createBuffer();
    this.energyBuffer = gl.createBuffer();

    if (
      !this.positionBuffer ||
      !this.sizeBuffer ||
      !this.depthBuffer ||
      !this.colorBiasBuffer ||
      !this.energyBuffer
    ) {
      throw new Error('[Renderer] 描画バッファの初期化に失敗しました。');
    }
  }

  resize(width, height, dpr) {
    this.dpr = dpr;

    this.canvas.width = Math.max(1, Math.floor(width * dpr));
    this.canvas.height = Math.max(1, Math.floor(height * dpr));
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  getContext() {
    return this.gl;
  }

  render(particles) {
    // Renderer is draw-only: it receives prepared particle data from app/system.
    const gl = this.gl;
    const count = particles.length;
    const positions = new Float32Array(count * 2);
    const sizes = new Float32Array(count);
    const depths = new Float32Array(count);
    const colorBiases = new Float32Array(count);
    const energies = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      const p = particles[i];
      positions[i * 2] = p.x * this.dpr;
      positions[i * 2 + 1] = p.y * this.dpr;
      sizes[i] = p.size * this.dpr;
      depths[i] = p.depth || 0;
      colorBiases[i] = p.colorBias || 0;
      energies[i] = p.interactionGlow || 0;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(1.0, 0.91, 0.91, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);

    if (this.uResolution) {
      gl.uniform2f(this.uResolution, this.canvas.width, this.canvas.height);
    }

    if (this.uColor) {
      gl.uniform3f(this.uColor, 0.922, 0.431, 0.976);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.aPosition);
    gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.sizeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.aSize);
    gl.vertexAttribPointer(this.aSize, 1, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.depthBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, depths, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.aDepth);
    gl.vertexAttribPointer(this.aDepth, 1, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBiasBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colorBiases, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.aColorBias);
    gl.vertexAttribPointer(this.aColorBias, 1, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.energyBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, energies, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.aEnergy);
    gl.vertexAttribPointer(this.aEnergy, 1, gl.FLOAT, false, 0, 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.drawArrays(gl.POINTS, 0, count);
  }
}
