function applyTextureParams(gl, options) {
  const minFilter = options.minFilter ?? gl.NEAREST;
  const magFilter = options.magFilter ?? gl.NEAREST;
  const wrap = options.wrap ?? gl.CLAMP_TO_EDGE;

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
}

function framebufferStatusLabel(gl, status) {
  const labels = {
    [gl.FRAMEBUFFER_COMPLETE]: 'FRAMEBUFFER_COMPLETE',
    [gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT]: 'FRAMEBUFFER_INCOMPLETE_ATTACHMENT',
    [gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT]: 'FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT',
    [gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS]: 'FRAMEBUFFER_INCOMPLETE_DIMENSIONS',
    [gl.FRAMEBUFFER_UNSUPPORTED]: 'FRAMEBUFFER_UNSUPPORTED',
  };

  return labels[status] || `UNKNOWN_STATUS(${status})`;
}

export function createTextureFBO(gl, width, height, options = {}) {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error('[FBO] texture を作成できません。');
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);
  applyTextureParams(gl, options);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );

  const framebuffer = gl.createFramebuffer();
  if (!framebuffer) {
    gl.deleteTexture(texture);
    throw new Error('[FBO] framebuffer を作成できません。');
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0,
  );

  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.deleteFramebuffer(framebuffer);
    gl.deleteTexture(texture);
    throw new Error(
      `[FBO] framebuffer incomplete: ${framebufferStatusLabel(gl, status)} (${status}), size=${width}x${height}`,
    );
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);

  return {
    texture,
    framebuffer,
    width,
    height,
    options,
  };
}

export function createPingPongFBO(gl, width, height, options = {}) {
  const first = createTextureFBO(gl, width, height, options);
  const second = createTextureFBO(gl, width, height, options);

  return {
    read: first,
    write: second,
    swap() {
      const temp = this.read;
      this.read = this.write;
      this.write = temp;
    },
  };
}

export function destroyTextureFBO(gl, target) {
  if (!target) {
    return;
  }

  if (target.texture) {
    gl.deleteTexture(target.texture);
  }

  if (target.framebuffer) {
    gl.deleteFramebuffer(target.framebuffer);
  }
}

export function destroyPingPongFBO(gl, pingPong) {
  if (!pingPong) {
    return;
  }

  destroyTextureFBO(gl, pingPong.read);
  destroyTextureFBO(gl, pingPong.write);
}
