export const threeParticleVertexShader = `
attribute vec2 targetPosition;
attribute float particleRandom;
attribute float particleSize;
attribute float particleType;
attribute float particleEnergy;

uniform vec2 uResolution;
uniform float uPixelRatio;
uniform float uTime;

varying float vRandom;
varying float vType;
varying float vEnergy;

void main() {
  vec2 zeroToOne = position.xy / uResolution;
  vec2 clip = zeroToOne * 2.0 - 1.0;
  float returnDistance = length(targetPosition - position.xy);
  float shimmer = sin(uTime * 2.2 + particleRandom * 6.28318) * 0.08;
  float energyBoost = particleEnergy * 0.42 + smoothstep(0.0, 42.0, returnDistance) * 0.05;

  gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
  gl_PointSize = particleSize * uPixelRatio * (1.0 + shimmer + energyBoost);

  vRandom = particleRandom;
  vType = particleType;
  vEnergy = particleEnergy;
}
`;

export const threeParticleFragmentShader = `
precision mediump float;

uniform vec3 uColor;
uniform float uOpacity;

varying float vRandom;
varying float vType;
varying float vEnergy;

void main() {
  vec2 centered = gl_PointCoord - vec2(0.5);
  float dist = length(centered);

  if (dist > 0.5) {
    discard;
  }

  float core = 1.0 - smoothstep(0.0, 0.32, dist);
  float edge = 1.0 - smoothstep(0.34, 0.5, dist);
  float sparkle = 0.92 + sin(vRandom * 19.91) * 0.08;
  float typeLift = vType < 0.5 ? 1.08 : 1.0;
  float alpha = clamp((edge * 0.92 + core * 0.28) * uOpacity * typeLift, 0.0, 1.0);

  vec3 highlightColor = vec3(1.0, 0.54, 0.84);
  vec3 color = mix(uColor, highlightColor, core * 0.18 + vEnergy * 0.1);
  color *= sparkle;

  gl_FragColor = vec4(color, alpha);
}
`;
