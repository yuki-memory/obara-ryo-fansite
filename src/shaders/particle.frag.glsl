precision mediump float;

uniform vec3 u_color;
varying float v_depthAlpha;
varying float v_colorBias;
varying float v_energy;

void main() {
  vec2 centered = gl_PointCoord - vec2(0.5);
  float distanceFromCenter = length(centered);

  if (distanceFromCenter > 0.5) {
    discard;
  }

  float softEdge = smoothstep(0.5, 0.08, distanceFromCenter);
  float energy = clamp(v_energy, 0.0, 1.0);
  float densityVariation = 0.98 + abs(clamp(v_colorBias, -1.0, 1.0)) * 0.02;

  vec3 color = u_color;

  float alpha = softEdge * (1.08 + energy * 0.08) * v_depthAlpha * densityVariation;
  alpha = clamp(alpha, 0.0, 1.0);

  gl_FragColor = vec4(color, alpha);
}
