const MOBILE_BREAKPOINT = 768;
const PARTICLE_COUNT_DESKTOP = 14000;
const PARTICLE_COUNT_MOBILE = 7600;
const POINT_SIZE_DESKTOP = 2.35;
const POINT_SIZE_MOBILE = 2.7;

export const PARTICLE_MOTION_MODES = Object.freeze({
  IDLE: 'IDLE',
  INTERACT: 'INTERACT',
  RETURN: 'RETURN',
});

function getParticleCount(width) {
  return width < MOBILE_BREAKPOINT
    ? PARTICLE_COUNT_MOBILE
    : PARTICLE_COUNT_DESKTOP;
}

function getPointSize(width) {
  return width < MOBILE_BREAKPOINT ? POINT_SIZE_MOBILE : POINT_SIZE_DESKTOP;
}

class Particle {
  constructor(index, width, height, basePointSize) {
    this.index = index;
    this.seed = Math.random() * 1000;

    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.tx = width * 0.5;
    this.ty = height * 0.5;

    this.vx = (Math.random() - 0.5) * 2;
    this.vy = (Math.random() - 0.5) * 2;
    this.ax = 0;
    this.ay = 0;

    this.basePointSize = basePointSize;
    this.sizeVariance = 0.9 + Math.random() * 0.22;
    this.size = this.basePointSize * this.sizeVariance;
    this.interactionAccent = 0.86 + Math.random() * 0.28;
    this.colorBias = (Math.random() * 2 - 1) * (0.35 + Math.random() * 0.65);
    this.interactionGlow = 0;

    this.depthBase = (Math.random() - 0.5) * 0.32;
    this.depthSign = Math.random() < 0.5 ? -1 : 1;
    this.depth = this.depthBase;
    this.depthVelocity = 0;
  }

  setTarget(x, y) {
    this.tx = x;
    this.ty = y;
  }

  scatter(power = 14) {
    this.vx += (Math.random() - 0.5) * power;
    this.vy += (Math.random() - 0.5) * power;
  }

  update(dt, time, config, flowField, interaction, motionMode) {
    const step = Math.min(2, dt * 60);
    const dx = this.tx - this.x;
    const dy = this.ty - this.y;
    const isIdleMode = motionMode === PARTICLE_MOTION_MODES.IDLE;
    const isInteractMode = motionMode === PARTICLE_MOTION_MODES.INTERACT;

    let coreAx = dx * config.spring;
    let coreAy = dy * config.spring;

    if (!isIdleMode && config.noiseStrength > 0) {
      const nx =
        Math.sin(time * 1.17 + this.seed * 0.37) * config.noiseStrength +
        Math.cos(time * 0.73 + this.seed * 0.81) * (config.noiseStrength * 0.6);
      const ny =
        Math.cos(time * 1.01 + this.seed * 0.43) * config.noiseStrength +
        Math.sin(time * 0.79 + this.seed * 0.67) * (config.noiseStrength * 0.6);

      coreAx += nx;
      coreAy += ny;
    }

    let pointerAx = 0;
    let pointerAy = 0;
    let fluidAx = 0;
    let fluidAy = 0;
    let flowMagnitude = 0;

    if (isInteractMode && interaction) {
      const pdx = this.x - interaction.x;
      const pdy = this.y - interaction.y;
      const pointerDist = Math.hypot(pdx, pdy);

      if (pointerDist < interaction.pointerRadius && config.pointerForce > 0) {
        const t = Math.max(0, 1 - pointerDist / interaction.pointerRadius);
        const smooth = t * t * (3 - 2 * t);
        const falloff = smooth * smooth;

        pointerAx = interaction.dx * config.pointerForce * falloff * interaction.influence;
        pointerAy = interaction.dy * config.pointerForce * falloff * interaction.influence;

        const pointerAccelMag = Math.hypot(pointerAx, pointerAy);
        if (pointerAccelMag > config.pointerMaxAccel && pointerAccelMag > 0) {
          const scale = config.pointerMaxAccel / pointerAccelMag;
          pointerAx *= scale;
          pointerAy *= scale;
        }
      }

      if (
        pointerDist < interaction.fluidRadius &&
        config.fluidInfluence > 0 &&
        flowField &&
        typeof flowField.sampleVelocity === 'function'
      ) {
        const t = Math.max(0, 1 - pointerDist / interaction.fluidRadius);
        const smooth = t * t * (3 - 2 * t);
        const falloff = smooth * smooth * interaction.influence;

        const flow = flowField.sampleVelocity(this.x, this.y);
        const flowLength = Math.hypot(flow.x, flow.y);
        flowMagnitude = flowLength * falloff;

        fluidAx = flow.x * config.fluidInfluence * falloff;
        fluidAy = flow.y * config.fluidInfluence * falloff;

        if (config.fluidDisturbance > 0 && flowLength > 0.0001) {
          const invLen = 1 / flowLength;
          const perpX = -flow.y * invLen;
          const perpY = flow.x * invLen;
          const burst = Math.min(1, flowMagnitude / config.fluidBurstScale);
          const phase = time * config.fluidDisturbanceFreq + this.seed * 1.97;
          const oscillation = Math.sin(phase) * 0.5 + Math.cos(phase * 0.63) * 0.5;
          const disturbance = config.fluidDisturbance * burst;

          fluidAx += perpX * oscillation * disturbance;
          fluidAy += perpY * oscillation * disturbance;
        }

        const fluidAccelMag = Math.hypot(fluidAx, fluidAy);
        if (fluidAccelMag > config.fluidMaxAccel && fluidAccelMag > 0) {
          const scale = config.fluidMaxAccel / fluidAccelMag;
          fluidAx *= scale;
          fluidAy *= scale;
        }
      }
    }

    let sizeBoost = 0;
    if (isInteractMode && interaction) {
      const pdx = this.x - interaction.x;
      const pdy = this.y - interaction.y;
      const pointerDist = Math.hypot(pdx, pdy);
      if (pointerDist < interaction.pointerRadius) {
        const t = Math.max(0, 1 - pointerDist / interaction.pointerRadius);
        const smooth = t * t * (3 - 2 * t);
        sizeBoost = smooth * 0.18 * this.interactionAccent * interaction.influence;
      }
    }

    const glowTarget = Math.min(1, sizeBoost * 3.8);
    this.interactionGlow += (glowTarget - this.interactionGlow) * Math.min(1, 0.22 * step);

    let pointerDvX = pointerAx * step;
    let pointerDvY = pointerAy * step;
    const pointerDvMag = Math.hypot(pointerDvX, pointerDvY);
    if (pointerDvMag > config.pointerMaxSpeedDelta && pointerDvMag > 0) {
      const scale = config.pointerMaxSpeedDelta / pointerDvMag;
      pointerDvX *= scale;
      pointerDvY *= scale;
    }

    let fluidDvX = fluidAx * step;
    let fluidDvY = fluidAy * step;
    const fluidDvMag = Math.hypot(fluidDvX, fluidDvY);
    if (fluidDvMag > config.fluidMaxSpeedDelta && fluidDvMag > 0) {
      const scale = config.fluidMaxSpeedDelta / fluidDvMag;
      fluidDvX *= scale;
      fluidDvY *= scale;
    }

    this.ax = coreAx + pointerAx + fluidAx;
    this.ay = coreAy + pointerAy + fluidAy;

    this.vx += coreAx * step + pointerDvX + fluidDvX;
    this.vy += coreAy * step + pointerDvY + fluidDvY;

    const damp = Math.pow(config.damping, step);
    this.vx *= damp;
    this.vy *= damp;

    const speed = Math.hypot(this.vx, this.vy);
    if (speed > config.maxSpeed) {
      const scale = config.maxSpeed / speed;
      this.vx *= scale;
      this.vy *= scale;
    }

    if (Math.abs(dx) < config.snapDistance && Math.abs(dy) < config.snapDistance) {
      this.vx *= config.snapVelocityFactor;
      this.vy *= config.snapVelocityFactor;

      if (Math.abs(this.vx) < config.stopVelocityEpsilon) {
        this.vx = 0;
      }
      if (Math.abs(this.vy) < config.stopVelocityEpsilon) {
        this.vy = 0;
      }
    }

    const depthNoise = config.depthNoiseAmplitude > 0
      ? (
        Math.sin(time * 0.86 + this.seed * 0.47) * config.depthNoiseAmplitude +
        Math.cos(time * 1.19 + this.seed * 0.21) * (config.depthNoiseAmplitude * 0.64)
      )
      : 0;
    const baseFlowDepth = config.depthFlowInfluence > 0
      ? Math.min(config.depthFlowMax, flowMagnitude * config.depthFlowInfluence)
      : 0;
    const flowDepth = baseFlowDepth * this.depthSign * config.depthFlowSignedness;
    const interactionDepth = isInteractMode
      ? sizeBoost * config.depthInteractSpread * this.depthSign
      : 0;
    const depthTarget = Math.max(
      -config.depthClamp,
      Math.min(
        config.depthClamp,
        this.depthBase + depthNoise + flowDepth + interactionDepth,
      ),
    );

    this.depthVelocity += (depthTarget - this.depth) * config.depthSpring * step;
    this.depthVelocity *= Math.pow(config.depthDamping, step);
    this.depth += this.depthVelocity * step;
    this.depth = Math.max(-config.depthClamp, Math.min(config.depthClamp, this.depth));

    const sizeTarget = this.basePointSize * this.sizeVariance * (1 + sizeBoost);
    this.size += (sizeTarget - this.size) * Math.min(1, 0.24 * step);

    this.x += this.vx * step;
    this.y += this.vy * step;
  }
}

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.currentParticleCount = 0;
    this.viewportWidth = 0;
    this.viewportHeight = 0;

    this.motionConfigs = {
      [PARTICLE_MOTION_MODES.IDLE]: {
        spring: 0.14,
        damping: 0.9,
        maxSpeed: 10,
        noiseStrength: 0,
        fluidInfluence: 0,
        fluidMaxAccel: 0,
        fluidMaxSpeedDelta: 0,
        fluidDisturbance: 0,
        fluidDisturbanceFreq: 0,
        fluidBurstScale: 1,
        pointerForce: 0,
        pointerMaxAccel: 0,
        pointerMaxSpeedDelta: 0,
        pointerRadiusRatioDesktop: 0.16,
        pointerRadiusRatioMobile: 0.22,
        fluidRadiusMultiplier: 1.3,
        snapDistance: 0.75,
        snapVelocityFactor: 0.24,
        stopVelocityEpsilon: 0.04,
        depthSpring: 0.074,
        depthDamping: 0.91,
        depthNoiseAmplitude: 0,
        depthFlowInfluence: 0,
        depthFlowSignedness: 0,
        depthInteractSpread: 0,
        depthFlowMax: 0.2,
        depthClamp: 0.34,
      },
      [PARTICLE_MOTION_MODES.INTERACT]: {
        spring: 0.086,
        damping: 0.86,
        maxSpeed: 13,
        noiseStrength: 0.03,
        fluidInfluence: 0.48,
        fluidMaxAccel: 0.24,
        fluidMaxSpeedDelta: 0.36,
        fluidDisturbance: 0.34,
        fluidDisturbanceFreq: 7.8,
        fluidBurstScale: 0.055,
        pointerForce: 0.08,
        pointerMaxAccel: 1.4,
        pointerMaxSpeedDelta: 1.1,
        pointerRadiusRatioDesktop: 0.11,
        pointerRadiusRatioMobile: 0.15,
        fluidRadiusMultiplier: 0.72,
        snapDistance: 0.28,
        snapVelocityFactor: 0.9,
        stopVelocityEpsilon: 0.02,
        depthSpring: 0.084,
        depthDamping: 0.86,
        depthNoiseAmplitude: 0.09,
        depthFlowInfluence: 0.28,
        depthFlowSignedness: 0.72,
        depthInteractSpread: 0.32,
        depthFlowMax: 0.18,
        depthClamp: 0.62,
      },
      [PARTICLE_MOTION_MODES.RETURN]: {
        spring: 0.11,
        damping: 0.87,
        maxSpeed: 15,
        noiseStrength: 0,
        fluidInfluence: 0,
        fluidMaxAccel: 0,
        fluidMaxSpeedDelta: 0,
        fluidDisturbance: 0,
        fluidDisturbanceFreq: 0,
        fluidBurstScale: 1,
        pointerForce: 0,
        pointerMaxAccel: 0,
        pointerMaxSpeedDelta: 0,
        pointerRadiusRatioDesktop: 0.16,
        pointerRadiusRatioMobile: 0.22,
        fluidRadiusMultiplier: 1.3,
        snapDistance: 0.58,
        snapVelocityFactor: 0.5,
        stopVelocityEpsilon: 0.03,
        depthSpring: 0.078,
        depthDamping: 0.9,
        depthNoiseAmplitude: 0,
        depthFlowInfluence: 0,
        depthFlowSignedness: 0,
        depthInteractSpread: 0,
        depthFlowMax: 0.2,
        depthClamp: 0.42,
      },
    };
  }

  rebuild(width, height) {
    this.viewportWidth = width;
    this.viewportHeight = height;

    const count = getParticleCount(width);
    const basePointSize = getPointSize(width);

    this.currentParticleCount = count;
    this.particles = new Array(count);

    for (let i = 0; i < count; i += 1) {
      this.particles[i] = new Particle(i, width, height, basePointSize);
    }
  }

  setTargets(targetPoints) {
    if (!targetPoints || targetPoints.length === 0) {
      return;
    }

    const count = Math.min(this.particles.length, targetPoints.length);

    for (let i = 0; i < count; i += 1) {
      this.particles[i].setTarget(targetPoints[i].x, targetPoints[i].y);
    }
  }

  scatter(power = 14) {
    for (let i = 0; i < this.particles.length; i += 1) {
      this.particles[i].scatter(power);
    }
  }

  getMotionConfig(mode) {
    if (mode && this.motionConfigs[mode]) {
      return this.motionConfigs[mode];
    }
    return this.motionConfigs[PARTICLE_MOTION_MODES.IDLE];
  }

  buildPointerInteraction(options, config) {
    const pointer = options.pointer;
    if (!pointer || pointer.influence <= 0) {
      return null;
    }

    const width = options.viewportWidth || this.viewportWidth;
    const height = options.viewportHeight || this.viewportHeight;
    if (!width || !height) {
      return null;
    }

    const radiusRatio = width < MOBILE_BREAKPOINT
      ? config.pointerRadiusRatioMobile
      : config.pointerRadiusRatioDesktop;
    const pointerRadius = Math.max(28, Math.min(width, height) * radiusRatio);

    return {
      x: pointer.x,
      y: pointer.y,
      dx: pointer.smoothDx,
      dy: pointer.smoothDy,
      influence: pointer.influence,
      pointerRadius,
      fluidRadius: pointerRadius * config.fluidRadiusMultiplier,
    };
  }

  update(dt, time = 0, flowField = null, options = {}) {
    const motionMode = options.motionMode || options.mode || PARTICLE_MOTION_MODES.IDLE;
    const config = this.getMotionConfig(motionMode);
    const interaction = motionMode === PARTICLE_MOTION_MODES.INTERACT
      ? this.buildPointerInteraction(options, config)
      : null;

    for (let i = 0; i < this.particles.length; i += 1) {
      this.particles[i].update(dt, time, config, flowField, interaction, motionMode);
    }
  }

  isSettled(positionThreshold = 0.75, velocityThreshold = 0.14, sampleStride = 2) {
    if (this.particles.length === 0) {
      return true;
    }

    const stride = Math.max(1, sampleStride | 0);
    for (let i = 0; i < this.particles.length; i += stride) {
      const p = this.particles[i];

      if (Math.abs(p.tx - p.x) > positionThreshold || Math.abs(p.ty - p.y) > positionThreshold) {
        return false;
      }

      if (Math.abs(p.vx) > velocityThreshold || Math.abs(p.vy) > velocityThreshold) {
        return false;
      }
    }

    return true;
  }

  getParticles() {
    return this.particles;
  }

  getParticleCount() {
    return this.currentParticleCount;
  }
}
