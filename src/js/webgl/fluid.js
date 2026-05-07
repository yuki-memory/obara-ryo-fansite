import advectionFragSource from '../../shaders/fluid/advection.frag.glsl?raw';
import baseVertSource from '../../shaders/fluid/base.vert.glsl?raw';
import divergenceFragSource from '../../shaders/fluid/divergence.frag.glsl?raw';
import gradientSubtractFragSource from '../../shaders/fluid/gradientSubtract.frag.glsl?raw';
import jacobiFragSource from '../../shaders/fluid/jacobi.frag.glsl?raw';
import splatFragSource from '../../shaders/fluid/splat.frag.glsl?raw';
import {
  createPingPongFBO,
  createTextureFBO,
  destroyPingPongFBO,
  destroyTextureFBO,
} from '../utils/fbo.js';

const MAX_PENDING_SPLATS = 24;
const MOBILE_BREAKPOINT = 768;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

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
    throw new Error(`[Fluid] ${label} shader を作成できません。`);
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || '';
    gl.deleteShader(shader);
    throw new Error(
      `[Fluid] ${label} (${shaderTypeName(gl, type)}) compile failed\n${info}\n--- source ---\n${withLineNumbers(source)}`,
    );
  }

  return shader;
}

function createProgram(gl, vertSource, fragSource, label) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertSource, `${label}:vert`);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragSource, `${label}:frag`);

  const program = gl.createProgram();
  if (!program) {
    throw new Error(`[Fluid] ${label} program を作成できません。`);
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || '';
    gl.deleteProgram(program);
    throw new Error(`[Fluid] ${label} program link failed: ${info}`);
  }

  return program;
}

function createProgramBundle(gl, fragSource, uniformNames, label) {
  const program = createProgram(gl, baseVertSource, fragSource, label);
  const aPosition = gl.getAttribLocation(program, 'a_position');
  const uniforms = {};

  for (let i = 0; i < uniformNames.length; i += 1) {
    const name = uniformNames[i];
    uniforms[name] = gl.getUniformLocation(program, name);
  }

  return { program, aPosition, uniforms };
}

export class FluidSimulation {
  constructor(gl, options = {}) {
    this.gl = gl;
    this.simulationScale = options.simulationScale ?? 0.25;
    this.jacobiIterations = options.jacobiIterations ?? 8;
    this.activeVelocityDissipation = options.activeVelocityDissipation
      ?? options.velocityDissipation
      ?? 0.956;
    this.releaseVelocityDissipation = options.releaseVelocityDissipation ?? 0.9;
    this.pointerForceScaleDesktop = options.pointerForceScaleDesktop ?? 6.8;
    this.pointerForceScaleMobile = options.pointerForceScaleMobile ?? 6.1;
    this.baseSplatRadiusDesktop = options.baseSplatRadiusDesktop ?? 0.00014;
    this.baseSplatRadiusMobile = options.baseSplatRadiusMobile ?? 0.00018;
    this.dynamicSplatRadiusDesktop = options.dynamicSplatRadiusDesktop ?? 0.001;
    this.dynamicSplatRadiusMobile = options.dynamicSplatRadiusMobile ?? 0.0014;
    this.maxSplatForce = options.maxSplatForce ?? 0.28;
    this.cpuSyncInterval = options.cpuSyncInterval ?? 1;

    this.viewportWidth = 1;
    this.viewportHeight = 1;
    this.simWidth = 1;
    this.simHeight = 1;

    this.quadBuffer = this.createFullscreenQuad();
    this.programs = this.createPrograms();

    this.velocity = null;
    this.pressure = null;
    this.divergence = null;

    this.pendingSplats = [];
    this.cpuVelocityRaw = null;
    this.frameCounter = 0;
    this.sampleResult = { x: 0, y: 0 };
    this.pointerDown = false;
  }

  createFullscreenQuad() {
    const gl = this.gl;
    const buffer = gl.createBuffer();

    if (!buffer) {
      throw new Error('Fluid quad buffer を作成できません。');
    }

    const vertices = new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1,
    ]);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    return buffer;
  }

  createPrograms() {
    const gl = this.gl;

    // Each pass is kept explicit to keep simulation responsibility in this file.
    return {
      advection: createProgramBundle(gl, advectionFragSource, [
        'u_velocity',
        'u_dt',
        'u_dissipation',
      ], 'advection'),
      divergence: createProgramBundle(gl, divergenceFragSource, [
        'u_velocity',
        'u_texelSize',
      ], 'divergence'),
      jacobi: createProgramBundle(gl, jacobiFragSource, [
        'u_pressure',
        'u_divergence',
        'u_texelSize',
      ], 'jacobi'),
      gradientSubtract: createProgramBundle(gl, gradientSubtractFragSource, [
        'u_velocity',
        'u_pressure',
        'u_texelSize',
      ], 'gradientSubtract'),
      splat: createProgramBundle(gl, splatFragSource, [
        'u_target',
        'u_point',
        'u_force',
        'u_radius',
        'u_aspectRatio',
      ], 'splat'),
    };
  }

  resize(viewportWidth, viewportHeight) {
    const width = Math.max(1, Math.floor(viewportWidth));
    const height = Math.max(1, Math.floor(viewportHeight));

    this.viewportWidth = width;
    this.viewportHeight = height;

    const simWidth = Math.max(32, Math.floor(width * this.simulationScale));
    const simHeight = Math.max(18, Math.floor(height * this.simulationScale));

    if (this.velocity && simWidth === this.simWidth && simHeight === this.simHeight) {
      return;
    }

    this.simWidth = simWidth;
    this.simHeight = simHeight;

    this.rebuildFramebuffers();
  }

  rebuildFramebuffers() {
    const gl = this.gl;

    if (this.velocity) {
      destroyPingPongFBO(gl, this.velocity);
    }

    if (this.pressure) {
      destroyPingPongFBO(gl, this.pressure);
    }

    if (this.divergence) {
      destroyTextureFBO(gl, this.divergence);
    }

    const velocityOptions = {
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrap: gl.CLAMP_TO_EDGE,
    };

    const scalarOptions = {
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST,
      wrap: gl.CLAMP_TO_EDGE,
    };

    this.velocity = createPingPongFBO(
      gl,
      this.simWidth,
      this.simHeight,
      velocityOptions,
    );
    this.pressure = createPingPongFBO(
      gl,
      this.simWidth,
      this.simHeight,
      scalarOptions,
    );
    this.divergence = createTextureFBO(
      gl,
      this.simWidth,
      this.simHeight,
      scalarOptions,
    );

    this.cpuVelocityRaw = new Uint8Array(this.simWidth * this.simHeight * 4);
    this.clearFramebuffer(this.velocity.read.framebuffer, 0.5, 0.5, 0.5, 1);
    this.clearFramebuffer(this.velocity.write.framebuffer, 0.5, 0.5, 0.5, 1);
    this.clearFramebuffer(this.pressure.read.framebuffer, 0.5, 0.5, 0.5, 1);
    this.clearFramebuffer(this.pressure.write.framebuffer, 0.5, 0.5, 0.5, 1);
    this.clearFramebuffer(this.divergence.framebuffer, 0.5, 0.5, 0.5, 1);

    this.pendingSplats.length = 0;
    this.frameCounter = 0;
    this.syncVelocityToCPU();
  }

  clearFramebuffer(framebuffer, r, g, b, a) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.viewport(0, 0, this.simWidth, this.simHeight);
    gl.clearColor(r, g, b, a);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  bindProgram(programBundle, targetFramebuffer) {
    const gl = this.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFramebuffer);
    gl.viewport(0, 0, this.simWidth, this.simHeight);
    gl.disable(gl.BLEND);
    gl.useProgram(programBundle.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(programBundle.aPosition);
    gl.vertexAttribPointer(programBundle.aPosition, 2, gl.FLOAT, false, 0, 0);
  }

  bindTexture(unit, texture, location) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(location, unit);
  }

  drawFullscreen() {
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  setPointerDown(pointerDown) {
    this.pointerDown = !!pointerDown;
    if (!this.pointerDown) {
      this.pendingSplats.length = 0;
    }
  }

  addPointerInput(pointer) {
    if (!pointer || !this.pointerDown) {
      return;
    }

    const dx = pointer.dx || 0;
    const dy = pointer.dy || 0;
    const movement = Math.hypot(dx, dy);

    if (movement < 0.0001) {
      return;
    }

    const isMobile = this.viewportWidth < MOBILE_BREAKPOINT;
    const pointerForceScale = isMobile
      ? this.pointerForceScaleMobile
      : this.pointerForceScaleDesktop;
    const baseSplatRadius = isMobile
      ? this.baseSplatRadiusMobile
      : this.baseSplatRadiusDesktop;
    const dynamicSplatRadius = isMobile
      ? this.dynamicSplatRadiusMobile
      : this.dynamicSplatRadiusDesktop;

    const x = clamp(pointer.x / this.viewportWidth, 0, 1);
    const y = clamp(1 - pointer.y / this.viewportHeight, 0, 1);
    let fx = (dx / this.viewportWidth) * pointerForceScale;
    let fy = (-dy / this.viewportHeight) * pointerForceScale;

    const forceMagnitude = Math.hypot(fx, fy);
    if (forceMagnitude > this.maxSplatForce && forceMagnitude > 0) {
      const scale = this.maxSplatForce / forceMagnitude;
      fx *= scale;
      fy *= scale;
    }

    const normalizedSpeed = Math.hypot(fx, fy);
    const radius = baseSplatRadius + Math.min(
      dynamicSplatRadius,
      normalizedSpeed * 0.0008,
    );

    this.pendingSplats.push({ x, y, fx, fy, radius });

    if (this.pendingSplats.length > MAX_PENDING_SPLATS) {
      this.pendingSplats.shift();
    }
  }

  runAdvectionPass(dt, dissipation) {
    const gl = this.gl;
    const program = this.programs.advection;

    this.bindProgram(program, this.velocity.write.framebuffer);
    this.bindTexture(0, this.velocity.read.texture, program.uniforms.u_velocity);
    gl.uniform1f(program.uniforms.u_dt, dt);
    gl.uniform1f(program.uniforms.u_dissipation, dissipation);

    this.drawFullscreen();
    this.velocity.swap();
  }

  runSplatPass(splat) {
    const gl = this.gl;
    const program = this.programs.splat;
    const aspectRatio = this.viewportWidth / Math.max(1, this.viewportHeight);

    this.bindProgram(program, this.velocity.write.framebuffer);
    this.bindTexture(0, this.velocity.read.texture, program.uniforms.u_target);
    gl.uniform2f(program.uniforms.u_point, splat.x, splat.y);
    gl.uniform2f(program.uniforms.u_force, splat.fx, splat.fy);
    gl.uniform1f(program.uniforms.u_radius, splat.radius);
    gl.uniform1f(program.uniforms.u_aspectRatio, aspectRatio);

    this.drawFullscreen();
    this.velocity.swap();
  }

  runDivergencePass() {
    const gl = this.gl;
    const program = this.programs.divergence;

    this.bindProgram(program, this.divergence.framebuffer);
    this.bindTexture(0, this.velocity.read.texture, program.uniforms.u_velocity);
    gl.uniform2f(program.uniforms.u_texelSize, 1 / this.simWidth, 1 / this.simHeight);

    this.drawFullscreen();
  }

  runJacobiPass() {
    const gl = this.gl;
    const program = this.programs.jacobi;

    for (let i = 0; i < this.jacobiIterations; i += 1) {
      this.bindProgram(program, this.pressure.write.framebuffer);
      this.bindTexture(0, this.pressure.read.texture, program.uniforms.u_pressure);
      this.bindTexture(1, this.divergence.texture, program.uniforms.u_divergence);
      gl.uniform2f(program.uniforms.u_texelSize, 1 / this.simWidth, 1 / this.simHeight);

      this.drawFullscreen();
      this.pressure.swap();
    }
  }

  runGradientSubtractPass() {
    const gl = this.gl;
    const program = this.programs.gradientSubtract;

    this.bindProgram(program, this.velocity.write.framebuffer);
    this.bindTexture(0, this.velocity.read.texture, program.uniforms.u_velocity);
    this.bindTexture(1, this.pressure.read.texture, program.uniforms.u_pressure);
    gl.uniform2f(program.uniforms.u_texelSize, 1 / this.simWidth, 1 / this.simHeight);

    this.drawFullscreen();
    this.velocity.swap();
  }

  syncVelocityToCPU() {
    if (!this.cpuVelocityRaw || !this.velocity) {
      return;
    }

    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.velocity.read.framebuffer);
    gl.readPixels(
      0,
      0,
      this.simWidth,
      this.simHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.cpuVelocityRaw,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  update(dt, options = {}) {
    if (!this.velocity || !this.pressure || !this.divergence) {
      return;
    }

    if (typeof options.pointerDown === 'boolean') {
      this.pointerDown = options.pointerDown;
    }

    const clampedDt = Math.min(0.033, Math.max(0.001, dt));
    const dissipation = this.pointerDown
      ? this.activeVelocityDissipation
      : this.releaseVelocityDissipation;
    this.runAdvectionPass(clampedDt, dissipation);

    for (let i = 0; i < this.pendingSplats.length; i += 1) {
      this.runSplatPass(this.pendingSplats[i]);
    }

    this.pendingSplats.length = 0;

    this.clearFramebuffer(this.pressure.read.framebuffer, 0.5, 0.5, 0.5, 1);
    this.clearFramebuffer(this.pressure.write.framebuffer, 0.5, 0.5, 0.5, 1);

    this.runDivergencePass();
    this.runJacobiPass();
    this.runGradientSubtractPass();

    this.frameCounter += 1;
    if (this.frameCounter % this.cpuSyncInterval === 0) {
      this.syncVelocityToCPU();
    }

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  sampleVelocity(x, y) {
    if (!this.cpuVelocityRaw) {
      this.sampleResult.x = 0;
      this.sampleResult.y = 0;
      return this.sampleResult;
    }

    const u = clamp(x / this.viewportWidth, 0, 0.9999);
    const v = clamp(1 - y / this.viewportHeight, 0, 0.9999);

    const fx = u * (this.simWidth - 1);
    const fy = v * (this.simHeight - 1);

    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(this.simWidth - 1, x0 + 1);
    const y1 = Math.min(this.simHeight - 1, y0 + 1);

    const tx = fx - x0;
    const ty = fy - y0;

    const idx00 = (y0 * this.simWidth + x0) * 4;
    const idx10 = (y0 * this.simWidth + x1) * 4;
    const idx01 = (y1 * this.simWidth + x0) * 4;
    const idx11 = (y1 * this.simWidth + x1) * 4;

    const vx00 = (this.cpuVelocityRaw[idx00] / 255) * 2 - 1;
    const vy00 = (this.cpuVelocityRaw[idx00 + 1] / 255) * 2 - 1;
    const vx10 = (this.cpuVelocityRaw[idx10] / 255) * 2 - 1;
    const vy10 = (this.cpuVelocityRaw[idx10 + 1] / 255) * 2 - 1;
    const vx01 = (this.cpuVelocityRaw[idx01] / 255) * 2 - 1;
    const vy01 = (this.cpuVelocityRaw[idx01 + 1] / 255) * 2 - 1;
    const vx11 = (this.cpuVelocityRaw[idx11] / 255) * 2 - 1;
    const vy11 = (this.cpuVelocityRaw[idx11 + 1] / 255) * 2 - 1;

    const vx0 = vx00 * (1 - tx) + vx10 * tx;
    const vx1 = vx01 * (1 - tx) + vx11 * tx;
    const vy0 = vy00 * (1 - tx) + vy10 * tx;
    const vy1 = vy01 * (1 - tx) + vy11 * tx;

    this.sampleResult.x = vx0 * (1 - ty) + vx1 * ty;
    this.sampleResult.y = vy0 * (1 - ty) + vy1 * ty;

    return this.sampleResult;
  }

  dispose() {
    const gl = this.gl;

    if (this.velocity) {
      destroyPingPongFBO(gl, this.velocity);
      this.velocity = null;
    }

    if (this.pressure) {
      destroyPingPongFBO(gl, this.pressure);
      this.pressure = null;
    }

    if (this.divergence) {
      destroyTextureFBO(gl, this.divergence);
      this.divergence = null;
    }

    const programList = Object.values(this.programs);
    for (let i = 0; i < programList.length; i += 1) {
      gl.deleteProgram(programList[i].program);
    }

    gl.deleteBuffer(this.quadBuffer);
    this.cpuVelocityRaw = null;
    this.pendingSplats.length = 0;
  }
}
