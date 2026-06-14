import * as THREE from 'three';
import {
  threeParticleFragmentShader,
  threeParticleVertexShader,
} from './threeParticleShaders.js';

const MOBILE_BREAKPOINT = 768;
const PARTICLE_COUNT_DESKTOP = 13600;
const PARTICLE_COUNT_MOBILE = 7400;
const POINT_SIZE_DESKTOP = 2.32;
const POINT_SIZE_MOBILE = 2.58;
const MIN_PARTICLES_PER_DAYS_DIGIT_GROUP = 470;
const MIN_PARTICLES_PER_DAYS_LETTER_GROUP = 590;
const MIN_PARTICLES_PER_TIME_GROUP = 310;
const MIN_PARTICLES_PER_TIME_ONE_GROUP = 195;
const MIN_PARTICLES_PER_PUNCTUATION_GROUP = 86;
const MIN_PARTICLES_PER_TEXT_GROUP = 210;
const CHANGED_GROUP_VELOCITY = 0.34;

export const THREE_PARTICLE_MOTION_MODES = Object.freeze({
  IDLE: 'IDLE',
  INTERACT: 'INTERACT',
  RETURN: 'RETURN',
  AMBIENT: 'AMBIENT',
});

function getParticleCount(width) {
  return width < MOBILE_BREAKPOINT ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP;
}

function getPointSize(width) {
  return width < MOBILE_BREAKPOINT ? POINT_SIZE_MOBILE : POINT_SIZE_DESKTOP;
}

function createParticleData(index, width, height, baseSize) {
  const random = Math.random();
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    tx: width * 0.5,
    ty: height * 0.5,
    vx: (Math.random() - 0.5) * 1.8,
    vy: (Math.random() - 0.5) * 1.8,
    size: baseSize * (0.96 + Math.random() * 0.08),
    random,
    type: 'time',
    energy: 0,
    groupKey: null,
    groupTargetRatio: (index * 0.618033988749895) % 1,
  };
}

function toThreeColor(r, g, b) {
  return new THREE.Color(r, g, b);
}

function getMinimumParticlesForGroup(group) {
  if (group.lineIndex === 0) {
    return /[A-Z]/.test(group.char)
      ? MIN_PARTICLES_PER_DAYS_LETTER_GROUP
      : MIN_PARTICLES_PER_DAYS_DIGIT_GROUP;
  }
  if (group.lineIndex === 1) {
    if (group.char === ':') {
      return MIN_PARTICLES_PER_PUNCTUATION_GROUP;
    }
    if (group.char === '1') {
      return MIN_PARTICLES_PER_TIME_ONE_GROUP;
    }
    return MIN_PARTICLES_PER_TIME_GROUP;
  }
  return MIN_PARTICLES_PER_TEXT_GROUP;
}

export class ThreeParticleCountdownScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });
    this.renderer.setClearColor(0xffe8e8, 1);
    this.renderer.setPixelRatio(1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
    this.geometry = null;
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uResolution: { value: new THREE.Vector2(1, 1) },
        uPixelRatio: { value: 1 },
        uTime: { value: 0 },
        uColor: { value: toThreeColor(1.0, 0.44, 0.72) },
        uOpacity: { value: 1.0 },
      },
      vertexShader: threeParticleVertexShader,
      fragmentShader: threeParticleFragmentShader,
    });
    this.points = null;
    this.particles = [];
    this.currentParticleCount = 0;
    this.width = 1;
    this.height = 1;
    this.dpr = 1;
    this.sizeScale = 1;
    this.pointerDown = false;
  }

  resize(width, height, dpr = 1) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.dpr = Math.min(dpr || 1, 2);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.right = this.width;
    this.camera.bottom = this.height;
    this.camera.updateProjectionMatrix();
    this.material.uniforms.uResolution.value.set(this.width, this.height);
    this.material.uniforms.uPixelRatio.value = this.dpr;
  }

  rebuild(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    const count = getParticleCount(this.width);
    const baseSize = getPointSize(this.width);

    this.currentParticleCount = count;
    this.particles = Array.from({ length: count }, (_, index) => (
      createParticleData(index, this.width, this.height, baseSize)
    ));
    this.buildGeometry();
  }

  buildGeometry() {
    if (this.points) {
      this.scene.remove(this.points);
      this.geometry?.dispose();
    }

    const count = this.particles.length;
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    this.geometry.setAttribute('targetPosition', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    this.geometry.setAttribute('particleRandom', new THREE.BufferAttribute(new Float32Array(count), 1));
    this.geometry.setAttribute('particleSize', new THREE.BufferAttribute(new Float32Array(count), 1));
    this.geometry.setAttribute('particleType', new THREE.BufferAttribute(new Float32Array(count), 1));
    this.geometry.setAttribute('particleEnergy', new THREE.BufferAttribute(new Float32Array(count), 1));
    this.points = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.points);
    this.syncAllAttributes();
  }

  syncAllAttributes() {
    if (!this.geometry) {
      return;
    }
    const position = this.geometry.getAttribute('position');
    const target = this.geometry.getAttribute('targetPosition');
    const random = this.geometry.getAttribute('particleRandom');
    const size = this.geometry.getAttribute('particleSize');
    const type = this.geometry.getAttribute('particleType');
    const energy = this.geometry.getAttribute('particleEnergy');

    this.particles.forEach((particle, index) => {
      position.setXYZ(index, particle.x, particle.y, 0);
      target.setXY(index, particle.tx, particle.ty);
      random.setX(index, particle.random);
      size.setX(index, particle.size * this.sizeScale);
      type.setX(index, particle.type === 'days' ? 0 : 1);
      energy.setX(index, particle.energy);
    });

    position.needsUpdate = true;
    target.needsUpdate = true;
    random.needsUpdate = true;
    size.needsUpdate = true;
    type.needsUpdate = true;
    energy.needsUpdate = true;
  }

  syncDynamicAttributes() {
    if (!this.geometry) {
      return;
    }
    const position = this.geometry.getAttribute('position');
    const size = this.geometry.getAttribute('particleSize');
    const type = this.geometry.getAttribute('particleType');
    const energy = this.geometry.getAttribute('particleEnergy');

    this.particles.forEach((particle, index) => {
      position.setXYZ(index, particle.x, particle.y, 0);
      size.setX(index, particle.size * this.sizeScale);
      type.setX(index, particle.type === 'days' ? 0 : 1);
      energy.setX(index, particle.energy);
    });

    position.needsUpdate = true;
    size.needsUpdate = true;
    type.needsUpdate = true;
    energy.needsUpdate = true;
  }

  setClearColor(r, g, b, a = 1) {
    this.renderer.setClearColor(toThreeColor(r, g, b), a);
  }

  setParticleColor(r, g, b) {
    this.material.uniforms.uColor.value.setRGB(r, g, b);
  }

  setSizeScale(sizeScale = 1) {
    this.sizeScale = Math.max(0.1, sizeScale);
  }

  getParticleCount() {
    return this.currentParticleCount;
  }

  clearTargetGroups() {
    this.particles.forEach((particle) => {
      particle.groupKey = null;
    });
  }

  setTargets(targetPoints) {
    if (!Array.isArray(targetPoints) || targetPoints.length === 0) {
      return;
    }

    this.clearTargetGroups();
    this.particles.forEach((particle, index) => {
      const target = targetPoints[index % targetPoints.length];
      particle.tx = target.x;
      particle.ty = target.y;
      particle.type = target.type === 'days' ? 'days' : 'time';
    });
    this.syncTargetAttributes();
  }

  getAvailableTargetGroups(groupedTargetPoints) {
    if (!groupedTargetPoints) {
      return [];
    }

    return Object.entries(groupedTargetPoints)
      .filter(([, points]) => Array.isArray(points) && points.length > 0)
      .map(([groupKey, points]) => ({
        groupKey,
        points,
        char: points[0]?.char ?? '',
        lineIndex: points[0]?.lineIndex ?? 0,
      }));
  }

  allocateParticlesToGroups(groups) {
    const particleCount = this.particles.length;
    const minimums = groups.map((group) => ({
      ...group,
      minimumCount: getMinimumParticlesForGroup(group),
      count: 0,
    }));
    const minimumTotal = minimums.reduce((total, group) => total + group.minimumCount, 0);
    const totalPoints = groups.reduce((total, group) => total + Math.max(1, group.points.length), 0);

    if (minimumTotal >= particleCount) {
      let assigned = 0;
      const scaled = minimums.map((group) => {
        const count = Math.max(1, Math.floor((group.minimumCount / minimumTotal) * particleCount));
        assigned += count;
        return { ...group, count };
      });
      while (assigned < particleCount) {
        scaled[assigned % scaled.length].count += 1;
        assigned += 1;
      }
      return scaled;
    }

    let remaining = particleCount - minimumTotal;
    const allocations = minimums.map((group) => {
      const extra = Math.floor((Math.max(1, group.points.length) / totalPoints) * remaining);
      return { ...group, count: group.minimumCount + extra };
    });
    let assigned = allocations.reduce((total, group) => total + group.count, 0);
    while (assigned < particleCount) {
      allocations[assigned % allocations.length].count += 1;
      assigned += 1;
    }
    return allocations;
  }

  setTargetsByGroup(groupedTargetPoints) {
    const groups = this.getAvailableTargetGroups(groupedTargetPoints);
    if (groups.length === 0) {
      return;
    }

    this.clearTargetGroups();
    const allocations = this.allocateParticlesToGroups(groups);
    let particleIndex = 0;

    allocations.forEach((allocation) => {
      for (let i = 0; i < allocation.count && particleIndex < this.particles.length; i += 1) {
        const particle = this.particles[particleIndex];
        const ratio = (i * 0.618033988749895) % 1;
        const target = allocation.points[Math.min(
          allocation.points.length - 1,
          Math.floor(ratio * allocation.points.length),
        )];
        particle.groupKey = allocation.groupKey;
        particle.groupTargetRatio = ratio;
        particle.tx = target.x;
        particle.ty = target.y;
        particle.type = target.type === 'days' ? 'days' : 'time';
        particleIndex += 1;
      }
    });
    this.syncTargetAttributes();
  }

  softUpdateTargetsByGroup(groupedTargetPoints, changedGroupKeys = []) {
    if (!groupedTargetPoints) {
      return;
    }

    const changed = new Set(changedGroupKeys);
    this.particles.forEach((particle) => {
      if (!particle.groupKey) {
        return;
      }

      const targets = groupedTargetPoints[particle.groupKey];
      if (!Array.isArray(targets) || targets.length === 0) {
        return;
      }

      const target = targets[Math.min(
        targets.length - 1,
        Math.floor(particle.groupTargetRatio * targets.length),
      )];
      particle.tx = target.x;
      particle.ty = target.y;
      particle.type = target.type === 'days' ? 'days' : 'time';

      if (changed.has(particle.groupKey)) {
        particle.vx += (Math.random() - 0.5) * CHANGED_GROUP_VELOCITY;
        particle.vy += (Math.random() - 0.5) * CHANGED_GROUP_VELOCITY;
        particle.energy = Math.max(particle.energy, 0.55);
      }
    });
    this.syncTargetAttributes();
  }

  syncTargetAttributes() {
    if (!this.geometry) {
      return;
    }
    const target = this.geometry.getAttribute('targetPosition');
    const type = this.geometry.getAttribute('particleType');
    this.particles.forEach((particle, index) => {
      target.setXY(index, particle.tx, particle.ty);
      type.setX(index, particle.type === 'days' ? 0 : 1);
    });
    target.needsUpdate = true;
    type.needsUpdate = true;
  }

  scatter(power = 4.5) {
    const scaledPower = Math.min(7, power);
    this.particles.forEach((particle) => {
      particle.vx += (Math.random() - 0.5) * scaledPower;
      particle.vy += (Math.random() - 0.5) * scaledPower;
      particle.energy = Math.max(particle.energy, 0.5);
    });
  }

  buildPointerInteraction(options = {}) {
    const pointer = options.pointer;
    if (!pointer || pointer.influence <= 0) {
      return null;
    }

    const isMobile = this.width < MOBILE_BREAKPOINT;
    const radius = Math.max(46, Math.min(this.width, this.height) * (isMobile ? 0.18 : 0.12));

    return {
      x: pointer.x,
      y: pointer.y,
      dx: pointer.smoothDx || 0,
      dy: pointer.smoothDy || 0,
      influence: pointer.influence,
      radius,
    };
  }

  update(dt, time = 0, _flowField = null, options = {}) {
    const step = Math.min(2, dt * 60);
    const motionMode = options.motionMode || options.mode || THREE_PARTICLE_MOTION_MODES.IDLE;
    const interaction = motionMode === THREE_PARTICLE_MOTION_MODES.INTERACT
      ? this.buildPointerInteraction(options)
      : null;

    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uOpacity.value = motionMode === THREE_PARTICLE_MOTION_MODES.AMBIENT ? 0.72 : 1;

    this.particles.forEach((particle) => {
      const dx = particle.tx - particle.x;
      const dy = particle.ty - particle.y;
      let ax = dx * 0.105;
      let ay = dy * 0.105;
      let damping = 0.86;

      if (motionMode === THREE_PARTICLE_MOTION_MODES.AMBIENT) {
        ax = dx * 0.012 + Math.sin(time * 0.7 + particle.random * 10.0) * 0.014;
        ay = dy * 0.012 + Math.cos(time * 0.62 + particle.random * 11.0) * 0.014;
        damping = 0.965;
      } else if (interaction) {
        const px = particle.x - interaction.x;
        const py = particle.y - interaction.y;
        const distance = Math.hypot(px, py);

        if (distance < interaction.radius) {
          const t = 1 - distance / interaction.radius;
          const smooth = t * t * (3 - 2 * t);
          const invDistance = distance > 0.0001 ? 1 / distance : 0;
          const nx = px * invDistance;
          const ny = py * invDistance;
          const tangentX = -ny;
          const tangentY = nx;
          const pointerSpeed = Math.min(18, Math.hypot(interaction.dx, interaction.dy));
          const push = smooth * (0.42 + pointerSpeed * 0.018) * interaction.influence;
          const swirl = smooth * (0.32 + pointerSpeed * 0.012) * interaction.influence;

          ax += nx * push + tangentX * swirl + interaction.dx * 0.014 * smooth;
          ay += ny * push + tangentY * swirl + interaction.dy * 0.014 * smooth;
          particle.energy = Math.max(particle.energy, smooth);
        }
        damping = 0.875;
      }

      particle.vx = (particle.vx + ax * step) * Math.pow(damping, step);
      particle.vy = (particle.vy + ay * step) * Math.pow(damping, step);
      const speed = Math.hypot(particle.vx, particle.vy);
      const maxSpeed = motionMode === THREE_PARTICLE_MOTION_MODES.INTERACT ? 16 : 12;
      if (speed > maxSpeed) {
        const scale = maxSpeed / speed;
        particle.vx *= scale;
        particle.vy *= scale;
      }

      particle.x += particle.vx * step;
      particle.y += particle.vy * step;
      particle.energy += (0 - particle.energy) * Math.min(1, 0.08 * step);
    });

    this.syncDynamicAttributes();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  isSettled(positionThreshold = 0.75, velocityThreshold = 0.14, sampleStride = 2) {
    const stride = Math.max(1, sampleStride | 0);
    for (let i = 0; i < this.particles.length; i += stride) {
      const particle = this.particles[i];
      if (Math.abs(particle.tx - particle.x) > positionThreshold) {
        return false;
      }
      if (Math.abs(particle.ty - particle.y) > positionThreshold) {
        return false;
      }
      if (Math.abs(particle.vx) > velocityThreshold || Math.abs(particle.vy) > velocityThreshold) {
        return false;
      }
    }
    return true;
  }

  getParticles() {
    return this.particles;
  }

  dispose() {
    if (this.points) {
      this.scene.remove(this.points);
      this.points = null;
    }
    this.geometry?.dispose();
    this.material?.dispose();
    this.renderer?.dispose();
    this.geometry = null;
  }
}
