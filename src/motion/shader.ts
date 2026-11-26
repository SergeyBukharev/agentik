export type ShaderEffect = 'welcome' | 'pulse' | 'skeleton' | 'reveal' | 'pro';
export type Point = {x: number; y: number};

const budgets = {welcome: 48_000, pulse: 86_000, skeleton: 48_000, reveal: 100_000, pro: 18_000} satisfies Record<ShaderEffect, number>;
let webglUnavailable = false;

const vertex = `
attribute vec2 position;
varying vec2 uv;
void main() {
  uv = position * .5 + .5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const fragmentHeader = `
precision mediump float;
varying vec2 uv;
uniform vec2 origin;
uniform vec3 background, foreground, accent;
uniform float time;
uniform sampler2D glyphs;

float bell(float n, float width) {
  float x = n / width;
  return exp(-x * x);
}

void main() {
  vec3 lime = vec3(.79, .96, .42);
  vec3 mint = vec3(.54, .88, .77);
  float envelope = smoothstep(0., .14, time) * (1. - smoothstep(.67, 1., time));
  float sweep = uv.x + (uv.y - .5) * .30 - mix(-.25, 1.25, time);
`;

// Each canvas only compiles the effect it draws. No per-pixel effect branch.
const fragments: Record<ShaderEffect, string> = {
  welcome: `
    float column = floor(uv.x * 21.) / 21.;
    float reveal = clamp((time - .35 * column) / .61, 0., 1.);
    float rest = 1. - reveal;
    float spring = .19 * rest * rest * rest - .08 * sin(reveal * 9.) * exp(-4. * reveal);
    float mask = texture2D(glyphs, vec2(uv.x, 1. - uv.y - spring)).a;
    float lit = bell(sweep + .035 * sin(uv.y * 22.), .13) * envelope;
    vec3 tint = mix(mint, lime, .5 + .5 * sin(uv.y * 4. + time * 5.));
    gl_FragColor = vec4(mix(foreground, tint, lit * .78), mask * smoothstep(0., .38, reveal));
  `,
  pulse: `
    float expand = time * (2. - time);
    vec2 center = origin + vec2(-.19, .16) * expand;
    vec2 delta = uv - center;
    float radius = mix(.15, .72, expand);
    float glow = 1. - smoothstep(0., radius * radius, dot(delta, delta));
    vec2 edge = min(uv, 1. - uv);
    float feather = smoothstep(0., .22, min(edge.x, edge.y));
    float fade = smoothstep(0., .23, time) * (1. - smoothstep(.34, 1., time));
    vec3 tint = mix(accent, mint, smoothstep(.26, .78, uv.y) * .48);
    gl_FragColor = vec4(tint, glow * feather * fade * .34);
  `,
  skeleton: `
    float line = bell(sweep, .13) * .30 + bell(sweep + .18, .24) * .12;
    gl_FragColor = vec4(mix(mint, vec3(.93, 1., .83), bell(sweep, .065)), line * envelope);
  `,
  pro: `
    float arc = uv.y - sin(uv.x * 4.6 - time * 3.) * .29 - mix(-.25, 1.25, time);
    float glimmer = bell(arc, .31) * envelope;
    gl_FragColor = vec4(mix(mint, lime, smoothstep(.08, .96, uv.x)), glimmer * .41);
  `,
  reveal: `
    float ripple = .02 * sin(uv.y * 36. + uv.x * 10.) + .013 * sin(uv.y * 81.);
    float edge = sweep + ripple;
    float veil = smoothstep(-.11, .09, edge) * (1. - smoothstep(.8, 1., time)) * .91;
    float shimmer = bell(edge, .065) * envelope;
    gl_FragColor = vec4(mix(background, lime, shimmer * .7), max(veil, shimmer * .38));
  `,
};

function compile(gl: WebGLRenderingContext, kind: number, source: string) {
  const shader = gl.createShader(kind);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

function glyphTexture(text: HTMLElement, width: number, height: number, scale: number) {
  const mask = document.createElement('canvas');
  mask.width = width;
  mask.height = height;
  const ctx = mask.getContext('2d');
  if (!ctx) return null;
  const style = getComputedStyle(text);
  ctx.font = `${style.fontWeight} ${parseFloat(style.fontSize) * scale}px ${style.fontFamily}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${(parseFloat(style.letterSpacing) || 0) * scale}px`;
  const content = text.textContent ?? '';
  if (ctx.measureText(content).width > width + 2) return null;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.fillText(content, width / 2, height / 2 + scale);
  return mask;
}

function paletteColor(style: CSSStyleDeclaration, property: string, fallback: [number, number, number]): [number, number, number] {
  const color = style.getPropertyValue(property).trim();
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return fallback;
  return [0, 2, 4].map(start => parseInt(match[1].slice(start, start + 2), 16) / 255) as [number, number, number];
}

export function playShader(canvas: HTMLCanvasElement, options: {
  effect: ShaderEffect;
  duration: number;
  origin?: Point;
  text?: HTMLElement | null;
}): (() => void) | undefined {
  if (webglUnavailable || typeof WebGLRenderingContext === 'undefined' || document.hidden) return;
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return;
  const scale = Math.min(devicePixelRatio || 1, options.effect === 'welcome' ? 1.5 : 1.25,
    Math.sqrt(budgets[options.effect] / (rect.width * rect.height)));
  canvas.width = Math.max(1, Math.floor(rect.width * scale));
  canvas.height = Math.max(1, Math.floor(rect.height * scale));
  const gl = canvas.getContext('webgl', {alpha: true, antialias: false, premultipliedAlpha: false, failIfMajorPerformanceCaveat: true});
  if (!gl) {
    // Keep the CSS effects on systems where the browser declines hardware WebGL.
    webglUnavailable = true;
    return;
  }
  const glyphs = options.text ? glyphTexture(options.text, canvas.width, canvas.height, canvas.width / rect.width) : null;
  if (options.effect === 'welcome' && !glyphs) {
    canvas.width = 1;
    canvas.height = 1;
    return;
  }
  const v = compile(gl, gl.VERTEX_SHADER, vertex);
  const f = compile(gl, gl.FRAGMENT_SHADER, `${fragmentHeader}${fragments[options.effect]}}`);
  const program = gl.createProgram();
  const buffer = gl.createBuffer();
  const texture = glyphs ? gl.createTexture() : null;
  let frame = 0;
  let stopped = false;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');

  function stop() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    document.removeEventListener('visibilitychange', stopWhenHidden);
    preference.removeEventListener('change', stopWhenReduced);
    canvas.removeEventListener('webglcontextlost', stop);
    if (gl && !gl.isContextLost()) {
      gl.deleteShader(v);
      gl.deleteShader(f);
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
      if (texture) gl.deleteTexture(texture);
    }
    delete canvas.dataset.running;
    // Keep a hidden canvas cheap even while its parent stays mounted (welcome and PRO).
    canvas.width = 1;
    canvas.height = 1;
  }

  function stopWhenHidden() { if (document.hidden) stop(); }
  function stopWhenReduced() { if (preference.matches) stop(); }

  if (!v || !f || !program || !buffer || (glyphs && !texture)) {
    stop();
    return;
  }
  gl.attachShader(program, v);
  gl.attachShader(program, f);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    stop();
    return;
  }
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  if (glyphs && texture) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, glyphs);
  }

  gl.viewport(0, 0, canvas.width, canvas.height);
  if (options.effect === 'pulse' && options.origin) {
    gl.uniform2f(gl.getUniformLocation(program, 'origin'),
      (options.origin.x - rect.left) / rect.width, 1 - (options.origin.y - rect.top) / rect.height);
    gl.uniform3f(gl.getUniformLocation(program, 'accent'), ...paletteColor(getComputedStyle(canvas), '--lime', [.79, .96, .42]));
  } else if (options.effect === 'reveal') {
    gl.uniform3f(gl.getUniformLocation(program, 'background'), ...paletteColor(getComputedStyle(canvas), '--shader-surface', [.95, .96, .92]));
  } else if (options.effect === 'welcome') {
    gl.uniform3f(gl.getUniformLocation(program, 'foreground'), ...paletteColor(getComputedStyle(canvas), '--ink', [.14, .16, .13]));
  }
  const time = gl.getUniformLocation(program, 'time');
  let start: number | undefined;
  document.addEventListener('visibilitychange', stopWhenHidden);
  preference.addEventListener('change', stopWhenReduced);
  canvas.addEventListener('webglcontextlost', stop);
  function draw(now: number) {
    if (!gl || stopped) return;
    if (start === undefined) {
      start = now;
      if (options.effect === 'welcome') canvas.dataset.started = 'true';
      canvas.dataset.running = 'true';
    }
    if (now - start >= options.duration) return stop();
    gl.uniform1f(time, Math.min(1, (now - start) / options.duration));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    frame = requestAnimationFrame(draw);
  }
  frame = requestAnimationFrame(draw);
  return stop;
}
