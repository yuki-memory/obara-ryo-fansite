attribute vec2 a_position;
attribute float a_size;
attribute float a_depth;
attribute float a_colorBias;
attribute float a_energy;

uniform vec2 u_resolution;
varying float v_depthAlpha;
varying float v_depthTint;
varying float v_colorBias;
varying float v_energy;

void main() {
  vec2 zeroToOne = a_position / u_resolution;
  vec2 clipSpace = zeroToOne * 2.0 - 1.0;
  float depth01 = clamp((a_depth + 1.0) * 0.5, 0.0, 1.0);
  float perspectiveScale = clamp(0.82 + depth01 * 0.54, 0.74, 1.36);

  gl_Position = vec4(clipSpace * vec2(1.0, -1.0), a_depth * 0.06, 1.0);
  gl_PointSize = a_size * perspectiveScale;
  v_depthAlpha = mix(0.95, 1.12, depth01);
  v_depthTint = mix(0.92, 1.1, depth01);
  v_colorBias = a_colorBias;
  v_energy = a_energy;
}
