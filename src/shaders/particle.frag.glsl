precision mediump float;

uniform vec3 u_color;
varying float v_depthAlpha;
varying float v_colorBias;
varying float v_type;

void main() {
  vec2 centered = gl_PointCoord - vec2(0.5);
  float distanceFromCenter = length(centered);

  if (distanceFromCenter > 0.5) {
    discard;
  }

  float softEdge = smoothstep(0.5, 0.0, distanceFromCenter);
  float densityVariation = 0.98 + abs(clamp(v_colorBias, -1.0, 1.0)) * 0.02;

  vec3 color = u_color;

  float alpha = softEdge * 1.35 * v_depthAlpha * densityVariation;
  if (v_type < 0.5) {
    color.rgb *= 1.08;
    alpha *= 1.08;
  }
  alpha = clamp(alpha, 0.0, 1.0);

  gl_FragColor = vec4(color, alpha);
}
