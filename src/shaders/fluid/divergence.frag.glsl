precision mediump float;

varying vec2 v_uv;

uniform sampler2D u_velocity;
uniform vec2 u_texelSize;

vec2 decodeVelocity(vec4 color) {
  return color.xy * 2.0 - 1.0;
}

vec4 encodeScalar(float value) {
  float encoded = clamp(value * 0.5 + 0.5, 0.0, 1.0);
  return vec4(encoded, 0.5, 0.5, 1.0);
}

void main() {
  float left = decodeVelocity(texture2D(u_velocity, v_uv - vec2(u_texelSize.x, 0.0))).x;
  float right = decodeVelocity(texture2D(u_velocity, v_uv + vec2(u_texelSize.x, 0.0))).x;
  float bottom = decodeVelocity(texture2D(u_velocity, v_uv - vec2(0.0, u_texelSize.y))).y;
  float top = decodeVelocity(texture2D(u_velocity, v_uv + vec2(0.0, u_texelSize.y))).y;

  float divergence = 0.5 * ((right - left) + (top - bottom));
  gl_FragColor = encodeScalar(divergence);
}
