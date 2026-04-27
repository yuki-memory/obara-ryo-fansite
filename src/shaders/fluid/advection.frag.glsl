precision mediump float;

varying vec2 v_uv;

uniform sampler2D u_velocity;
uniform float u_dt;
uniform float u_dissipation;

vec2 decodeVelocity(vec4 color) {
  return color.xy * 2.0 - 1.0;
}

vec4 encodeVelocity(vec2 velocity) {
  return vec4(clamp(velocity * 0.5 + 0.5, 0.0, 1.0), 0.5, 1.0);
}

void main() {
  vec2 velocity = decodeVelocity(texture2D(u_velocity, v_uv));
  vec2 prevUv = clamp(v_uv - u_dt * velocity, 0.001, 0.999);
  vec2 advected = decodeVelocity(texture2D(u_velocity, prevUv)) * u_dissipation;
  gl_FragColor = encodeVelocity(advected);
}
