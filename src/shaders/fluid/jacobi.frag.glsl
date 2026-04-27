precision mediump float;

varying vec2 v_uv;

uniform sampler2D u_pressure;
uniform sampler2D u_divergence;
uniform vec2 u_texelSize;

float decodeScalar(vec4 color) {
  return color.x * 2.0 - 1.0;
}

vec4 encodeScalar(float value) {
  float encoded = clamp(value * 0.5 + 0.5, 0.0, 1.0);
  return vec4(encoded, 0.5, 0.5, 1.0);
}

void main() {
  float left = decodeScalar(texture2D(u_pressure, v_uv - vec2(u_texelSize.x, 0.0)));
  float right = decodeScalar(texture2D(u_pressure, v_uv + vec2(u_texelSize.x, 0.0)));
  float bottom = decodeScalar(texture2D(u_pressure, v_uv - vec2(0.0, u_texelSize.y)));
  float top = decodeScalar(texture2D(u_pressure, v_uv + vec2(0.0, u_texelSize.y)));
  float divergence = decodeScalar(texture2D(u_divergence, v_uv));

  float pressure = (left + right + bottom + top - divergence) * 0.25;
  gl_FragColor = encodeScalar(pressure);
}
