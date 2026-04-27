precision mediump float;

varying vec2 v_uv;

uniform sampler2D u_velocity;
uniform sampler2D u_pressure;
uniform vec2 u_texelSize;

vec2 decodeVelocity(vec4 color) {
  return color.xy * 2.0 - 1.0;
}

float decodeScalar(vec4 color) {
  return color.x * 2.0 - 1.0;
}

vec4 encodeVelocity(vec2 velocity) {
  return vec4(clamp(velocity * 0.5 + 0.5, 0.0, 1.0), 0.5, 1.0);
}

void main() {
  float left = decodeScalar(texture2D(u_pressure, v_uv - vec2(u_texelSize.x, 0.0)));
  float right = decodeScalar(texture2D(u_pressure, v_uv + vec2(u_texelSize.x, 0.0)));
  float bottom = decodeScalar(texture2D(u_pressure, v_uv - vec2(0.0, u_texelSize.y)));
  float top = decodeScalar(texture2D(u_pressure, v_uv + vec2(0.0, u_texelSize.y)));

  vec2 velocity = decodeVelocity(texture2D(u_velocity, v_uv));
  velocity -= 0.5 * vec2(right - left, top - bottom);

  gl_FragColor = encodeVelocity(velocity);
}
