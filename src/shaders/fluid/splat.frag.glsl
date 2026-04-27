precision mediump float;

varying vec2 v_uv;

uniform sampler2D u_target;
uniform vec2 u_point;
uniform vec2 u_force;
uniform float u_radius;
uniform float u_aspectRatio;

vec2 decodeVelocity(vec4 color) {
  return color.xy * 2.0 - 1.0;
}

vec4 encodeVelocity(vec2 velocity) {
  return vec4(clamp(velocity * 0.5 + 0.5, 0.0, 1.0), 0.5, 1.0);
}

void main() {
  vec2 base = decodeVelocity(texture2D(u_target, v_uv));

  vec2 delta = v_uv - u_point;
  delta.x *= u_aspectRatio;

  float falloff = exp(-dot(delta, delta) / max(0.000001, u_radius));
  vec2 velocity = base + u_force * falloff;

  gl_FragColor = encodeVelocity(velocity);
}
