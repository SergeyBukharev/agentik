export type ShaderEffect = 'welcome' | 'pulse' | 'skeleton' | 'reveal' | 'ripple';
export type Point = {x: number; y: number};

const budgets = {welcome: 48_000, pulse: 86_000, skeleton: 48_000, reveal: 100_000, ripple: 65_000};
const sweepSlope = .30;
const softeningPx = 44;
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
uniform vec3 sweepWidths;
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
  float sweep = uv.x + (uv.y - .5) * ${sweepSlope} - mix(-.25, 1.25, time);
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
    float line = bell(sweep, sweepWidths.x) * .13 + bell(sweep + .18, sweepWidths.y) * .05;
    gl_FragColor = vec4(mix(mint, vec3(.93, 1., .83), bell(sweep, sweepWidths.z)), line * envelope);
  `,
  reveal: `
    float ripple = .02 * sin(uv.y * 36. + uv.x * 10.) + .013 * sin(uv.y * 81.);
    float edge = sweep + ripple;
    float veil = smoothstep(-.11 - sweepWidths.x, .09 + sweepWidths.x, edge) * (1. - smoothstep(.8, 1., time)) * .30;
    float shimmer = bell(edge, sweepWidths.y) * envelope;
    gl_FragColor = vec4(mix(background, lime, shimmer * .7), max(veil, shimmer * .17));
  `,
  ripple: `
    precision mediump float;
    varying vec2 uv;
    uniform sampler2D artwork;
    uniform vec2 origin, extent;
    uniform vec3 travel;
    uniform float strength, time;
    void main() {
      vec2 point = vec2(uv.x, 1. - uv.y) * extent;
      vec2 delta = point - origin;
      float distance = length(delta);
      // Reach distant artwork promptly, then slow down as the front crosses it.
      float approach = clamp(travel.x * .13, .001, .20);
      float progress = clamp((time - approach) / (1. - approach), 0., 1.);
      float radius = travel.x * smoothstep(0., approach, time)
        + (travel.y - travel.x) * progress * (2. - progress);
      float edge = clamp((distance - radius) / travel.z, -4., 4.);
      float fade = smoothstep(0., .14, time) * (1. - smoothstep(.46, 1., time));
      // A soft slope bends the samples in opposite directions across the crest.
      float bend = strength * fade * 2.33 * edge * exp(-edge * edge);
      vec2 samplePoint = point - delta * bend / max(distance, travel.z * .25);
      gl_FragColor = texture2D(artwork, samplePoint / extent);
    }
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

function measureRipple(canvas: HTMLCanvasElement, rect: DOMRect, image: HTMLImageElement, click: Point) {
  if (!image.complete || !image.naturalWidth) return;
  const style = getComputedStyle(canvas);
  const width = parseFloat(style.width);
  const height = parseFloat(style.height);
  const imageStyle = getComputedStyle(image);
  const imageWidth = parseFloat(imageStyle.width);
  const imageHeight = parseFloat(imageStyle.height);
  if (!width || !height || !imageWidth || !imageHeight) return;

  // The canvas rotates with the mark. Convert the viewport press back into its texture space.
  const transform = getComputedStyle(canvas.parentElement ?? canvas).transform;
  const matrix = new DOMMatrixReadOnly(transform === 'none' ? undefined : transform);
  const zoom = rect.width / (Math.abs(matrix.a) * width + Math.abs(matrix.c) * height);
  const delta = matrix.inverse().transformPoint({
    x: (click.x - rect.left - rect.width / 2) / zoom,
    y: (click.y - rect.top - rect.height / 2) / zoom,
    w: 0,
  });
  const near = Math.hypot(Math.max(0, Math.abs(delta.x) - imageWidth / 2), Math.max(0, Math.abs(delta.y) - imageHeight / 2));
  const far = Math.hypot(Math.abs(delta.x) + imageWidth / 2, Math.abs(delta.y) + imageHeight / 2);
  const band = Math.min(42, Math.max(20, imageWidth * .26));
  // Keep values small enough for mediump fragment shaders.
  const unit = Math.max(width, height);
  return {
    image, width, height, imageWidth, imageHeight, zoom,
    origin: [(width / 2 + delta.x) / unit, (height / 2 + delta.y) / unit] as const,
    extent: [width / unit, height / unit] as const,
    travel: [Math.max(0, near - band * .75) / unit, (far + band * .6) / unit, band / unit] as const,
    strength: Math.min(9, imageWidth * .055) / unit,
  };
}

function rippleTexture(ripple: NonNullable<ReturnType<typeof measureRipple>>, width: number, height: number) {
  const source = document.createElement('canvas');
  source.width = width;
  source.height = height;
  const ctx = source.getContext('2d');
  if (!ctx) return null;
  const imageWidth = ripple.imageWidth * width / ripple.width;
  const imageHeight = ripple.imageHeight * height / ripple.height;
  ctx.drawImage(ripple.image, (width - imageWidth) / 2, (height - imageHeight) / 2, imageWidth, imageHeight);
  return source;
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
  image?: HTMLImageElement | null;
}): (() => void) | undefined {
  if (webglUnavailable || typeof WebGLRenderingContext === 'undefined' || document.hidden) return;
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return;
  const {effect, origin, image} = options;
  const ripple = effect === 'ripple' && origin && image ? measureRipple(canvas, rect, image, origin) : undefined;
  if (effect === 'ripple' && !ripple) return;
  const displayWidth = ripple ? ripple.width * ripple.zoom : rect.width;
  const displayHeight = ripple ? ripple.height * ripple.zoom : rect.height;
  const maxRatio = ripple ? 1.65 : options.effect === 'welcome' ? 1.5 : 1.25;
  const scale = Math.min(devicePixelRatio || 1, maxRatio, Math.sqrt(budgets[effect] / (displayWidth * displayHeight)));
  canvas.width = Math.max(1, Math.floor(displayWidth * scale));
  canvas.height = Math.max(1, Math.floor(displayHeight * scale));
  const gl = canvas.getContext('webgl', {
    alpha: true, antialias: false, depth: !ripple, premultipliedAlpha: !!ripple, failIfMajorPerformanceCaveat: true,
  });
  if (!gl) {
    // Keep the CSS effects on systems where the browser declines hardware WebGL.
    webglUnavailable = true;
    canvas.width = 1;
    canvas.height = 1;
    return;
  }
  const source = ripple ? rippleTexture(ripple, canvas.width, canvas.height)
    : options.text ? glyphTexture(options.text, canvas.width, canvas.height, canvas.width / rect.width) : null;
  if ((effect === 'welcome' || effect === 'ripple') && !source) {
    canvas.width = 1;
    canvas.height = 1;
    return;
  }
  const v = compile(gl, gl.VERTEX_SHADER, vertex);
  const f = compile(gl, gl.FRAGMENT_SHADER, effect === 'ripple' ? fragments.ripple : `${fragmentHeader}${fragments[effect]}}`);
  const program = gl.createProgram();
  const buffer = gl.createBuffer();
  const texture = source ? gl.createTexture() : null;
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
    if (ripple) window.removeEventListener('resize', stop);
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

  if (!v || !f || !program || !buffer || (source && !texture)) {
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
  if (source && texture) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (ripple) gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } catch {
      stop();
      return;
    }
    if (ripple && gl.getError() !== gl.NO_ERROR) {
      stop();
      return;
    }
  }

  gl.viewport(0, 0, canvas.width, canvas.height);
  if (ripple) {
    gl.uniform2f(gl.getUniformLocation(program, 'origin'), ...ripple.origin);
    gl.uniform2f(gl.getUniformLocation(program, 'extent'), ...ripple.extent);
    gl.uniform3f(gl.getUniformLocation(program, 'travel'), ...ripple.travel);
    gl.uniform1f(gl.getUniformLocation(program, 'strength'), ripple.strength);
    window.addEventListener('resize', stop);
  }
  if (options.effect === 'skeleton' || options.effect === 'reveal') {
    // Convert the CSS radius to sweep coordinates without a second rendering pass.
    const width = canvas.clientWidth || rect.width;
    const height = canvas.clientHeight || rect.height;
    const radius = softeningPx * Math.hypot(1 / width, sweepSlope / height);
    const broaden = (width: number) => Math.hypot(width, Math.SQRT2 * radius);
    const widths = options.effect === 'skeleton'
      ? [broaden(.13), broaden(.24), broaden(.065)]
      : [radius, broaden(.065), 0];
    gl.uniform3f(gl.getUniformLocation(program, 'sweepWidths'), widths[0], widths[1], widths[2]);
  }
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
  function draw() {
    if (!gl || stopped) return;
    const elapsed = start === undefined ? 0 : performance.now() - start;
    if (elapsed >= options.duration) return stop();
    gl.uniform1f(time, elapsed / options.duration);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (start === undefined) {
      // Begin the visible duration after submitting the first frame.
      start = performance.now();
      if (effect === 'welcome') canvas.dataset.started = 'true';
      canvas.dataset.running = 'true';
    }
    frame = requestAnimationFrame(draw);
  }
  frame = requestAnimationFrame(draw);
  return stop;
}
